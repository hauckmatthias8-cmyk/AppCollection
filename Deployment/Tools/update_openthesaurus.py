#!/usr/bin/env python3
"""Manual data-maintenance helper; never called by normal release/deploy."""
from __future__ import annotations
import io, json, re, sys, unicodedata, urllib.request, zipfile
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'Crossword/data/openthesaurus_groups.txt'
SOURCES=ROOT/'Crossword/data/sources.json'
URL='https://www.openthesaurus.de/export/OpenThesaurus-Textversion.zip'
TARGET_RELATIONS=40_000
BAD=re.compile(r'\((?:ugs\.|derb|vulg\.|vulgär|regional|schweiz\.|österr\.|bair\.|veraltet|altertüm|scherzhaft|ironisch|jugendsprach|ostdeutsch|Jargon|werbesprachlich)[^)]*\)',re.I)
WORD=re.compile(r'^[A-Za-zÄÖÜäöüßÉéÀàÁáÈèÍíÓóÚúÇçŒœÆæ-]{3,24}$')
REPL={'Ä':'AE','Ö':'OE','Ü':'UE','ẞ':'SS','ß':'SS','ä':'AE','ö':'OE','ü':'UE'}

def norm(s):
    s=''.join(REPL.get(c,c) for c in s).upper()
    s=''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
    return re.sub('[^A-Z]','',s)

def clean_term(s):
    return re.sub(r'\s+',' ',re.sub(r'\s*\([^)]*\)\s*',' ',s)).strip()

def main():
    req=urllib.request.Request(URL,headers={'User-Agent':'Hauckis-App-Sammlung data updater (hauckmatthias8@gmail.com)'})
    with urllib.request.urlopen(req,timeout=60) as resp:
        blob=resp.read(); last_modified=resp.headers.get('Last-Modified','')
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        names=[n for n in z.namelist() if n.lower().endswith(('.txt','.dat'))]
        if not names: raise SystemExit('Im ZIP wurde keine Textdatei gefunden.')
        raw=z.read(names[0]).decode('utf-8-sig',errors='replace')

    groups=[]
    for line in raw.splitlines():
        line=line.strip()
        if not line or line.startswith('#') or BAD.search(line): continue
        words=[]; seen=set()
        for part in line.split(';'):
            w=clean_term(part)
            if not WORD.fullmatch(w): continue
            k=norm(w)
            if not k or k in seen: continue
            seen.add(k);words.append(w)
        if 5<=len(words)<=18:
            pairs=len(words)*(len(words)-1)
            chars=max(1,len(';'.join(words)))
            groups.append((pairs/chars,pairs,words))

    groups.sort(key=lambda x:(-x[0],-x[1],';'.join(x[2]).casefold()))
    selected=[];pairs=0
    for _,n,g in groups:
        if pairs>=TARGET_RELATIONS: break
        selected.append(g);pairs+=n
    if pairs<TARGET_RELATIONS: raise SystemExit(f'Nur {pairs} Beziehungen gefunden; Auswahlziel nicht erreicht.')
    OUT.write_text('\n'.join(';'.join(g) for g in selected)+'\n',encoding='utf-8')

    meta=json.loads(SOURCES.read_text(encoding='utf-8'))
    stamp='latest'
    if last_modified:
        try: stamp=parsedate_to_datetime(last_modified).date().isoformat()
        except Exception: stamp=last_modified
    for src in meta.get('sources',[]):
        if src.get('id')=='openthesaurus':
            src['snapshot']=stamp
            src['description']='Aktive Ausbauquelle für Synonymfragen; manuell aus dem offiziellen OpenThesaurus-Textdownload aktualisiert.'
    SOURCES.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'OpenThesaurus aktualisiert: {len(selected)} Gruppen, {pairs} gerichtete Beziehungen, Snapshot {stamp}.')
    print('Danach ausführen: python Deployment/Tools/expand_crossword_catalog.py && python Deployment/Tools/build_crossword_data.py')

if __name__=='__main__':
    raise SystemExit(main())
