import {BY_ID,SPECIES,BOSS,isCollectionComplete,STARTERS,REGIONS,KEEPERS,stats,nextXP} from './catalog.js';
import {createBattle} from './battle.js';
const clone=x=>JSON.parse(JSON.stringify(x));
export const SAVE_KEY='mofumori.quest.v1';
export function newGame(starter){if(!STARTERS.includes(starter))throw new Error('Choose a starter');const s=stats(starter,2);return {version:1,starter,collection:{[starter]:{level:2,xp:0,hp:s.maxHp,bond:1}},team:[starter],seen:[starter],badges:[],visited:['camp'],position:{x:0,z:17,yaw:0},wins:0,steps:0,finished:false,bossDefeated:false,bossNoticeSeen:false,tipsSeen:[],created:Date.now(),updated:Date.now()};}
export function healAll(state){const s=clone(state);for(const [id,c] of Object.entries(s.collection))c.hp=stats(id,c.level).maxHp;return s;}
export function chooseTeam(state,id){if(!state.collection[id])return state;const s=clone(state),i=s.team.indexOf(id);if(i>=0){if(s.team.length===1)return state;s.team.splice(i,1);}else if(s.team.length<3)s.team.push(id);else return state;return s;}
export function leadWith(state,id){if(!state.team.includes(id)||state.team[0]===id)return state;return {...state,team:[id,...state.team.filter(x=>x!==id)]};}
export function seeSpecies(state,id){return !SPECIES.some(s=>s.id===id)||state.seen.includes(id)?state:{...state,seen:[...state.seen,id]};}
export function discover(state,id){return !REGIONS.some(r=>r.id===id)||state.visited.includes(id)?state:{...state,visited:[...state.visited,id]};}
export function startWild(state,id){const sp=SPECIES.find(s=>s.id===id);if(!sp||id==='star'&&state.badges.length<3)throw new Error('Encounter unavailable');return createBattle(state.collection,state.team,[{id,level:sp.level}],{kind:'wild',target:id});}
export function startKeeper(state,id){const k=KEEPERS.find(k=>k.id===id);if(!k)throw new Error('Unknown keeper');const level=3+Math.min(3,state.badges.length);return createBattle(state.collection,state.team,k.species.map((id,i)=>({id,level:level+i})),{kind:'keeper',target:k.id});}
export function canChallengeBoss(state){return state?.badges?.length===3&&isCollectionComplete(state.collection);}
export function startBoss(state){if(!canChallengeBoss(state))throw new Error('Collect all 13 friends first');const b=createBattle(state.collection,state.team,[{id:BOSS.id,level:BOSS.level}],{kind:'boss',target:BOSS.id});b.enemies[0].type='leaf';b.phase=1;b.bossBeat=0;return b;}
function awardXP(c,id,xp){c.xp+=xp;let levels=0;while(c.level<12&&c.xp>=nextXP(c.level)){const old=stats(id,c.level).maxHp;c.xp-=nextXP(c.level);c.level++;levels++;c.hp=Math.min(stats(id,c.level).maxHp,c.hp+stats(id,c.level).maxHp-old+8);}if(c.level===12)c.xp=0;return levels;}
export function finishBattle(state,b){
 if(!b||b.status==='active'||b.settled)return {state,rewards:[]};const s=clone(state),rewards=[];
 for(const c of b.allies)if(s.collection[c.id])s.collection[c.id].hp=c.hp;
 if(b.status==='lost'){const healed=healAll(s);healed.position={x:0,z:17,yaw:0};return {state:healed,rewards:['広場でみんな元気に。なかまも、しるしも、そのままです。']};}
 if(b.status==='won'||b.status==='befriended'){
   s.wins++;const xp=b.kind==='boss'?180:b.enemies.reduce((n,c)=>n+8+c.level*4,0);
   for(const id of s.team){const levels=awardXP(s.collection[id],id,xp);if(levels)rewards.push(`${BY_ID[id].name}が Lv.${s.collection[id].level} に！`);}
   rewards.push(`チーム全員に ${xp} EXP`);
   if(b.status==='befriended'){
     const foe=b.enemies[b.enemy],id=foe.id;
     if(s.collection[id]){s.collection[id].bond=Math.min(99,s.collection[id].bond+1);s.collection[id].hp=stats(id,s.collection[id].level).maxHp;rewards.unshift(`${BY_ID[id].name}とのきずなが深まった！`);}
     else{s.collection[id]={level:foe.level,xp:0,hp:foe.maxHp,bond:1};if(s.team.length<3)s.team.push(id);rewards.unshift(`${BY_ID[id].name}がなかまに！${s.team.includes(id)?' チームに加わったよ。':' ずかんからチームに入れよう。'}`);}
     if(!s.seen.includes(id))s.seen.push(id);
     if(isCollectionComplete(s.collection)&&!isCollectionComplete(state.collection))rewards.push('13のなかま全員集合！ 星の祭壇に嵐竜ヴォルガが現れた！');
     if(id==='star'){s.finished=true;rewards.push('島の灯りが、ひとつにつながった。モフモリ探検隊、おめでとう！');}
   }
   if(b.kind==='boss'&&b.status==='won'){s.bossDefeated=true;Object.assign(s,healAll(s));rewards.unshift('嵐竜ヴォルガを倒した！ 島に青空が戻った！');rewards.push('称号「嵐を越えた探検隊」を手にいれた！');}
   if(b.kind==='keeper'&&!s.badges.includes(b.target)){s.badges.push(b.target);rewards.unshift(`${KEEPERS.find(k=>k.id===b.target).title}を手にいれた！`);Object.assign(s,healAll(s));if(s.badges.length===3)rewards.push('北の星の祭壇に、ふしぎな気配が……！');}
 }
 return {state:s,rewards};
}
export function quest(state){const count=Object.keys(state.collection).length;if(state.bossDefeated)return {title:'嵐を越えた探検隊',text:'ヴォルガを倒し、島に青空が戻った！ なかまと冒険のつづきへ。'};if(canChallengeBoss(state))return {title:'最終決戦！ 嵐竜ヴォルガ',text:'13のなかまが集まった！ 星の祭壇でボスに挑もう。'};if(state.finished)return {title:count===SPECIES.length?'島のともだち、全員集合！':'星のともだちと、冒険のつづき',text:count===SPECIES.length?'13の出会いが、きみの宝物。好きな子と島を歩こう。':`ずかん ${count} / ${SPECIES.length}。まだ会っていないなかまを探そう。`};if(count<2)return {title:'はじめてのともだち',text:'近くのなかまに近づいて、声をかけよう。'};if(state.badges.length===3)return {title:'星の祭壇へ',text:'島の北に、特別なともだちが待っている。'};return {title:'三つのしるしをあつめよう',text:`守り手に挑戦！ しるし ${state.badges.length} / 3 · なかま ${count} / 13`};}
export function validateSave(raw){
 if(!raw||typeof raw!=='object'||raw.version!==1||!STARTERS.includes(raw.starter)||!raw.collection||typeof raw.collection!=='object')throw new Error('この冒険データは読みこめません。');
 const fresh=newGame(raw.starter),collection={};
 for(const {id} of SPECIES){const c=raw.collection[id];if(!c)continue;if(!Number.isInteger(c.level)||c.level<1||c.level>12||!Number.isFinite(c.hp)||!Number.isFinite(c.xp)||c.xp<0)throw new Error('なかまのデータがこわれています。');collection[id]={level:c.level,xp:c.level===12?0:Math.min(Math.floor(c.xp),nextXP(c.level)-1),hp:Math.max(0,Math.min(Math.floor(c.hp),stats(id,c.level).maxHp)),bond:Number.isInteger(c.bond)?Math.max(1,Math.min(c.bond,99)):1};}
 if(!collection[raw.starter])throw new Error('はじめのなかまが見つかりません。');
 const list=(value,allowed)=>Array.isArray(value)?[...new Set(value.filter(v=>typeof v==='string'&&allowed.includes(v)))]:[];
 const team=list(raw.team,Object.keys(collection)).slice(0,3);if(!team.length)team.push(raw.starter);
 const p=raw.position,position=p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x,p.z)<58?{x:p.x,z:p.z,yaw:Number.isFinite(p.yaw)?p.yaw:0}:fresh.position;
 const badges=list(raw.badges,KEEPERS.map(k=>k.id));
 return {...fresh,collection,team,seen:[...new Set([...Object.keys(collection),...list(raw.seen,SPECIES.map(s=>s.id))])],badges,visited:[...new Set(['camp',...list(raw.visited,REGIONS.map(r=>r.id))])],position,wins:Number.isInteger(raw.wins)?Math.max(0,Math.min(raw.wins,100000)):0,steps:Number.isFinite(raw.steps)?Math.max(0,Math.min(raw.steps,1e9)):0,finished:badges.length===3&&!!collection.star,bossDefeated:raw.bossDefeated===true&&badges.length===3&&isCollectionComplete(collection),bossNoticeSeen:raw.bossNoticeSeen===true,tipsSeen:list(raw.tipsSeen,['battle','journal','keeper']),created:Number.isFinite(raw.created)?raw.created:fresh.created,updated:Date.now()};
}
export function writeSave(state,storage){try{storage.setItem(SAVE_KEY,JSON.stringify({...state,updated:Date.now()}));return true;}catch{return false;}}
export function readSave(storage){try{const raw=storage.getItem(SAVE_KEY);return raw?{state:validateSave(JSON.parse(raw)),error:null}:{state:null,error:null};}catch{return {state:null,error:'保存データを読みこめませんでした。バックアップからの復元、または新しい冒険を選べます。'};}}

export function replaceTeam(state,outgoing,incoming){if(!state.team.includes(outgoing)||!state.collection[incoming]||state.team.includes(incoming))return state;return {...state,team:state.team.map(id=>id===outgoing?incoming:id)};}
