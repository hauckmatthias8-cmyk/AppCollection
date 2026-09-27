(() => {
  'use strict';
  const Core=window.HauckiCrosswordCore;
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];

  const SIZE={
    normal:{rows:15,cols:20,label:'Normal · 15 × 20',targetWords:36},
    large:{rows:20,cols:30,label:'Groß · 20 × 30',targetWords:58}
  };

  const busy=$('#cw-busy'),busyLabel=$('#busy-label');
  const dateInput=$('#cw-date'),dailyBtn=$('#daily-btn'),randomBtn=$('#random-btn');
  const game=$('#game'),gridEl=$('#crossword-grid'),gridScroll=$('#grid-scroll'),clueFloat=$('#clue-float');
  const acrossEl=$('#across-clues'),downEl=$('#down-clues');
  const activeClueEl=$('#active-clue'),statusEl=$('#status');
  const solutionEl=$('#solution-progress'),solutionCount=$('#solution-count');
  const gameTitle=$('#game-title'),gameSubtitle=$('#game-subtitle');
  const keyboard=$('#cw-keyboard');

  let data=null,puzzle=null,values={},selected=null,direction='across',sizeKey='normal';
  let mode='random',modeDate='',currentSeed='';

  function setBusy(show,text=''){
    busy.classList.toggle('hidden',!show);
    if(text) busyLabel.textContent=text;
  }
  function status(text,kind=''){
    statusEl.textContent=text;
    statusEl.className='status'+(kind?` ${kind}`:'');
  }
  function todayLocal(){
    const d=new Date(),pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function niceDate(iso){
    try{return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${iso}T12:00:00`));}
    catch(_){return iso;}
  }

  function decryptPacked(bytes){
    let state=0xC0FFEE42>>>0;
    const out=new Uint8Array(bytes.length);
    for(let i=0;i<bytes.length;i++){
      state^=(state<<13)>>>0;
      state^=state>>>17;
      state^=(state<<5)>>>0;
      state>>>=0;
      out[i]=bytes[i]^(state&0xff)^((i*31+0x5A)&0xff);
    }
    return out;
  }

  async function loadData(){
    const packed=String(window.__HAUCKI_CROSSWORD_DATA||'');
    if(!packed.startsWith('HCW1:')) throw new Error('Lokaler Kreuzworträtsel-Katalog fehlt.');
    if(typeof DecompressionStream==='undefined') throw new Error('Dieser Browser unterstützt den lokalen Datencontainer nicht.');
    const b64=packed.slice(5);
    const raw=atob(b64);
    const encrypted=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) encrypted[i]=raw.charCodeAt(i);
    const gz=decryptPacked(encrypted);
    const stream=new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text=await new Response(stream).text();
    const parsed=JSON.parse(text);
    if(!Array.isArray(parsed.entries)||!Array.isArray(parsed.solutions)) throw new Error('Lokaler Fragenkatalog ist ungültig.');
    return parsed;
  }

  function randomSeed(){
    if(window.crypto?.getRandomValues){
      const a=new Uint32Array(2);crypto.getRandomValues(a);
      return `random:${a[0].toString(16)}${a[1].toString(16)}`;
    }
    return `random:${Date.now()}:${Math.random()}`;
  }

  function currentPuzzleId(){
    return `cw:${data?.v||1}:${mode}:${sizeKey}:${mode==='daily'?modeDate:currentSeed}`;
  }
  function saveProgress(){
    if(!puzzle) return;
    try{localStorage.setItem(`crossword.progress.${currentPuzzleId()}`,JSON.stringify(values));}catch(_){}
  }
  function loadProgress(){
    values={};
    try{
      const raw=localStorage.getItem(`crossword.progress.${currentPuzzleId()}`);
      if(raw) values=JSON.parse(raw)||{};
    }catch(_){values={};}
  }

  async function buildPuzzle(kind){
    if(!data) return;
    const cfg=SIZE[sizeKey];
    mode=kind;
    modeDate=dateInput.value||todayLocal();
    currentSeed=kind==='daily'
      ? `daily|${modeDate}|${sizeKey}|catalog:${data.v||1}`
      : randomSeed();

    setBusy(true,kind==='daily'?'Kreuzworträtsel des Tages wird erzeugt …':'Zufälliges Kreuzworträtsel wird erzeugt …');
    await new Promise(r=>setTimeout(r,25));

    try{
      puzzle=Core.generatePuzzle(data.entries,data.solutions,cfg.rows,cfg.cols,currentSeed,{
        targetWords:cfg.targetWords,attempts:12
      });
      loadProgress();
      selected=null;direction='across';cluePeekKey=null;
      game.classList.remove('hidden');
      gameTitle.textContent=kind==='daily'?'Kreuzworträtsel des Tages':'Zufälliges Kreuzworträtsel';
      gameSubtitle.textContent=kind==='daily'
        ? `${niceDate(modeDate)} · ${cfg.label} · ${puzzle.placements.length} Begriffe`
        : `${cfg.label} · ${puzzle.placements.length} Begriffe`;
      render();
      status('Tippe ein weißes Feld oder eine Frage an.');
      game.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){
      console.error(err);
      status(`Rätsel konnte nicht erzeugt werden: ${err.message}`,'bad');
    }finally{
      setBusy(false);
    }
  }

  function refsByCell(){
    const refs={};
    for(const p of puzzle.placements){
      const dr=p.dir==='down'?1:0,dc=p.dir==='across'?1:0;
      for(let i=0;i<p.entry.a.length;i++){
        const k=`${p.row+dr*i},${p.col+dc*i}`;
        if(!refs[k]) refs[k]={};
        refs[k][p.dir]=p.id;
      }
    }
    return refs;
  }

  function numbersByCell(){
    const nums={};
    for(const p of puzzle.placements){
      const k=`${p.row},${p.col}`;
      if(nums[k]==null||p.number<nums[k]) nums[k]=p.number;
    }
    return nums;
  }

  function placementById(id){return puzzle.placements.find(p=>p.id===id)||null;}
  function selectedPlacement(){
    if(!selected) return null;
    const refs=cellRefs[selected];
    const id=refs?.[direction] ?? refs?.across ?? refs?.down;
    return id==null?null:placementById(id);
  }

  let cellRefs={},cellNumbers={},cluePeekKey=null;

  function render(){
    if(!puzzle) return;
    cellRefs=refsByCell();
    cellNumbers=numbersByCell();
    gridEl.style.setProperty('--rows',puzzle.rows);
    gridEl.style.setProperty('--cols',puzzle.cols);
    gridEl.innerHTML='';

    const active=selectedPlacement();
    const activeCells=new Set();
    if(active){
      const dr=active.dir==='down'?1:0,dc=active.dir==='across'?1:0;
      for(let i=0;i<active.entry.a.length;i++) activeCells.add(`${active.row+dr*i},${active.col+dc*i}`);
    }

    for(let r=0;r<puzzle.rows;r++) for(let c=0;c<puzzle.cols;c++){
      const k=`${r},${c}`,answer=puzzle.grid[r][c];
      const cell=document.createElement('button');
      cell.type='button';
      cell.className=answer?'cw-cell':'cw-cell block';
      cell.dataset.key=k;
      if(!answer){cell.tabIndex=-1;gridEl.append(cell);continue;}

      if(k===selected) cell.classList.add('selected');
      else if(activeCells.has(k)) cell.classList.add('word-peer');

      const value=String(values[k]||'');
      cell.append(document.createTextNode(value));

      if(cellNumbers[k]){
        const n=document.createElement('span');
        n.className='cell-number';
        n.textContent=cellNumbers[k];
        n.title=`Frage${placementsStartingAt(k).length===1?'':'n'} zu Nummer ${cellNumbers[k]} anzeigen`;
        n.addEventListener('click',event=>{
          event.stopPropagation();
          showCluesForNumber(k);
        });
        cell.append(n);
      }
      if(puzzle.marksByCell[k]){
        const m=document.createElement('span');m.className='solution-mark';m.textContent=puzzle.marksByCell[k];cell.append(m);
      }
      cell.addEventListener('click',()=>selectCell(k,true));
      gridEl.append(cell);
    }

    renderClues();
    renderSolution();
    updateActiveClue();
    renderClueFloat();
  }

  function renderClues(){
    acrossEl.innerHTML='';downEl.innerHTML='';
    for(const dir of ['across','down']){
      const target=dir==='across'?acrossEl:downEl;
      const list=puzzle.placements.filter(p=>p.dir===dir).sort((a,b)=>a.number-b.number);
      for(const p of list){
        const b=document.createElement('button');
        b.type='button';b.className='clue-btn';b.dataset.id=p.id;
        const done=wordValue(p)===p.entry.a;
        if(done)b.classList.add('done');
        if(selectedPlacement()?.id===p.id)b.classList.add('active');
        const num=document.createElement('b');num.textContent=`${p.number}.`;
        b.append(num,document.createTextNode(` ${p.entry.q}`));
        b.addEventListener('click',()=>selectPlacement(p));
        target.append(b);
      }
    }
  }

  function renderSolution(){
    solutionEl.innerHTML='';
    let filled=0,correct=0;
    for(const m of puzzle.marks.slice().sort((a,b)=>a.n-b.n)){
      const k=`${m.r},${m.c}`,v=String(values[k]||'');
      if(v)filled++;
      if(v===m.ch)correct++;
      const span=document.createElement('span');
      span.className='solution-letter'+(v?'':' empty')+(v&&v===m.ch?' solved':'');
      span.textContent=v||'·';
      span.title=`Lösungsfeld ${m.n}`;
      solutionEl.append(span);
    }
    solutionCount.textContent=`${filled}/${puzzle.solutionWord.length}`;
    if(filled===puzzle.solutionWord.length){
      if(correct===puzzle.solutionWord.length) status('Geschafft – das Lösungswort ist vollständig und richtig.','good');
      else status('Das Lösungswort ist vollständig, aber noch nicht korrekt.','bad');
    }
  }

  function wordValue(p){
    const dr=p.dir==='down'?1:0,dc=p.dir==='across'?1:0;
    let s='';
    for(let i=0;i<p.entry.a.length;i++) s+=values[`${p.row+dr*i},${p.col+dc*i}`]||'';
    return s;
  }

  function selectPlacement(p){
    cluePeekKey=null;
    direction=p.dir;
    const dr=p.dir==='down'?1:0,dc=p.dir==='across'?1:0;
    let k=`${p.row},${p.col}`;
    for(let i=0;i<p.entry.a.length;i++){
      const test=`${p.row+dr*i},${p.col+dc*i}`;
      if(!values[test]){k=test;break;}
    }
    selected=k;render();focusKeyboard();scrollSelectedIntoView();
  }

  function selectCell(k,toggle){
    if(!puzzle.grid[Number(k.split(',')[0])][Number(k.split(',')[1])]) return;
    const refs=cellRefs[k]||{};
    if(cluePeekKey&&!peekCellKeys().has(k)) cluePeekKey=null;
    if(toggle&&selected===k&&refs.across!=null&&refs.down!=null){
      direction=direction==='across'?'down':'across';
    }else if(refs[direction]==null){
      direction=refs.across!=null?'across':'down';
    }
    selected=k;render();focusKeyboard();
  }

  function focusKeyboard(){
    keyboard.value='';
    try{keyboard.focus({preventScroll:true});}catch(_){keyboard.focus();}
  }

  function scrollSelectedIntoView(){
    const el=gridEl.querySelector(`[data-key="${selected}"]`);
    el?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
  }

  function placementsStartingAt(k){
    if(!puzzle||!k) return [];
    const [r,c]=k.split(',').map(Number);
    return puzzle.placements
      .filter(p=>p.row===r&&p.col===c)
      .sort((a,b)=>{
        if(a.dir===b.dir) return a.id-b.id;
        return a.dir==='across'?-1:1;
      });
  }

  function placementCellKeys(p){
    const dr=p.dir==='down'?1:0,dc=p.dir==='across'?1:0;
    const out=[];
    for(let i=0;i<p.entry.a.length;i++) out.push(`${p.row+dr*i},${p.col+dc*i}`);
    return out;
  }

  function peekCellKeys(){
    const keys=new Set();
    for(const p of placementsStartingAt(cluePeekKey)){
      for(const k of placementCellKeys(p)) keys.add(k);
    }
    return keys;
  }

  function showCluesForNumber(k){
    const starts=placementsStartingAt(k);
    if(!starts.length) return;
    cluePeekKey=k;
    selected=k;
    if(!starts.some(p=>p.dir===direction)) direction=starts[0].dir;
    render();
  }

  function selectPeekPlacement(p){
    direction=p.dir;
    selected=`${p.row},${p.col}`;
    cluePeekKey=selected;
    render();
    focusKeyboard();
    scrollSelectedIntoView();
  }

  function hideClueFloat(){
    cluePeekKey=null;
    clueFloat.classList.add('hidden');
    clueFloat.innerHTML='';
  }

  function overlapArea(a,b){
    const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
    const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    return w*h;
  }

  function positionClueFloat(){
    if(!cluePeekKey||clueFloat.classList.contains('hidden')) return;
    const startCell=gridEl.querySelector(`[data-key="${cluePeekKey}"]`);
    if(!startCell) return;

    const hostRect=gridScroll.getBoundingClientRect();
    const toContent=el=>{
      const r=el.getBoundingClientRect();
      return {
        left:r.left-hostRect.left+gridScroll.scrollLeft,
        top:r.top-hostRect.top+gridScroll.scrollTop,
        right:r.right-hostRect.left+gridScroll.scrollLeft,
        bottom:r.bottom-hostRect.top+gridScroll.scrollTop
      };
    };

    const start=toContent(startCell);
    const reserved=[];
    for(const k of peekCellKeys()){
      const el=gridEl.querySelector(`[data-key="${k}"]`);
      if(!el) continue;
      const r=toContent(el);
      reserved.push({left:r.left-4,top:r.top-4,right:r.right+4,bottom:r.bottom+4});
    }

    function findPosition(){
      const w=clueFloat.offsetWidth,h=clueFloat.offsetHeight;
      if(!w||!h) return null;

      const pad=8;
      const left=gridScroll.scrollLeft+pad;
      const top=gridScroll.scrollTop+pad;
      const right=gridScroll.scrollLeft+gridScroll.clientWidth-pad;
      const bottom=gridScroll.scrollTop+gridScroll.clientHeight-pad;
      const maxX=Math.max(left,right-w);
      const maxY=Math.max(top,bottom-h);
      const sx=(start.left+start.right)/2;
      const sy=(start.top+start.bottom)/2;

      const candidates=[];
      const xs=[
        Math.max(left,Math.min(maxX,start.left-w-8)),
        Math.max(left,Math.min(maxX,start.right+8)),
        left,maxX
      ];
      const ys=[
        Math.max(top,Math.min(maxY,start.top-h-8)),
        Math.max(top,Math.min(maxY,start.bottom+8)),
        top,maxY
      ];
      for(const x of xs) for(const y of ys) candidates.push({x,y});

      for(let y=top;y<=maxY;y+=10){
        for(let x=left;x<=maxX;x+=10) candidates.push({x,y});
      }

      let best=null;
      for(const c of candidates){
        const box={left:c.x,top:c.y,right:c.x+w,bottom:c.y+h};
        let overlap=0;
        for(const r of reserved) overlap+=overlapArea(box,r);
        if(overlap>0) continue;
        const d=Math.hypot(c.x+w/2-sx,c.y+h/2-sy);
        if(!best||d<best.d) best={x:c.x,y:c.y,d};
      }
      return best;
    }

    clueFloat.classList.remove('compact');
    let best=findPosition();
    if(!best){
      clueFloat.classList.add('compact');
      best=findPosition();
    }

    if(!best){
      clueFloat.classList.add('hidden');
      return;
    }

    clueFloat.style.left=`${Math.round(best.x)}px`;
    clueFloat.style.top=`${Math.round(best.y)}px`;
  }

  function renderClueFloat(){
    clueFloat.innerHTML='';
    const starts=cluePeekKey?placementsStartingAt(cluePeekKey):[];
    if(!starts.length){
      clueFloat.classList.add('hidden');
      return;
    }

    const head=document.createElement('div');
    head.className='clue-float-head';

    const number=document.createElement('b');
    number.textContent=`Nr. ${cellNumbers[cluePeekKey]}`;

    const close=document.createElement('button');
    close.type='button';
    close.className='clue-float-close';
    close.textContent='×';
    close.setAttribute('aria-label','Fragen ausblenden');
    close.addEventListener('click',event=>{
      event.stopPropagation();
      hideClueFloat();
    });

    head.append(number,close);
    clueFloat.append(head);

    const active=selectedPlacement();
    for(const p of starts){
      const button=document.createElement('button');
      button.type='button';
      button.className='clue-float-option';
      if(active?.id===p.id) button.classList.add('active');

      const dir=document.createElement('span');
      dir.className='clue-float-dir';
      dir.textContent=p.dir==='across'?'Waagerecht':'Senkrecht';

      const question=document.createElement('span');
      question.className='clue-float-question';
      question.textContent=p.entry.q;

      button.append(dir,question);
      button.addEventListener('click',event=>{
        event.stopPropagation();
        selectPeekPlacement(p);
      });
      clueFloat.append(button);
    }

    clueFloat.classList.remove('hidden');
    requestAnimationFrame(positionClueFloat);
  }

  function updateActiveClue(){
    const p=selectedPlacement();
    if(!p){
      activeClueEl.textContent='Tippe ein weißes Feld, eine kleine Nummer oder eine Frage an.';
      return;
    }
    activeClueEl.textContent=`${p.number} ${p.dir==='across'?'waagerecht':'senkrecht'} · ${p.entry.q}`;
  }
  function stepInPlacement(delta){
    const p=selectedPlacement();
    if(!p||!selected)return;
    const [sr,sc]=selected.split(',').map(Number);
    const dr=p.dir==='down'?1:0,dc=p.dir==='across'?1:0;
    let index=p.dir==='down'?sr-p.row:sc-p.col;
    index=Math.max(0,Math.min(p.entry.a.length-1,index+delta));
    selected=`${p.row+dr*index},${p.col+dc*index}`;
  }

  function enterLetter(letter){
    if(!selected)return;
    const normalized=Core.normalizeAnswer(letter);
    if(!normalized)return;
    values[selected]=normalized[0];
    saveProgress();
    stepInPlacement(1);
    render();scrollSelectedIntoView();
  }

  function backspace(){
    if(!selected)return;
    if(values[selected]) delete values[selected];
    else{stepInPlacement(-1);delete values[selected];}
    saveProgress();render();scrollSelectedIntoView();
  }

  function movePhysical(dr,dc){
    if(!selected)return;
    let [r,c]=selected.split(',').map(Number);
    for(let i=0;i<Math.max(puzzle.rows,puzzle.cols);i++){
      r+=dr;c+=dc;
      if(r<0||c<0||r>=puzzle.rows||c>=puzzle.cols)return;
      if(puzzle.grid[r][c]){selected=`${r},${c}`;direction=dr?'down':'across';render();scrollSelectedIntoView();return;}
    }
  }

  keyboard.addEventListener('input',()=>{
    const v=keyboard.value;
    keyboard.value='';
    if(v)enterLetter(v);
  });
  keyboard.addEventListener('keydown',e=>{
    if(e.key==='Backspace'){e.preventDefault();backspace();}
    else if(e.key==='ArrowLeft'){e.preventDefault();movePhysical(0,-1);}
    else if(e.key==='ArrowRight'){e.preventDefault();movePhysical(0,1);}
    else if(e.key==='ArrowUp'){e.preventDefault();movePhysical(-1,0);}
    else if(e.key==='ArrowDown'){e.preventDefault();movePhysical(1,0);}
  });

  function checkPuzzle(){
    if(!puzzle)return;
    let wrong=0,filled=0,total=0;
    gridEl.querySelectorAll('.cw-cell:not(.block)').forEach(cell=>{
      const k=cell.dataset.key,[r,c]=k.split(',').map(Number),v=values[k]||'';
      total++;
      cell.classList.remove('wrong','correct');
      if(!v)return;
      filled++;
      if(v!==puzzle.grid[r][c]){wrong++;cell.classList.add('wrong');}
      else cell.classList.add('correct');
    });
    if(wrong)status(`${wrong} ausgefüllte Feld${wrong===1?' ist':'er sind'} noch falsch.`,'bad');
    else if(filled===total)status('Alles richtig – Kreuzworträtsel vollständig gelöst.','good');
    else status(`Bis hierhin alles richtig. ${filled}/${total} Felder sind ausgefüllt.`,'good');
  }


  $$('.size-btn').forEach(btn=>btn.addEventListener('click',()=>{
    sizeKey=btn.dataset.size;
    $$('.size-btn').forEach(x=>{
      const active=x===btn;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));
    });
  }));
  dailyBtn.addEventListener('click',()=>buildPuzzle('daily'));
  randomBtn.addEventListener('click',()=>buildPuzzle('random'));
  $('#new-btn').addEventListener('click',()=>game.classList.add('hidden'));
  $('#check-btn').addEventListener('click',checkPuzzle);
  gridScroll.addEventListener('scroll',()=>{if(cluePeekKey)positionClueFloat();},{passive:true});
  window.addEventListener('resize',()=>{if(cluePeekKey)requestAnimationFrame(positionClueFloat);});

  async function init(){
    dateInput.value=todayLocal();
    try{
      data=await loadData();
      setBusy(false);
      status(`${data.entries.length.toLocaleString('de-DE')} lokale Fragen und ${data.solutions.length.toLocaleString('de-DE')} Lösungswörter geladen.`);
    }catch(err){
      console.error(err);
      busyLabel.textContent=`Katalog konnte nicht geladen werden: ${err.message}`;
    }
  }
  init();
})();
