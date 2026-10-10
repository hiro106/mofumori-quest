export const LIMIT=57;
const valid = v => typeof v==='number'&&Number.isFinite(v);
export function isWalkable(x,z,obstacles=[],padding=.55){if(!valid(x)||!valid(z)||Math.hypot(x,z)>LIMIT-padding)return false;return !obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+padding);}
export function movePlayer(position,dx,dz,obstacles=[]){
 if(!valid(dx)||!valid(dz))return {...position};
 const length=Math.hypot(dx,dz),cap=Math.min(4,length),steps=Math.max(1,Math.ceil(cap/.22));if(!length)return {...position};dx=dx/length*cap/steps;dz=dz/length*cap/steps;let {x,z}=position;
 for(let i=0;i<steps;i++){if(isWalkable(x+dx,z+dz,obstacles)){x+=dx;z+=dz;}else if(isWalkable(x+dx,z,obstacles))x+=dx;else if(isWalkable(x,z+dz,obstacles))z+=dz;}
 return {...position,x,z};
}
// Small deterministic A* used only after a tap, so walking can route around props.
export function findPath(start,goal,obstacles=[]){
 if(![start.x,start.z,goal.x,goal.z].every(valid))return [];
 const cell=2,key=(x,z)=>`${x},${z}`,sx=Math.round(start.x/cell),sz=Math.round(start.z/cell),gx=Math.round(goal.x/cell),gz=Math.round(goal.z/cell);
 if(!isWalkable(goal.x,goal.z,obstacles))return [];
 const open=[{x:sx,z:sz,g:0,f:0}],known=new Map([[key(sx,sz),{g:0,parent:null}]]),closed=new Set();let end=null;
 for(let n=0;open.length&&n<4200;n++){
  let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
  const cur=open.splice(best,1)[0],k=key(cur.x,cur.z);if(closed.has(k))continue;closed.add(k);
  if(Math.abs(cur.x-gx)<=1&&Math.abs(cur.z-gz)<=1){end=k;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=cur.x+dx,z=cur.z+dz,nk=key(x,z);if(closed.has(nk)||!isWalkable(x*cell,z*cell,obstacles,.8))continue;
   if(dx&&dz&&(!isWalkable((cur.x+dx)*cell,cur.z*cell,obstacles,.8)||!isWalkable(cur.x*cell,(cur.z+dz)*cell,obstacles,.8)))continue;
   const g=cur.g+Math.hypot(dx,dz);if((known.get(nk)?.g??Infinity)<=g)continue;
   known.set(nk,{g,parent:k});open.push({x,z,g,f:g+Math.hypot(gx-x,gz-z)});
  }
 }
 if(!end)return [];const path=[];for(let k=end;k;k=known.get(k)?.parent){const [x,z]=k.split(',').map(Number);path.push({x:x*cell,z:z*cell});}path.reverse();path.shift();path.push({x:goal.x,z:goal.z});return path;
}

// Saves from an older layout or a hand-edited file must not strand the player in scenery.
export function safePosition(position,obstacles=[]){if(position&&isWalkable(position.x,position.z,obstacles))return {...position};return {x:0,z:17,yaw:0};}
