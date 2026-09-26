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
    ap.add_argument("--check", action="store_true", help="Kompatibilitätsoption für Release-Skripte.")
    ap.add_argument("--sample", type=int, default=0)
    args = ap.parse_args()

    with CATALOG.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))

    required = {"answer","clue","category","language","difficulty","source"}
    if not rows:
        print("FEHLER: Katalog ist leer.")
        return 1
    if not required.issubset(rows[0]):
        print("FEHLER: Katalogspalten fehlen.")
        return 1

    errors = []
    pairs = set()
    answers = set()
    cats = Counter()

    for line_no, row in enumerate(rows, start=2):
        answer = norm(row.get("answer", ""))
        clue = " ".join((row.get("clue") or "").split())
        category = (row.get("category") or "").strip()
        source = (row.get("source") or "").strip()

        if not 3 <= len(answer) <= 30:
            errors.append(f"Zeile {line_no}: Antwortlänge ungültig: {answer}")
        if not 4 <= len(clue) <= 150:
            errors.append(f"Zeile {line_no}: Hinweislänge ungültig.")
        if not category:
            errors.append(f"Zeile {line_no}: Kategorie fehlt.")
        if not source:
            errors.append(f"Zeile {line_no}: Quelle fehlt.")

        key = (answer, clue.casefold())
        if key in pairs:
            errors.append(f"Zeile {line_no}: exakte Frage/Antwort-Dublette.")
        pairs.add(key)
        answers.add(answer)
        cats[category] += 1

    if len(rows) != 30000:
        errors.append(f"Katalog muss exakt 30.000 Zeilen enthalten, hat aber {len(rows)}.")
    if len(answers) != 30000:
        errors.append(f"Katalog muss 30.000 global eindeutige Lösungen enthalten, hat aber {len(answers)}.")
    if len(cats) != 30:
        errors.append(f"Katalog muss exakt 30 Kategorien enthalten, hat aber {len(cats)}.")
    for category, count in sorted(cats.items()):
        if count != 1000:
            errors.append(f"Kategorie {category}: {count} statt 1.000 Antworten.")

    forbidden_sources = ("openthesaurus", "wikidata")
    for row in rows:
        source = (row.get("source") or "").casefold()
        if any(x in source for x in forbidden_sources):
            errors.append(f"Verworfene Katalogquelle gefunden: {source}")
            break

    solution_words = [norm(x) for x in SOLUTIONS.read_text(encoding="utf-8").splitlines() if norm(x)]
    if len(solution_words) < 200:
        errors.append(f"Zu wenige Lösungswörter: {len(solution_words)} (<200).")
    if len(solution_words) != len(set(solution_words)):
        errors.append("Lösungswortliste enthält Dubletten.")
    if any(not 10 <= len(x) <= 20 for x in solution_words):
        errors.append("Lösungswort außerhalb 10–20 Buchstaben.")

    meta = json.loads(SOURCES.read_text(encoding="utf-8"))
    if int(meta.get("catalog_version", 0)) != 5:
        errors.append("sources.json: catalog_version muss 5 sein.")

    if errors:
        for error in errors[:100]:
            print("FEHLER:", error)
        print(f"Katalogprüfung FEHLGESCHLAGEN: {len(errors)} Fehler.")
        return 1

    print(
        f"Katalogprüfung OK: {len(rows)} Fragen, {len(answers)} verschiedene Lösungen, "
        f"{len(cats)} Kategorien × 1.000, {len(solution_words)} Lösungswörter."
    )

    if args.sample:
        import random
        rng = random.Random(20260927)
        for row in rng.sample(rows, min(args.sample, len(rows))):
            print(f"[{row['category']}] {row['clue']} -> {row['answer']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
