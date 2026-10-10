export const TYPES = Object.freeze({leaf:{name:'わかば',icon:'❧',color:'#79ba77',strong:'tide'},tide:{name:'しずく',icon:'≈',color:'#71bbd3',strong:'ember'},ember:{name:'ほのお',icon:'✦',color:'#efae67',strong:'leaf'},star:{name:'ほし',icon:'✧',color:'#bb9fde',strong:null}});
export const SPECIES = Object.freeze([
  {id:'sprig',name:'ハネハ',type:'leaf',kind:'はっぱみみ',bio:'耳で風をあつめる、はずかしがりや。なかよくなると、小さな種をわけてくれる。',trait:'すばやい',hp:30,atk:9,def:7,skill:'はっぱのワルツ',color:'#b2d890',region:'meadow',pos:[-17,-12],level:2},
  {id:'puff',name:'ポポタン',type:'leaf',kind:'たんぽぽはり',bio:'びっくりすると、背中の綿毛がふわり。ねむっているあいだも花の夢を見ている。',trait:'がまんづよい',hp:38,atk:7,def:10,skill:'わたげのかぜ',color:'#e9d987',region:'meadow',pos:[-32,-5],level:2},
  {id:'fawn',name:'コモレビ',type:'leaf',kind:'はなつの',bio:'角の花は、うれしい気持ちでひらく。森でまよった子を、そっと案内してくれる。',trait:'やさしい',hp:34,atk:10,def:8,skill:'こもれびのはな',color:'#d8ad7a',region:'meadow',pos:[-38,-16],level:4},
  {id:'moss',name:'モコケ',type:'leaf',kind:'こけこうら',bio:'背中に小さな森をのせている。急がない、あわてない。いっしょにいると落ち着く。',trait:'まもりじょうず',hp:42,atk:7,def:12,skill:'もりのいぶき',color:'#81ac82',region:'meadow',pos:[-17,-31],level:3},
  {id:'otter',name:'ラッコロ',type:'tide',kind:'かいがらかわうそ',bio:'お気にいりの貝がらを、いつもだいじに持っている。泳ぐより水あそびが好き。',trait:'あそびずき',hp:33,atk:9,def:8,skill:'しずくのリング',color:'#abcbca',region:'shore',pos:[17,20],level:2},
  {id:'fin',name:'プカリン',type:'tide',kind:'ふわえら',bio:'水も陸も、ぷかぷか気分。えらをゆらして歌うと、まわりも笑顔になる。',trait:'のんびり',hp:37,atk:8,def:9,skill:'あわのダンス',color:'#e8adc1',region:'shore',pos:[35,6],level:3},
  {id:'shell',name:'ヤドポン',type:'tide',kind:'おうちやどかり',bio:'貝がらのおうちには、丸い窓。いい景色を見つけるたびに、引っこしをする。',trait:'まもりじょうず',hp:41,atk:8,def:11,skill:'しおさいガード',color:'#e7ba81',region:'shore',pos:[35,32],level:3},
  {id:'manta',name:'ナミル',type:'tide',kind:'そらおよぎ',bio:'海の風にのって空を泳ぐ。波の音をおぼえていて、遠くの友だちに届ける。',trait:'すばやい',hp:32,atk:12,def:7,skill:'なみのリボン',color:'#7ebacb',region:'shore',pos:[48,9],level:4},
  {id:'ember',name:'ホノコ',type:'ember',kind:'ひだまりきつね',bio:'しっぽは、ひだまりのあたたかさ。元気いっぱいだけれど、暗い夜は少しこわい。',trait:'まけずぎらい',hp:30,atk:11,def:7,skill:'ひだまりスパーク',color:'#e9a273',region:'grove',pos:[5,-22],level:2},
  {id:'moth',name:'トモシビ',type:'ember',kind:'ランタンばね',bio:'はねの灯りで、夜の森の道しるべに。うれしいと、ふわふわ輪をえがいて飛ぶ。',trait:'やさしい',hp:31,atk:11,def:8,skill:'ほたるのひかり',color:'#e8c475',region:'grove',pos:[20,-16],level:3},
  {id:'ram',name:'イワモフ',type:'ember',kind:'ぬくいしひつじ',bio:'石みたいな角と、もふもふの毛。おなかはいつもぽかぽかで、ひるねの人気者。',trait:'がまんづよい',hp:43,atk:8,def:11,skill:'ぽかぽかスタンプ',color:'#c9b0a0',region:'grove',pos:[37,-20],level:4},
  {id:'drake',name:'コガリュウ',type:'ember',kind:'こだねりゅう',bio:'大きく飛ぶ練習をしている小さな竜。じょうずにできると、こちらを見てほめてほしがる。',trait:'まけずぎらい',hp:36,atk:12,def:8,skill:'ゆうやけのつばさ',color:'#dba486',region:'grove',pos:[7,-42],level:5},
  {id:'star',name:'ルナミィ',type:'star',kind:'ほしみみ',bio:'島のなかよしの灯りにひかれて、空からやってきた。きみとの冒険を、星に話している。',trait:'ふしぎ',hp:40,atk:12,def:10,skill:'ほしのハーモニー',color:'#bcaedc',region:'altar',pos:[-5,-47],level:7},
].map(Object.freeze));
export const BY_ID = Object.freeze(Object.assign(Object.create(null),Object.fromEntries(SPECIES.map(s=>[s.id,s]))));
export const STARTERS = ['sprig','otter','ember'];
export const SKILL_ROLES=Object.freeze({
 sprig:'power',puff:'guard',fawn:'heal',moss:'guard',otter:'tempo',fin:'heal',shell:'guard',manta:'power',ember:'power',moth:'tempo',ram:'guard',drake:'power',star:'heal'
});
export const ROLE_INFO=Object.freeze({
 power:{name:'とっぱ役',description:'力をこめた得意技。ふつうより少し大きなダメージ。',hint:'威力が高い'},
 guard:{name:'まもり役',description:'得意技のあと、身をまもる。次に受けるダメージを60%へらす。',hint:'技のあと自分をまもる'},
 heal:{name:'おせわ役',description:'得意技で、戦っているチームの元気ななかまのHPを少し回復する。',hint:'チームのHPも回復'},
 tempo:{name:'おうえん役',description:'得意技で、相手の気力を2へらす。強い技を使われにくくなる。',hint:'相手の気力 −2'}
});
export const REGIONS = Object.freeze([
 {id:'camp',name:'はじまりの広場',short:'広場',color:'#d3ba84',pos:[0,12],description:'なかまを休ませる、旅のホーム。'},
 {id:'meadow',name:'わかばの丘',short:'わかば',color:'#83b878',pos:[-25,-15],description:'花と風の丘。わかばのなかまが暮らす。'},
 {id:'shore',name:'しおかぜ浜',short:'しおかぜ',color:'#78b9ca',pos:[28,17],description:'貝がらが光る、しずくのなかまの浜。'},
 {id:'grove',name:'ともしびの森',short:'ともしび',color:'#dca374',pos:[17,-30],description:'ランタンのような花が咲く、あたたかな森。'},
]);
export const KEEPERS = Object.freeze([
 {id:'meadow',name:'花守りのミモ',title:'わかばのしるし',type:'leaf',pos:[-39,-28],species:['puff','fawn'],hello:'風の声をききながら、なかまと力をあわせてみよう。'},
 {id:'shore',name:'波守りのナギ',title:'しおかぜのしるし',type:'tide',pos:[44,25],species:['fin','manta'],hello:'強い波も、なかまといっしょなら越えられるよ。'},
 {id:'grove',name:'灯守りのアン',title:'ともしびのしるし',type:'ember',pos:[32,-38],species:['ram','drake'],hello:'ひとりの強さより、なかまを信じる気持ちを見せてね。'},
]);
export const getSpecies = id => BY_ID[id] || null;
export const stats = (id,level=1) => {const s=BY_ID[id];if(!s)return null;const l=Math.max(1,Math.min(12,Math.floor(level)||1));return {maxHp:s.hp+l*6,atk:s.atk+l*2,def:s.def+l};};
export const nextXP = level => 12+Math.max(1,level)*8;
export const effectiveness = (attack,defend) => TYPES[attack]?.strong===defend?1.5:TYPES[defend]?.strong===attack?0.72:1;
export function regionAt(x,z){if(x< -10&&z<7)return 'meadow';if(x>12&&z> -5)return 'shore';if(z< -10)return 'grove';return 'camp';}
