const FACE_META = [
  {key:'F', name:'Vorn', help:'Deine feste Vorderseite. Diese Seite ist die Referenz für Rechts/Links.'},
  {key:'R', name:'Rechts', help:'Die rechte Seite bezogen auf deine festgelegte Vorder- und Oberseite.'},
  {key:'B', name:'Hinten', help:'Die Seite genau gegenüber von Vorn.'},
  {key:'L', name:'Links', help:'Die linke Seite bezogen auf deine festgelegte Vorder- und Oberseite.'},
  {key:'U', name:'Oben', help:'Die festgelegte Oberseite.'},
  {key:'D', name:'Unten', help:'Die Seite genau gegenüber von Oben.'},
];
const FACE_ORDER = ['U','R','F','D','L','B'];
const FACE_NAMES = {U:'Oben',R:'Rechts',F:'Vorn',D:'Unten',L:'Links',B:'Hinten'};
const state = { samples:{}, previews:{}, grids:null, centers:null, selectedLabel:'U', solution:null, moveIndex:0, solverReady:false };
const $ = q => document.querySelector(q);

function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
  document.querySelectorAll('.step').forEach(s=>s.classList.toggle('active',s.dataset.view===name));
  window.scrollTo({top:0,behavior:'smooth'});
}
let toastTimer;
function toast(msg){clearTimeout(toastTimer);const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');toastTimer=setTimeout(()=>t.classList.add('hidden'),3600)}
function busy(text){$('#busy-text').textContent=text;$('#busy').classList.remove('hidden')}
function unbusy(){$('#busy').classList.add('hidden')}

if(location.protocol !== 'file:' && 'serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
if(isiOS && !standalone) $('#install-hint').classList.remove('hidden');

function renderFaceCards(){
  const root=$('#face-list');root.innerHTML='';
  FACE_META.forEach(meta=>{
    const ready=!!state.samples[meta.key];
    const b=document.createElement('button');b.className='face-card';
    b.innerHTML=`<div class="face-badge">${meta.key}</div><div class="face-info"><b>${meta.name}</b><span>${ready?'Erfasst – antippen zum Ersetzen':'Foto aufnehmen oder auswählen'}</span></div>${ready?`<img class="face-preview" src="${state.previews[meta.key]}" alt="${meta.name}"><span class="face-check">✓</span>`:'<span class="face-check">＋</span>'}`;
    b.addEventListener('click',()=>openScan(meta.key));root.appendChild(b);
  });
  $('#to-check').disabled=!FACE_ORDER.every(f=>state.samples[f]);
}
renderFaceCards();

const modal=$('#scan-modal'), input=$('#photo-input'), canvas=$('#photo-canvas'), ctx=canvas.getContext('2d',{willReadFrequently:true});
let currentFace=null,currentImage=null,cornerPoints=[],dragIndex=-1;
function openScan(face){
  currentFace=face; currentImage=null; cornerPoints=[]; dragIndex=-1; input.value='';
  const m=FACE_META.find(x=>x.key===face);$('#modal-title').textContent=`${m.name} (${face})`;$('#modal-help').textContent=m.help;
  $('#canvas-wrap').classList.add('hidden');$('#reset-corners').disabled=true;$('#accept-face').disabled=true;$('#corner-status').textContent='Noch kein Foto ausgewählt.';modal.classList.remove('hidden');
}
function closeScan(){modal.classList.add('hidden')}
$('#close-modal').onclick=closeScan;modal.addEventListener('click',e=>{if(e.target===modal)closeScan()});

input.addEventListener('change',()=>{
  const file=input.files?.[0];if(!file)return;
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
    const max=1400,s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*s));canvas.height=Math.max(1,Math.round(img.naturalHeight*s));
    ctx.drawImage(img,0,0,canvas.width,canvas.height);currentImage=img;cornerPoints=[];
    $('#canvas-wrap').classList.remove('hidden');$('#reset-corners').disabled=false;updateCornerState();drawCanvas();URL.revokeObjectURL(url);
  };
  img.onerror=()=>toast('Foto konnte nicht geladen werden.');img.src=url;
});

function ordered(pts){
  if(pts.length!==4)return pts;
  const tagged=pts.map((p,i)=>({p,i,s:p.x+p.y,d:p.x-p.y}));
  const tl=tagged.reduce((a,b)=>a.s<b.s?a:b).p, br=tagged.reduce((a,b)=>a.s>b.s?a:b).p;
  const tr=tagged.reduce((a,b)=>a.d>b.d?a:b).p, bl=tagged.reduce((a,b)=>a.d<b.d?a:b).p;
  if(new Set([tl,tr,br,bl]).size<4){return [...pts].sort((a,b)=>Math.atan2(a.y-.5,a.x-.5)-Math.atan2(b.y-.5,b.x-.5));}
  return [tl,tr,br,bl];
}
function lerp(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function drawCanvas(){
  if(!currentImage)return;
  ctx.drawImage(currentImage,0,0,canvas.width,canvas.height);
  if(!cornerPoints.length)return;
  const p=ordered(cornerPoints).map(q=>({x:q.x*canvas.width,y:q.y*canvas.height}));
  ctx.save();ctx.strokeStyle='#6ee7ff';ctx.fillStyle='#6ee7ff';ctx.lineWidth=Math.max(3,canvas.width/320);
  if(p.length>1){ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);if(p.length===4)ctx.closePath();ctx.stroke()}
  if(p.length===4){ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=Math.max(1.5,canvas.width/600);[1/3,2/3].forEach(t=>{let a=lerp(p[0],p[1],t),b=lerp(p[3],p[2],t);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();a=lerp(p[0],p[3],t);b=lerp(p[1],p[2],t);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()})}
  cornerPoints.forEach((q,i)=>{const x=q.x*canvas.width,y=q.y*canvas.height,r=Math.max(10,canvas.width/75);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#06111c';ctx.font=`800 ${Math.max(14,canvas.width/55)}px -apple-system`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x,y);ctx.fillStyle='#6ee7ff'});ctx.restore();
}
function eventPoint(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}}
canvas.addEventListener('pointerdown',e=>{if(!currentImage)return;const p=eventPoint(e);if(cornerPoints.length<4){cornerPoints.push(p);dragIndex=cornerPoints.length-1}else{let best=0,bd=Infinity;cornerPoints.forEach((q,i)=>{const d=Math.hypot(p.x-q.x,p.y-q.y);if(d<bd){bd=d;best=i}});cornerPoints[best]=p;dragIndex=best}canvas.setPointerCapture(e.pointerId);updateCornerState();drawCanvas()});
canvas.addEventListener('pointermove',e=>{if(dragIndex<0)return;cornerPoints[dragIndex]=eventPoint(e);drawCanvas()});
canvas.addEventListener('pointerup',()=>dragIndex=-1);canvas.addEventListener('pointercancel',()=>dragIndex=-1);
$('#reset-corners').onclick=()=>{cornerPoints=[];updateCornerState();drawCanvas()};
function updateCornerState(){const n=cornerPoints.length;$('#corner-status').textContent=n===4?'4/4 Ecken markiert – Raster prüfen und übernehmen.':`${n}/4 Ecken markiert.`;$('#accept-face').disabled=!(currentImage&&n===4)}

function gaussSolve(A,b){
  const n=b.length,M=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;for(let r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[pivot][col]))pivot=r;
    if(Math.abs(M[pivot][col])<1e-12)throw new Error('Ungültige Perspektive.');
    [M[col],M[pivot]]=[M[pivot],M[col]];const d=M[col][col];for(let c=col;c<=n;c++)M[col][c]/=d;
    for(let r=0;r<n;r++){if(r===col)continue;const f=M[r][col];for(let c=col;c<=n;c++)M[r][c]-=f*M[col][c]}
  }
  return M.map(r=>r[n]);
}
function homographyFromUnit(points){
  const q=ordered(points).map(p=>({x:p.x*canvas.width,y:p.y*canvas.height}));
  const uv=[[0,0],[1,0],[1,1],[0,1]],A=[],b=[];
  for(let i=0;i<4;i++){const [u,v]=uv[i],x=q[i].x,y=q[i].y;A.push([u,v,1,0,0,0,-x*u,-x*v]);b.push(x);A.push([0,0,0,u,v,1,-y*u,-y*v]);b.push(y)}
  return gaussSolve(A,b);
}
function project(H,u,v){const d=H[6]*u+H[7]*v+1;return{x:(H[0]*u+H[1]*v+H[2])/d,y:(H[3]*u+H[4]*v+H[5])/d}}
function median(arr){const a=[...arr].sort((x,y)=>x-y),n=a.length;return n%2?a[(n-1)/2]:Math.round((a[n/2-1]+a[n/2])/2)}
function extractSamples(){
  const H=homographyFromUnit(cornerPoints),image=ctx.getImageData(0,0,canvas.width,canvas.height),data=image.data,w=image.width,h=image.height;
  const get=(x,y)=>{x=Math.max(0,Math.min(w-1,Math.round(x)));y=Math.max(0,Math.min(h-1,Math.round(y)));const k=(y*w+x)*4;return[data[k],data[k+1],data[k+2]]};
  const grid=[];
  for(let r=0;r<3;r++){const row=[];for(let c=0;c<3;c++){
    const rs=[],gs=[],bs=[];for(let iy=-3;iy<=3;iy++)for(let ix=-3;ix<=3;ix++){
      const u=(c+.5)/3+ix*.0105,v=(r+.5)/3+iy*.0105,p=project(H,u,v),rgb=get(p.x,p.y);rs.push(rgb[0]);gs.push(rgb[1]);bs.push(rgb[2]);
    }row.push([median(rs),median(gs),median(bs)]);
  }grid.push(row)}
  return {grid,H,image};
}
function makePreview(H,image){
  const out=document.createElement('canvas');out.width=180;out.height=180;const ox=out.getContext('2d'),od=ox.createImageData(180,180),src=image.data,w=image.width,h=image.height;
  for(let y=0;y<180;y++)for(let x=0;x<180;x++){const p=project(H,(x+.5)/180,(y+.5)/180),sx=Math.max(0,Math.min(w-1,Math.round(p.x))),sy=Math.max(0,Math.min(h-1,Math.round(p.y))),si=(sy*w+sx)*4,di=(y*180+x)*4;od.data[di]=src[si];od.data[di+1]=src[si+1];od.data[di+2]=src[si+2];od.data[di+3]=255}
  ox.putImageData(od,0,0);return out.toDataURL('image/jpeg',.78);
}
$('#accept-face').onclick=()=>{
  try{busy('Farbfelder lokal auslesen …');const {grid,H,image}=extractSamples();state.samples[currentFace]=grid;state.previews[currentFace]=makePreview(H,image);renderFaceCards();closeScan();toast(`${FACE_NAMES[currentFace]} übernommen.`)}catch(e){toast(e.message||'Seite konnte nicht ausgewertet werden.')}finally{unbusy()}
};

function srgbLinear(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}
function rgbToLab(rgb){const r=srgbLinear(rgb[0]),g=srgbLinear(rgb[1]),b=srgbLinear(rgb[2]);let x=(r*.4124+g*.3576+b*.1805)/.95047,y=(r*.2126+g*.7152+b*.0722),z=(r*.0193+g*.1192+b*.9505)/1.08883;const f=t=>t>.008856?Math.cbrt(t):(7.787*t+16/116);x=f(x);y=f(y);z=f(z);return[116*y-16,500*(x-y),200*(y-z)]}
function labDist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}
function hungarian(cost){
  const n=cost.length,m=cost[0].length,u=Array(n+1).fill(0),v=Array(m+1).fill(0),p=Array(m+1).fill(0),way=Array(m+1).fill(0);
  for(let i=1;i<=n;i++){p[0]=i;let j0=0,minv=Array(m+1).fill(Infinity),used=Array(m+1).fill(false);do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=m;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<minv[j]){minv[j]=cur;way[j]=j0}if(minv[j]<delta){delta=minv[j];j1=j}}for(let j=0;j<=m;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta}else minv[j]-=delta;j0=j1}while(p[j0]!==0);do{const j1=way[j0];p[j0]=p[j1];j0=j1}while(j0!==0)}
  const a=Array(n).fill(-1);for(let j=1;j<=m;j++)if(p[j])a[p[j]-1]=j-1;return a;
}
function classify(){
  const centers={};FACE_ORDER.forEach(f=>centers[f]=state.samples[f][1][1].map(Math.round));const labs={};FACE_ORDER.forEach(f=>labs[f]=rgbToLab(centers[f]));
  const grids={};FACE_ORDER.forEach(f=>grids[f]=Array.from({length:3},()=>Array(3).fill('')));const items=[];FACE_ORDER.forEach(f=>{grids[f][1][1]=f;for(let r=0;r<3;r++)for(let c=0;c<3;c++)if(!(r===1&&c===1))items.push({f,r,c,lab:rgbToLab(state.samples[f][r][c])})});
  const slots=[];FACE_ORDER.forEach(f=>{for(let i=0;i<8;i++)slots.push(f)});const cost=items.map(it=>slots.map(s=>labDist(it.lab,labs[s]))),ass=hungarian(cost);items.forEach((it,i)=>grids[it.f][it.r][it.c]=slots[ass[i]]);state.centers=centers;state.grids=grids;
}
$('#to-check').onclick=()=>{try{busy('Farben lokal zuordnen …');classify();renderEditor();showView('check')}catch(e){toast(e.message||'Farben konnten nicht erkannt werden.')}finally{unbusy()}};
$('#back-scan').onclick=()=>showView('scan');
function rgbCss(rgb){return`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`}
function renderPalette(){const p=$('#palette');p.innerHTML='';FACE_ORDER.forEach(f=>{const b=document.createElement('button');b.style.background=rgbCss(state.centers[f]);b.classList.toggle('selected',state.selectedLabel===f);b.title=FACE_NAMES[f];b.onclick=()=>{state.selectedLabel=f;renderPalette()};p.appendChild(b)})}
function renderEditor(){renderPalette();const root=$('#editor');root.innerHTML='';FACE_ORDER.forEach(f=>{const wrap=document.createElement('div');wrap.className='face-editor';wrap.innerHTML=`<h3>${FACE_NAMES[f]} (${f})</h3>`;const g=document.createElement('div');g.className='grid3';for(let r=0;r<3;r++)for(let c=0;c<3;c++){const b=document.createElement('button'),lab=state.grids[f][r][c];b.className='sticker'+(r===1&&c===1?' center':'');b.style.background=rgbCss(state.centers[lab]);if(!(r===1&&c===1))b.onclick=()=>{state.grids[f][r][c]=state.selectedLabel;renderEditor()};g.appendChild(b)}wrap.appendChild(g);root.appendChild(wrap)});renderCounts()}
function counts(){const c=Object.fromEntries(FACE_ORDER.map(f=>[f,0]));FACE_ORDER.forEach(f=>state.grids[f].forEach(row=>row.forEach(x=>c[x]++)));return c}
function renderCounts(){const c=counts(),ok=FACE_ORDER.every(f=>c[f]===9);$('#counts').innerHTML=`<b class="${ok?'good':'bad'}">${ok?'✓ Jede Farbe kommt genau 9× vor.':'Farben noch nicht konsistent.'}</b><br>`+FACE_ORDER.map(f=>`${FACE_NAMES[f]}: ${c[f]}×`).join(' · ')}

function rotateGridCW(grid,turns){let out=grid.map(r=>[...r]);for(let t=0;t<(turns%4);t++)out=out[0].map((_,i)=>out.map(row=>row[i]).reverse());return out}
function buildFacelets(grids,rots={}){return FACE_ORDER.map(f=>rotateGridCW(grids[f],rots[f]||0).flat().join('')).join('')}
const base=Object.fromEntries(FACE_ORDER.map((f,i)=>[f,i*9])),idx=(f,p)=>base[f]+p-1;
const CORNER_FACELETS=[[idx('U',9),idx('R',1),idx('F',3)],[idx('U',7),idx('F',1),idx('L',3)],[idx('U',1),idx('L',1),idx('B',3)],[idx('U',3),idx('B',1),idx('R',3)],[idx('D',3),idx('F',9),idx('R',7)],[idx('D',1),idx('L',9),idx('F',7)],[idx('D',7),idx('B',9),idx('L',7)],[idx('D',9),idx('R',9),idx('B',7)]];
const CORNER_COLORS=[['U','R','F'],['U','F','L'],['U','L','B'],['U','B','R'],['D','F','R'],['D','L','F'],['D','B','L'],['D','R','B']];
const EDGE_FACELETS=[[idx('U',6),idx('R',2)],[idx('U',8),idx('F',2)],[idx('U',4),idx('L',2)],[idx('U',2),idx('B',2)],[idx('D',6),idx('R',8)],[idx('D',2),idx('F',8)],[idx('D',4),idx('L',8)],[idx('D',8),idx('B',8)],[idx('F',6),idx('R',4)],[idx('F',4),idx('L',6)],[idx('B',6),idx('L',4)],[idx('B',4),idx('R',6)]];
const EDGE_COLORS=[['U','R'],['U','F'],['U','L'],['U','B'],['D','R'],['D','F'],['D','L'],['D','B'],['F','R'],['F','L'],['B','L'],['B','R']];
function parity(a){let inv=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)inv^=(a[i]>a[j])?1:0;return inv}
function verifyFacelets(s){
  if(s.length!==54)return false;for(const c of FACE_ORDER)if([...s].filter(x=>x===c).length!==9)return false;
  const cp=Array(8).fill(-1),co=Array(8).fill(0);for(let i=0;i<8;i++){const fl=CORNER_FACELETS[i];let ori=-1;for(let o=0;o<3;o++)if('UD'.includes(s[fl[o]])){ori=o;break}if(ori<0)return false;const c1=s[fl[(ori+1)%3]],c2=s[fl[(ori+2)%3]];let cub=-1;for(let j=0;j<8;j++)if(c1===CORNER_COLORS[j][1]&&c2===CORNER_COLORS[j][2]){cub=j;break}if(cub<0)return false;cp[i]=cub;co[i]=ori%3}
  if(new Set(cp).size!==8||co.reduce((a,b)=>a+b,0)%3!==0)return false;
  const ep=Array(12).fill(-1),eo=Array(12).fill(0);for(let i=0;i<12;i++){const [a,b]=EDGE_FACELETS[i],x=s[a],y=s[b];let ok=false;for(let j=0;j<12;j++){const [u,v]=EDGE_COLORS[j];if(x===u&&y===v){ep[i]=j;eo[i]=0;ok=true;break}if(x===v&&y===u){ep[i]=j;eo[i]=1;ok=true;break}}if(!ok)return false}
  return new Set(ep).size===12&&eo.reduce((a,b)=>a+b,0)%2===0&&parity(cp)===parity(ep);
}
function findValidOrientation(){
  const raw=buildFacelets(state.grids);for(const f of FACE_ORDER)if([...raw].filter(x=>x===f).length!==9)throw new Error(`${FACE_NAMES[f]} kommt nicht 9× vor.`);
  const uniq=new Map();for(let n=0;n<4096;n++){let x=n,rot={};for(const f of FACE_ORDER){rot[f]=x&3;x>>=2}const s=buildFacelets(state.grids,rot);if(verifyFacelets(s)&&!uniq.has(s))uniq.set(s,rot)}
  if(!uniq.size)throw new Error('Aus diesen Farbfeldern lässt sich kein physikalisch möglicher Würfel bilden. Bitte die Erkennung prüfen.');
  const list=[...uniq.entries()].map(([facelets,rot])=>({facelets,rot,cost:Object.values(rot).reduce((a,v)=>a+Math.min(v,4-v),0)})).sort((a,b)=>a.cost-b.cost);return{...list[0],count:uniq.size};
}
function moveInfo(token,i){const f=token[0];if(token.endsWith('2'))return{token,face:f,text:`${FACE_NAMES[f]} um 180° drehen`,arrow:'180°',i};if(token.endsWith("'"))return{token,face:f,text:`${FACE_NAMES[f]} 90° gegen den Uhrzeigersinn`,arrow:'↺',i};return{token,face:f,text:`${FACE_NAMES[f]} 90° im Uhrzeigersinn`,arrow:'↻',i}}
function solveNow(){
  const c=counts();if(!FACE_ORDER.every(f=>c[f]===9)){toast('Jede Farbe muss genau 9× vorkommen.');return}
  busy('Würfelzustand prüfen …');setTimeout(()=>{
    try{
      const candidate=findValidOrientation();
      if(typeof Cube==='undefined')throw new Error('Lokale Solver-Dateien fehlen oder konnten nicht geladen werden.');
      if(!state.solverReady){$('#busy-text').textContent='Solver einmalig vorbereiten …';Cube.initSolver();state.solverReady=true}
      $('#busy-text').textContent='Lösung berechnen …';const cube=Cube.fromString(candidate.facelets),notation=(cube.solve()||'').trim(),tokens=notation?notation.split(/\s+/):[];
      state.solution={notation,tokens,moves:tokens.map((t,i)=>moveInfo(t,i+1)),rot:candidate.rot,orientationCount:candidate.count};state.moveIndex=0;renderSolution();showView('solve');
    }catch(e){toast(e.message||'Lösen fehlgeschlagen.')}finally{unbusy()}
  },60);
}
$('#solve-btn').onclick=solveNow;
function swatch(f){return`<span style="display:inline-block;width:16px;height:16px;border-radius:5px;vertical-align:-3px;margin:0 4px;background:${rgbCss(state.centers[f])};border:1px solid #fff8"></span>`}
function renderSolution(){
  const s=state.solution;$('#notation').textContent=s.notation||'Bereits gelöst';$('#orientation-note').innerHTML=`Für die Züge: ${swatch('U')} = <b>Oben</b>, ${swatch('F')} = <b>Vorn</b>. Uhrzeigersinn gilt immer beim direkten Blick auf die genannte Fläche.${s.orientationCount>1?` (${s.orientationCount} mögliche Foto-Drehungen waren physikalisch gültig.)`:''}`;renderMove();
}
function renderMove(){const s=state.solution;if(!s||!s.moves.length){$('#move-progress').textContent='0 Züge nötig';$('#move-face').textContent='Fertig';$('#move-arrow').textContent='✓';$('#move-text').textContent='Der Würfel ist bereits gelöst.';$('#prev-move').disabled=true;$('#next-move').disabled=true;return}const m=s.moves[state.moveIndex];$('#move-progress').textContent=`Zug ${state.moveIndex+1} von ${s.moves.length} · ${m.token}`;$('#move-face').textContent=FACE_NAMES[m.face];$('#move-arrow').textContent=m.arrow;$('#move-text').textContent=m.text;$('#prev-move').disabled=state.moveIndex===0;$('#next-move').textContent=state.moveIndex===s.moves.length-1?'Fertig ✓':'Weiter →'}
$('#prev-move').onclick=()=>{if(state.moveIndex>0){state.moveIndex--;renderMove()}};
$('#next-move').onclick=()=>{if(!state.solution?.moves.length)return;if(state.moveIndex<state.solution.moves.length-1){state.moveIndex++;renderMove()}else toast('Fertig!')};
$('#new-cube').onclick=()=>{state.samples={};state.previews={};state.grids=null;state.centers=null;state.solution=null;renderFaceCards();showView('scan')};
