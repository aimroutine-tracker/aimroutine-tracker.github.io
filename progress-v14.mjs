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
const sourceStatus=document.getElementById('v14-source-status');
const signIn=document.getElementById('v14-source-signin');
const filterPanel=$('#v14-progress-filters');
const toolFilter=$('#v14-progress-tool');
const scenarioFilter=$('#v14-progress-scenario');
const rangeFilter=$('#v14-progress-range');
const authStorageKey='sb-lmzswtzboobpokumxzhy-auth-token';
let sessions=[],goal=3,readable=false,syncPending=false,loadVersion=0,loaded=false;
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
 const left=48,right=486,baseline=174;
 const x=i=>left+(a.length===1?0.5:i/(a.length-1))*(right-left);
 const y=n=>18+(100-n)/100*(baseline-18);
 const svg=svgEl('svg',{viewBox:'0 0 500 206',role:'img','aria-labelledby':'progress-accuracy-title progress-line-caption'});
 const dates=new Intl.DateTimeFormat(locale(),{day:'numeric',month:'short'});
 for(const tick of [0,25,50,75,100]){
  const ty=y(tick);
  svg.append(svgEl('line',{x1:left,x2:right,y1:ty,y2:ty,class:'progress-svg-grid'}));
  const label=svgEl('text',{x:0,y:ty+5,class:'progress-svg-tick'});label.textContent=tick+'%';svg.append(label);
 }
 const d=a.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.accuracy).toFixed(1)).join(' ');
 if(a.length>1)svg.append(svgEl('path',{d:d+' L'+right+' '+baseline+' L'+left+' '+baseline+' Z',class:'progress-svg-area'}));
 svg.append(svgEl('path',{d,class:'progress-svg-line','stroke-width':3,fill:'none','stroke-linejoin':'round','stroke-linecap':'round'}));
 a.forEach((p,i)=>svg.append(svgEl('circle',{cx:x(i),cy:y(p.accuracy),r:i===a.length-1?6:3.5,class:'progress-svg-point'})));
 const first=dates.format(new Date(a[0].date)),last=dates.format(new Date(a.at(-1).date));
 const endpoints=first===last?[[first,(left+right)/2,'middle']]:[[first,left,'start'],[last,right,'end']];
 for(const [value,x,anchor] of endpoints){
  const label=svgEl('text',{x,y:198,class:'progress-svg-tick','text-anchor':anchor});
  label.textContent=value;svg.append(label);
 }
 root.append(svg);
 const caption=document.createElement('p');caption.id='progress-line-caption';caption.className='v14-chart-caption';caption.textContent=scored.length>a.length
  ? tr(`${a.length} derniers résultats sur ${fmt(scored.length)}`,`Latest ${a.length} of ${fmt(scored.length)} scores`)
  : a.length+' '+(a.length===1?tr('résultat saisi','reported score'):tr('résultats saisis','reported scores'));
 root.append(caption);
 const details=document.createElement('details');
 details.className='progress-chart-data';
 const summary=document.createElement('summary');
 summary.textContent=tr('Voir les valeurs','Show values');
 const values=document.createElement('ol');
 for(const session of a){
  const row=document.createElement('li'),date=document.createElement('time'),score=document.createElement('strong');
  date.dateTime=session.date;
  date.textContent=dates.format(new Date(session.date));
  score.textContent=fmt(session.accuracy)+' %';
  row.append(date,score);values.append(row);
 }
 details.append(summary,values);root.append(details);
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
 const root=$('#v14-p-distribution');
 const total=items.length;
 if(!total)return blank(root,'Aucune séance à répartir pour cette sélection.','No sessions to group for this selection.');
 const list=document.createElement('ul');
 for(const [focus,labels] of Object.entries(focusLabels)){
  const count=items.filter(item=>item.focus===focus).length,share=100*count/total;
  const row=document.createElement('li'),label=document.createElement('div');
  const name=document.createElement('span'),value=document.createElement('strong');
  label.className='progress-distribution-label';
  name.textContent=tr(...labels);
  value.textContent=fmt(count);
  label.append(name,value);
  const track=document.createElement('span'),fill=document.createElement('span');
  track.className='progress-distribution-track';
  track.setAttribute('aria-hidden','true');
  fill.style.width=share+'%';
  track.append(fill);row.append(label,track);list.append(row);
 }
 root.replaceChildren(list);
}
function render(){
 const period=Number(rangeFilter.value)||0;
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
 $('#v14-p-goal').textContent=all.week+' / '+all.goal;
 $('#v14-p-goalbar').style.width=Math.min(100,Math.round(all.week/all.goal*100))+'%';
 lineChart(subset);barChart(buckets,now);distribution(subset);recentSessions(subset);
}
async function load(){
 const version=++loadVersion;
 let key=null,pending=false;
 try{
  if(localStorage.getItem(authStorageKey)){
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
 loaded=true;readable=key!==null;syncPending=pending;sessions=[];goal=3;
 if(readable){
  try{const raw=JSON.parse(localStorage.getItem(key)||'null');const clean=normalizeStore(raw,null);sessions=clean.sessions;goal=clean.weeklyGoal;}catch{}
 }
 refreshFilters();
 renderSource();
 render();
}
function renderSource(){
 sourceStatus.dataset.source=readable?(syncPending?'pending':'current'):'guest';
 source.textContent=readable?
  (syncPending?tr('Synchronisation en attente · Dernières données disponibles de ton compte','Cloud sync pending · Showing your latest available account data'):tr('Compte connecté · Séances web synchronisées','Signed in · Web sessions synced')):
  tr('Connecte-toi pour retrouver tes séances et tes statistiques.','Sign in to see your sessions and statistics.');
 signIn.hidden=readable;
}
function renderLanguage(){
 const captions=[tr('7 jours','7 days'),tr('30 jours','30 days'),tr('90 jours','90 days'),tr('Tout','All')];
 [...rangeFilter.options].forEach((option,index)=>{option.textContent=captions[index]});
 $('.r19-range-buttons')?.setAttribute('aria-label',tr('Période des statistiques','Statistics period'));
 if(loaded){renderSource();refreshFilters();render();}
}
rangeFilter.addEventListener('change',render);
toolFilter.addEventListener('change',()=>{refreshFilters();render()});
scenarioFilter.addEventListener('change',render);
new MutationObserver(renderLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.addEventListener('storage',event=>{
 if(event.key===authStorageKey||event.key===null){
  if(readable){readable=false;syncPending=false;sessions=[];goal=3;renderSource();refreshFilters();render();}
  void load();
 }else if(event.key?.includes(STORAGE_KEY))void load();
});
window.addEventListener('focus',()=>void load());
window.addEventListener('online',()=>void load());
renderLanguage();
void load();
