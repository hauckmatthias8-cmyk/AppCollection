#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "Crossword" / "data"
CATALOG = DATA / "crossword_catalog.tsv"
SOLUTIONS = DATA / "solution_words.txt"
SOURCES = DATA / "sources.json"

EXPECTED_ROWS = 7367
EXPECTED_UNIQUE_ANSWERS = 5398
EXPECTED_SOURCE = "user:cwr"
EXPECTED_VERSION = 8

REPL = {
    "Ä":"AE","Ö":"OE","Ü":"UE","ẞ":"SS","ß":"SS",
    "ä":"AE","ö":"OE","ü":"UE",
}

def norm(value: str) -> str:
    value = "".join(REPL.get(c, c) for c in str(value)).upper()
    value = "".join(
        c for c in unicodedata.normalize("NFD", value)
        if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^A-Z]", "", value)

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--sample", type=int, default=0)
    args = ap.parse_args()

    with CATALOG.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))

    required = {"answer","clue","category","language","difficulty","source"}
    errors = []
    if not rows:
        errors.append("Katalog ist leer.")
    elif not required.issubset(rows[0]):
        errors.append("Katalogspalten fehlen.")

    pairs = set()
    answers = set()
    cats = Counter()
    two_letter = 0

    for line_no, row in enumerate(rows, start=2):
        answer = norm(row.get("answer", ""))
        clue = " ".join((row.get("clue") or "").split())
        category = (row.get("category") or "").strip()
        source = (row.get("source") or "").strip()
        language = (row.get("language") or "").strip()

        if not 2 <= len(answer) <= 30:
            errors.append(f"Zeile {line_no}: Antwortlänge ungültig: {answer}")
        if len(answer) == 2:
            two_letter += 1
        if not 3 <= len(clue) <= 150:
            errors.append(f"Zeile {line_no}: Hinweislänge ungültig: {clue!r}")
        if category != "klassisch":
            errors.append(f"Zeile {line_no}: unerwartete Kategorie: {category!r}")
        if source != EXPECTED_SOURCE:
            errors.append(f"Zeile {line_no}: unerwartete Quelle: {source!r}")
        if language != "de":
            errors.append(f"Zeile {line_no}: Sprache ist nicht de.")

        key = (answer, clue.casefold())
        if key in pairs:
            errors.append(f"Zeile {line_no}: exakte Frage/Antwort-Dublette.")
        pairs.add(key)
        answers.add(answer)
        cats[category] += 1

    if len(rows) != EXPECTED_ROWS:
        errors.append(f"Katalog muss {EXPECTED_ROWS} Zeilen enthalten, hat aber {len(rows)}.")
    if len(answers) != EXPECTED_UNIQUE_ANSWERS:
        errors.append(
            f"Katalog muss {EXPECTED_UNIQUE_ANSWERS} unterschiedliche Lösungen enthalten, "
            f"hat aber {len(answers)}."
        )
    if cats != Counter({"klassisch": EXPECTED_ROWS}):
        errors.append(f"Unerwartete Kategorienverteilung: {dict(cats)}")
    if two_letter != 443:
        errors.append(f"Erwartet 443 Zwei-Buchstaben-Einträge, gefunden: {two_letter}.")

    solution_words = [
        norm(x) for x in SOLUTIONS.read_text(encoding="utf-8").splitlines()
        if norm(x)
    ]
    if len(solution_words) < 200:
        errors.append(f"Zu wenige Lösungswörter: {len(solution_words)} (<200).")
    if len(solution_words) != len(set(solution_words)):
        errors.append("Lösungswortliste enthält Dubletten.")
    if any(not 10 <= len(x) <= 20 for x in solution_words):
        errors.append("Lösungswort außerhalb 10–20 Buchstaben.")

    meta = json.loads(SOURCES.read_text(encoding="utf-8"))
    if int(meta.get("catalog_version", 0)) != EXPECTED_VERSION:
        errors.append(f"sources.json: catalog_version muss {EXPECTED_VERSION} sein.")
    source_ids = {
        (x.get("id") or "") for x in meta.get("sources", [])
        if x.get("active", True)
    }
    if source_ids != {EXPECTED_SOURCE}:
        errors.append(f"sources.json: unerwartete aktive Quellen: {sorted(source_ids)}")

    if errors:
        for error in errors[:100]:
            print("FEHLER:", error)
        print(f"Katalogprüfung FEHLGESCHLAGEN: {len(errors)} Fehler.")
        return 1

    print(
        f"Katalogprüfung OK: {len(rows)} Fragen, {len(answers)} verschiedene Lösungen, "
        f"{two_letter} Zwei-Buchstaben-Einträge, {len(solution_words)} Lösungswörter."
    )

    if args.sample:
        import random
        rng = random.Random(20260927)
        for row in rng.sample(rows, min(args.sample, len(rows))):
            print(f"{row['clue']} -> {row['answer']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
