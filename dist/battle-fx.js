import * as THREE from './vendor/three.module.js';

const TAU = Math.PI * 2;
const COLORS = {leaf:0xa9f56b,tide:0x62ddff,ember:0xff9a45,star:0xffe88a,storm:0xc5adff};
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => n*n*(3-2*n);
export function duration(event = {}) {
  if (event.type === 'victory') return 2.1;
  if (event.type === 'friend') return 1.8;
  if (event.type === 'heal') return 1.5;
  return event.special ? 1.65 : 1.1;
}

// All objects, vertices, materials and random-looking trajectories are pooled.
// Coordinates are local to the arena, whose parent may be at world y=60.
export function buildBattleFX({low = false} = {}) {
  const group = new THREE.Group(); group.name = 'battle-fx';
  const geometries = [], materials = [];
  const own = g => (geometries.push(g), g);
  const sphere = own(new THREE.IcosahedronGeometry(1, low ? 0 : 1));
  const torus = own(new THREE.TorusGeometry(1,.035,4,low?24:48));
  const cone = own(new THREE.ConeGeometry(.28,1,low?5:8));
  const plane = own(new THREE.PlaneGeometry(.19,.34));
  const leafShape = new THREE.Shape(); leafShape.moveTo(0,-.35); leafShape.quadraticCurveTo(.29,-.05,0,.4); leafShape.quadraticCurveTo(-.29,.06,0,-.35);
  const leaf = own(new THREE.ShapeGeometry(leafShape,low?4:8));
  const starShape = new THREE.Shape();
  for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.16:.38; if(i===0)starShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);else starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r);} starShape.closePath();
  const star = own(new THREE.ShapeGeometry(starShape));
  const heartShape = new THREE.Shape(); heartShape.moveTo(0,-.3); heartShape.bezierCurveTo(-.58,.06,-.25,.56,0,.24);heartShape.bezierCurveTo(.25,.56,.58,.06,0,-.3);
  const heart = own(new THREE.ShapeGeometry(heartShape,low?5:10));
  const shieldGeo = own(new THREE.SphereGeometry(1,low?12:24,low?8:16,0,Math.PI*2,0,Math.PI));
  const make = (geo, additive=true) => {
    const material = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});
    material.forceSinglePass=true;
    materials.push(material); const m=new THREE.Mesh(geo,material);m.visible=false;m.frustumCulled=false;group.add(m);return m;
  };
  const core=make(sphere), lance=make(cone), shield=make(shieldGeo,false);
  const rings=Array.from({length:low?3:6},()=>make(torus));
  const shards=Array.from({length:low?12:26},(_,i)=>({mesh:make(leaf,false),a:i*2.39996323,seed:((i*37)%101)/101}));
  const bubbles=Array.from({length:low?6:12},(_,i)=>({mesh:make(sphere),a:i*2.39996323,seed:((i*29)%97)/97}));
  const arcs=Array.from({length:low?2:5},(_,i)=>{
    const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(27),3));
    const mat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});materials.push(mat);
    const line=new THREE.Line(geo,mat);line.visible=false;line.frustumCulled=false;group.add(line);return {mesh:line,seed:i*.83};
  });
  let active=false, disposed=false, type='hit',element='leaf',special=false,blocked=false,total=1.1, sx=-2.6,sz=1,tx=2.6,tz=-1,dir=1,color=COLORS.leaf;
  function hide(){for(let i=0;i<group.children.length;i++)group.children[i].visible=false;group.visible=false;}
  function show(m,x,y,z,scale,opacity){m.visible=opacity>.002;m.position.set(x,y,z);m.scale.setScalar(Math.max(.001,scale));m.material.opacity=clamp(opacity);}
  function play(event={}) {
    if(disposed)return 0;
    hide();core.geometry=sphere;type=['hit','heal','guard','friend','charge','victory'].includes(event.type)?event.type:'hit';element=COLORS[event.element]?event.element:'leaf';special=!!event.special;blocked=!!event.blocked;total=duration({type,special});
    dir=event.side==='enemy'?-1:1;sx=-2.6*dir;sz=dir;tx=-sx;tz=-sz;color=COLORS[element];
    for(let i=0;i<materials.length;i++)materials[i].color.setHex(color);
    for(let i=0;i<shards.length;i++)shards[i].mesh.geometry=type==='friend'?heart:type==='victory'?plane:element==='leaf'?leaf:element==='star'?star:element==='ember'?cone:plane;
    if(type==='heal')for(let i=0;i<materials.length;i++)materials[i].color.setHex(0x88ffba);
    if(type==='friend')for(let i=0;i<materials.length;i++)materials[i].color.setHex(0xff8cbd);
    active=true;group.visible=true;update(0);return total;
  }
  function reset(){active=false;hide();}
  function update(ageSeconds){
    if(!active||disposed)return;
    if(!Number.isFinite(ageSeconds)||ageSeconds>=total){reset();return;}
    const p=clamp(ageSeconds/total), fade=clamp((1-p)*5), pulse=1+Math.sin(p*40)*.07;
    // A single age clock makes seeking, paused battles and headless tests deterministic.
    for(let i=0;i<group.children.length;i++)group.children[i].visible=false;
    group.visible=true;
    if(type==='hit'&&!special){
      const windup=clamp(p/.23),travel=ease(clamp((p-.23)/.34)),impact=clamp((p-.57)/.43);
      const x=sx+(tx-sx)*travel,z=sz+(tz-sz)*travel;
      show(core,x,1.45+Math.sin(travel*Math.PI)*.25,z,impact?.12+Math.sin(impact*Math.PI)*.65:.12+windup*.13,impact?fade*(1-impact):.8);
      for(let i=0;i<rings.length;i++){
        const r=rings[i];r.rotation.set(0,.57,0);
        if(impact>0)show(r,tx,1.45,tz,.15+impact*(1+i*.22),fade*(1-impact)*.8);
      }
      for(let i=0;i<shards.length;i++){
        const s=shards[i],m=s.mesh;m.rotation.set(0,.57,s.a+p*6);
        if(impact>0){const r=.12+impact*(1.1+s.seed);show(m,tx+Math.cos(s.a)*r,1.45+Math.sin(s.a)*r,tz+Math.cos(s.a)*r*.3,.25*(1-impact),fade*.85);}
        else if(p>.23){show(m,x-dir*s.seed*.8,1.45+Math.sin(s.a)*.12,z,.10*(1-s.seed*.5),.6*(1-s.seed));}
      }
    } else if(type==='hit'||type==='charge'){
      const c=clamp(p/.25), travel=ease(clamp((p-.23)/.34)), impact=clamp((p-.57)/.43), strength=special?1.55:1;
      const x=sx+(tx-sx)*travel,z=sz+(tz-sz)*travel,y=1.55+Math.sin(travel*Math.PI)*.65;
      const chargeAlpha=clamp((.3-p)*10);
      show(core,sx,1.6,sz,(.12+c*.48)*pulse,chargeAlpha*.8);
      for(let i=0;i<rings.length;i++){
        const r=rings[i];r.rotation.set(Math.PI/2,0,p*(i%2?2:-2));
        if(p<.3)show(r,sx,.15+i*.23,sz,(.35+c*.7+i*.11)*strength,chargeAlpha*(1-i/rings.length)*.8);
        else if(impact>0){r.rotation.set(element==='tide'?0:Math.PI/2,element==='tide'?Math.PI/2:0,p*2);show(r,tx,element==='tide'?1.3+i*.18:.15+i*.09,tz,(.2+impact*(1.8+i*.25))*strength,fade*(1-impact)*.7);}
        else if(element==='tide'){r.rotation.set(0,Math.PI/2,0);show(r,x-dir*i*.17,y,z,(.4+i*.08)*strength,.65*(1-i/rings.length));}
      }
      if(type==='charge'){
        show(core,sx,1.6,sz,(.3+Math.sin(p*Math.PI)*.6)*pulse,fade*.8);
      }else if(p>=.23&&p<.62){
        core.geometry=element==='star'?star:sphere;show(core,x,y,z,(element==='tide'?.45:.3)*strength,.9);core.rotation.set(0,0,p*10);
        if(element==='ember'||element==='leaf'){lance.rotation.set(0,0,-dir*Math.PI/2);show(lance,x,y,z,1.5*strength,.95);lance.scale.set(.75*strength,1.8*strength,.75*strength);}
      }
      for(let i=0;i<shards.length;i++){
        const s=shards[i],m=s.mesh,a=s.a+p*(element==='leaf'?9:3),radius=(.4+s.seed*.8)*strength;
        m.rotation.set(p*8+s.seed,p*5,p*10+s.a);
        if(p<.23||type==='charge'){show(m,sx+Math.cos(a)*radius,1.2+Math.sin(a)*radius,sz+Math.sin(a*.7)*.5,.4+c*.45,chargeAlpha*.9);}
        else if(impact===0){const tail=(i/shards.length)*.32;show(m,x-dir*tail*4, y+Math.sin(a)*radius*.4,z+Math.cos(a)*radius*.35,(.6-tail)*strength,.85);}
        else{const r=(.3+impact*(1.5+s.seed*1.7))*strength;show(m,tx+Math.cos(s.a)*r,1.4+Math.sin(s.a)*r-impact*impact*.9,tz+Math.sin(s.a*1.7)*r*.55,(1-impact)*(.6+s.seed*.5)*strength,fade*.9);}
      }
      for(let i=0;i<bubbles.length;i++){
        const b=bubbles[i],m=b.mesh,a=b.a+p*6;
        if(element==='tide'){const r=.5+(impact?impact*2:b.seed*.55);show(m,(impact?tx:x)+Math.cos(a)*r,1.5+Math.sin(a)*r+(impact?impact:0),(impact?tz:z)+Math.sin(b.a)*.7,(.08+b.seed*.12)*strength,fade*.65);}
        else if(impact>0){show(m,tx+Math.cos(b.a)*impact*1.5,1.3+Math.sin(b.a)*impact*1.5,tz+Math.sin(b.a*2)*impact,.15*(1-impact)*strength,fade*.8);}
      }
      if(element==='storm'||element==='leaf')for(let i=0;i<arcs.length;i++){
        const ar=arcs[i],m=ar.mesh,attr=m.geometry.attributes.position,base=ar.seed;
        for(let j=0;j<9;j++){
          const f=j/8;
          if(element==='storm')attr.setXYZ(j,impact?tx+Math.sin(f*18+base)*.23: sx+(tx-sx)*f,impact?4.5-f*3.2:1.5+Math.sin(f*21+p*52+base)*.24,impact?tz+Math.cos(f*17+base)*.2:sz+(tz-sz)*f);
          else {const a=-1.1+f*2.8+p*4+base;attr.setXYZ(j,(impact?tx:x)+Math.cos(a)*1.1*strength,1.5+Math.sin(a)*1.1*strength,(impact?tz:z)+Math.sin(f*Math.PI)*.3);}
        }
        attr.needsUpdate=true;m.visible=p>.23;m.material.opacity=(impact?fade:1)*.85;
      }
      if(impact>0){core.geometry=sphere;show(core,tx,1.5,tz,(.15+Math.sin(impact*Math.PI)*.8)*strength,fade*(1-impact)*.55);}
    } else if(type==='guard'){
      show(shield,sx,1.45,sz,1.45*(.8+ease(clamp(p*4))*.2),fade*.2);shield.scale.set(1.45,1.8,1.45);shield.rotation.y=p*.4;
      for(let i=0;i<rings.length;i++){const r=rings[i];r.rotation.set(0,Math.PI/2,p*2+i*.4);show(r,sx,1.45,sz,1.45+i*.025,fade*.55);r.scale.y=1.23;}
    } else {
      const victory=type==='victory',friend=type==='friend',cx=friend?0:sx,cz=friend?0:sz;
      for(let i=0;i<shards.length;i++){
        const s=shards[i],m=s.mesh,a=s.a+p*(friend?1.2:5),r=friend?.8+s.seed: victory?1+s.seed*3:.5+s.seed*.35;
        if(victory){m.material.color.setHSL(s.seed,.9,.65);show(m,Math.cos(s.a)*r,1.8+s.seed*2+Math.sin(p*Math.PI)*2.4-p*p*3,Math.sin(s.a)*r,.7,fade);m.rotation.set(p*8+s.a,p*5,p*9);}
        else{show(m,cx+Math.cos(a)*r,.4+((s.seed+p*1.4)%1)*3.2,cz+Math.sin(a)*r,friend?.65:.45,fade*Math.sin(Math.PI*clamp(p*3)));m.rotation.set(0,-.35,friend?Math.sin(a)*.2:a);}
      }
      for(let i=0;i<rings.length;i++){const r=rings[i];r.rotation.set(Math.PI/2,0,p);show(r,cx,.1+i*.07,cz,(.5+p*(friend?2:1.3)+i*.12),fade*.4);}
      if(!victory)for(let i=0;i<bubbles.length;i++){const b=bubbles[i];show(b.mesh,cx+Math.cos(b.a+p*4)*.75,.4+((b.seed+p)%1)*2.6,cz+Math.sin(b.a+p*4)*.75,.055,fade*.8);}
    }
    if(type==='hit'&&blocked){shield.material.color.setHex(0x8cfde3);show(shield,tx,1.15,tz,1.55,.23*fade+Math.sin(p*Math.PI)*.12);}

  }
  function dispose(){if(disposed)return;reset();disposed=true;for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();}
  hide();
  return {group,play,update,reset,dispose};
}
