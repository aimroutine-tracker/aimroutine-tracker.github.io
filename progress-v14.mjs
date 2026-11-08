/* V14 progress: only validated user-recorded sessions, no fabricated analytics. */
import {normalizeStore,computeStats,FOCUS,STORAGE_KEY} from './training-core-v5.mjs';
import {validUid,scopedKey} from './cloud-core-v7.mjs';
import {synchronize} from './cloud-sync-v7.mjs';
const $=s=>document.querySelector(s);
const en=()=>document.documentElement.lang==='en';
const tr=(fr,english)=>en()?english:fr;
const fmt=n=>Number(n).toLocaleString(en()?'en-GB':'fr-FR',{maximumFractionDigits:1});
const source=document.getElementById('v14-source-status');
let sessions=[],goal=3,scope='guest';
const recent=(items,days)=>!days?items.slice():items.filter(x=>{const age=Date.now()-Date.parse(x.date);return age>=0&&age<=days*86400000;});
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
}
function barChart(items){
 const root=$('#v14-p-bars');root.replaceChildren();
 const counts=Array(8).fill(0),span=7*86400000;
 for(const s of items){const ago=Date.now()-Date.parse(s.date);if(ago>=0&&ago<8*span)counts[7-Math.floor(ago/span)]++;}
 const max=Math.max(1,...counts);
 const svg=svgEl('svg',{viewBox:'0 0 600 235','aria-hidden':'true'});
 counts.forEach((count,i)=>{
  const x=24+i*70,h=count/max*153;
  svg.append(svgEl('rect',{x,y:187-h,width:42,height:h,rx:3,fill:i===7?'#8df0e0':'#268494'}));
  const value=svgEl('text',{x:x+21,y:Math.max(18,187-h-9),'text-anchor':'middle','font-size':12,fill:'#f3fcff'});value.textContent=count;svg.append(value);
  const week=svgEl('text',{x:x+21,y:208,'text-anchor':'middle','font-size':11,fill:'#adc7d2'});week.textContent=i===7?tr('Cette sem.','This week'):'S-'+(7-i);svg.append(week);
 });
 root.append(svg);
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
 const subset=recent(sessions,period),stats=computeStats(subset,goal),all=computeStats(sessions,goal);
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
 lineChart(subset);barChart(subset);distribution(subset);
}
async function load(){
 let key=null,readable=false,syncPending=false;scope='guest';sessions=[];goal=3;
 try{
  if(localStorage.getItem('sb-lmzswtzboobpokumxzhy-auth-token')){
   const {supabase}=await import('./cloud-client-v7.mjs');
   const {data,error}=await supabase.auth.getSession();
   const uid=data?.session?.user?.id;
   if(!error&&validUid(uid)){
    const verified=await supabase.auth.getUser();
    if(!verified.error&&verified.data?.user?.id===uid){
     key=scopedKey(STORAGE_KEY,uid);scope='account';readable=true;
     try{await synchronize(supabase,uid)}catch{syncPending=true}
    }
   }
  }
 }catch{readable=false;}
 if(readable){
  try{const raw=JSON.parse(localStorage.getItem(key)||'null');const clean=normalizeStore(raw,null);sessions=clean.sessions;goal=clean.weeklyGoal;}catch{sessions=[];goal=3;}
 }
 source.textContent=readable?
  (syncPending?tr('Compte connecté · Synchronisation cloud en attente ; affichage du cache de ton compte','Signed in · Cloud sync pending; showing account cache'):tr('Compte connecté · Statistiques automatiquement synchronisées','Signed in · Statistics automatically synchronized')):
  tr('Connecte-toi pour consulter tes statistiques. Rien n’est sauvegardé sans compte.','Sign in to see your statistics. Nothing is saved without an account.');
 render();
}
$('#v14-progress-range').addEventListener('change',render);
document.querySelectorAll('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(render)));
window.addEventListener('storage',event=>{if(event.key?.includes(STORAGE_KEY))void load();});
window.addEventListener('focus',()=>void load());
window.addEventListener('online',()=>void load());
void load();