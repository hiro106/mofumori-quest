import * as THREE from './vendor/three.module.js';
import {buildCreature} from './creatures.js';
import {buildBoss} from './boss.js';
import {buildKeeper} from './keepers.js';
const cache=new Map();let renderer,scene,camera;
export function portrait(id){
 if(cache.has(id))return cache.get(id);
 if(!renderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fffbe8','#8aab92',2.4));const sun=new THREE.DirectionalLight('#fff1da',3.8);sun.position.set(-3,5,4);scene.add(sun);const fill=new THREE.DirectionalLight('#bed8e3',1);fill.position.set(4,2,-2);scene.add(fill);camera=new THREE.PerspectiveCamera(32,1,.1,20);}
 const model=id==='storm'?buildBoss({detail:'low'}):id.startsWith('keeper:')?buildKeeper(id.slice(7)):buildCreature(id);model.animate(0,{mood:'happy'});scene.add(model.group);const box=new THREE.Box3().setFromObject(model.group),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const radius=Math.max(size.x,size.y,size.z)*1.45;camera.position.set(center.x+radius*.45,center.y+radius*.3,center.z+radius*1.7);camera.lookAt(center);renderer.render(scene,camera);const url=renderer.domElement.toDataURL('image/png');cache.set(id,url);scene.remove(model.group);model.dispose();return url;
}
export function disposePortraits(){renderer?.dispose();renderer=null;cache.clear();}
