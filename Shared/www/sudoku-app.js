(()=>{
const Core=window.SudokuCore,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const ui={menu:$('#sudoku-menu'),game:$('#sudoku-game'),board:$('#sudoku-board'),status:$('#status'),pad:$('#number-pad'),dateRow:$('#date-row'),date:$('#daily-date'),manualInfo:$('#manual-info'),manualEdit:$('#manual-edit'),title:$('#game-title'),subtitle:$('#game-subtitle'),busy:$('#sudoku-busy'),busyLabel:$('#busy-label'),toast:$('#sudoku-toast')};
const state={mode:null,puzzle:Array(81).fill(0),board:Array(81).fill(0),solution:null,givens:new Set(),hints:new Set(),selected:null,manualLocked:false,date:null,seed:null};
let toastTimer=null,splashTimer=null;
function localDateString(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function formatDate(s){const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d))}
function showToast(msg){clearTimeout(toastTimer);ui.toast.textContent=msg;ui.toast.classList.remove('hidden');toastTimer=setTimeout(()=>ui.toast.classList.add('hidden'),3000)}
function setStatus(msg,type=''){ui.status.textContent=msg;ui.status.className='status'+(type?` ${type}`:'')}
function busy(msg){ui.busyLabel.textContent=msg;ui.busy.classList.remove('hidden')}
function unbusy(){ui.busy.classList.add('hidden')}
function showScreen(game){ui.menu.classList.toggle('active',!game);ui.game.classList.toggle('active',game);window.scrollTo({top:0,behavior:'smooth'})}
function splashDone(){const s=$('#sudoku-splash');if(!s.classList.contains('hide'))s.classList.add('hide');clearTimeout(splashTimer)}
$('#sudoku-splash').addEventListener('click',splashDone);$('#sudoku-splash').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')splashDone()});splashTimer=setTimeout(splashDone,1450);
function freshState(mode){state.mode=mode;state.puzzle=Array(81).fill(0);state.board=Array(81).fill(0);state.solution=null;state.givens=new Set();state.hints=new Set();state.selected=null;state.manualLocked=false;state.seed=null;ui.manualEdit.classList.add('hidden');ui.dateRow.classList.toggle('hidden',mode!=='daily');ui.manualInfo.classList.toggle('hidden',mode!=='manual')}
function setPuzzle(data,{restore=null}={}){state.puzzle=data.puzzle.slice();state.board=restore&&restore.length===81?restore.slice():data.puzzle.slice();state.solution=data.solution.slice();state.seed=data.seed||null;state.givens=new Set(data.puzzle.map((n,i)=>n?i:-1).filter(i=>i>=0));state.hints.clear();state.selected=state.board.findIndex(n=>!n);if(state.selected<0)state.selected=null;render();}
function saveDaily(){if(state.mode!=='daily'||!state.date)return;try{localStorage.setItem(`haucki-sudoku-daily-${state.date}`,JSON.stringify(state.board))}catch(_){}}
function loadDaily(date){state.date=date;ui.date.value=date;busy('Sudoku des Tages wird erzeugt …');setTimeout(()=>{try{const data=Core.daily(date);let restore=null;try{const raw=JSON.parse(localStorage.getItem(`haucki-sudoku-daily-${date}`)||'null');if(Array.isArray(raw)&&raw.length===81&&raw.every((n,i)=>stateIsProgressCompatible(n,data.puzzle[i])))restore=raw}catch(_){}setPuzzle(data,{restore});ui.title.textContent='Sudoku des Tages';ui.subtitle.textContent=formatDate(date);setStatus('Wähle ein Feld und eine Zahl. Dein Fortschritt wird lokal gespeichert.')}catch(e){setStatus('Sudoku konnte nicht erzeugt werden.','bad');showToast(String(e.message||e))}finally{unbusy()}},30)}
function stateIsProgressCompatible(n,given){return Number.isInteger(n)&&n>=0&&n<=9&&(!given||n===given)}
function loadRandom(){busy('Eindeutig lösbares Sudoku wird erzeugt …');setTimeout(()=>{try{const seed=Core.randomSeed(),data=Core.generate(seed,32);setPuzzle(data);ui.title.textContent='Zufälliges Sudoku';ui.subtitle.textContent=`${data.clues} Vorgaben · eindeutig lösbar`;setStatus('Wähle ein Feld und eine Zahl.')}finally{unbusy()}},30)}
function loadManual(){state.puzzle=Array(81).fill(0);state.board=Array(81).fill(0);state.solution=null;state.givens.clear();state.hints.clear();state.selected=0;state.manualLocked=false;ui.title.textContent='Sudoku-Löser';ui.subtitle.textContent='Eigene Vorgabe';ui.manualEdit.classList.add('hidden');render();setStatus('Trage deine Vorgaben ein. Danach „Nächstes Feld lösen“ drücken.')}
function startMode(mode){freshState(mode);showScreen(true);if(mode==='daily'){const d=ui.date.value||localDateString();loadDaily(d)}else if(mode==='random')loadRandom();else loadManual()}
$$('.mode-card').forEach(b=>b.onclick=()=>startMode(b.dataset.mode));
$('#game-back').onclick=()=>showScreen(false);
$('#load-date').onclick=()=>{if(ui.date.value)loadDaily(ui.date.value)};
$('#game-new').onclick=()=>{if(state.mode==='daily')loadDaily(ui.date.value||localDateString());else if(state.mode==='random')loadRandom();else loadManual()};
function cellPeers(a,b){if(a==null||b==null)return false;const ar=Math.floor(a/9),ac=a%9,br=Math.floor(b/9),bc=b%9;return ar===br||ac===bc||(Math.floor(ar/3)===Math.floor(br/3)&&Math.floor(ac/3)===Math.floor(bc/3))}
function render(){
  ui.board.innerHTML='';const bad=Core.conflicts(state.board),selVal=state.selected==null?0:state.board[state.selected];
  for(let i=0;i<81;i++){const b=document.createElement('button'),r=Math.floor(i/9),c=i%9,n=state.board[i];b.className='cell';b.type='button';if(c===2||c===5)b.classList.add('box-r');if(r===2||r===5)b.classList.add('box-b');if(state.givens.has(i))b.classList.add('given');else if(state.hints.has(i))b.classList.add('hint');else if(n)b.classList.add('user');if(i===state.selected)b.classList.add('selected');else if(cellPeers(i,state.selected))b.classList.add('peer');if(selVal&&n===selVal&&i!==state.selected)b.classList.add('same');if(bad.has(i))b.classList.add('conflict');if(state.solution&&n&&n!==state.solution[i]&&!state.givens.has(i))b.classList.add('wrong');b.textContent=n||'';b.setAttribute('aria-label',`Zeile ${r+1}, Spalte ${c+1}${n?`, ${n}`:''}`);b.onclick=()=>{state.selected=i;render()};ui.board.appendChild(b)}
  renderPad();checkFinished();
}
function renderPad(){ui.pad.innerHTML='';const counts=Array(10).fill(0);state.board.forEach(n=>{if(n)counts[n]++});for(let n=1;n<=9;n++){const b=document.createElement('button');b.textContent=n;if(counts[n]>=9)b.classList.add('used');b.onclick=()=>putNumber(n);ui.pad.appendChild(b)}}
function editableSelected(){if(state.selected==null)return false;if(state.mode==='manual'&&!state.manualLocked)return true;return !state.givens.has(state.selected)&&!state.hints.has(state.selected)}
function putNumber(n){if(!editableSelected()){showToast('Dieses Feld ist fest vorgegeben.');return}state.board[state.selected]=n;if(state.mode==='manual'&&!state.manualLocked)state.solution=null;saveDaily();render();advanceSelection()}
function advanceSelection(){if(state.selected==null)return;for(let k=1;k<=81;k++){const i=(state.selected+k)%81;if(!state.board[i]&&!state.givens.has(i)){state.selected=i;break}}render()}
$('#erase').onclick=()=>{if(!editableSelected()){showToast('Dieses Feld kann nicht gelöscht werden.');return}state.board[state.selected]=0;if(state.mode==='manual'&&!state.manualLocked)state.solution=null;saveDaily();render()};
function prepareManual(){
  if(state.manualLocked)return true;
  const bad=Core.conflicts(state.board);if(bad.size){state.selected=[...bad][0];render();setStatus('Die Vorgabe enthält einen Widerspruch. Markiertes Feld prüfen.','bad');return false}
  const count=Core.countSolutions(state.board,2);if(count===0){setStatus('Für diese Vorgabe existiert keine Lösung.','bad');return false}if(count>1){setStatus('Die Vorgabe ist noch nicht eindeutig lösbar. Bitte weitere Zahlen eintragen.','bad');return false}
  const sol=Core.solve(state.board);if(!sol){setStatus('Keine Lösung gefunden.','bad');return false}state.solution=sol;state.puzzle=state.board.slice();state.givens=new Set(state.board.map((n,i)=>n?i:-1).filter(i=>i>=0));state.manualLocked=true;ui.manualEdit.classList.remove('hidden');setStatus('Eindeutige Lösung gefunden. Der Einzelschritt-Löser ist bereit.','good');render();return true
}
$('#manual-edit').onclick=()=>{state.manualLocked=false;state.solution=null;state.hints.clear();state.givens.clear();ui.manualEdit.classList.add('hidden');setStatus('Vorgabe wieder freigegeben. Zahlen eingeben oder ändern.');render()};
$('#step-solve').onclick=()=>{
  if(state.mode==='manual'&&!prepareManual())return;
  if(!state.solution){setStatus('Noch keine Lösung verfügbar.','bad');return}
  let target=-1;for(let i=0;i<81;i++)if(!state.board[i]){target=i;break}
  if(target<0){checkFinished(true);return}
  state.board[target]=state.solution[target];state.hints.add(target);state.selected=target;saveDaily();render();setStatus(`Feld Zeile ${Math.floor(target/9)+1}, Spalte ${target%9+1} wurde gelöst.`,'good')
};
function checkFinished(force=false){if(state.board.some(n=>!n))return;const ok=state.solution?state.board.every((n,i)=>n===state.solution[i]):Core.boardValid(state.board);if(ok){setStatus('Geschafft – das Sudoku ist vollständig gelöst! 🎉','good');if(force)showToast('Sudoku gelöst! 🎉')}else if(force)setStatus('Das Gitter ist vollständig, enthält aber Fehler.','bad')}
ui.date.value=localDateString();renderPad();
})();
