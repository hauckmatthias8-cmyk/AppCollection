(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.SudokuCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const SIZE=9, BOX=3, FULL_MASK=0x3FE;
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
  function boardValid(board){if(!Array.isArray(board)||board.length!==81)return false;for(let i=0;i<81;i++){const n=board[i]|0;if(n<0||n>9)return false;if(n&& !isValidPlacement(board,i,n))return false}return true}
  function candidateMask(board,index){if(board[index])return 0;let mask=FULL_MASK,r=Math.floor(index/9),c=index%9;for(let i=0;i<9;i++){const a=board[r*9+i],b=board[i*9+c];if(a)mask&=~(1<<a);if(b)mask&=~(1<<b)}const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++){const n=board[rr*9+cc];if(n)mask&=~(1<<n)}return mask}
  function bitCount(x){x=x-((x>>>1)&0x55555555);x=(x&0x33333333)+((x>>>2)&0x33333333);return(((x+(x>>>4))&0x0F0F0F0F)*0x01010101)>>>24}
  function chooseCell(board){let best=-1,bmask=0,bcount=10;for(let i=0;i<81;i++)if(!board[i]){const m=candidateMask(board,i),c=bitCount(m);if(c===0)return{i,mask:0};if(c<bcount){best=i;bmask=m;bcount=c;if(c===1)break}}return{ i:best, mask:bmask}}
  function countSolutions(input,limit=2){const board=input.slice();if(!boardValid(board))return 0;let count=0;function rec(){if(count>=limit)return;const ch=chooseCell(board);if(ch.i<0){count++;return}if(!ch.mask)return;for(let n=1;n<=9;n++)if(ch.mask&(1<<n)){board[ch.i]=n;rec();board[ch.i]=0;if(count>=limit)return}}rec();return count}
  function solve(input){const board=input.slice();if(!boardValid(board))return null;function rec(){const ch=chooseCell(board);if(ch.i<0)return true;if(!ch.mask)return false;for(let n=1;n<=9;n++)if(ch.mask&(1<<n)){board[ch.i]=n;if(rec())return true;board[ch.i]=0}return false}return rec()?board:null}
  function generate(seed,targetClues=32){const solution=solvedGrid(seed),puzzle=solution.slice(),rng=rngFromSeed(String(seed)+':remove:v2');const order=shuffle(Array.from({length:81},(_,i)=>i),rng);let clues=81;for(const i of order){if(clues<=targetClues)break;const old=puzzle[i];puzzle[i]=0;if(countSolutions(puzzle,2)!==1)puzzle[i]=old;else clues--}return{puzzle,solution,clues,seed:String(seed)}}
  function daily(dateString){return generate('daily:'+dateString+':haucki-v1',32)}
  function randomSeed(){if(typeof crypto!=='undefined'&&crypto.getRandomValues){const a=new Uint32Array(4);crypto.getRandomValues(a);return 'random:'+Array.from(a).join('-')}return 'random:'+Date.now()+':'+Math.random()}
  function conflicts(board){const bad=new Set();for(let i=0;i<81;i++){const n=board[i]|0;if(!n)continue;const copy=board.slice();copy[i]=0;if(!isValidPlacement(copy,i,n))bad.add(i)}return bad}
  return{hashString,rngFromSeed,solvedGrid,isValidPlacement,boardValid,candidateMask,countSolutions,solve,generate,daily,randomSeed,conflicts};
});
