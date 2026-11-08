/* V14 progress: only validated user-recorded sessions, no fabricated analytics. */
import {normalizeStore,computeStats,FOCUS,STORAGE_KEY} from './training-core-v5.mjs';
import {validUid,scopedKey} from './cloud-core-v7.mjs';
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
 for(const key of Object.keys(FOCUS)){
  const amount=items.filter(s=>s.focus===key).length,pct=items.length?Math.round(amount/items.length*100):0;
  const row=document.createElement('div');row.className='v14-distribution-row';
  const title=document.createElement('div');title.className='v14-distribution-head';
  const label=document.createElement('span');label.textContent=key==='micro'?tr('Micro-corrections','Micro-adjustments'):key==='control'?tr('Contrôle','Control'):key==='tracking'?'Tracking':'Flick';
  const value=document.createElement('strong');value.textContent=amount+' · '+pct+'%';
  title.append(label,value);
  const meter=document.createElement('div');meter.className='v14-meter';
  const fill=document.createElement('span');fill.style.width=pct+'%';meter.append(fill);
  row.append(title,meter);root.append(row);
 }
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
 let key=STORAGE_KEY,readable=true;
 try{
  if(localStorage.getItem('sb-lmzswtzboobpokumxzhy-auth-token')){
   readable=false;
   const {supabase}=await import('./cloud-client-v7.mjs');
   const {data,error}=await supabase.auth.getSession();
   const uid=data?.session?.user?.id;
   if(!error&&validUid(uid)){key=scopedKey(STORAGE_KEY,uid);scope='account';readable=true;}
  }
 }catch{readable=false;}
 if(readable){
  try{const raw=JSON.parse(localStorage.getItem(key)||'null');const clean=normalizeStore(raw,null);sessions=clean.sessions;goal=clean.weeklyGoal;}catch{sessions=[];goal=3;}
 }
 source.textContent=readable?
  (scope==='account'?tr('Compte connecté · données locales de ton compte','Signed in · local account data'):tr('Mode invité · données de cet appareil','Guest mode · this device data')):
  tr('Connecte-toi sur Mon compte pour autoriser l’accès aux données privées.','Sign in on My Account to verify access to private data.');
 render();
}
$('#v14-progress-range').addEventListener('change',render);
document.querySelectorAll('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(render)));
window.addEventListener('storage',event=>{if(event.key?.includes(STORAGE_KEY))void load();});
void load();