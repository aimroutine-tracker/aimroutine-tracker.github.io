/* AimRoutine V20 — owner reference interaction polish. Visuals are backed by real data. */
import {computeStats} from './training-core-v5.mjs';
const $=(q,root=document)=>root.querySelector(q);
const $$=(q,root=document)=>[...root.querySelectorAll(q)];
const isEn=()=>document.documentElement.lang==='en';
const words=(fr,en)=>isEn()?en:fr;
const p=location.pathname.split('/').pop()||'index.html';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dateKey=d=>new Date(d).toLocaleDateString('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit'});
function init(){
 const screen=$('.r17-screen');if(!screen)return;
 document.body.classList.add('r20');
 const art=$('.r17-hero-art',screen);
 if(art)art.setAttribute('aria-hidden','true');
 if(p==='index.html')home(screen);
 if(p==='training.html')routines(screen);
 if(p==='account.html')account(screen);
 if(p==='progress.html')progress(screen);
}
function home(screen){
 const feature=$$('.r17-feature',screen);
 const art=[
  '<svg viewBox="0 0 90 90" width="86" height="86" aria-hidden="true"><circle cx="45" cy="45" r="31" fill="none" stroke="#37e3dd" stroke-opacity=".72"/><path d="M45 0V90M0 45H90" stroke="#ff6076" stroke-width="1.4" stroke-opacity=".9"/><circle cx="45" cy="45" r="3" fill="#ff6076"/></svg>',
  '<svg viewBox="0 0 100 100" width="94" height="92" aria-hidden="true"><path d="m10 40 40-20 40 20-40 20Z" stroke="#37e3dd" fill="none" stroke-width="2"/><path d="m10 54 40-20 40 20-40 20Z" stroke="#ff5b69" fill="none" stroke-width="2"/><path d="m10 68 40-20 40 20-40 20Z" stroke="#37e3dd" fill="none" stroke-width="2"/></svg>',
  '<svg viewBox="0 0 94 76" width="93" height="80" aria-hidden="true"><path d="M10 70V59h12v11m8 0V49h12v21m8 0V37h12v33m8 0V23h12v47" fill="#37e3dd" fill-opacity=".42"/><path d="m6 49 24-11 20-5 29-19m-11 0h11v11" stroke="#37e3dd" stroke-width="3" fill="none"/></svg>'
 ];
 feature.forEach((el,i)=>{const t=$('.r17-feature-art',el);if(t)t.innerHTML=art[i]||''});
 const challenge=$('.r17-challenge h3',screen);if(challenge)challenge.textContent=words('Mini Défi : Précision 1 min','Mini challenge: 1-minute accuracy');
 const target=$('.r17-challenge-target',screen);if(target)target.textContent='◎';
 const chip=$('.r17-challenge .r17-chipbar span:first-child',screen);if(chip)chip.textContent=words('◷ 1 minute','◷ 1 minute');
 const link=$('.r17-challenge .r17-button',screen);
 if(link)link.addEventListener('click',event=>{ // Existing on-page AIM demo is a real interactive minigame.
  const demo=$('#aim-challenge');if(!demo)return;
  event.preventDefault();demo.scrollIntoView({behavior:'smooth',block:'start'});
 });
}
function routines(screen){
 const title=$('.r17-training-grid .r17-train-left .r17-panel-title h2',screen);if(title)title.textContent=words('Mon entraînement','My training');
 const sidebar=$$('.r17-train-left .r17-metric',screen);
 const labels=[words('Durée moyenne','Average session duration'),words('Séances terminées','Completed sessions'),words('Précision moyenne','Average accuracy'),words('Jours consécutifs','Current streak'),words('Objectif hebdo','Weekly goal')];
 sidebar.forEach((el,i)=>{const span=$('span',el);if(span)span.textContent=labels[i]});
 const stats=()=>window.AIMWeb?.getStore?.();
 const update=()=>{
  const store=stats();if(!store)return;
  const sessions=Array.isArray(store.sessions)?store.sessions:[];
  const s=computeStats(sessions,store.weeklyGoal||3);
  const avgDuration=s.count?(s.minutes/s.count):null;
  const dur=$('[data-r17-minutes]',screen);if(dur)dur.textContent=avgDuration===null?'—':Math.round(avgDuration)+' min';
  const list=$$('.r17-weekday',screen);
  const today=new Date();
  const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const dayIndex=start.getDay();
  start.setDate(start.getDate()-((dayIndex+6)%7));
  let done=0;
  for(const [i,el] of list.entries()){
   const day=new Date(start);day.setDate(start.getDate()+i);
   const key=dateKey(day);
   const has=sessions.some(x=>dateKey(x.date)===key);
   el.classList.toggle('r20-complete',has);
   if(has)done++;
   el.setAttribute('title',has?words('Séance enregistrée','Recorded session'):words('Aucune séance enregistrée','No recorded session'));
  }
  const weekly=$('[data-r17-week]',screen);if(weekly)weekly.textContent=done+' / 5';
  const bar=$('[data-r17-week-meter]',screen);if(bar)bar.style.width=(done/5*100)+'%';
  renderGraph(sessions,screen);
 };
 const chartHost=$('[data-r17-chart]',screen);
 if(chartHost){
  const root=chartHost.parentElement;
  const tabs=document.createElement('div');
  tabs.className='ar20-tabbar';tabs.setAttribute('role','group');tabs.setAttribute('aria-label',words('Mesure affichée','Displayed metric'));
  const options=[['accuracy','Précision','Accuracy'],['tracking','Tracking','Tracking'],['reaction','Réaction','Reaction'],['consistency','Régularité','Consistency']];
  tabs.innerHTML=options.map(([key,fr,en],i)=>'<button type="button" data-ar20-chart="'+key+'" aria-pressed="'+(i===0)+'"><span class="fr">'+fr+'</span><span class="en">'+en+'</span></button>').join('');
  root.insertBefore(tabs,chartHost);
  tabs.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
   $$('button',tabs).forEach(x=>x.setAttribute('aria-pressed',String(x===button)));
   renderGraph(stats()?.sessions||[],screen);
  });
 }
 function renderGraph(sessions,screen){
  if(!chartHost)return;
  const type=$('[data-ar20-chart][aria-pressed=true]',screen)?.dataset.ar20Chart||'accuracy';
  const sevenDays=sessions.filter(x=>Date.now()-Date.parse(x.date)<7*86400000&&Date.now()-Date.parse(x.date)>=0);
  const scores=sevenDays.filter(x=>Number.isFinite(x.accuracy)).sort((a,b)=>a.date.localeCompare(b.date));
  if(type==='reaction'){
   chartHost.innerHTML='<div class="ar20-empty">'+words('Temps de réaction non mesuré par les séances actuelles.','Reaction time is not measured by current sessions.')+'</div>';
   return;
  }
  if(type==='consistency'){
   const counts=Array(7).fill(0);for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-6+i);counts[i]=sevenDays.filter(s=>dateKey(s.date)===dateKey(d)).length}
   chartHost.innerHTML=bars(counts);
   return;
  }
  const relevant=type==='tracking'?scores.filter(x=>x.focus==='tracking'):scores;
  if(!relevant.length){chartHost.innerHTML='<div class="ar20-empty">'+words('Enregistre des résultats pour afficher ta courbe.','Record sessions to display your trend.')+'</div>';return}
  const pts=relevant.slice(-16);
  const width=330,height=150,x=i=>22+(pts.length===1?145:(i/(pts.length-1))*284),y=v=>135-(v/100)*113;
  const points=pts.map((v,i)=>x(i)+','+y(v.accuracy)).join(' ');
  const fill=pts.map((v,i)=>(i?'L':'M')+x(i)+' '+y(v.accuracy)).join(' ')+'L'+x(pts.length-1)+' 135 L'+x(0)+' 135Z';
  const gr=['25','50','75','100'].map(t=>'<line x1="20" y1="'+y(+t)+'" x2="313" y2="'+y(+t)+'" stroke="#4e7180" stroke-opacity=".35"/>').join('');
  chartHost.innerHTML='<svg class="ar20-graph" viewBox="0 0 330 150" aria-label="'+words('Précision des séances enregistrées','Recorded session accuracy')+'" role="img"><defs><linearGradient id="ar20-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ff5b69" stop-opacity=".42"/><stop offset="1" stop-color="#ff5b69" stop-opacity="0"/></linearGradient></defs>'+gr+'<path d="'+fill+'" fill="url(#ar20-fill)"/><polyline points="'+points+'" fill="none" stroke="#ff6475" stroke-width="2.5"/>'+pts.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v.accuracy)+'" r="3.2" fill="#ff6778" stroke="#ffbdc7" stroke-width="1"/>').join('')+'</svg>';
 }
 function bars(counts){
  const max=Math.max(1,...counts);
  return '<svg class="ar20-graph" viewBox="0 0 330 150" role="img" aria-label="'+words('Séances des sept derniers jours','Sessions over last seven days')+'">'+counts.map((n,i)=>{const h=n/max*100;return '<rect x="'+(28+i*42)+'" y="'+(130-h)+'" width="25" height="'+h+'" rx="3" fill="'+(n?'#37e3dd':'#315064')+'"/><text x="'+(40+i*42)+'" y="145" font-size="10" fill="#b0cbdb" text-anchor="middle">'+(i+1)+'</text>'}).join('')+'</svg>';
 }
 const output=$('.r17-chart-caption strong',screen);
 if(output){const f=()=>{const ss=stats();if(!ss)return;const vals=ss.sessions.filter(s=>Number.isFinite(s.accuracy));output.textContent=vals.length?(vals.reduce((n,x)=>n+x.accuracy,0)/vals.length).toFixed(1)+' %':'—'};f();window.addEventListener('aim-store-updated',f)}
 window.addEventListener('aim-v5-ready',update);
 window.addEventListener('aim-store-updated',update);
 window.addEventListener('aim-cloud-data-changed',update);
 window.addEventListener('aim-sync-applied',update);
 update();
}
function account(screen){
 const benefit=$('.r17-account-benefits',screen);
 if(benefit){
  const items=$$('span',benefit);items.forEach((it,i)=>{if(i===0)it.textContent='☁ '+words('Progression partagée · sur tes appareils','Shared progress across devices');if(i===1)it.textContent='▱ '+words('Paramètres unifiés','Unified preferences');if(i===2)it.textContent='⬡ '+words('Données protégées','Protected data')});
 }
 const note=$('.r17-cloud-status',screen);if(note){
  const p=$('[data-r17-sync-copy]',note);if(p)p.textContent=words('Avec un compte, tes données se synchronisent automatiquement.','With an account, your data syncs automatically.');
 }
 const devices=$('.r17-cloud-devices',screen);
 if(devices){const p=$('p',devices);if(p)p.textContent=words('La liste des appareils n’est pas disponible dans ton compte : aucun appareil fictif n’est affiché.','Device history is unavailable: no fictional devices are displayed.')}
 const dashboard=$('#dashboard-panel');
 if(dashboard){
  const show=()=>{
   const active=!dashboard.hidden;
   const username=$('[data-r17-username]',screen);
   if(username && !active) username.textContent=words('Connecte-toi à ton profil','Sign in to your profile');
   const sync=$('[data-r17-sync-copy]',screen);
   if(sync)sync.textContent=active?words('Synchronisation automatique active pour ton compte.','Automatic synchronization active for your account.'):words('Connecte-toi pour synchroniser automatiquement tes données.','Sign in to synchronize your data automatically.');
   const label=$('[data-r17-cloud-label]',screen);
   if(label)label.textContent=active?words('Sync Cloud · Automatique','Cloud sync · Automatic'):words('Cloud non connecté','Cloud not signed in');
  };
  new MutationObserver(show).observe(dashboard,{attributes:true,attributeFilter:['hidden']});show();
 }
}
function progress(screen){
 const source=$('#v14-source-status');
 const panel=$('#v14-p-skills-panel');
 if(panel){
  const title=$('.v14-panel-head h2',panel);if(title)title.textContent=words('Résumé de tes entraînements','Your training summary');
  const caption=$('.v14-panel-head small',panel);if(caption)caption.textContent=words('Répartition des séances par compétence (données réelles)','Real distribution of sessions by skill');
 }
 const btn=$('.v14-progress-toolbar',screen);
 if(btn){const label=document.createElement('span');label.className='ar20-progress-period';label.textContent=words('Mes résultats personnels','My real personal results');btn.append(label)}
 const foot=$('.v14-data-footnote',screen);
 if(foot)foot.textContent=words('Toutes les mesures proviennent de séances enregistrées sur ton compte. La précision moyenne de scénarios différents ne constitue pas un classement VALORANT. Les temps de réaction ne sont pas mesurés par le suivi actuel.','Figures use real recorded account sessions. Accuracy across different scenarios is not a VALORANT rank; reaction time is not measured yet.');
 const notice=document.createElement('section');notice.className='ar20-progress-advanced';
 notice.innerHTML='<div><strong>'+words('Prochaine étape — un résultat comparable','Next step — a comparable result')+'</strong><div class="ar20-profile-note">'+words('Rejoue le même scénario et enregistre sa précision pour suivre ta tendance.','Repeat the same scenario and log accuracy to track your trend.')+'</div></div><a href="training.html#panel-builder">'+words('▶ Lancer une routine ciblée','▶ Start a focused routine')+'</a>';
 const secondary=$('.r17-secondary-grid',screen);if(secondary)secondary.after(notice);
 const oldCharts=$$('#v14-p-line-panel svg,#v14-p-bars-panel svg');
 oldCharts.forEach(svg=>{svg.style.filter='drop-shadow(0 0 3px rgba(55,227,221,.25))'});
 if(source){new MutationObserver(()=>{const guest=source.textContent.includes('Connecte-toi')||source.textContent.includes('Sign in');screen.classList.toggle('ar20-guest',guest)}).observe(source,{childList:true,subtree:true})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
