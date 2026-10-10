import {BY_ID,stats,effectiveness,SKILL_ROLES} from './catalog.js';

// Deterministic turn resolver: presentation clocks never decide game outcomes.
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function combatant(id,level,hp){const s=stats(id,level);if(!s)throw new Error('Unknown creature');return {id,level:clamp(Math.floor(level)||1,1,12),...s,hp:clamp(Number.isFinite(hp)?hp:s.maxHp,0,s.maxHp),energy:3,guard:false};}
export function createBattle(collection,team,opponents,{kind='wild',target=null}={}){
 const allies=team.filter(id=>collection[id]&&BY_ID[id]).slice(0,3).map(id=>combatant(id,collection[id].level,collection[id].hp));
 const enemies=opponents.filter(c=>BY_ID[c.id]).map(c=>combatant(c.id,c.level));
 if(!allies.some(c=>c.hp>0)||!enemies.length)throw new Error('Battle needs healthy teams');
 return {kind,target,allies,enemies,active:allies.findIndex(c=>c.hp>0),enemy:0,turn:0,status:'active',log:[{text:kind==='keeper'?'力をあわせて、しるしに挑戦！':'まずは、あいさつのバトル！',tone:'info'}],events:[]};
}
function say(b,text,tone='info'){b.log.push({text,tone});if(b.log.length>7)b.log.shift();}
function hit(b,attacker,defender,special,side){
 const mult=special?effectiveness(BY_ID[attacker.id].type,BY_ID[defender.id].type):1;
 const role=SKILL_ROLES[attacker.id];
 const raw=((special?16:10)+attacker.atk*.8-defender.def*.4)*(special?({power:1.08,guard:.82,heal:.78,tempo:.92}[role]||1):1);
 const damage=Math.max(3,Math.round(raw*mult*(side==='enemy'?(b.kind==='wild'?.78:.92):1)*(defender.guard?.4:1)));
 const dealt=Math.min(defender.hp,damage);defender.hp=Math.max(0,defender.hp-damage);defender.guard=false;
 if(special)attacker.energy-=2;else attacker.energy=Math.min(5,attacker.energy+1);
 const name=BY_ID[attacker.id].name,skill=special?BY_ID[attacker.id].skill:'ぽんっとアタック';
 say(b,`${name}の ${skill}！ ${dealt}ダメージ${mult>1?'・こうかばつぐん！':mult<1?'・少しひかえめ':''}`,mult>1?'good':'info');
 b.events.push({type:'hit',side,damage:dealt,special,mult});
 if(special&&role==='guard'){attacker.guard=true;say(b,`${name}は、技のあと身をまもった。`);}
 if(special&&role==='tempo'){defender.energy=Math.max(0,defender.energy-2);say(b,'相手の気力を2へらした！');}
 if(special&&role==='heal'){const team=side==='ally'?b.allies:b.enemies;for(const c of team)if(c.hp>0)c.hp=Math.min(c.maxHp,c.hp+Math.ceil(c.maxHp*.16));say(b,`${name}のやさしさで、チームのHPが回復！`,'good');b.events.push({type:'heal',side});}
}
function checkEnemy(b){
 if(b.enemies[b.enemy].hp>0)return false;
 const next=b.enemies.findIndex((c,i)=>i>b.enemy&&c.hp>0);
 if(next>=0){say(b,`${BY_ID[b.enemies[b.enemy].id].name}はひと休み。`);b.enemy=next;say(b,`${BY_ID[b.enemies[next].id].name}が前へ！`);b.events.push({type:'enemy-switch'});return true;}
 b.status='won';say(b,'やったね！ なかまの力で勝利！','good');b.events.push({type:'end'});return true;
}
function enemyTurn(b){
 const foe=b.enemies[b.enemy],ally=b.allies[b.active];
 if(foe.hp<=0||ally.hp<=0)return;
 // Keepers occasionally telegraph a guard; wild creatures use a readable cadence.
 if(b.kind==='keeper'&&b.turn%4===0){foe.guard=true;foe.energy=Math.min(5,foe.energy+2);say(b,`${BY_ID[foe.id].name}は身をまもった。つぎの攻撃を受けとめる。`);b.events.push({type:'guard',side:'enemy'});}
 else hit(b,foe,ally,foe.energy>=2&&b.turn%3===0,'enemy');
 if(ally.hp<=0){say(b,`${BY_ID[ally.id].name}はひと休み。`);const next=b.allies.findIndex(c=>c.hp>0);if(next<0){b.status='lost';say(b,'だいじょうぶ。広場で休んで、また挑戦しよう。');b.events.push({type:'end'});}else{b.active=next;say(b,`${BY_ID[b.allies[next].id].name}にバトンタッチ！`);b.events.push({type:'ally-switch'});}}
}
export function canBefriend(b){const foe=b?.enemies?.[b.enemy];return b?.status==='active'&&b.kind==='wild'&&foe?.hp>0&&foe.hp<=Math.floor(foe.maxHp*.4);}
export function resolveTurn(input,action){
 if(!input||input.status!=='active')return input;
 const b=clone(input),ally=b.allies[b.active];b.events=[];
 if(!action||!['attack','special','guard','heal','befriend','switch','leave'].includes(action.type))return input;
 if(action.type==='special'&&ally.energy<2||action.type==='heal'&&(ally.energy<2||ally.hp===ally.maxHp))return input;
 if(action.type==='switch'&&(!Number.isInteger(action.index)||action.index===b.active||!b.allies[action.index]||b.allies[action.index].hp<=0))return input;
 if(action.type==='befriend'&&b.kind!=='wild')return input;
 if(action.type==='leave'){b.status='fled';say(b,'またね、と手をふった。');return b;}
 b.turn++;ally.guard=false;
 if(action.type==='attack'||action.type==='special'){hit(b,ally,b.enemies[b.enemy],action.type==='special','ally');if(checkEnemy(b))return b;}
 else if(action.type==='guard'){ally.guard=true;ally.energy=Math.min(5,ally.energy+2);say(b,`${BY_ID[ally.id].name}はまもりのポーズ。気力が2回復！`);b.events.push({type:'guard',side:'ally'});}
 else if(action.type==='heal'){ally.energy-=2;const amount=Math.min(ally.maxHp-ally.hp,Math.round(ally.maxHp*.4));ally.hp+=amount;say(b,`${BY_ID[ally.id].name}の深呼吸。HPが${amount}回復！`,'good');b.events.push({type:'heal',side:'ally'});}
 else if(action.type==='switch'){b.active=action.index;b.allies[b.active].guard=false;say(b,`${BY_ID[b.allies[b.active].id].name}、よろしく！`);b.events.push({type:'ally-switch'});}
 else if(action.type==='befriend'){
   if(canBefriend(input)){b.status='befriended';say(b,`${BY_ID[b.enemies[b.enemy].id].name}と、ともだちになった！`,'good');b.events.push({type:'friend'});return b;}
   say(b,'まだ少し緊張しているみたい。HPを40%以下にしてから声をかけよう。');
 }
 enemyTurn(b);return b;
}
export function enemyIntent(b){const next=b.turn+1,foe=b.enemies[b.enemy];if(b.kind==='keeper'&&next%4===0)return 'つぎは、まもるかも';return foe.energy>=2&&next%3===0?'つぎは、得意技の予感！':'つぎは、軽いアタック';}
