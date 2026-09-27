(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  root.HauckiCrosswordCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function hash32(text){
    let h=2166136261>>>0;
    for(const ch of String(text)){
      h^=ch.codePointAt(0);
      h=Math.imul(h,16777619)>>>0;
    }
    h^=h>>>16;
    h=Math.imul(h,0x7feb352d)>>>0;
    h^=h>>>15;
    h=Math.imul(h,0x846ca68b)>>>0;
    h^=h>>>16;
    return h>>>0 || 0x9e3779b9;
  }

  class RNG{
    constructor(seed){ this.s=(typeof seed==='number'?seed:hash32(seed))>>>0 || 0x6d2b79f5; }
    next(){
      let x=this.s>>>0;
      x^=x<<13; x^=x>>>17; x^=x<<5;
      this.s=x>>>0;
      return (this.s>>>0)/4294967296;
    }
    int(n){ return n>0?Math.floor(this.next()*n):0; }
    pick(a){ return a[this.int(a.length)]; }
    shuffle(a){
      a=a.slice();
      for(let i=a.length-1;i>0;i--){
        const j=this.int(i+1);
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    }
  }

  function normalizeAnswer(value){
    const repl={Ä:'AE',Ö:'OE',Ü:'UE',ẞ:'SS',ß:'SS',ä:'AE',ö:'OE',ü:'UE'};
    let s=[...String(value||'')].map(c=>repl[c]||c).join('').toUpperCase();
    try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){}
    return s.replace(/[^A-Z]/g,'');
  }

  function emptyGrid(rows,cols){
    return Array.from({length:rows},()=>Array(cols).fill(null));
  }

  function key(r,c){ return `${r},${c}`; }

  function canPlace(grid,word,row,col,dir,requireCross=true){
    const rows=grid.length, cols=grid[0].length;
    const dr=dir==='down'?1:0, dc=dir==='across'?1:0;
    const endR=row+dr*(word.length-1), endC=col+dc*(word.length-1);
    if(row<0||col<0||endR>=rows||endC>=cols) return null;

    const beforeR=row-dr,beforeC=col-dc;
    const afterR=endR+dr,afterC=endC+dc;
    if(beforeR>=0&&beforeC>=0&&beforeR<rows&&beforeC<cols&&grid[beforeR][beforeC]) return null;
    if(afterR>=0&&afterC>=0&&afterR<rows&&afterC<cols&&grid[afterR][afterC]) return null;

    let crosses=0,newCells=0;
    for(let i=0;i<word.length;i++){
      const r=row+dr*i,c=col+dc*i;
      const existing=grid[r][c];
      if(existing){
        if(existing!==word[i]) return null;
        crosses++;
      }else{
        newCells++;
        if(dir==='across'){
          if(r>0&&grid[r-1][c]) return null;
          if(r+1<rows&&grid[r+1][c]) return null;
        }else{
          if(c>0&&grid[r][c-1]) return null;
          if(c+1<cols&&grid[r][c+1]) return null;
        }
      }
    }
    if(requireCross&&crosses===0) return null;
    if(newCells===0) return null;
    return {crosses,newCells};
  }

  function place(grid,word,row,col,dir){
    const dr=dir==='down'?1:0,dc=dir==='across'?1:0;
    for(let i=0;i<word.length;i++) grid[row+dr*i][col+dc*i]=word[i];
  }

  function letterCells(grid){
    const map=new Map();
    for(let r=0;r<grid.length;r++) for(let c=0;c<grid[0].length;c++){
      const ch=grid[r][c];
      if(!ch) continue;
      if(!map.has(ch)) map.set(ch,[]);
      map.get(ch).push([r,c]);
    }
    return map;
  }

  function bestPlacement(grid,word,rng){
    const map=letterCells(grid);
    const rows=grid.length,cols=grid[0].length;
    const options=[];
    for(let i=0;i<word.length;i++){
      for(const cell of map.get(word[i])||[]){
        for(const dir of ['across','down']){
          const dr=dir==='down'?1:0,dc=dir==='across'?1:0;
          const row=cell[0]-dr*i,col=cell[1]-dc*i;
          const ok=canPlace(grid,word,row,col,dir,true);
          if(!ok) continue;
          const midR=row+dr*(word.length-1)/2,midC=col+dc*(word.length-1)/2;
          const centre=Math.abs(midR-(rows-1)/2)+Math.abs(midC-(cols-1)/2);
          const score=ok.crosses*120+ok.newCells*1.7-centre+rng.next()*3;
          options.push({row,col,dir,score,crosses:ok.crosses});
        }
      }
    }
    options.sort((a,b)=>b.score-a.score);
    return options[0]||null;
  }

  function entryClean(entries,rows,cols){
    const maxLen=Math.max(rows,cols)-2;
    const seen=new Set(),out=[];
    for(const e of entries||[]){
      const a=normalizeAnswer(e.a||e.answer);
      const q=String(e.q||e.clue||'').trim();
      if(a.length<2||a.length>maxLen||!q) continue;
      const k=`${a}\u0000${q.toLowerCase()}`;
      if(seen.has(k)) continue;
      seen.add(k);
      out.push({a,q,c:e.c||e.category||'',l:e.l||e.language||'de',d:Number(e.d||e.difficulty||2),s:e.s||e.source||''});
    }
    return out;
  }

  function firstPlacement(grid,entry,rng){
    const rows=grid.length,cols=grid[0].length;
    const word=entry.a;
    let dir='across';
    if(word.length>cols-2 && word.length<=rows-2) dir='down';
    if(dir==='across'){
      const row=Math.max(1,Math.min(rows-2,Math.floor(rows/2)+(rng.int(3)-1)));
      const col=Math.max(1,Math.floor((cols-word.length)/2));
      if(canPlace(grid,word,row,col,dir,false)) return {row,col,dir};
    }else{
      const col=Math.max(1,Math.min(cols-2,Math.floor(cols/2)+(rng.int(3)-1)));
      const row=Math.max(1,Math.floor((rows-word.length)/2));
      if(canPlace(grid,word,row,col,dir,false)) return {row,col,dir};
    }
    return null;
  }

  function buildAttempt(entries,rows,cols,seed,targetWords){
    const rng=new RNG(seed);
    const grid=emptyGrid(rows,cols);
    const shuffled=rng.shuffle(entries);
    shuffled.sort((a,b)=>(b.a.length-a.a.length)+(rng.next()-.5)*2);
    const placements=[];
    const usedAnswers=new Set();

    let first=null,firstEntry=null;
    const preferred=shuffled.filter(e=>e.a.length>=Math.min(8,cols-4)&&e.a.length<=Math.min(cols-2,16));
    for(const e of preferred.concat(shuffled)){
      const p=firstPlacement(grid,e,rng);
      if(p){ first=p; firstEntry=e; break; }
    }
    if(!firstEntry) return {grid,placements};
    place(grid,firstEntry.a,first.row,first.col,first.dir);
    placements.push({...first,entry:firstEntry});
    usedAnswers.add(firstEntry.a);

    let misses=0;
    const candidates=rng.shuffle(shuffled);
    for(let pass=0;pass<4 && placements.length<targetWords;pass++){
      for(const e of candidates){
        if(placements.length>=targetWords) break;
        if(usedAnswers.has(e.a)) continue;
        const p=bestPlacement(grid,e.a,rng);
        if(!p){ misses++; continue; }
        place(grid,e.a,p.row,p.col,p.dir);
        placements.push({row:p.row,col:p.col,dir:p.dir,entry:e});
        usedAnswers.add(e.a);
      }
      if(misses>candidates.length*3) break;
    }
    return {grid,placements};
  }

  function occupiedCount(grid){
    let n=0;
    for(const row of grid) for(const c of row) if(c) n++;
    return n;
  }

  function chooseSolutionMarks(grid,solutions,rng){
    const counts=new Map(),cells=new Map(),occupied=[];
    for(let r=0;r<grid.length;r++) for(let c=0;c<grid[0].length;c++){
      const ch=grid[r][c];
      if(!ch) continue;
      counts.set(ch,(counts.get(ch)||0)+1);
      if(!cells.has(ch)) cells.set(ch,[]);
      cells.get(ch).push({r,c});
      occupied.push({r,c});
    }
    if(!occupied.length) return null;

    const minR=Math.min(...occupied.map(x=>x.r));
    const maxR=Math.max(...occupied.map(x=>x.r));
    const minC=Math.min(...occupied.map(x=>x.c));
    const maxC=Math.max(...occupied.map(x=>x.c));
    const rowSpan=Math.max(1,maxR-minR);
    const colSpan=Math.max(1,maxC-minC);
    const distanceScale=Math.max(1,rowSpan+colSpan);

    // 20 Zielbereiche über die gesamte belegte Rätsel-Fläche.
    // Die Reihenfolge wird anschließend "farthest first" aufgebaut, damit schon
    // die ersten 10–20 Lösungsbuchstaben möglichst weit auseinander liegen.
    const solutionSpreadTargets=[];
    for(const rf of [0,1/3,2/3,1]){
      for(const cf of [0,0.25,0.5,0.75,1]){
        solutionSpreadTargets.push({
          r:minR+rf*rowSpan,
          c:minC+cf*colSpan
        });
      }
    }

    function spreadTargetOrder(localRng){
      const rest=localRng.shuffle(solutionSpreadTargets);
      if(!rest.length) return [];
      const ordered=[rest.shift()];
      while(rest.length){
        let bestIndex=0,bestScore=-Infinity;
        for(let i=0;i<rest.length;i++){
          const p=rest[i];
          let nearest=Infinity;
          for(const q of ordered){
            const d=Math.abs(p.r-q.r)+Math.abs(p.c-q.c);
            if(d<nearest) nearest=d;
          }
          const score=nearest+localRng.next()*0.0001;
          if(score>bestScore){
            bestScore=score;
            bestIndex=i;
          }
        }
        ordered.push(rest.splice(bestIndex,1)[0]);
      }
      return ordered;
    }

    function zoneOf(cell){
      const zr=Math.max(0,Math.min(3,Math.floor(((cell.r-minR)/(rowSpan+0.000001))*4)));
      const zc=Math.max(0,Math.min(4,Math.floor(((cell.c-minC)/(colSpan+0.000001))*5)));
      return `${zr},${zc}`;
    }

    function coverageScore(marks,zones,localRng){
      const rs=marks.map(x=>x.r),cs=marks.map(x=>x.c);
      const rSpan=(Math.max(...rs)-Math.min(...rs))/rowSpan;
      const cSpan=(Math.max(...cs)-Math.min(...cs))/colSpan;

      let nearestSum=0;
      for(let i=0;i<marks.length;i++){
        let nearest=Infinity;
        for(let j=0;j<marks.length;j++){
          if(i===j) continue;
          const d=(Math.abs(marks[i].r-marks[j].r)+Math.abs(marks[i].c-marks[j].c))/distanceScale;
          if(d<nearest) nearest=d;
        }
        if(Number.isFinite(nearest)) nearestSum+=nearest;
      }
      const avgNearest=marks.length>1?nearestSum/marks.length:0;
      const zoneCoverage=zones.size/Math.min(20,marks.length);

      return rSpan*1.8+cSpan*1.8+zoneCoverage*0.8+avgNearest*0.8+localRng.next()*0.001;
    }

    const candidates=rng.shuffle(
      (solutions||[]).map(normalizeAnswer).filter(w=>w.length>=10&&w.length<=20)
    );

    let best=null;

    for(const word of candidates){
      const need=new Map();
      for(const ch of word) need.set(ch,(need.get(ch)||0)+1);
      let possible=true;
      for(const [ch,n] of need){
        if((counts.get(ch)||0)<n){
          possible=false;
          break;
        }
      }
      if(!possible) continue;

      // Eigener deterministischer Zufallszweig pro Lösungswort, damit die
      // Bewertung eines Kandidaten die folgenden Kandidaten nicht verzerrt.
      const localRng=new RNG(Math.floor(rng.next()*0xFFFFFFFF)>>>0);
      const targets=spreadTargetOrder(localRng);
      const pools=new Map();
      for(const [ch,list] of cells) pools.set(ch,localRng.shuffle(list));

      const used=new Set(),usedZones=new Set(),marks=[];
      let ok=true;

      for(let i=0;i<word.length;i++){
        const ch=word[i];
        const pool=pools.get(ch)||[];
        const target=targets[i%targets.length];
        let chosen=null,bestCellScore=-Infinity;

        for(const cell of pool){
          const cellKey=key(cell.r,cell.c);
          if(used.has(cellKey)) continue;

          const targetDistance=(
            Math.abs(cell.r-target.r)+Math.abs(cell.c-target.c)
          )/distanceScale;

          let separation=0;
          if(marks.length){
            separation=Infinity;
            for(const mark of marks){
              const d=(
                Math.abs(cell.r-mark.r)+Math.abs(cell.c-mark.c)
              )/distanceScale;
              if(d<separation) separation=d;
            }
          }

          const zone=zoneOf(cell);
          const newZone=usedZones.has(zone)?0:1;

          // Zielnähe sorgt für eine gleichmäßige Verteilung über das Raster,
          // Mindestabstand verhindert lokale Klumpen; neue Bereiche erhalten
          // einen zusätzlichen Bonus.
          const score=
            -1.8*targetDistance+
             2.7*separation+
             0.65*newZone+
             localRng.next()*0.002;

          if(score>bestCellScore){
            bestCellScore=score;
            chosen=cell;
          }
        }

        if(!chosen){
          ok=false;
          break;
        }

        used.add(key(chosen.r,chosen.c));
        usedZones.add(zoneOf(chosen));
        marks.push({n:i+1,r:chosen.r,c:chosen.c,ch});
      }

      if(!ok) continue;

      const score=coverageScore(marks,usedZones,localRng);
      if(!best||score>best.score){
        best={word,marks,score};
      }
    }

    return best?{word:best.word,marks:best.marks}:null;
  }
  function numberPlacements(placements){
    const starts=[...new Set(placements.map(p=>key(p.row,p.col)))]
      .map(k=>k.split(',').map(Number))
      .sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const numberByStart=new Map(starts.map((rc,i)=>[key(rc[0],rc[1]),i+1]));
    return placements.map((p,i)=>({...p,id:i,number:numberByStart.get(key(p.row,p.col))}));
  }

  function sampledEntries(entries,rows,cols,seed,limit){
    const maxLen=Math.max(rows,cols)-2;
    const rng=new RNG(`${seed}|sample`);
    const source=entries||[];
    const out=[],seenIndices=new Set(),seenRows=new Set();
    const wanted=Math.min(limit,source.length);
    let guard=0;
    while(out.length<wanted && guard<source.length*5){
      guard++;
      const idx=rng.int(source.length);
      if(seenIndices.has(idx)) continue;
      seenIndices.add(idx);
      const e=source[idx]||{};
      const a=normalizeAnswer(e.a||e.answer);
      const q=String(e.q||e.clue||'').trim();
      if(a.length<2||a.length>maxLen||!q) continue;
      const k=`${a}\u0000${q.toLowerCase()}`;
      if(seenRows.has(k)) continue;
      seenRows.add(k);
      out.push({a,q,c:e.c||e.category||'',l:e.l||e.language||'de',d:Number(e.d||e.difficulty||2),s:e.s||e.source||''});
    }
    // If random sampling was unlucky because of length filtering, fill deterministically.
    if(out.length<Math.min(1000,wanted)){
      for(let i=0;i<source.length && out.length<wanted;i++){
        const e=source[(i+hash32(seed))%source.length]||{};
        const a=normalizeAnswer(e.a||e.answer),q=String(e.q||e.clue||'').trim();
        if(a.length<2||a.length>maxLen||!q) continue;
        const k=`${a}\u0000${q.toLowerCase()}`;
        if(seenRows.has(k)) continue;
        seenRows.add(k);out.push({a,q,c:e.c||e.category||'',l:e.l||e.language||'de',d:Number(e.d||e.difficulty||2),s:e.s||e.source||''});
      }
    }
    return out;
  }

  function generatePuzzle(entries,solutions,rows,cols,seed,options={}){
    // The shipped catalog can contain >100k rows. Layout generation works on a
    // deterministic several-thousand-row sample so phone performance stays stable.
    const sampleLimit=Number(options.sampleLimit)||(rows>=20||cols>=30?7000:5200);
    const clean=sampledEntries(entries,rows,cols,seed,sampleLimit);
    if(clean.length<100) throw new Error('Zu wenige Kreuzworträtsel-Einträge.');
    const targetWords=Number(options.targetWords)||(
      rows>=20||cols>=30 ? 58 : 36
    );
    const attempts=Number(options.attempts)||10;
    let best=null;

    for(let i=0;i<attempts;i++){
      const attemptSeed=`${seed}|layout:${i}`;
      const built=buildAttempt(clean,rows,cols,attemptSeed,targetWords);
      const solution=chooseSolutionMarks(built.grid,solutions,new RNG(`${seed}|solution:${i}`));
      const occupied=occupiedCount(built.grid);
      const score=built.placements.length*1000+occupied+(solution?5000:0);
      if(!best||score>best.score) best={...built,solution,score,attempt:i};
      if(solution && built.placements.length>=Math.floor(targetWords*.82)) break;
    }

    if(!best||!best.solution) throw new Error('Kein passendes Rätsel mit Lösungswort erzeugt.');
    const placements=numberPlacements(best.placements);
    const marksByCell={};
    for(const m of best.solution.marks) marksByCell[key(m.r,m.c)]=m.n;

    return {
      version:1,
      rows,cols,
      seed:String(seed),
      placements,
      grid:best.grid,
      solutionWord:best.solution.word,
      marks:best.solution.marks,
      marksByCell,
      occupied:occupiedCount(best.grid)
    };
  }

  function puzzleSignature(p){
    return [
      p.rows,p.cols,p.seed,p.solutionWord,
      ...p.placements.map(x=>`${x.number}:${x.dir}:${x.row},${x.col}:${x.entry.a}`)
    ].join('|');
  }

  return {RNG,hash32,normalizeAnswer,generatePuzzle,puzzleSignature,sampledEntries};
});
