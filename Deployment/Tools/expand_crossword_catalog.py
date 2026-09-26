#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, hashlib, itertools, json, re, unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'Crossword/data'
CAT=DATA/'crossword_catalog.tsv'
GROUPS=DATA/'openthesaurus_groups.txt'
SOL=DATA/'solution_words.txt'
STATS=DATA/'catalog_stats.json'
TARGET_SYNONYM_ROWS=119_000

REPL={'Ä':'AE','Ö':'OE','Ü':'UE','ẞ':'SS','ß':'SS','ä':'AE','ö':'OE','ü':'UE'}
def norm_answer(s:str)->str:
    s=''.join(REPL.get(c,c) for c in str(s)).upper()
    s=''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
    return re.sub(r'[^A-Z]','',s)

def norm_clue(s:str)->str:
    s=unicodedata.normalize('NFC',str(s)).replace('“','"').replace('”','"').replace('„','"')
    return ' '.join(s.split()).casefold()

def load_existing():
    with CAT.open(encoding='utf-8',newline='') as f:
        return list(csv.DictReader(f,delimiter='\t'))

def load_groups():
    groups=[]
    for line in GROUPS.read_text(encoding='utf-8').splitlines():
        seen=set(); group=[]
        for raw in line.split(';'):
            word=' '.join(raw.split()).strip()
            key=norm_answer(word)
            if not key or key in seen: continue
            seen.add(key); group.append(word)
        if len(group)>=2: groups.append(group)
    return groups

def difficulty(word:str)->int:
    n=len(norm_answer(word))
    if n<=6:return 1
    if n<=10:return 2
    if n<=15:return 3
    return 4

def row(answer,clue,source):
    return {
        'answer':answer,'clue':clue,'category':'synonym','language':'de',
        'difficulty':str(difficulty(answer)),'source':source
    }

def dedupe(rows):
    out=[]; seen=set(); removed=0
    for r in rows:
        answer=norm_answer(r.get('answer',''))
        clue=' '.join(str(r.get('clue','')).split())
        if not 3<=len(answer)<=30 or not clue:
            removed+=1; continue
        key=(answer,norm_clue(clue))
        if key in seen:
            removed+=1; continue
        seen.add(key)
        out.append({
            'answer':answer,'clue':clue,
            'category':r.get('category') or 'allgemein',
            'language':r.get('language') or 'de',
            'difficulty':str(max(1,min(5,int(r.get('difficulty') or 2)))),
            'source':r.get('source') or ''
        })
    return out,removed

def generate_synonym_rows(groups):
    # 1) One simple clue for every unique directed synonym relation.
    pair_seen=set(); pair_duplicates=0; simple=[]
    for group in groups:
        for source in group:
            sn=norm_answer(source)
            for answer in group:
                an=norm_answer(answer)
                if not sn or not an or sn==an: continue
                pair=(sn,an)
                if pair in pair_seen:
                    pair_duplicates+=1; continue
                pair_seen.add(pair)
                simple.append(row(answer,f'Synonym für „{source}“','openthesaurus:2015-03-23'))

    # 2) Fill the target with distinct two-hint crossword clues, not three
    # paraphrases of the same relation. Example: "Synonym zu X und Y".
    # This gives genuinely distinct clue/answer pairs while remaining grounded
    # entirely in one OpenThesaurus synonym group.
    multi_seen=set(); multi=[]
    for group in groups:
        for answer in group:
            an=norm_answer(answer)
            others=[x for x in group if norm_answer(x)!=an]
            for a,b in itertools.combinations(others,2):
                na,nb=norm_answer(a),norm_answer(b)
                if not na or not nb or na==nb: continue
                first,second=(a,b) if na<nb else (b,a)
                key=(an,min(na,nb),max(na,nb))
                if key in multi_seen: continue
                multi_seen.add(key)
                digest=hashlib.sha1('|'.join(key).encode('utf-8')).digest()
                multi.append((digest,row(answer,f'Synonym zu „{first}“ und „{second}“','openthesaurus:2015-03-23')))
    multi.sort(key=lambda x:x[0])
    need=max(0,TARGET_SYNONYM_ROWS-len(simple))
    selected_multi=[r for _,r in multi[:need]]
    return simple+selected_multi,{
        'directed_synonym_pairs_before_pair_dedupe':sum(len(g)*(len(g)-1) for g in groups),
        'directed_pair_duplicates_removed':pair_duplicates,
        'unique_directed_synonym_pairs':len(pair_seen),
        'single_hint_synonym_rows':len(simple),
        'available_unique_two_hint_rows':len(multi),
        'selected_two_hint_rows':len(selected_multi),
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--check',action='store_true')
    args=ap.parse_args()

    existing=load_existing()
    # Preserve hand-written/factual rows. Generated OpenThesaurus rows are always rebuilt.
    starter=[r for r in existing if not str(r.get('source','')).startswith('openthesaurus:')]
    groups=load_groups()
    synonym_rows,syn_stats=generate_synonym_rows(groups)
    candidates=starter+synonym_rows
    final,exact_removed=dedupe(candidates)

    solutions=[]; sol_seen=set()
    for raw in SOL.read_text(encoding='utf-8').splitlines():
        w=norm_answer(raw)
        if 10<=len(w)<=20 and w not in sol_seen:
            sol_seen.add(w);solutions.append(w)
    for group in groups:
        for raw in group:
            if not re.fullmatch(r'[A-Za-zÄÖÜäöüßÉéÀàÁáÈèÍíÓóÚúÇçŒœÆæ]+',raw): continue
            w=norm_answer(raw)
            if 10<=len(w)<=20 and w not in sol_seen:
                sol_seen.add(w);solutions.append(w)

    stats={
        'catalog_version':2,
        'starter_entries':len(starter),
        'openthesaurus_groups':len(groups),
        **syn_stats,
        'generated_synonym_candidates':len(synonym_rows),
        'all_candidates_before_final_dedupe':len(candidates),
        'final_duplicate_or_invalid_rows_removed':exact_removed,
        'final_entries':len(final),
        'solution_words_final':len(solutions),
        'source_snapshot':'OpenThesaurus text snapshot generated 2015-03-23 (public mirror); original source openthesaurus.de',
    }
    if not 100000<=len(final)<=150000:
        raise SystemExit(f'Zielbereich verletzt: {len(final)} Einträge')

    if args.check:
        raw_current=load_existing()
        current,current_removed=dedupe(raw_current)
        if current_removed:
            raise SystemExit(f'Katalog enthält noch {current_removed} doppelte/ungültige Zeilen.')
        if current!=final:
            raise SystemExit('crossword_catalog.tsv ist nicht reproduzierbar aktuell.')
        current_sol=[norm_answer(x) for x in SOL.read_text(encoding='utf-8').splitlines() if norm_answer(x)]
        if current_sol!=solutions:
            raise SystemExit('solution_words.txt ist nicht reproduzierbar aktuell.')
        if not STATS.exists() or json.loads(STATS.read_text(encoding='utf-8'))!=stats:
            raise SystemExit('catalog_stats.json ist nicht aktuell.')
        print(f'Katalog-Expansion OK: {len(final)} eindeutige Frage-Antwort-Paare, 0 verbleibende Duplikate, {len(solutions)} Lösungswörter.')
        return 0

    with CAT.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['answer','clue','category','language','difficulty','source'],delimiter='\t',lineterminator='\n')
        w.writeheader();w.writerows(final)
    SOL.write_text('\n'.join(solutions)+'\n',encoding='utf-8')
    STATS.write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(stats,ensure_ascii=False,indent=2))
    return 0

if __name__=='__main__':
    raise SystemExit(main())
