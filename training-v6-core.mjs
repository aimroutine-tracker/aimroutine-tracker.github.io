/* AimRoutine Tracker v6: deterministic, browser-independent player features. No Riot/network access. */
import {FOCUS,RANK,TOOLS,createRoutine,validSession,validPreset} from './training-core-v5.mjs';

export const EXT_KEY='aimroutine_player_extensions_v1';
export const INTERCHANGE='aimroutine-interchange-v1';
export const PERIODS=[7,30,90,0];
export const AVATARS=['crosshair','bolt','shield','star'];

const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clampText=(v,limit)=>String(v??'').trim().slice(0,limit);
const isNum=(n,min,max)=>Number.isFinite(Number(n))&&Number(n)>=min&&Number(n)<=max;
export function cleanProfile(p){
 const o=plain(p)?p:{};
 return {
   nickname:clampText(o.nickname,24),
   avatar:AVATARS.includes(o.avatar)?o.avatar:'crosshair',
   rank:Object.hasOwn(RANK,o.rank)?o.rank:'silver',
   dpi:o.dpi===''||o.dpi==null?null:isNum(o.dpi,100,32000)?Math.round(Number(o.dpi)):null,
   sensitivity:o.sensitivity===''||o.sensitivity==null?null:isNum(o.sensitivity,0.001,10)?Number(o.sensitivity):null,
   mouse:clampText(o.mouse,70),goal:clampText(o.goal,140),
   tool:TOOLS.includes(o.tool)?o.tool:'VALORANT'
 };
}
export function validProgram(program){
 return plain(program)&&[7,14,30].includes(program.days)&&
   typeof program.startedAt==='string'&&Number.isFinite(Date.parse(program.startedAt))&&
   Object.hasOwn(RANK,program.rank)&&TOOLS.includes(program.tool);
}
export function cleanExtension(x){
 const raw=plain(x)?x:{};
 return {version:1,profile:cleanProfile(raw.profile),
   program:validProgram(raw.program)?{days:raw.program.days,startedAt:new Date(raw.program.startedAt).toISOString(),rank:raw.program.rank,tool:raw.program.tool}:null};
}
const dayISO=date=>{const d=new Date(date);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
export function startProgram(days,rank,tool,date=new Date()){
 if(![7,14,30].includes(Number(days))||!Object.hasOwn(RANK,rank)||!TOOLS.includes(tool)||!Number.isFinite(new Date(date).getTime()))throw Error('Programme invalide');
 return {days:Number(days),rank,tool,startedAt:new Date(date).toISOString()};
}
export function scheduledDay(program,index){
 if(!validProgram(program)||!Number.isInteger(index)||index<0||index>=program.days)throw Error('Jour invalide');
 const start=new Date(program.startedAt),local=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index);
 const focus=['flick','micro','tracking','control','flick','tracking',null][index%7];
 const minutes=focus===null?0:[15,20,20,25,25,20][index%7];
 return {index,date:dayISO(local),focus,minutes,rest:focus===null,tool:program.tool,
   label:focus?FOCUS[focus]:'Repos / récupération'};
}
export function programCalendar(program,sessions=[],now=new Date()){
 if(!validProgram(program))return [];
 // A recorded timestamp in the future cannot complete a scheduled day.
 // Keep the raw history untouched for clock-drift troubleshooting.
 const observed=periodSessions(sessions,0,now);
 const used=new Set();
 return Array.from({length:program.days},(_,i)=>{
  const entry=scheduledDay(program,i);
  const matched=observed.find(s=>!used.has(s.id)&&entry.focus&&validSession(s)&&
    dayISO(s.date)===entry.date&&s.focus===entry.focus&&s.tool===entry.tool&&
    Date.parse(s.date)>=Date.parse(program.startedAt));
  if(matched)used.add(matched.id);
  return {...entry,completed:!!matched};
 });
}
export function periodSessions(sessions,range=30,now=new Date()){
 if(!PERIODS.includes(Number(range)))throw Error('Période invalide');
 const end=new Date(now).getTime();const start=Number(range)?end-Number(range)*86400000:-Infinity;
 return sessions.filter(s=>{const t=Date.parse(s.date);return validSession(s)&&t<=end&&t>=start});
}
export function scenarioOptions(sessions,focus,tool,now=new Date()){
 const counts=new Map();
 periodSessions(sessions,0,now).filter(s=>s.accuracy!==null&&s.focus===focus&&
   (!tool||s.tool===tool)&&typeof s.scenario==='string'&&s.scenario.trim())
 .forEach(s=>{const name=s.scenario.trim();counts.set(name,(counts.get(name)||0)+1)});
 return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,count])=>({name,count}));
}
export function scenarioMetrics(sessions,{focus,tool,scenario,range=30,now=new Date()}){
 const all=periodSessions(sessions,range,now).filter(s=>s.focus===focus&&s.accuracy!==null&&
   (!tool||s.tool===tool)&&(!scenario||s.scenario===scenario));
 const sorted=all.sort((a,b)=>a.date.localeCompare(b.date));
 const best=sorted.length?Math.max(...sorted.map(s=>s.accuracy)):null;
 const avg=sorted.length?sorted.reduce((sum,s)=>sum+s.accuracy,0)/sorted.length:null;
 const first=sorted.slice(0,Math.min(3,sorted.length));
 const last=sorted.slice(-Math.min(3,sorted.length));
 const mean=xs=>xs.reduce((a,b)=>a+b.accuracy,0)/xs.length;
 const comparable=!!scenario&&!!tool&&sorted.length>=6;
 return {sessions:sorted,best,average:avg,count:sorted.length,
   change:comparable?mean(last)-mean(first):null,
   comparisonValid:comparable};
}
export function calendarGrid(sessions,now=new Date(),days=35){
 // Including a later-today timestamp would visually award activity early.
 const observed=periodSessions(sessions,0,now);
 const end=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 return Array.from({length:days},(_,i)=>{
   const day=new Date(end.getFullYear(),end.getMonth(),end.getDate()-(days-1-i));
   const date=dayISO(day);
   const count=observed.filter(s=>dayISO(s.date)===date).length;
   return {date,count};
 });
}
export function achievements(sessions,now=new Date()){
 // Rewards reflect completed, observed sessions only; future cache rows
 // may be retained but can never unlock a badge or extend a streak.
 const observed=periodSessions(sessions,0,now);
 const total=observed.length;
 const month=periodSessions(observed,30,now).length;
 const days=new Set(observed.map(s=>dayISO(s.date)));
 let longest=0,streak=0,previous=null;
 for(const day of [...days].sort()){
  const dayMs=new Date(day+'T12:00:00').getTime();
  if(previous!==null&&Math.round((dayMs-previous)/86400000)===1)streak+=1;else streak=1;
  longest=Math.max(longest,streak);previous=dayMs;
 }
 const list=[
 {id:'first',title:'Première séance',desc:'Une séance enregistrée',done:total>=1,progress:Math.min(total,1),target:1},
 {id:'regular',title:'Régularité',desc:'5 séances enregistrées',done:total>=5,progress:Math.min(total,5),target:5},
 {id:'dedicated',title:'Investi',desc:'25 séances enregistrées',done:total>=25,progress:Math.min(total,25),target:25},
 {id:'streak',title:'3 jours de suite',desc:'3 jours consécutifs avec séance',done:longest>=3,progress:Math.min(longest,3),target:3},
 {id:'month',title:'Un mois actif',desc:'10 séances durant les 30 derniers jours',done:month>=10,progress:Math.min(month,10),target:10}
 ];
 return list;
}
export function toInterchange(store,extension){
 // A documented portable format only. No desktop importer is claimed.
 return {
  format:INTERCHANGE,createdAt:new Date().toISOString(),
  origin:'aimroutine-web',
  disclaimer:'Portable web export. Windows desktop importer is not implemented yet.',
  profile:cleanProfile(extension.profile),
  sessions:store.sessions.filter(validSession).slice(-1000),
  presets:store.presets.filter(validPreset).slice(-25),
  weeklyGoal:store.weeklyGoal,
  program:validProgram(extension.program)?extension.program:null
 };
}
export function parseInterchange(payload){
 if(!plain(payload)||payload.format!==INTERCHANGE||!Array.isArray(payload.sessions)||
  payload.sessions.length>1000||!payload.sessions.every(validSession)||
  !Array.isArray(payload.presets)||payload.presets.length>25||!payload.presets.every(validPreset)||
  !isNum(payload.weeklyGoal,1,14)||!Number.isInteger(Number(payload.weeklyGoal)))
   throw Error('Format d’échange incompatible');
 return {sessions:payload.sessions,presets:payload.presets,
   weeklyGoal:Number(payload.weeklyGoal),
   extension:cleanExtension({profile:payload.profile,program:payload.program})};
}
