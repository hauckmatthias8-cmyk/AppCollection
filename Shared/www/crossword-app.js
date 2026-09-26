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
  const game=$('#game'),gridEl=$('#crossword-grid'),gridScroll=$('#grid-scroll');
  const acrossEl=$('#across-clues'),downEl=$('#down-clues');
  const activeClueEl=$('#active-clue'),statusEl=$('#status');
  const solutionEl=$('#solution-progress'),solutionCount=$('#solution-count');
  const gameTitle=$('#game-title'),gameSubtitle=$('#game-subtitle');
  const keyboard=$('#cw-keyboard'),zoomLabel=$('#zoom-label');

  let data=null,puzzle=null,values={},selected=null,direction='across',sizeKey='normal';
  let zoom=1,mode='random',modeDate='',currentSeed='';

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
      selected=null;direction='across';
      game.classList.remove('hidden');
      gameTitle.textContent=kind==='daily'?'Kreuzworträtsel des Tages':'Zufälliges Kreuzworträtsel';
      gameSubtitle.textContent=kind==='daily'
        ? `${niceDate(modeDate)} · ${cfg.label} · ${puzzle.placements.length} Begriffe`
        : `${cfg.label} · ${puzzle.placements.length} Begriffe`;
      render();
      fitZoom();
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

  let cellRefs={},cellNumbers={};

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
        const n=document.createElement('span');n.className='cell-number';n.textContent=cellNumbers[k];cell.append(n);
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

  function updateActiveClue(){
    const p=selectedPlacement();
    if(!p){activeClueEl.textContent='Tippe ein weißes Feld oder eine Frage an.';return;}
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

  function setZoom(next){
    zoom=Math.max(.55,Math.min(1.75,next));
    const px=Math.round(38*zoom);
    gridEl.style.setProperty('--cell',`${px}px`);
    zoomLabel.textContent=`${Math.round(zoom*100)} %`;
  }
  function fitZoom(){
    if(!puzzle)return;
    const available=Math.max(260,gridScroll.clientWidth-24);
    const fit=Math.min(1,available/(puzzle.cols*39));
    setZoom(Math.max(.55,fit));
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
  $('#zoom-in').addEventListener('click',()=>setZoom(zoom+.10));
  $('#zoom-out').addEventListener('click',()=>setZoom(zoom-.10));
  $('#zoom-fit').addEventListener('click',fitZoom);
  window.addEventListener('resize',()=>{if(puzzle&&zoom<=1)fitZoom();});

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
