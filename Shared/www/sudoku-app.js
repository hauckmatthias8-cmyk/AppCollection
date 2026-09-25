(()=>{
const Core=window.SudokuCore,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const ui={menu:$('#sudoku-menu'),game:$('#sudoku-game'),board:$('#sudoku-board'),status:$('#status'),pad:$('#number-pad'),dateRow:$('#date-row'),date:$('#daily-date'),manualInfo:$('#manual-info'),manualEdit:$('#manual-edit'),title:$('#game-title'),subtitle:$('#game-subtitle'),busy:$('#sudoku-busy'),busyLabel:$('#busy-label'),toast:$('#sudoku-toast'),difficultyInfo:$('#difficulty-info')};
const state={mode:null,puzzle:Array(81).fill(0),board:Array(81).fill(0),solution:null,solutionCount:0,givens:new Set(),hints:new Set(),selected:null,manualLocked:false,date:null,seed:null,difficulty:loadDifficulty()};
let toastTimer=null,splashTimer=null;
function localDateString(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function formatDate(s){const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d))}
function loadDifficulty(){try{return Core.normalizeDifficulty(localStorage.getItem('haucki-sudoku-difficulty')||'normal')}catch(_){return'normal'}}
function saveDifficulty(){try{localStorage.setItem('haucki-sudoku-difficulty',state.difficulty)}catch(_){}}
function difficultyMeta(){return Core.difficultyConfig(state.difficulty)}
function difficultyDescription(){const d=difficultyMeta();return d.id==='hard'?`${d.label}: ca. ${d.targetClues} Vorgaben · höchstens 2 Lösungen`:`${d.label}: ca. ${d.targetClues} Vorgaben · eindeutig lösbar`}
function updateDifficultyUI(){
  $$('.difficulty-btn').forEach(b=>{const active=b.dataset.difficulty===state.difficulty;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});
  if(ui.difficultyInfo)ui.difficultyInfo.textContent=difficultyDescription();
}
function showToast(msg){clearTimeout(toastTimer);ui.toast.textContent=msg;ui.toast.classList.remove('hidden');toastTimer=setTimeout(()=>ui.toast.classList.add('hidden'),3000)}
function setStatus(msg,type=''){ui.status.textContent=msg;ui.status.className='status'+(type?` ${type}`:'')}
function busy(msg){ui.busyLabel.textContent=msg;ui.busy.classList.remove('hidden')}
function unbusy(){ui.busy.classList.add('hidden')}
function showScreen(game){ui.menu.classList.toggle('active',!game);ui.game.classList.toggle('active',game);window.scrollTo({top:0,behavior:'smooth'})}
function splashDone(){const s=$('#sudoku-splash');if(!s.classList.contains('hide'))s.classList.add('hide');clearTimeout(splashTimer)}
$('#sudoku-splash').addEventListener('click',splashDone);$('#sudoku-splash').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')splashDone()});splashTimer=setTimeout(splashDone,1450);
$$('.difficulty-btn').forEach(b=>b.onclick=()=>{state.difficulty=Core.normalizeDifficulty(b.dataset.difficulty);saveDifficulty();updateDifficultyUI()});
function freshState(mode){state.mode=mode;state.puzzle=Array(81).fill(0);state.board=Array(81).fill(0);state.solution=null;state.solutionCount=0;state.givens=new Set();state.hints=new Set();state.selected=null;state.manualLocked=false;state.seed=null;ui.manualEdit.classList.add('hidden');ui.dateRow.classList.toggle('hidden',mode!=='daily');ui.manualInfo.classList.toggle('hidden',mode!=='manual')}
function setPuzzle(data,{restore=null}={}){state.puzzle=data.puzzle.slice();state.board=restore&&restore.length===81?restore.slice():data.puzzle.slice();state.solution=data.solution?data.solution.slice():null;state.solutionCount=data.solutionCount||1;state.seed=data.seed||null;state.givens=new Set(data.puzzle.map((n,i)=>n?i:-1).filter(i=>i>=0));state.hints.clear();state.selected=state.board.findIndex(n=>!n);if(state.selected<0)state.selected=null;render()}
function dailyStorageKey(date){return `haucki-sudoku-daily-${state.difficulty}-${date}`}
function saveDaily(){if(state.mode!=='daily'||!state.date)return;try{localStorage.setItem(dailyStorageKey(state.date),JSON.stringify(state.board))}catch(_){}}
function solutionText(count){return count===1?'eindeutig lösbar':count===2?'2 Lösungen möglich':'mehrere Lösungen möglich'}
function loadDaily(date){
  state.date=date;ui.date.value=date;busy(`Sudoku des Tages (${difficultyMeta().label}) wird erzeugt …`);
  setTimeout(()=>{try{
    const data=Core.daily(date,state.difficulty);let restore=null;
    try{
      let rawText=localStorage.getItem(dailyStorageKey(date));
      if(!rawText&&state.difficulty==='normal')rawText=localStorage.getItem(`haucki-sudoku-daily-${date}`);
      const raw=JSON.parse(rawText||'null');
      if(Array.isArray(raw)&&raw.length===81&&raw.every((n,i)=>stateIsProgressCompatible(n,data.puzzle[i])))restore=raw;
    }catch(_){}
    setPuzzle(data,{restore});ui.title.textContent='Sudoku des Tages';ui.subtitle.textContent=`${formatDate(date)} · ${difficultyMeta().label} · ${data.clues} Vorgaben · ${solutionText(data.solutionCount)}`;setStatus('Wähle ein Feld und eine Zahl. Dein Fortschritt wird lokal gespeichert.');
  }catch(e){setStatus('Sudoku konnte nicht erzeugt werden.','bad');showToast(String(e.message||e))}finally{unbusy()}},30)
}
function stateIsProgressCompatible(n,given){return Number.isInteger(n)&&n>=0&&n<=9&&(!given||n===given)}
function loadRandom(){busy(`Zufälliges Sudoku (${difficultyMeta().label}) wird erzeugt …`);setTimeout(()=>{try{const seed=Core.randomSeed(),data=Core.generateDifficulty(seed,state.difficulty);setPuzzle(data);ui.title.textContent='Zufälliges Sudoku';ui.subtitle.textContent=`${difficultyMeta().label} · ${data.clues} Vorgaben · ${solutionText(data.solutionCount)}`;setStatus('Wähle ein Feld und eine Zahl.')}catch(e){setStatus('Sudoku konnte nicht erzeugt werden.','bad');showToast(String(e.message||e))}finally{unbusy()}},30)}
function loadManual(){state.puzzle=Array(81).fill(0);state.board=Array(81).fill(0);state.solution=null;state.solutionCount=0;state.givens.clear();state.hints.clear();state.selected=0;state.manualLocked=false;ui.title.textContent='Sudoku-Löser';ui.subtitle.textContent='Eigene Vorgabe';ui.manualEdit.classList.add('hidden');render();setStatus('Trage deine Vorgaben ein. Danach „Markiertes Feld lösen“ drücken.')}
function startMode(mode){freshState(mode);showScreen(true);if(mode==='daily'){const d=ui.date.value||localDateString();loadDaily(d)}else if(mode==='random')loadRandom();else loadManual()}
$$('.mode-card').forEach(b=>b.onclick=()=>startMode(b.dataset.mode));
$('#game-back').onclick=()=>showScreen(false);
$('#load-date').onclick=()=>{if(ui.date.value)loadDaily(ui.date.value)};
$('#game-new').onclick=()=>{if(state.mode==='daily')loadDaily(ui.date.value||localDateString());else if(state.mode==='random')loadRandom();else loadManual()};
function cellPeers(a,b){if(a==null||b==null)return false;const ar=Math.floor(a/9),ac=a%9,br=Math.floor(b/9),bc=b%9;return ar===br||ac===bc||(Math.floor(ar/3)===Math.floor(br/3)&&Math.floor(ac/3)===Math.floor(bc/3))}
function render(){
  ui.board.innerHTML='';const bad=Core.conflicts(state.board),selVal=state.selected==null?0:state.board[state.selected];
  for(let i=0;i<81;i++){
    const b=document.createElement('button'),r=Math.floor(i/9),c=i%9,n=state.board[i];b.className='cell';b.type='button';
    if(c===2||c===5)b.classList.add('box-r');if(r===2||r===5)b.classList.add('box-b');if(state.givens.has(i))b.classList.add('given');else if(state.hints.has(i))b.classList.add('hint');else if(n)b.classList.add('user');if(i===state.selected)b.classList.add('selected');else if(cellPeers(i,state.selected))b.classList.add('peer');if(selVal&&n===selVal&&i!==state.selected)b.classList.add('same');if(bad.has(i))b.classList.add('conflict');if(state.solutionCount===1&&state.solution&&n&&n!==state.solution[i]&&!state.givens.has(i))b.classList.add('wrong');b.textContent=n||'';b.setAttribute('aria-label',`Zeile ${r+1}, Spalte ${c+1}${n?`, ${n}`:''}`);b.onclick=()=>{state.selected=i;render()};ui.board.appendChild(b)
  }
  renderPad();checkFinished();
}
function renderPad(){ui.pad.innerHTML='';const counts=Array(10).fill(0);state.board.forEach(n=>{if(n)counts[n]++});for(let n=1;n<=9;n++){const b=document.createElement('button');b.textContent=n;if(counts[n]>=9)b.classList.add('used');b.onclick=()=>putNumber(n);ui.pad.appendChild(b)}}
function editableSelected(){if(state.selected==null)return false;if(state.mode==='manual'&&!state.manualLocked)return true;return !state.givens.has(state.selected)}
function refreshManualSolutionFromCurrentBoard(){if(state.mode!=='manual'||!state.manualLocked)return;const sols=Core.solveAll(state.board,2);state.solution=sols[0]||null;state.solutionCount=sols.length}
function putNumber(n){if(!editableSelected()){showToast('Dieses Feld ist fest vorgegeben.');return}state.hints.delete(state.selected);state.board[state.selected]=n;if(state.mode==='manual'){if(!state.manualLocked){state.solution=null;state.solutionCount=0}else refreshManualSolutionFromCurrentBoard()}saveDaily();render();advanceSelection()}
function advanceSelection(){if(state.selected==null)return;for(let k=1;k<=81;k++){const i=(state.selected+k)%81;if(!state.board[i]&&!state.givens.has(i)){state.selected=i;break}}render()}
$('#erase').onclick=()=>{if(!editableSelected()){showToast('Dieses Feld kann nicht gelöscht werden.');return}state.hints.delete(state.selected);state.board[state.selected]=0;if(state.mode==='manual'){if(!state.manualLocked){state.solution=null;state.solutionCount=0}else refreshManualSolutionFromCurrentBoard()}saveDaily();render()};
function prepareManual(){
  if(state.manualLocked)return true;
  const bad=Core.conflicts(state.board);if(bad.size){state.selected=[...bad][0];render();setStatus('Die Vorgabe enthält einen Widerspruch. Markiertes Feld prüfen.','bad');return false}
  const sols=Core.solveAll(state.board,2);if(!sols.length){setStatus('Für diese Vorgabe existiert keine Lösung.','bad');return false}
  state.solution=sols[0];state.solutionCount=sols.length;state.puzzle=state.board.slice();state.givens=new Set(state.board.map((n,i)=>n?i:-1).filter(i=>i>=0));state.manualLocked=true;ui.manualEdit.classList.remove('hidden');
  if(sols.length===1)setStatus('Eindeutige Lösung gefunden. Der Einzelschritt-Löser ist bereit.','good');
  else setStatus('Mehrere Lösungen sind möglich. Der Löser bevorzugt die erste aktuell mögliche Lösung.','good');
  render();return true;
}
$('#manual-edit').onclick=()=>{state.manualLocked=false;state.solution=null;state.solutionCount=0;state.hints.clear();state.givens.clear();ui.manualEdit.classList.add('hidden');setStatus('Vorgabe wieder freigegeben. Zahlen eingeben oder ändern.');render()};
function chooseStepTarget(){
  if(state.selected!=null&&!state.givens.has(state.selected)&&!state.hints.has(state.selected))return state.selected;
  for(let i=0;i<81;i++)if(!state.board[i]&&!state.givens.has(i)&&!state.hints.has(i))return i;
  return-1;
}
$('#step-solve').onclick=()=>{
  if(state.mode==='manual'&&!prepareManual())return;
  const target=chooseStepTarget();if(target<0){checkFinished(true);return}
  const work=state.board.slice();if(!state.givens.has(target))work[target]=0;
  const sols=Core.solveAll(work,2);
  if(!sols.length){setStatus('Mit den aktuellen Eingaben ist keine Lösung möglich. Prüfe deine Einträge.','bad');return}
  state.solution=sols[0];state.solutionCount=sols.length;state.board[target]=sols[0][target];state.hints.add(target);state.selected=target;saveDaily();render();setStatus(`Markiertes Feld: Zeile ${Math.floor(target/9)+1}, Spalte ${target%9+1} wurde gelöst.${sols.length>1?' Erste aktuell mögliche Lösung verwendet.':''}`,'good')
};
function checkFinished(force=false){if(state.board.some(n=>!n))return;const ok=Core.boardValid(state.board);if(ok){setStatus('Geschafft – das Sudoku ist vollständig gelöst! 🎉','good');if(force)showToast('Sudoku gelöst! 🎉')}else if(force)setStatus('Das Gitter ist vollständig, enthält aber Fehler.','bad')}
ui.date.value=localDateString();updateDifficultyUI();renderPad();
})();
