// Original Web Audio music and effects, activated only by a user gesture.
export class IslandAudio {
 constructor(){this.enabled=false;this.region='camp';this.battle=false;this.boss=false;this.volume=1;this.step=0;this.nodes=new Set();this.hidden=false;this.generation=0;this.timer=null;this.effects=new Set();}
 async enable(){const generation=++this.generation;const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return false;try{this.context??=new Context();await this.context.resume();}catch{return false;}if(generation!==this.generation)return false;this.enabled=true;this.schedule();return true;}
 disable(){this.generation++;this.enabled=false;this.cancel();}
 suspend(hidden){this.hidden=hidden;if(hidden)this.cancel();else if(this.enabled)this.schedule();}
 cancel(){clearTimeout(this.timer);this.timer=null;this.clearEffects();this.stopNotes();}
 clearEffects(){for(const timer of this.effects)clearTimeout(timer);this.effects.clear();}
 stopNotes(){for(const n of [...this.nodes]){try{n.osc.stop();}catch{}this.release(n);}}
 release(n){if(!this.nodes.delete(n))return;n.osc.onended=null;try{n.osc.disconnect();}catch{}try{n.gain.disconnect();}catch{}}
 setVolume(value){const v=Number(value);if(!Number.isFinite(v))return this.volume;this.volume=Math.max(0,Math.min(1,v));this.stopNotes();return this.volume;}
 voice(source,duration,volume,attack=.012){if(!this.enabled||this.hidden||!this.context||this.volume===0||this.nodes.size>=48){try{source?.disconnect();}catch{}return;}const t=this.context.currentTime,gain=this.context.createGain();gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(Math.max(.0001,volume*this.volume),t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(gain);gain.connect(this.context.destination);const n={osc:source,gain};this.nodes.add(n);source.onended=()=>this.release(n);source.start(t);source.stop(t+duration+.025);return source;}
 note(freq,duration=.7,volume=.045,type='sine',endFreq=null){if(!this.enabled||this.hidden||!this.context||this.volume===0||this.nodes.size>=48)return;const osc=this.context.createOscillator(),t=this.context.currentTime;osc.type=type;osc.frequency.value=freq;if(endFreq!==null){osc.frequency.setValueAtTime?.(freq,t);osc.frequency.exponentialRampToValueAtTime?.(Math.max(1,endFreq),t+duration);}return this.voice(osc,duration,volume);}
 noise(duration=.12,volume=.025){if(!this.enabled||this.hidden||!this.context||this.volume===0||this.nodes.size>=48)return;const c=this.context;if(!c.createBuffer||!c.createBufferSource)return this.note(170,duration,volume,'triangle',65);this.noiseBuffer??=(()=>{const b=c.createBuffer(1,Math.ceil(c.sampleRate*.6),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.6;return b;})();const source=c.createBufferSource();source.buffer=this.noiseBuffer;return this.voice(source,Math.min(duration,.55),volume,.006);}
 later(delay,callback){if(!this.enabled||this.hidden||this.effects.size>=64)return;const generation=this.generation;const timer=setTimeout(()=>{this.effects.delete(timer);if(this.enabled&&!this.hidden&&generation===this.generation)callback();},delay);this.effects.add(timer);}
 schedule(){clearTimeout(this.timer);this.timer=null;if(!this.enabled||this.hidden)return;const i=this.step++%16;
  if(this.battle){const root=this.boss?174.61:220,melody=this.boss?[0,7,10,14,12,10,7,3]:[0,7,12,7,3,10,14,10],beat=this.boss?205:240;
   this.note(root*2**(melody[i%8]/12),.22,.012,'triangle');
   if(i%4===0){this.note(root/2*2**([0,0,3,7][Math.floor(i/4)]/12),.4,.025,'triangle');this.note(115,.15,.024,'sine',45);}
   if(i%4===2){this.noise(.09,.012);this.note(180,.07,.007,'triangle',90);}
   if(i%2===1)this.noise(.035,.004);
   if(i%8===0){this.note(root*2,.7,.007);this.note(root*2**(7/12),.6,.007);}
   this.timer=setTimeout(()=>this.schedule(),beat);
  }else{const notes=this.region==='shore'?[0,7,12,14,9,7,4,2]:this.region==='grove'?[0,3,7,10,12,7,3,2]:[0,4,7,12,9,7,4,2],root=this.region==='grove'?196:220;if(i%2===0)this.note(root*2**(notes[Math.floor(i/2)]/12),1.05,.018);if(i%8===0)this.note(root/2,1.6,.014,'triangle');this.timer=setTimeout(()=>this.schedule(),440);}
 }
 combat(event={},stage='start'){if(!this.enabled||this.hidden)return;const type=event.type||'attack',raw=String(event.element||'neutral').toLowerCase(),element=({leaf:'wind',tide:'water',ember:'fire',star:'light',storm:'dark'})[raw]||raw,special=!!event.special||type==='charge';
  if(type==='friend'||type==='victory'){if(stage==='impact')this.event(type==='friend'?'friend':'win');return;}
  if(type==='phase'){if(stage==='start')this.event('boss-phase');return;}
  if(type==='charge'&&stage==='impact')return;
  if(type==='heal'){if(stage==='impact')this.chime([0,7,12],523,.035);else this.note(392,.28,.018,'sine',784);return;}
  if(type==='guard'||type==='defend'){this.note(stage==='impact'?260:390,.2,.025,'triangle',180);return;}
  if(stage==='start'){
   if(event.actor==='storm'&&type==='charge')this.event('boss-roar');

   const base=element==='fire'?150:element==='water'?340:element==='wind'?600:element==='earth'?110:element==='light'?520:element==='dark'?180:240;
   this.note(base,special?.38:.22,.027,element==='earth'?'triangle':'sine',base*(special?3:1.8));
   if(['wind','fire','earth'].includes(element))this.noise(special?.25:.13,.016);
   if(special)this.note(base*1.5,.35,.014,'triangle',base*2.5);
  }else{
   const power=special?.052:.035;
   if(element==='fire'){this.noise(.22,power);this.note(190,.24,.03,'triangle',55);}
   else if(element==='water'){this.note(740,.25,power,'sine',210);this.later(65,()=>this.note(570,.22,.023,'sine',270));}
   else if(element==='wind'){this.noise(.26,power*.65);this.note(1100,.18,.018,'sine',280);}
   else if(element==='earth'){this.note(105,.3,power,'triangle',38);this.noise(.09,.024);}
   else if(element==='light')this.chime([0,7,12],660,power*.6);
   else if(element==='dark'){this.note(150,.3,power,'triangle',70);this.note(225,.24,.018,'sine',100);}
   else{this.noise(.1,.025);this.note(event.side==='enemy'?130:180,.15,power,'triangle',60);}
  }
 }
 chime(intervals,root=330,volume=.04){intervals.forEach((v,i)=>this.later(i*100,()=>this.note(root*2**(v/12),.6,volume)));}
 event(name){if(!this.enabled||this.hidden)return;if(name==='win'||name==='victory'){this.chime([0,4,7,12,7,12,16,19],330,.035);this.later(700,()=>{this.note(330,.9,.025,'triangle');this.note(660,.9,.025);});}else if(name==='friend')this.chime([0,4,7,12]);else if(name==='boss'||name==='roar'||name==='boss-roar'){this.note(110,.6,.035,'triangle',220);this.note(165,.5,.018,'sine',330);this.noise(.28,.012);}else if(name==='phase'||name==='boss-phase'){this.chime([0,3,7,12],220,.03);this.note(110,.6,.025,'triangle',165);}else if(name==='hit')this.combat({},'impact');else if(name==='heal')this.combat({type:'heal'},'impact');else this.note(440,.12,.02);}
 dispose(){this.disable();this.context?.close();}
}
