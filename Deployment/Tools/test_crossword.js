const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const Core=require(path.join(ROOT,'Shared/www/crossword-core.js'));

function parseTsv(file){
  const lines=fs.readFileSync(file,'utf8').trim().split(/\r?\n/);
  const head=lines.shift().split('\t');
  return lines.map(line=>{
    const cells=line.split('\t');
    const obj={};head.forEach((h,i)=>obj[h]=cells[i]||'');
    return {a:obj.answer,q:obj.clue,c:obj.category,l:obj.language,d:Number(obj.difficulty||2),s:obj.source};
  });
}
const entries=parseTsv(path.join(ROOT,'Crossword/data/crossword_catalog.tsv'));
const solutions=fs.readFileSync(path.join(ROOT,'Crossword/data/solution_words.txt'),'utf8').split(/\r?\n/).filter(Boolean);
if(!entries.some(e=>Core.normalizeAnswer(e.a).length===2)) throw new Error('Zwei-Buchstaben-Einträge fehlen im Katalog.');

function check(rows,cols,target,seed){
  const a=Core.generatePuzzle(entries,solutions,rows,cols,seed,{targetWords:target,attempts:12});
  const b=Core.generatePuzzle(entries,solutions,rows,cols,seed,{targetWords:target,attempts:12});
  if(Core.puzzleSignature(a)!==Core.puzzleSignature(b)) throw new Error('Determinismus verletzt: '+seed);
  if(a.rows!==rows||a.cols!==cols) throw new Error('Falsche Größe');
  if(a.placements.length<Math.floor(target*.55)) throw new Error(`Zu wenige Begriffe: ${a.placements.length}`);
  if(a.solutionWord.length<10||a.solutionWord.length>20) throw new Error('Lösungswortlänge ungültig');
  if(a.marks.length!==a.solutionWord.length) throw new Error('Lösungsmarkierungen unvollständig');
  const seen=new Set();
  a.marks.forEach((m,i)=>{
    const k=`${m.r},${m.c}`;
    if(seen.has(k)) throw new Error('Lösungsfeld doppelt');
    seen.add(k);
    if(a.grid[m.r][m.c]!==a.solutionWord[i]) throw new Error('Lösungsfeld ergibt falschen Buchstaben');
  });
  return a.placements.length;
}

const counts=[];
for(const d of ['2026-01-01','2026-05-17','2026-09-26','2027-12-24']){
  counts.push(check(15,20,36,`daily|${d}|normal|catalog:6`));
  counts.push(check(20,30,58,`daily|${d}|large|catalog:6`));
}
console.log(`Kreuzworträtsel-Test OK: Normal/Groß deterministisch, 10–20 Buchstaben Lösungswort, ${entries.length} Fragen / ${solutions.length} Lösungswörter. Begriffe/Test: ${counts.join(', ')}.`);
