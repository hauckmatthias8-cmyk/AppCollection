(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.SudokuCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SIZE=9, BOX=3, FULL_MASK=0x3FE;
  const DIFFICULTIES={
    easy:{id:'easy',label:'Leicht',targetClues:40,maxSolutions:1},
    normal:{id:'normal',label:'Normal',targetClues:32,maxSolutions:1},
    hard:{id:'hard',label:'Schwer',targetClues:26,maxSolutions:2},
  };
  function normalizeDifficulty(value){return Object.prototype.hasOwnProperty.call(DIFFICULTIES,value)?value:'normal'}
  function difficultyConfig(value){return {...DIFFICULTIES[normalizeDifficulty(value)]}}
  function hashString(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function rngFromSeed(seed){let a=(typeof seed==='number'?seed:hashString(String(seed)))>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function shuffle(arr,rng){for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
  function basePattern(r,c){return (r*3+Math.floor(r/3)+c)%9}
  function solvedGrid(seed){
    const rng=rngFromSeed(seed), nums=shuffle([1,2,3,4,5,6,7,8,9],rng);
    const bands=shuffle([0,1,2],rng), stacks=shuffle([0,1,2],rng);
    const rows=[],cols=[];
    for(const b of bands){const inside=shuffle([0,1,2],rng);for(const x of inside)rows.push(b*3+x)}
    for(const s of stacks){const inside=shuffle([0,1,2],rng);for(const x of inside)cols.push(s*3+x)}
    const out=[];for(const r of rows)for(const c of cols)out.push(nums[basePattern(r,c)]);
    if(rng()<.5){const tr=Array(81).fill(0);for(let r=0;r<9;r++)for(let c=0;c<9;c++)tr[c*9+r]=out[r*9+c];return tr}return out;
  }
  function isValidPlacement(board,index,n){const r=Math.floor(index/9),c=index%9;for(let i=0;i<9;i++){const rv=r*9+i,cv=i*9+c;if(rv!==index&&board[rv]===n)return false;if(cv!==index&&board[cv]===n)return false}const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++){const k=rr*9+cc;if(k!==index&&board[k]===n)return false}return true}
  function boardValid(board){if(!Array.isArray(board)||board.length!==81)return false;for(let i=0;i<81;i++){const n=board[i]|0;if(n<0||n>9)return false;if(n&&!isValidPlacement(board,i,n))return false}return true}
  function candidateMask(board,index){if(board[index])return 0;let mask=FULL_MASK,r=Math.floor(index/9),c=index%9;for(let i=0;i<9;i++){const a=board[r*9+i],b=board[i*9+c];if(a)mask&=~(1<<a);if(b)mask&=~(1<<b)}const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++){const n=board[rr*9+cc];if(n)mask&=~(1<<n)}return mask}
  function candidates(board,index){const mask=candidateMask(board,index),out=[];for(let n=1;n<=9;n++)if(mask&(1<<n))out.push(n);return out}
  function bitCount(x){x=x-((x>>>1)&0x55555555);x=(x&0x33333333)+((x>>>2)&0x33333333);return(((x+(x>>>4))&0x0F0F0F0F)*0x01010101)>>>24}
  function chooseCell(board){let best=-1,bmask=0,bcount=10;for(let i=0;i<81;i++)if(!board[i]){const m=candidateMask(board,i),c=bitCount(m);if(c===0)return{i,mask:0};if(c<bcount){best=i;bmask=m;bcount=c;if(c===1)break}}return{i:best,mask:bmask}}
  function solveAll(input,limit=2){
    const board=input.slice(),solutions=[];
    if(!boardValid(board)||limit<1)return solutions;
    function rec(){
      if(solutions.length>=limit)return;
      const ch=chooseCell(board);
      if(ch.i<0){solutions.push(board.slice());return}
      if(!ch.mask)return;
      for(let n=1;n<=9;n++)if(ch.mask&(1<<n)){board[ch.i]=n;rec();board[ch.i]=0;if(solutions.length>=limit)return}
    }
    rec();return solutions;
  }
  function countSolutions(input,limit=2){return solveAll(input,limit).length}
  function solve(input){const sols=solveAll(input,1);return sols.length?sols[0]:null}
  function generate(seed,targetClues=32,maxSolutions=1,removalSeedSuffix=null){
    targetClues=Math.max(17,Math.min(81,targetClues|0));maxSolutions=Math.max(1,maxSolutions|0);
    const removalSeed=removalSeedSuffix||`:remove:v3:${targetClues}:${maxSolutions}`;
    const sourceSolution=solvedGrid(seed),puzzle=sourceSolution.slice(),rng=rngFromSeed(String(seed)+removalSeed);
    const order=shuffle(Array.from({length:81},(_,i)=>i),rng);let clues=81;
    for(const i of order){
      if(clues<=targetClues)break;
      const old=puzzle[i];puzzle[i]=0;
      const count=countSolutions(puzzle,maxSolutions+1);
      if(count<1||count>maxSolutions)puzzle[i]=old;else clues--;
    }
    const solutions=solveAll(puzzle,maxSolutions+1);
    return{puzzle,solution:solutions[0]||sourceSolution,solutionCount:Math.min(solutions.length,maxSolutions+1),clues,seed:String(seed),maxSolutions};
  }
  function generateDifficulty(seed,difficulty='normal'){
    const d=difficultyConfig(difficulty),data=generate(seed,d.targetClues,d.maxSolutions);
    return{...data,difficulty:d.id,difficultyLabel:d.label,targetClues:d.targetClues,maxSolutions:d.maxSolutions};
  }
  function daily(dateString,difficulty='normal'){
    const d=normalizeDifficulty(difficulty);
    const seed=d==='normal'?`daily:${dateString}:haucki-v1`:`daily:${dateString}:haucki-v1:${d}`;
    if(d==='normal'){const data=generate(seed,32,1,':remove:v2');return{...data,difficulty:'normal',difficultyLabel:'Normal',targetClues:32,maxSolutions:1}}
    return generateDifficulty(seed,d);
  }
  function randomSeed(){if(typeof crypto!=='undefined'&&crypto.getRandomValues){const a=new Uint32Array(4);crypto.getRandomValues(a);return 'random:'+Array.from(a).join('-')}return 'random:'+Date.now()+':'+Math.random()}
  function conflicts(board){const bad=new Set();for(let i=0;i<81;i++){const n=board[i]|0;if(!n)continue;const copy=board.slice();copy[i]=0;if(!isValidPlacement(copy,i,n))bad.add(i)}return bad}
  return{DIFFICULTIES,normalizeDifficulty,difficultyConfig,hashString,rngFromSeed,solvedGrid,isValidPlacement,boardValid,candidateMask,candidates,countSolutions,solveAll,solve,generate,generateDifficulty,daily,randomSeed,conflicts};
});
