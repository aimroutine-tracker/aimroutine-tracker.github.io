/* V14 progress: only validated user-recorded sessions, no fabricated analytics. */
import {normalizeStore,computeStats,STORAGE_KEY} from './training-core-v5.mjs';
import {validUid,scopedKey} from './cloud-core-v7.mjs';
import {synchronize} from './cloud-sync-v7.mjs';
import {progressPeriod,progressScenarioOptions,filterProgressSessions} from './progress-core.mjs?v=2';
const $=s=>document.querySelector(s);
const en=()=>document.documentElement.lang==='en';
const tr=(fr,english)=>en()?english:fr;
const fmt=n=>Number(n).toLocaleString(en()?'en-GB':'fr-FR',{maximumFractionDigits:1});
const source=document.getElementById('v14-source-message');
const signIn=document.getElementById('v14-source-signin');
const filterPanel=$('#v14-progress-filters');
const toolFilter=$('#v14-progress-tool');
const scenarioFilter=$('#v14-progress-scenario');
let sessions=[],goal=3,readable=false,syncPending=false,loadVersion=0;
const locale=()=>en()?'en-GB':'fr-FR';
const toolLabel=tool=>tool==='Non précisé'?tr('Non renseigné','Not specified'):tool;
const focusLabels={
 flick:['Premier tir','First shot'],tracking:['Tracking','Tracking'],
 micro:['Micro-corrections','Micro-adjustments'],control:['Contrôle','Control']
};
function updateFilter(select,allLabel,options){
 const previous=select.value;
 select.replaceChildren(new Option(allLabel,''),
  ...options.map(({label,value})=>new Option(label,value)));
 select.value=options.some(option=>option.value===previous)?previous:'';
 select.disabled=options.length===0;
}

function refreshFilters(){
 const {sessions:history}=progressPeriod(sessions,0);
 filterPanel.hidden=history.length===0;
 const compare=new Intl.Collator(locale()).compare;
 const tools=[...new Set(history.map(session=>session.tool))]
  .map(value=>({label:toolLabel(value),value}))
  .sort((a,b)=>compare(a.label,b.label));
 updateFilter(toolFilter,tr('Tous les logiciels','All tools'),tools);

 const tool=toolFilter.value;
 const scenarios=progressScenarioOptions(history,tool)
  .map(({name,value,tool:scenarioTool})=>({value,label:tool?name:name+' · '+toolLabel(scenarioTool)}))
  .sort((a,b)=>compare(a.label,b.label));
 updateFilter(scenarioFilter,tr('Tous les scénarios','All scenarios'),scenarios);
}

function svgEl(name,props){
 const e=document.createElementNS('http://www.w3.org/2000/svg',name);
 for(const [key,value] of Object.entries(props))e.setAttribute(key,String(value));
 return e;
}
function blank(el,fr,english){
 el.replaceChildren();
 const p=document.createElement('p');p.className='v14-chart-empty';
 p.textContent=tr(fr,english);el.append(p);
}
function lineChart(items){
 const root=$('#v14-p-line');
 const scored=items.filter(s=>s.accuracy!==null).sort((x,y)=>x.date.localeCompare(y.date));
 const a=scored.slice(-25);
 if(!a.length)return blank(root,'Aucune précision enregistrée pour cette sélection.','No accuracy scores for this selection.');
 root.replaceChildren();
 const width=620,height=235;
 const x=i=>34+(a.length===1?0.5:i/(a.length-1))*560;
 const y=n=>18+(100-n)/100*181;
 const svg=svgEl('svg',{viewBox:'0 0 '+width+' '+height,'aria-hidden':'true'});
 for(const tick of [0,25,50,75,100]){
  const ty=y(tick);
  svg.append(svgEl('line',{x1:34,x2:602,y1:ty,y2:ty,stroke:'#385364','stroke-dasharray':'3 6'}));
  const label=svgEl('text',{x:0,y:ty+4,fill:'#a7bdca','font-size':11});label.textContent=tick+'%';svg.append(label);
 }
 const d=a.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.accuracy).toFixed(1)).join(' ');
 svg.append(svgEl('path',{d,stroke:'#85e9dc','stroke-width':3,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'}));
 a.forEach((p,i)=>svg.append(svgEl('circle',{cx:x(i),cy:y(p.accuracy),r:i===a.length-1?6:3,fill:'#ff748d',stroke:'#ffced8','stroke-width':1})));
 const first=svgEl('text',{x:34,y:224,'font-size':11,fill:'#b5ced8'});first.textContent=new Date(a[0].date).toLocaleDateString(en()?'en-GB':'fr-FR',{day:'numeric',month:'short'});svg.append(first);
 const last=svgEl('text',{x:603,y:224,'font-size':11,fill:'#b5ced8','text-anchor':'end'});last.textContent=new Date(a[a.length-1].date).toLocaleDateString(en()?'en-GB':'fr-FR',{day:'numeric',month:'short'});svg.append(last);
 root.append(svg);
 const caption=document.createElement('small');caption.className='v14-chart-caption';caption.textContent=scored.length>a.length
  ? tr(`${a.length} derniers résultats sur ${fmt(scored.length)}`,`Latest ${a.length} of ${fmt(scored.length)} scores`)
  : a.length+' '+tr('résultats saisis','reported scores');
 root.append(caption);
}
function barChart(buckets,now){
 const root=$('#v14-p-bars');
 if(!buckets.length)return blank(root,'Aucune séance pour cette sélection.','No sessions for this selection.');
 const showYear=buckets[0].start.getUTCFullYear()!==now.getFullYear();
 const dates=new Intl.DateTimeFormat(locale(),{
  day:'numeric',month:'short',timeZone:'UTC',...(showYear?{year:'numeric'}:{})
 });
 const max=Math.max(...buckets.map(bucket=>bucket.count));
 const list=document.createElement('ul');
 list.className='ar-progress-frequency';
 for(const {start,end,count} of buckets){
  const row=document.createElement('li');
  const label=document.createElement('span');
  label.textContent=dates.formatRange(start,end);
  const track=document.createElement('span');
  track.className='ar-progress-frequency-track';
  track.setAttribute('aria-hidden','true');
  const fill=document.createElement('span');
  fill.style.width=100*count/max+'%';
  track.append(fill);
  const total=document.createElement('strong');
  total.dataset.sessionCount='';
  total.textContent=String(count);
  row.append(label,track,total);list.append(row);
 }
 root.replaceChildren(list);
}

function recentSessions(items){
 const root=$('#v14-p-recent');
 if(!items.length)return blank(root,'Aucune séance à afficher.','No sessions to show.');
 const dates=new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short',year:'numeric'});
 const list=document.createElement('ul');
 list.className='ar-progress-sessions';
 const latest=items.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
 for(const session of latest){
  const row=document.createElement('li');
  const details=document.createElement('div');
  const name=document.createElement('strong');
  name.textContent=session.scenario||tr(...focusLabels[session.focus]);
  const meta=document.createElement('small');
  const date=document.createElement('time');
  date.dateTime=session.date;
  date.textContent=dates.format(new Date(session.date));
  const tool=session.tool==='Non précisé'?'':' · '+session.tool;
  meta.append(date,tool+' · '+fmt(session.minutes)+' min');
  details.append(name,meta);
  row.append(details);
  if(session.accuracy!==null){
   const score=document.createElement('span');
   score.className='ar-progress-score';
   score.textContent=fmt(session.accuracy)+' %';
   score.title=tr('Précision saisie','Reported accuracy');
   row.append(score);
  }
  list.append(row);
 }
 root.replaceChildren(list);
}
function distribution(items){
 const root=$('#v14-p-distribution');root.replaceChildren();
 const keys=['flick','tracking','micro','control'];
 const labels=['Flick','Tracking',tr('Micro-correction','Micro-adjust'),tr('Contrôle','Control')];
 const counts=keys.map(k=>items.filter(s=>s.focus===k).length);
 const total=items.length;
 if(!total){
  const empty=document.createElement('p');empty.className='v14-chart-empty';
  empty.textContent=tr('Enregistre tes séances pour afficher la répartition.','Record sessions to see the distribution.');
  root.append(empty);return;
 }
 const chart=document.createElement('div');chart.className='v15-radar';
 const svg=svgEl('svg',{viewBox:'0 0 320 255','aria-hidden':'true'});
 const cx=160,cy=120,r=79;
 const pts=(fraction)=>keys.map((k,i)=>{
  const angle=-Math.PI/2+i*2*Math.PI/keys.length;
  return [cx+Math.cos(angle)*r*fraction,cy+Math.sin(angle)*r*fraction];
 });
 const string=(points)=>points.map(p=>p.map(x=>x.toFixed(1)).join(',')).join(' ');
 for(const amount of [.25,.5,.75,1]){
  svg.append(svgEl('polygon',{points:string(pts(amount)),fill:'none',stroke:amount===1?'#ff617c':'#3d5d6b','stroke-width':amount===1?1.5:1}));
 }
 pts(1).forEach(([x,y])=>svg.append(svgEl('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:'#476575','stroke-dasharray':'3 5'})));
 const actual=keys.map((_,i)=>{
  const angle=-Math.PI/2+i*2*Math.PI/keys.length;
  const value=counts[i]/total;
  return [cx+Math.cos(angle)*r*value,cy+Math.sin(angle)*r*value];
 });
 svg.append(svgEl('polygon',{points:string(actual),fill:'#52eddc59',stroke:'#5cf6e6','stroke-width':2.3,'stroke-linejoin':'round'}));
 actual.forEach(([x,y])=>svg.append(svgEl('circle',{cx:x,cy:y,r:3.5,fill:'#90fff2'})));
 const labelPos=pts(1.3);
 labelPos.forEach(([x,y],i)=>{
  const node=svgEl('text',{x,y,'text-anchor':'middle','font-size':11,fill:'#dcf8f7'});
  node.textContent=labels[i]+' '+Math.round(counts[i]/total*100)+'%';svg.append(node);
 });
 chart.append(svg);root.append(chart);
 const description=document.createElement('p');description.className='v14-chart-caption';
 description.textContent=tr('Part des '+total+' séances selon la compétence travaillée.','Share of '+total+' sessions by training focus.');
 root.append(description);
}
function render(){
 const period=Number($('#v14-progress-range').value)||0;
 const now=new Date();
 const selected=filterProgressSessions(sessions,toolFilter.value,scenarioFilter.value);
 const {sessions:subset,buckets}=progressPeriod(selected,period,now);
 const stats=computeStats(subset,goal,now),all=computeStats(sessions,goal,now);
 const percent=x=>x===null?'—':fmt(x)+' %';
 $('#v14-p-average').textContent=percent(stats.avg);
 $('#v14-p-minutes').textContent=fmt(stats.minutes);
 $('#v14-p-sessions').textContent=fmt(stats.count);
 $('#v14-p-streak').textContent=String(all.streak);
 $('#v14-p-best').textContent=percent(stats.best);
 $('#v14-p-week').textContent=String(all.week);
 $('#v14-p-streak-detail').textContent=String(all.streak);
 $('#v14-p-goal').textContent=all.week+' / '+all.goal;
 $('#v14-p-goalbar').style.width=Math.min(100,Math.round(all.week/all.goal*100))+'%';
 lineChart(subset);barChart(buckets,now);distribution(subset);recentSessions(subset);
}
async function load(){
 const version=++loadVersion;
 let key=null,pending=false;
 try{
  if(localStorage.getItem('sb-lmzswtzboobpokumxzhy-auth-token')){
   const {supabase}=await import('./cloud-client-v7.mjs');
   const {data,error}=await supabase.auth.getSession();
   const uid=data?.session?.user?.id;
   if(!error&&validUid(uid)){
    const verified=await supabase.auth.getUser();
    if(!verified.error&&verified.data?.user?.id===uid){
     key=scopedKey(STORAGE_KEY,uid);
     try{await synchronize(supabase,uid)}catch{pending=true}
    }
   }
  }
 }catch{key=null;}
 if(version!==loadVersion)return;
 readable=key!==null;syncPending=pending;sessions=[];goal=3;
 if(readable){
  try{const raw=JSON.parse(localStorage.getItem(key)||'null');const clean=normalizeStore(raw,null);sessions=clean.sessions;goal=clean.weeklyGoal;}catch{}
 }
 refreshFilters();
 renderSource();
 render();
}
function renderSource(){
 source.textContent=readable?
  (syncPending?tr('Compte connecté · Synchronisation cloud en attente ; affichage du cache de ton compte','Signed in · Cloud sync pending; showing account cache'):tr('Compte connecté · Statistiques automatiquement synchronisées','Signed in · Statistics automatically synchronized')):
  tr('Connecte-toi pour consulter tes statistiques.','Sign in to see your statistics.');
 signIn.hidden=readable;
}
$('#v14-progress-range').addEventListener('change',render);
toolFilter.addEventListener('change',()=>{refreshFilters();render()});
scenarioFilter.addEventListener('change',render);
document.querySelectorAll('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(()=>{if(loadVersion)renderSource();refreshFilters();render()})));
window.addEventListener('storage',event=>{if(event.key?.includes(STORAGE_KEY))void load();});
window.addEventListener('focus',()=>void load());
window.addEventListener('online',()=>void load());
void load();