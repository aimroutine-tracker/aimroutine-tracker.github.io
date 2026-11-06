/* AimRoutine web 5.0 — pure, testable functions (no network or Riot API). */
export const STORAGE_KEY='aimroutine_web_training_v2';
export const LEGACY_KEY='aimroutine_web_training_v1';
export const FOCUS={
  flick:'Flick et premier tir',micro:'Micro-corrections',
  tracking:'Tracking',control:'Contrôle et précision'
};
export const RANK={iron:'Fer / Bronze',silver:'Argent / Or',diamond:'Platine / Diamant / Ascendant',immortal:'Immortel / Radiant'};
export const TOOLS=['VALORANT','Aim Lab','KovaaK’s','Oblivity'];
export const CATALOG=[
  {tool:'VALORANT',focus:'flick',name:'Stand de tir · Premier tir',tip:'Arrête-toi complètement avant chaque balle.'},
  {tool:'VALORANT',focus:'micro',name:'Stand de tir · Petites corrections',tip:'Corrige doucement la position du viseur.'},
  {tool:'VALORANT',focus:'tracking',name:'Stand de tir · Cibles mobiles',tip:'Privilégie un mouvement fluide.'},
  {tool:'VALORANT',focus:'control',name:'Strafe · Arrêt · Tir',tip:'Garde le viseur à hauteur de tête.'},
  {tool:'Aim Lab',focus:'flick',name:'Gridshot / flicks contrôlés',tip:'Ralentis si la précision baisse.'},
  {tool:'Aim Lab',focus:'micro',name:'Microshot / corrections fines',tip:'Réduis l’amplitude des gestes.'},
  {tool:'Aim Lab',focus:'tracking',name:'Tracking · cibles mobiles',tip:'Suivi régulier, sans gestes brusques.'},
  {tool:'Aim Lab',focus:'control',name:'Précision · cibles statiques',tip:'Répète dans les mêmes conditions.'},
  {tool:'KovaaK’s',focus:'flick',name:'Clicking · cibles espacées',tip:'Soigne la phase de décélération.'},
  {tool:'KovaaK’s',focus:'micro',name:'Micro-cibles · corrections',tip:'Sois précis avant d’aller vite.'},
  {tool:'KovaaK’s',focus:'tracking',name:'Smooth tracking · suivi fluide',tip:'Évite de surcorriger.'},
  {tool:'KovaaK’s',focus:'control',name:'Static clicking · précision',tip:'Prends une difficulté comparable.'},
  {tool:'Oblivity',focus:'flick',name:'Flick · acquisition de cibles',tip:'Vise l’exactitude avant le rythme.'},
  {tool:'Oblivity',focus:'micro',name:'Micro-ajustements',tip:'Garde une prise détendue.'},
  {tool:'Oblivity',focus:'tracking',name:'Suivi de cible',tip:'Travaille la stabilité du geste.'},
  {tool:'Oblivity',focus:'control',name:'Contrôle du viseur',tip:'Garde des mouvements reproductibles.'}
];
export const int=(n,min,max)=>Number.isInteger(Number(n)) && Number(n)>=min && Number(n)<=max;
export function validSession(s){
  return !!(s&&typeof s==='object'&&!Array.isArray(s)&&
    typeof s.id==='string'&&s.id.length>0&&s.id.length<=100&&
    typeof s.date==='string'&&Number.isFinite(Date.parse(s.date))&&
    Object.hasOwn(RANK,s.rank)&&Object.hasOwn(FOCUS,s.focus)&&
    int(s.minutes,1,120)&&
    (s.accuracy===null||(typeof s.accuracy==='number'&&Number.isFinite(s.accuracy)&&s.accuracy>=0&&s.accuracy<=100))&&
    ['good','ok','hard'].includes(s.feeling)&&
    typeof s.notes==='string'&&s.notes.length<=240&&
    (s.tool===undefined||TOOLS.includes(s.tool)||s.tool==='Non précisé'));
}
export function normalizeSession(s){
  if(!validSession(s)) return null;
  return {
    id:s.id,date:new Date(s.date).toISOString(),rank:s.rank,focus:s.focus,
    minutes:Number(s.minutes),accuracy:s.accuracy,feeling:s.feeling,
    notes:s.notes.slice(0,240),
    tool:TOOLS.includes(s.tool)?s.tool:'Non précisé',
    scenario:typeof s.scenario==='string'?s.scenario.slice(0,90):'',
    breakSeconds:int(s.breakSeconds,0,120)?Number(s.breakSeconds):0
  };
}
export function validExercise(x){
  return !!(x&&typeof x==='object'&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=90&&
    TOOLS.includes(x.tool)&&int(x.minutes,1,45)&&
    typeof x.tip==='string'&&x.tip.length<=180);
}
export function validPreset(p){
  return !!(p&&typeof p==='object'&&typeof p.id==='string'&&p.id.length<=100&&
    typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=60&&
    Object.hasOwn(FOCUS,p.focus)&&Object.hasOwn(RANK,p.rank)&&
    int(p.breakSeconds,0,120)&&Array.isArray(p.exercises)&&p.exercises.length>=1&&p.exercises.length<=10&&
    p.exercises.every(validExercise)&&p.exercises.reduce((a,b)=>a+Number(b.minutes),0)<=120);
}
export function normalizeStore(raw,old){
  const current=raw&&typeof raw==='object'?raw:{};
  const legacy=old&&typeof old==='object'?old:{};
  const source=Array.isArray(current.sessions)?current.sessions:Array.isArray(legacy.sessions)?legacy.sessions:[];
  const seen=new Set();
  const sessions=[];
  for(const item of source.slice(-2000)){
    const s=normalizeSession(item);
    if(s&&!seen.has(s.id)){seen.add(s.id);sessions.push(s);}
  }
  const presets=Array.isArray(current.presets)?current.presets.filter(validPreset).slice(-25):[];
  return {format:'aimroutine-web-v2',sessions:sessions.slice(-1000),presets,weeklyGoal:int(current.weeklyGoal,1,14)?Number(current.weeklyGoal):3};
}
export function createRoutine(rank,focus,tool,minutes=25,breakSeconds=30){
  if(!Object.hasOwn(RANK,rank)||!Object.hasOwn(FOCUS,focus)||!TOOLS.includes(tool)) throw Error('Choix de routine invalide');
  const picks=CATALOG.filter(x=>x.tool===tool&&x.focus===focus);
  const fallback=CATALOG.filter(x=>x.tool===tool&&x.focus!==focus);
  const rows=[picks[0],fallback[0],picks[0]].filter(Boolean);
  const total=Math.max(10,Math.min(90,Number(minutes)||25));
  const first=Math.floor(total*.28),second=Math.floor(total*.36),last=total-first-second;
  return {rank,focus,breakSeconds:Number(breakSeconds)||0,exercises:rows.map((x,i)=>({
    name:x.name,tool:x.tool,minutes:[first,second,last][i],tip:x.tip
  }))};
}
export function sessionMinutes(p){return p.exercises.reduce((n,x)=>n+Number(x.minutes),0);}
export function localDay(date){const d=new Date(date);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
export function streak(sessions,now=new Date()){
  const days=new Set(sessions.map(s=>localDay(s.date)));
  let d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(!days.has(localDay(d)))d.setDate(d.getDate()-1);
  let n=0;
  while(days.has(localDay(d))&&n<=3650){n++;d.setDate(d.getDate()-1);}
  return n;
}
export function computeStats(sessions,weeklyGoal=3,now=new Date()){
  const list=sessions.slice().sort((a,b)=>b.date.localeCompare(a.date));
  const scores=list.filter(s=>s.accuracy!==null).map(s=>s.accuracy);
  const ms=now.getTime();
  const week=list.filter(s=>{const t=Date.parse(s.date);return t<=ms&&t>ms-7*86400000;});
  return {count:list.length,minutes:list.reduce((n,s)=>n+s.minutes,0),
    avg:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,
    best:scores.length?Math.max(...scores):null,
    week:week.length,goal:weeklyGoal,streak:streak(list,now),
    byFocus:Object.fromEntries(Object.keys(FOCUS).map(k=>[k,list.filter(s=>s.focus===k).length]))};
}
export function comparable(sessions,focus,tool){
  return sessions.filter(s=>s.focus===focus&&s.accuracy!==null&&(!tool||s.tool===tool)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function coach(sessions,focus,tool,weeklyGoal=3,now=new Date()){
  const stat=computeStats(sessions,weeklyGoal,now);
  const xs=comparable(sessions,focus,tool);
  if(!sessions.length)return {title:'Premiers pas',message:'Prépare une séance courte, note ton ressenti, puis répète plusieurs fois les mêmes exercices.',confidence:'Démarrage',focus};
  if(xs.length<4)return {title:'Construire un historique comparable',
    message:'Il faut au moins quatre séances avec une précision renseignée pour '+FOCUS[focus].toLowerCase()+' avec le même outil. Continue à enregistrer tes résultats.',
    confidence:'Données insuffisantes',focus};
  const prev=xs.slice(-4,-2),recent=xs.slice(-2);
  const mean=a=>a.reduce((n,s)=>n+s.accuracy,0)/a.length;
  const delta=mean(recent)-mean(prev);
  if(delta<=-3)return {title:'Priorité au contrôle',message:'Tes deux dernières précisions sont inférieures aux deux précédentes (−'+Math.abs(delta).toFixed(1)+' points). Réduis la vitesse et conserve un scénario comparable.',confidence:'Tendance indicative',focus};
  if(delta>=3)return {title:'Consolider la progression',message:'Tes deux dernières précisions sont en hausse (+'+delta.toFixed(1)+' points). Garde la même difficulté quelques séances pour confirmer.',confidence:'Tendance indicative',focus};
  return {title:'Régularité',message:'Ta précision évolue de moins de 3 points entre les deux périodes. Répète les mêmes scénarios et vise '+weeklyGoal+' séances par semaine.',confidence:'Tendance indicative',focus};
}
export function exportPayload(store){
  return {format:'aimroutine-web-v2',exportedAt:new Date().toISOString(),sessions:store.sessions,presets:store.presets,weeklyGoal:store.weeklyGoal};
}
export function importPayload(payload,store){
  if(!payload||typeof payload!=='object'||!['aimroutine-web-v1','aimroutine-web-v2'].includes(payload.format)||!Array.isArray(payload.sessions)||payload.sessions.length>1000||!payload.sessions.every(validSession))throw Error('Format ou séances invalides');
  if(payload.format==='aimroutine-web-v2'&&(!Array.isArray(payload.presets)||payload.presets.length>25||!payload.presets.every(validPreset)))throw Error('Favoris invalides');
  const known=new Set(store.sessions.map(x=>x.id));
  const added=payload.sessions.map(normalizeSession).filter(x=>!known.has(x.id));
  const presets=payload.format==='aimroutine-web-v2'?[...store.presets,...payload.presets.filter(p=>!store.presets.some(y=>y.id===p.id))].slice(-25):store.presets;
  return {store:{...store,sessions:[...store.sessions,...added].slice(-1000),presets,weeklyGoal:int(payload.weeklyGoal,1,14)?Number(payload.weeklyGoal):store.weeklyGoal},added:added.length};
}
