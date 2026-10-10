import * as THREE from './vendor/three.module.js';
// Fit the actual two models inside the free space between the HUD panels.
export function frameBattleCamera(camera,groups,{width,height,top=height*.2,bottom=height*.7}){
 const focus=new THREE.Vector3(0,61.3,0), offset=new THREE.Vector3(7.5,4.5,11.5);
 camera.aspect=width/height;camera.clearViewOffset();camera.updateProjectionMatrix();
 const safeTop=Math.min(height*.45,top+14),safeBottom=Math.max(safeTop+70,bottom-14),center=(safeTop+safeBottom)/2;
 camera.setViewOffset(width,height,0,height*.5-center,width,height);
 const points=[];for(const group of groups){group.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(group);for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z));}
 let scale=Math.max(1,.68/camera.aspect);let attempts=0;
 for(;attempts<50;attempts++){camera.position.copy(focus).addScaledVector(offset,scale);camera.lookAt(focus);camera.updateMatrixWorld();const fits=points.every(p=>{const q=p.clone().project(camera),py=(1-q.y)*height/2;return Math.abs(q.x)<=.86&&py>=safeTop&&py<=safeBottom;});if(fits)break;scale*=1.045;}
 return {scale,attempts,safeTop,safeBottom};
}
