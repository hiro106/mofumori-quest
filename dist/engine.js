import * as THREE from './vendor/three.module.js';
import {buildCreature,buildExplorer} from './creatures.js';
import {buildIsland} from './island.js';
import {buildArenaGarden} from './arena.js';
import {buildKeeper} from './keepers.js';
import {buildBoss,buildStormArena} from './boss.js';
import {buildBattleFX} from './battle-fx.js';
import {makeTimeline,sampleTimeline} from './battle-timeline.js';
import {SPECIES,BOSS,isCollectionComplete,BY_ID,REGIONS,KEEPERS,TYPES,regionAt} from './catalog.js';
import {movePlayer,findPath,safePosition} from './navigation.js';
import {frameBattleCamera} from './framing.js';

const v=(x,y,z)=>new THREE.Vector3(x,y,z),ease=(a,b,t)=>a+(b-a)*t;
export class GameEngine {
 constructor(canvas,{onNear,onWalk,onInteract,onRegion,onReady,getBattleFrame,onBattleCue}={}){
  this.canvas=canvas;this.callbacks={onNear,onWalk,onInteract,onRegion,onReady,getBattleFrame,onBattleCue};this.time=0;this.clock=0;this.paused=false;this.modal=true;this.started=false;this.keys=new Set();this.path=[];this.joystick={x:0,y:0};this.mode='world';this.zoom=11.5;this.theta=.15;this.playerPos={x:0,z:17,yaw:0};this.lastNear='';this.assets=[];this.disposables=[];this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.cinematic=!this.reduced;this.low=innerWidth<760||navigator.hardwareConcurrency<=4;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.low?1.3:1.7));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;this.renderer.shadowMap.enabled=!this.low;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#c5e4e5');this.scene.fog=new THREE.Fog('#c5e4e5',55,140);this.camera=new THREE.PerspectiveCamera(46,1,.1,230);this.focus=v(0,1,12);this.camGoal=v(12,19,37);
  this.hemi=new THREE.HemisphereLight('#effaff','#748971',1.7);this.scene.add(this.hemi);this.sun=new THREE.DirectionalLight('#fff0cf',2.6);this.sun.position.set(-22,38,25);this.sun.castShadow=!this.low;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-21,right:21,top:21,bottom:-21,near:1,far:90});this.sun.shadow.normalBias=.08;this.sun.shadow.bias=-.0001;this.scene.add(this.sun,this.sun.target);
  this.world=buildIsland();this.scene.add(this.world.group);this.assets.push(this.world);this.obstacles=this.world.obstacles||[];
  this.explorer=buildExplorer();this.scene.add(this.explorer.group);this.assets.push(this.explorer);this._addShadow(this.explorer.group,.55);
  this.encounters=[];for(const s of SPECIES){const c=buildCreature(s.id,{detail:'low'});c.group.position.set(s.pos[0],0,s.pos[1]);c.group.rotation.y=(s.pos[0]+s.pos[1])*.1;this.scene.add(c.group);this.assets.push(c);this.encounters.push({kind:'wild',id:s.id,x:s.pos[0],z:s.pos[1],title:s.name,model:c,object:c.group});c.group.userData.encounter=s.id;this._addShadow(c.group,s.id==='manta'?.8:.6);const label=this._label(s.name,TYPES[s.type].color,2.15);c.group.add(label);this.encounters[this.encounters.length-1].label=label;}
  this.markers=[];for(const r of REGIONS)this._marker(r.id,r.pos,r.id==='camp'?'camp':'waypost',r.name,r.color);for(const k of KEEPERS)this._marker(k.id,k.pos,'keeper',k.name,TYPES[k.type].color);
  const boss=buildBoss({detail:'low',scale:.7});boss.group.position.set(...[BOSS.pos[0],0,BOSS.pos[1]]);boss.group.userData.marker={kind:'boss',id:BOSS.id};boss.group.visible=false;this.scene.add(boss.group);this.assets.push(boss);this._addShadow(boss.group,1.4);const bossLabel=this._label('最終決戦・嵐竜ヴォルガ','#6571c0',3.9);boss.group.add(bossLabel);this.markers.push({kind:'boss',id:BOSS.id,x:BOSS.pos[0],z:BOSS.pos[1],title:BOSS.name,object:boss.group,label:bossLabel,boss});
  this.goalMarker=new THREE.Mesh(new THREE.RingGeometry(.35,.48,32),new THREE.MeshBasicMaterial({color:'#fff8db',side:THREE.DoubleSide,transparent:true,opacity:.9}));this.goalMarker.rotation.x=-Math.PI/2;this.goalMarker.position.y=.08;this.goalMarker.visible=false;this.scene.add(this.goalMarker);
  this.ray=new THREE.Raycaster();this.groundPlane=new THREE.Plane(v(0,1,0),0);this.pointer=new THREE.Vector2();this.battleGroup=new THREE.Group();this.battleGroup.visible=false;this.scene.add(this.battleGroup);this._buildArena();this.battleModels=[];this._bind();this.resize();this.last=performance.now();this.raf=requestAnimationFrame(t=>this.tick(t));onReady?.();
 }
 _marker(id,pos,kind,title,color){
  const g=new THREE.Group();g.position.set(pos[0],0,pos[1]);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,2.7,7),new THREE.MeshStandardMaterial({color:'#906f51',roughness:1}));pole.position.y=1.35;g.add(pole);
  const gem=new THREE.Mesh(kind==='keeper'?new THREE.OctahedronGeometry(.5):new THREE.SphereGeometry(.27,12,8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.2,roughness:.4}));gem.position.y=3;g.add(gem);g.userData.marker={kind,id};
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.05,1.13,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;g.add(ring);this.scene.add(g);const label=this._label(kind==='keeper'?title:kind==='camp'?'ひと休みの広場':title+'の道しるべ',color,3.75);g.add(label);let keeper=null;if(kind==='keeper'){pole.position.x=gem.position.x=-1.3;keeper=buildKeeper(id,{detail:'low'});keeper.group.position.set(.15,0,-.1);g.add(keeper.group);this._addShadow(keeper.group,.6);this.assets.push(keeper);this.obstacles.push({x:pos[0]+.15,z:pos[1]-.1,r:.5});}this.markers.push({kind,id,x:pos[0],z:pos[1],title,object:g,gem,ring,label,keeper});
 }
 _addShadow(parent,size){
  if(!this.shadowTexture){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');const gradient=ctx.createRadialGradient(32,32,4,32,32,30);gradient.addColorStop(0,'rgba(31,57,43,.32)');gradient.addColorStop(1,'rgba(31,57,43,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);this.shadowTexture=new THREE.CanvasTexture(c);this.shadowTexture.colorSpace=THREE.SRGBColorSpace;this.shadowGeometry=new THREE.PlaneGeometry(2,2);this.shadowMaterial=new THREE.MeshBasicMaterial({map:this.shadowTexture,transparent:true,depthWrite:false,toneMapped:false});}
  const shadow=new THREE.Mesh(this.shadowGeometry,this.shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.scale.set(size,size*.75,1);shadow.position.y=.035;shadow.name='soft contact shadow';parent.add(shadow);
 }
 _label(text,color,y){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#fffcf0';ctx.beginPath();ctx.roundRect(5,6,502,78,36);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.arc(36,45,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#45604f';ctx.font='600 26px "Yu Gothic UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,273,46,405);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false});const sprite=new THREE.Sprite(material);sprite.position.y=y;sprite.scale.set(3.5,.66,1);sprite.renderOrder=2;this.disposables.push(texture);return sprite;}
 _buildArena(){this.battleGroup.position.y=60;this.fx=buildBattleFX({low:this.low});this.battleGroup.add(this.fx.group);this.combatLight=new THREE.PointLight('#87d9ff',35,22);this.combatLight.position.set(0,5,5);this.battleGroup.add(this.combatLight);}
 _bind(){
  this.abort=new AbortController();const opts={signal:this.abort.signal};
  window.addEventListener('resize',()=>this.resize(),opts);document.addEventListener('visibilitychange',()=>{this.keys.clear();this.joystick={x:0,y:0};this.last=performance.now();},opts);window.addEventListener('blur',()=>this.clearMovement(),opts);
  window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)&&!this.modal)e.preventDefault();if(!this.modal&&!this.paused)this.keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='e'&&!e.repeat&&!this.modal&&!this.paused&&this.near)this.callbacks.onInteract?.(this.near);},opts);
  window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()),opts);
  this.canvas.addEventListener('pointerdown',e=>{if(this.mode!=='world'||this.modal||this.paused)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,last:e.clientX,moved:0};this.canvas.setPointerCapture(e.pointerId);},opts);
  this.canvas.addEventListener('pointermove',e=>{if(!this.drag||e.pointerId!==this.drag.id)return;const dx=e.clientX-this.drag.last;this.drag.last=e.clientX;this.drag.moved=Math.max(this.drag.moved,Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y));if(this.drag.moved>7)this.theta-=dx*.006;},opts);
  this.canvas.addEventListener('pointerup',e=>{if(!this.drag||e.pointerId!==this.drag.id)return;const click=this.drag.moved<8;this.drag=null;if(click)this.tap(e.clientX,e.clientY);},opts);
  this.canvas.addEventListener('pointercancel',()=>this.drag=null,opts);
  this.canvas.addEventListener('wheel',e=>{if(this.modal)return;e.preventDefault();this.zoom=Math.max(8,Math.min(23,this.zoom+e.deltaY*.015));},{...opts,passive:false});
 }
 clearMovement(){this.pendingInteract=null;this.keys.clear();this.joystick={x:0,y:0};this.path=[];this.goalMarker.visible=false;this.drag=null;}
 tap(x,y){if(this.modal||this.paused)return;const rect=this.canvas.getBoundingClientRect();this.pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);
  const active=[...this.encounters.filter(e=>e.object.visible),...this.markers.filter(m=>m.object.visible)];let picked=null;const hits=this.ray.intersectObjects(active.map(e=>e.object),true);if(hits[0]){let o=hits[0].object;while(o&&!o.userData.encounter&&!o.userData.marker)o=o.parent;picked=active.find(e=>e.object===o);}
  if(picked){if(Math.hypot(picked.x-this.playerPos.x,picked.z-this.playerPos.z)<5.5){this.callbacks.onInteract?.(picked);return;}const dx=this.playerPos.x-picked.x,dz=this.playerPos.z-picked.z,len=Math.hypot(dx,dz)||1;this.walkTo({x:picked.x+dx/len*2.3,z:picked.z+dz/len*2.3});this.pendingInteract=picked;return;}
  const target=v(0,0,0);if(this.ray.ray.intersectPlane(this.groundPlane,target)){this.pendingInteract=null;this.walkTo({x:target.x,z:target.z});}
 }
 walkTo(point){this.path=findPath(this.playerPos,point,this.obstacles);if(this.path.length){this.goalMarker.position.set(point.x,.07,point.z);this.goalMarker.visible=true;}}
 sync(state){this.state=state;if(!state)return;this.started=true;for(const e of this.encounters)e.object.visible=this.mode==='world'&&(e.id!=='star'||state.badges.length>=3&&!isCollectionComplete(state.collection));for(const marker of this.markers)if(marker.kind==='boss')marker.object.visible=this.mode==='world'&&state.badges.length===3&&isCollectionComplete(state.collection);const lead=state.team[0];if(lead!==this.followerId){if(this.follower){this.follower.group.removeFromParent();this.follower.dispose();}this.follower=buildCreature(lead,{detail:'low',scale:.8});this.followerId=lead;this.scene.add(this.follower.group);this._addShadow(this.follower.group,.5);this.follower.group.position.set(this.playerPos.x+1.5,0,this.playerPos.z+1.5);this.follower.group.visible=this.mode==='world';}}
 teleport(position){position=safePosition(position,this.obstacles);if(this.state)this.state.position={...position};this.playerPos={...position};this.explorer.group.position.set(position.x,0,position.z);this.focus.set(position.x,1,position.z);this.clearMovement();if(this.follower)this.follower.group.position.set(position.x+1.4,0,position.z+1.3);this.near=null;this.lastNear='';this.callbacks.onNear?.(null);}
 setModal(open){if(this.modal===open)return;this.modal=open;this.clearMovement();}
 setPaused(value){this.paused=value;this.clearMovement();}
 setBattle(b){this.mode='battle';this.clearMovement();this.world.group.visible=false;this.explorer.group.visible=false;for(const e of this.encounters)e.object.visible=false;for(const m of this.markers)m.object.visible=false;if(this.follower)this.follower.group.visible=false;this.battleGroup.visible=true;this.combatLight.intensity=b.kind==='boss'?85:12;if(this.arenaGarden){this.arenaGarden.group.removeFromParent();this.arenaGarden.dispose();}this.arenaGarden=b.kind==='boss'?buildStormArena():buildArenaGarden(BY_ID[b.enemies[0].id].type);this.battleGroup.add(this.arenaGarden.group);this.scene.background.set(b.kind==='boss'?'#152744':'#c5e4e5');this.hemi.color.set(b.kind==='boss'?'#b5d9ff':'#effaff');this.hemi.groundColor.set(b.kind==='boss'?'#18223d':'#748971');this.sun.color.set(b.kind==='boss'?'#bbe8ff':'#fff0cf');this.scene.fog=new THREE.Fog(b.kind==='boss'?'#152744':'#c5e4e5',70,170);this.effect=null;this.fx.reset();this.updateBattle(b);this.focus.set(0,61.3,0);this.sun.position.set(-12,82,15);this.sun.target.position.set(0,60,0);this._battleCamera();}
 updateBattle(b){this.battle=b;this.visualPhase=b.phase||1;const ids=[b.allies[b.active].id,b.enemies[b.enemy].id];if(this.battleModels.map(m=>m.id).join()!==ids.join()){for(const m of this.battleModels){m.model.group.removeFromParent();m.model.dispose();}this.battleModels=ids.map((id,i)=>{const model=id===BOSS.id?buildBoss({scale:1.05,detail:this.low?'low':'high'}):buildCreature(id,{scale:1.75});model.group.position.set(i?2.6:-2.6,0,i?-1:1);model.group.rotation.y=i?(id===BOSS.id?-.25:-1.2):1.95;this._addShadow(model.group,1.05);this.battleGroup.add(model.group);return {id,model};});}}
 animateBattle(events,done){const timeline=makeTimeline(events);this.effect={timeline,started:this.time,done,cue:null,impacted:null};return timeline.seconds;}
 _animateCombat(t){
  const effect=this.effect,age=effect?this.time-effect.started:0,entry=effect?sampleTimeline(effect.timeline,age):null;
  if(entry&&effect.cue!==entry){effect.cue=entry;if(entry.event.type==='phase')this.visualPhase=2;effect.impacted=null;this.fx.play(entry.event.type==='phase'?{...entry.event,type:'charge',special:true}:entry.event);this.callbacks.onBattleCue?.(entry.event,'start');}
  if(entry&&age>=entry.impact&&effect.impacted!==entry){effect.impacted=entry;this.callbacks.onBattleCue?.(entry.event,'impact');}
  const event=entry?.event,p=entry?Math.max(0,Math.min(1,(age-entry.start)/entry.seconds)):0,impact=event?.type==='hit'?Math.exp(-Math.max(0,p-.57)*17)*(p>=.57?1:0):0;
  if(entry)this.fx.update(age-entry.start);else this.fx.reset();
  for(let i=0;i<this.battleModels.length;i++){
   const side=i?'enemy':'ally',hit=event?.type==='hit'&&event.side===side,hurt=event?.type==='hit'&&event.side!==side,m=this.battleModels[i].model;
   const dash=hit?Math.sin(Math.max(0,Math.min(1,(p-.18)/.55))*Math.PI):0;
   m.animate(t,{attack:hit?dash:0,mood:hurt&&impact>.08?'hurt':this.battle.status==='won'&&i===0||this.battle.status==='befriended'?'happy':'idle',phase:this.visualPhase||1,defeated:i===1&&(this.battle.status==='won'||event?.type==='victory')});
   m.group.position.set((i?2.6:-2.6)+(hit?(i?-1:1)*dash*(event.special?.9:.65):hurt?(i?1:-1)*impact*.15:0),hit&&event.special&&m!==this.battleModels[1]?.model?Math.sin(p*Math.PI)*.22:0,(i?-1:1)+(hit?(i?1:-1)*dash*.25:0));
  }
  if(this.battleBase){this.camera.position.copy(this.battleBase.position);this.camera.quaternion.copy(this.battleBase.quaternion);if(this.cinematic&&entry){const shake=impact*(event.special?.22:.09);this.camera.position.x+=Math.sin(p*97)*shake;this.camera.position.y+=Math.cos(p*83)*shake*.5;if(event?.special||event?.type==='charge'){this.camera.position.lerp(this.focus,Math.sin(p*Math.PI)*.055);}}this.camera.updateMatrixWorld();}
  if(effect&&age>=effect.timeline.seconds){this.effect=null;this.fx.reset();effect.done?.();}
 }
 battlePoint(side){const point=v(side==='enemy'?2.6:-2.6,side==='enemy'&&this.battle?.kind==='boss'?63:62,side==='enemy'?-1:1).project(this.camera);return {x:(point.x+1)*50,y:(1-point.y)*50};}
 endBattle(){this.mode='world';this.battle=null;this.effect=null;this.fx.reset();this.scene.background.set('#c5e4e5');this.hemi.color.set('#effaff');this.hemi.groundColor.set('#748971');this.sun.color.set('#fff0cf');this.scene.fog=new THREE.Fog('#c5e4e5',55,140);this.camera.clearViewOffset();this.battleGroup.visible=false;for(const m of this.battleModels){m.model.group.removeFromParent();m.model.dispose();}this.battleModels=[];this.world.group.visible=true;this.explorer.group.visible=true;for(const m of this.markers)m.object.visible=true;if(this.follower)this.follower.group.visible=true;this.sync(this.state);this.focus.set(this.playerPos.x,1,this.playerPos.z);this.modal=false;}
 _walk(dt){
  const k=this.keys;let x=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0)+this.joystick.x,z=(k.has('s')||k.has('arrowdown')?1:0)-(k.has('w')||k.has('arrowup')?1:0)+this.joystick.y;
  let dx=0,dz=0;const manual=Math.hypot(x,z);if(manual>.1){this.path=[];this.pendingInteract=null;this.goalMarker.visible=false;x/=Math.max(1,manual);z/=Math.max(1,manual);dx=x*Math.cos(this.theta)+z*Math.sin(this.theta);dz=-x*Math.sin(this.theta)+z*Math.cos(this.theta);}
  else if(this.path.length){const p=this.path[0],d=Math.hypot(p.x-this.playerPos.x,p.z-this.playerPos.z);if(d<.5)this.path.shift();else{dx=(p.x-this.playerPos.x)/d;dz=(p.z-this.playerPos.z)/d;}}
  const speed=k.has('shift')?8.3:5.1,old={...this.playerPos};this.playerPos=movePlayer(this.playerPos,dx*speed*dt,dz*speed*dt,this.obstacles);this.moving=Math.hypot(this.playerPos.x-old.x,this.playerPos.z-old.z)>dt*.2?1:0;
  if(this.moving){this.playerPos.yaw=Math.atan2(dx,dz);this.callbacks.onWalk?.(this.playerPos,Math.hypot(this.playerPos.x-old.x,this.playerPos.z-old.z));}
  if(!this.path.length){this.goalMarker.visible=false;if(this.pendingInteract){const p=this.pendingInteract;this.pendingInteract=null;if(Math.hypot(p.x-this.playerPos.x,p.z-this.playerPos.z)<5.5)this.callbacks.onInteract?.(p);}}
  const near=[...this.encounters.filter(e=>e.object.visible),...this.markers.filter(m=>m.object.visible)].map(e=>({...e,d:Math.hypot(e.x-this.playerPos.x,e.z-this.playerPos.z)})).filter(e=>e.d<4.8).sort((a,b)=>a.d-b.d)[0]||null;this.near=near;const key=near?near.kind+near.id:'';if(key!==this.lastNear){this.lastNear=key;this.callbacks.onNear?.(near);}
  const region=regionAt(this.playerPos.x,this.playerPos.z);if(region!==this.region){this.region=region;this.callbacks.onRegion?.(region);}
 }
 tick(now){
  const dt=Math.min(.045,Math.max(0,(now-this.last)/1000));this.last=now;this.raf=requestAnimationFrame(t=>this.tick(t));if(document.hidden)return;
  const active=!this.paused;this.clock+=dt;if(active)this.time+=dt;const t=this.reduced?0:this.time;
  if(this.mode==='world'){
   if(this.started&&!this.modal&&active)this._walk(dt);else this.moving=0;
   this.explorer.group.position.set(this.playerPos.x,0,this.playerPos.z);const d=Math.atan2(Math.sin(this.playerPos.yaw-this.explorer.group.rotation.y),Math.cos(this.playerPos.yaw-this.explorer.group.rotation.y));if(active)this.explorer.group.rotation.y+=d*Math.min(1,dt*12);this.explorer.animate(t,{moving:this.moving});
   for(const e of this.encounters){e.label.visible=this.started&&Math.hypot(e.x-this.playerPos.x,e.z-this.playerPos.z)<25;if(e.object.visible&&e.object.position.distanceTo(this.camera.position)<62){const near=Math.hypot(e.x-this.playerPos.x,e.z-this.playerPos.z)<6,phase=t*.45+e.x*.13,roaming=!near&&Math.sin(phase*.4)>.25;e.object.position.set(e.x+(roaming?Math.sin(phase)*.65:0),0,e.z+(roaming?Math.cos(phase)*.45:0));if(near)e.object.rotation.y=Math.atan2(this.playerPos.x-e.x,this.playerPos.z-e.z);else if(roaming)e.object.rotation.y=Math.atan2(Math.cos(phase),-Math.sin(phase));e.model.animate(t+e.x*.1,{moving:roaming?.3:0,mood:near?'happy':'idle'});}}
   if(this.follower){const aim=v(this.playerPos.x-Math.sin(this.playerPos.yaw)*2,0,this.playerPos.z-Math.cos(this.playerPos.yaw)*2);const distance=this.follower.group.position.distanceTo(aim);if(active)this.follower.group.position.lerp(aim,Math.min(1,dt*4));this.follower.group.rotation.y=this.playerPos.yaw;this.follower.animate(t,{moving:distance>.25?1:0,mood:'happy'});}
   this.world.animate?.(t);for(const m of this.markers){m.boss?.animate(t,{defeated:!!this.state?.bossDefeated});m.keeper?.animate(t);if(m.keeper&&Math.hypot(m.x-this.playerPos.x,m.z-this.playerPos.z)<7)m.keeper.group.rotation.y=Math.atan2(this.playerPos.x-m.x,this.playerPos.z-m.z);m.label.visible=this.started&&Math.hypot(m.x-this.playerPos.x,m.z-this.playerPos.z)<28;if(m.gem){m.gem.position.y=3+Math.sin(t*2+m.x)*.12;m.gem.rotation.y=t*.5;}}
   const pos=this.playerPos;const target=this.started?v(pos.x,1.3,pos.z):v(0,1.5,12);this.focus.lerp(target,Math.min(1,dt*7));const theta=this.started?this.theta:.3+Math.sin(t*.08)*.25;this.camGoal.set(this.focus.x+Math.sin(theta)*this.zoom,this.focus.y+this.zoom*.72,this.focus.z+Math.cos(theta)*this.zoom);this.camera.position.lerp(this.camGoal,Math.min(1,dt*6));this.camera.lookAt(this.focus);
   this.sun.position.set(pos.x-22,38,pos.z+25);this.sun.target.position.set(pos.x,0,pos.z);
  }else{
   this.arenaGarden?.animate(t);
   this._animateCombat(t);
  }
  this.renderer.render(this.scene,this.camera);
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();if(this.mode==='battle')this._battleCamera();}
 _battleCamera(){const r=this.canvas.getBoundingClientRect();frameBattleCamera(this.camera,this.battleModels.map(m=>m.model.group),{width:r.width,height:r.height,boss:this.battle?.kind==='boss',...this.callbacks.getBattleFrame?.()});this.battleBase={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone()};}

 photograph(){this.renderer.render(this.scene,this.camera);return this.canvas.toDataURL('image/png');}
 dispose(){cancelAnimationFrame(this.raf);this.abort.abort();this.clearMovement();for(const m of this.battleModels)m.model.dispose();this.follower?.dispose();this.arenaGarden?.dispose();this.fx?.dispose();for(const a of this.assets)a.dispose?.();this.scene.traverse(o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])m.dispose();});this.shadowTexture?.dispose();for(const r of this.disposables)r.dispose();this.renderer.dispose();}
}
