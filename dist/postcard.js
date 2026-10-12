import {BY_ID,TYPES} from './catalog.js';
import {portrait} from './portraits.js';
const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
export async function makePostcard({snapshot,team,collection,badges,caption,bossDefeated=false}){
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1340;const ctx=canvas.getContext('2d');
 const photo=await load(snapshot),faces=await Promise.all(team.map(id=>load(portrait(id))));
 ctx.fillStyle='#faf6e8';ctx.fillRect(0,0,1200,1340);ctx.fillStyle='#dce8cd';ctx.beginPath();ctx.arc(1170,45,210,0,Math.PI*2);ctx.fill();ctx.fillStyle='#315846';ctx.font='600 16px sans-serif';ctx.fillText('MOFUMORI EXPEDITION  /  FIELD POSTCARD',58,56);ctx.font='500 43px "Yu Gothic UI",sans-serif';ctx.fillText('モフモリ探検隊',58,119);ctx.font='18px sans-serif';ctx.textAlign='right';ctx.fillText('なかま '+Object.keys(collection).length+' / 13  ·  しるし '+badges.length+' / 3',1140,115);ctx.textAlign='left';
 ctx.save();ctx.beginPath();ctx.roundRect(46,160,1108,720,20);ctx.clip();const scale=Math.max(1108/photo.width,720/photo.height),w=photo.width*scale,h=photo.height*scale;ctx.drawImage(photo,46+(1108-w)/2,160+(720-h)/2,w,h);ctx.restore();
 ctx.fillStyle='#345c4b';let font=31;const line=(caption||'きょうも、小さな冒険。').trim().slice(0,30);while(font>18){ctx.font='500 '+font+'px "Yu Gothic UI",sans-serif';if(ctx.measureText(line).width<1050)break;font--;};ctx.fillText(line,66,939);
 const start=600-team.length*160;team.forEach((id,i)=>{const x=start+i*320,s=BY_ID[id];ctx.fillStyle='#e9eeda';ctx.beginPath();ctx.roundRect(x+10,977,300,237,17);ctx.fill();ctx.drawImage(faces[i],x+65,975,190,190);ctx.fillStyle='#345c4b';ctx.textAlign='center';ctx.font='600 22px "Yu Gothic UI",sans-serif';ctx.fillText(s.name,x+160,1160);ctx.font='16px sans-serif';ctx.fillStyle='#728766';ctx.fillText(TYPES[s.type].name+'  /  Lv.'+collection[id].level,x+160,1193);});
 ctx.textAlign='left';ctx.strokeStyle='#d1ddc3';ctx.beginPath();ctx.moveTo(60,1254);ctx.lineTo(1140,1254);ctx.stroke();ctx.fillStyle='#819576';ctx.font='17px "Yu Gothic UI",sans-serif';ctx.fillText(bossDefeated?'称号：嵐を越えた探検隊':'小さな出会いが、大きな冒険に。',60,1294);ctx.textAlign='right';ctx.font='14px sans-serif';ctx.fillText('A LITTLE ISLAND. A BIG FRIENDSHIP.',1140,1294);
 return canvas.toDataURL('image/png');
}
