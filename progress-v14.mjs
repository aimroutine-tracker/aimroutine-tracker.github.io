/* V14 progress: only validated user-recorded sessions, no fabricated analytics. */
import {normalizeStore,computeStats,weeklySessionCounts,FOCUS,STORAGE_KEY} from './training-core-v5.mjs';
import {validUid,scopedKey} from './cloud-core-v7.mjs';
import {synchronize} from './cloud-sync-v7.mjs';
const $=s=>document.querySelector(s);
const en=()=>document.documentElement.lang==='en';
const tr=(fr,english)=>en()?english:fr;
const fmt=n=>Number(n).toLocaleString(en()?'en-GB':'fr-FR',{maximumFractionDigits:1});
const source=document.getElementById('v14-source-status');
const AUTH_KEY='sb-lmzswtzboobpokumxzhy-auth-token';
let sessions=[],goal=3,scope='guest',loadGeneration=0,cloudSyncPending=false;
const guestNotice=()=>tr('Connecte-toi pour consulter tes statistiques. Rien n’est sauvegardé sans compte.','Sign in to see your statistics. Nothing is saved without an account.');
function refreshSourceNotice(){
 const message=scope==='account'?
  (cloudSyncPending?
   tr('Compte connecté · Synchronisation cloud en attente ; affichage du cache de ton compte','Signed in · Cloud sync pending; showing account cache'):
   tr('Compte connecté · Statistiques automatiquement synchronisées','Signed in · Statistics automatically synchronized')):
  guestNotice();
 if(source.textContent!==message)source.textContent=message;
}
const recent=(items,days,now=new Date())=>!days?items.slice():items.filter(x=>{const age=now.getTime()-Date.parse(x.date);return age>=0&&age<=days*86400000;});
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
// All SVG charts are intentionally aria-hidden: expose real recorded values
// as screen-reader text instead of inventing demonstration metrics.
function readableChartSummary(root,text){
 const summary=document.createElement('p');
 summary.className='r17-visually-hidden';
 summary.textContent=text;
 root.append(summary);
}
function lineChart(items){
 const root=$('#v14-p-line');
 const a=items.filter(s=>s.accuracy!==null).sort((x,y)=>x.date.localeCompare(y.date)).slice(-25);
 if(!a.length)return blank(root,'Aucune précision enregistrée pour cette période.','No accuracy recorded in this period.');
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
 const caption=document.createElement('small');caption.className='v14-chart-caption';caption.textContent=a.length+' '+tr('résultats saisis','reported scores');root.append(caption);
 readableChartSummary(root,tr('Précision enregistrée : ','Recorded accuracy: ')+a.map(point=>{
  const date=new Date(point.date).toLocaleDateString(en()?'en-GB':'fr-FR',{day:'numeric',month:'short',year:'numeric'});
  return date+' : '+fmt(point.accuracy)+' %';
 }).join(' ; '));
}
function barChart(items,now=new Date()){
 const root=$('#v14-p-bars');root.replaceChildren();
 const choice=Number($('#v14-week-range')?.value);
 const weeks=[4,8,12].includes(choice)?choice:8;
 // Group by calendar week (Monday through Sunday), exactly like the
 // weekly-goal KPI. Rolling 7-day buckets would mislabel previous Sunday's
 // sessions as "This week" on Monday and drift across DST boundaries.
 const counts=weeklySessionCounts(items,weeks,now);
 const max=Math.max(1,...counts);
 const svg=svgEl('svg',{viewBox:'0 0 600 235','aria-hidden':'true'});
 const slot=560/weeks,barWidth=weeks===8?42:Math.min(52,slot*.68);
 counts.forEach((count,i)=>{
  const x=weeks===8?24+i*70:24+i*slot+(slot-barWidth)/2;
  const center=x+barWidth/2,h=count/max*153;
  svg.append(svgEl('rect',{x,y:187-h,width:barWidth,height:h,rx:3,
   fill:i===weeks-1?'#8df0e0':'#268494'}));
  const value=svgEl('text',{x:center,y:Math.max(18,187-h-9),
   'text-anchor':'middle','font-size':12,fill:'#f3fcff'});
  value.textContent=count;svg.append(value);
  const week=svgEl('text',{x:center,y:208,'text-anchor':'middle',
   'font-size':11,fill:'#adc7d2'});
  week.textContent=i===weeks-1?tr('Cette sem.','This week'):'S-'+(weeks-1-i);
  svg.append(week);
 });
 root.append(svg);
 readableChartSummary(root,tr('Séances par semaine : ','Sessions per week: ')+counts.map((count,i)=>{
  const label=i===weeks-1?tr('Cette semaine','This week'):'S-'+(weeks-1-i);
  return label+' : '+count+' '+tr('séance(s)','session(s)');
 }).join(' ; '));
}
function distribution(items){
 const root=$('#v14-p-distribution');root.replaceChildren();
 const keys=['flick','tracking','micro','control'];
 const labelPairs=[['Flick','Flick'],['Tracking','Tracking'],['Micro-correction','Micro-adjust'],['Contrôle','Control']];
 const labels=labelPairs.map(([fr,english])=>tr(fr,english));
 const counts=keys.map(k=>items.filter(s=>s.focus===k).length);
 const total=items.length;
 if(!total){
  // The owner's visual references use a radar chart. Draw only a neutral
  // FOUR-axis wireframe for the four actually tracked training focuses.
  // No data polygon, percentage, ranking or additional skill is invented.
  const preview=document.createElement('div');preview.className='v3-empty-radar';
  const svg=svgEl('svg',{viewBox:'0 0 320 215','aria-hidden':'true',focusable:'false'});
  const cx=160,cy=102,r=62;
  const point=(i,factor)=>{
   const angle=-Math.PI/2+i*Math.PI/2;
   return [cx+Math.cos(angle)*r*factor,cy+Math.sin(angle)*r*factor];
  };
  const polygon=factor=>keys.map((_,i)=>point(i,factor).map(n=>n.toFixed(1)).join(',')).join(' ');
  for(const amount of [.25,.5,.75,1])
   svg.append(svgEl('polygon',{points:polygon(amount),fill:'none',stroke:amount===1?'#bc5b6a':'#315665','stroke-width':amount===1?1.5:1}));
  keys.forEach((_,i)=>{
   const [x,y]=point(i,1);
   svg.append(svgEl('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:'#4a6977','stroke-dasharray':'2 5'}));
   const [lx,ly]=point(i,1.35);
   const label=svgEl('text',{x:lx,y:ly+3,'text-anchor':'middle','font-size':10,fill:'#bdcbd9'});
   label.textContent=labels[i];
   label.dataset.r20Fr=labelPairs[i][0];label.dataset.r20En=labelPairs[i][1];
   svg.append(label);
  });
  preview.append(svg);
  const empty=document.createElement('p');empty.className='v14-chart-empty v3-empty-radar-caption';
  empty.dataset.r20Fr='Aucune séance enregistrée : aucun score disponible.';
  empty.dataset.r20En='No recorded sessions: no score available.';
  empty.textContent=tr(empty.dataset.r20Fr,empty.dataset.r20En);
  root.append(preview,empty);return;
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
  const suffix=' '+Math.round(counts[i]/total*100)+'%';
  node.dataset.r20Fr=labelPairs[i][0]+suffix;node.dataset.r20En=labelPairs[i][1]+suffix;
  node.textContent=tr(node.dataset.r20Fr,node.dataset.r20En);svg.append(node);
 });
 chart.append(svg);root.append(chart);
 const description=document.createElement('p');description.className='v14-chart-caption';
 description.dataset.r20Fr='Part des '+total+' séances selon la compétence travaillée.';
 description.dataset.r20En='Share of '+total+' sessions by training focus.';
 description.textContent=tr(description.dataset.r20Fr,description.dataset.r20En);
 root.append(description);
 readableChartSummary(root,tr('Répartition par compétence : ','Training focus distribution: ')+counts.map((count,i)=>
  labels[i]+' : '+count+'/'+total+' ('+Math.round(count/total*100)+' %)').join(' ; '));
}
function render(){
 refreshSourceNotice();
 // A single clock snapshot prevents the KPI, rolling accuracy filter and
 // Monday–Sunday weekly bars from disagreeing exactly at midnight.
 const now=new Date();
 const period=Number($('#v14-progress-range').value)||0;
 const subset=recent(sessions,period,now),stats=computeStats(subset,goal,now),all=computeStats(sessions,goal,now);
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
 // Weekly chart uses its own explicit 4/8/12-week range; every bar reflects recorded sessions.
 lineChart(subset);barChart(sessions,now);distribution(subset);
}
// Cancel any pending verified-account load when another tab signs out or switches
// accounts. An obsolete getUser()/cloud response may not repopulate private KPIs.
function invalidateProgressView(){
 ++loadGeneration;
 sessions=[];goal=3;scope='guest';cloudSyncPending=false;
 render();
}
async function load(){
 const generation=++loadGeneration;
 let key=null,readable=false,syncPending=false;
 let loadedSessions=[],loadedGoal=3;
 let token=null;
 try{
  token=localStorage.getItem(AUTH_KEY);
  if(token){
   const {supabase}=await import('./cloud-client-v7.mjs');
   const {data,error}=await supabase.auth.getSession();
   const uid=data?.session?.user?.id;
   if(!error&&validUid(uid)){
    const verified=await supabase.auth.getUser();
    if(!verified.error&&verified.data?.user?.id===uid){
     key=scopedKey(STORAGE_KEY,uid);readable=true;
     try{await synchronize(supabase,uid)}catch{syncPending=true}
    }
   }
  }
 }catch{readable=false}
 // The browser may have removed or replaced its session during any await.
 // Never commit metrics from an older asynchronous verification.
 let tokenNow;
 try{tokenNow=localStorage.getItem(AUTH_KEY)}catch{tokenNow=null}
 if(generation!==loadGeneration||tokenNow!==token)return;
 if(readable){
  try{
   const raw=JSON.parse(localStorage.getItem(key)||'null');
   const clean=normalizeStore(raw,null);
   loadedSessions=clean.sessions;loadedGoal=clean.weeklyGoal;
  }catch{loadedSessions=[];loadedGoal=3}
 }
 if(generation!==loadGeneration)return;
 sessions=loadedSessions;goal=loadedGoal;scope=readable?'account':'guest';
 cloudSyncPending=syncPending;
 render();
}
$('#v14-progress-range').addEventListener('change',render);
$('#v14-week-range').addEventListener('change',render);
document.querySelectorAll('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(render)));
window.addEventListener('storage',event=>{
 // storage.clear() sends event.key=null; it also invalidates the session.
 if(event.key===null||event.key===AUTH_KEY){
  // Cross-tab sign-out / account switch: hide private numbers synchronously.
  invalidateProgressView();
  if(event.newValue)void load();
 }else if(event.key?.includes(STORAGE_KEY))void load();
});
window.addEventListener('focus',()=>void load());
window.addEventListener('online',()=>void load());
// Keep a visible progress dashboard fresh when sessions arrive from another device.
// With no auth token, do not make periodic cloud requests.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void load()});
setInterval(()=>{if(!document.hidden&&navigator.onLine){
 try{if(localStorage.getItem(AUTH_KEY))void load()}catch{}
}},45000);
void load();