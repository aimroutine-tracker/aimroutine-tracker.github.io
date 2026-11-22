/* AimRoutine V17 — four separately authored screens using the existing real engines.
   No Supabase queries, secrets, fictitious user metrics or shadow storage. */
(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const language=()=>document.documentElement.lang==='en'?'en':'fr';
const phrase=(fr,en)=>language()==='en'?en:fr;
const route=location.pathname.split('/').pop()||'index.html';
const levels={iron:['Débutant','Beginner',15],silver:['Intermédiaire','Intermediate',25],immortal:['Compétitif','Competitive',35]};
const days=[
 {focus:'flick',title:['Précision du premier tir','First-shot accuracy'],description:['Arrête-toi, place ton viseur et soigne le premier tir.','Stop, place your crosshair and make the first shot count.']},
 {focus:'tracking',title:['Tracking fluide','Smooth tracking'],description:['Suis une cible en mouvement et garde le viseur stable quand elle change de direction.','Follow a moving target and keep your crosshair steady as it changes direction.']},
 {focus:'micro',title:['Micro-corrections','Micro-adjustments'],description:['Rectifie les petits écarts du viseur avant de tirer.','Make small crosshair adjustments before firing.']},
 {focus:'control',title:['Contrôle du viseur','Crosshair control'],description:['Stabilise ton viseur entre les déplacements et soigne le rythme de tes tirs.','Steady your crosshair between movements and control your firing rhythm.']},
 {focus:'flick',title:['Routine complète','Full routine'],description:['Enchaîne premier tir, tracking et micro-corrections dans la même séance.','Combine first-shot accuracy, tracking and micro-adjustments in one session.']}
];
function routinePage(){
 if(!$('.r17-training-wrap'))return;
 let level=new URLSearchParams(location.search).get('level');if(!Object.hasOwn(levels,level))level='silver';let day=0;
 function update(){
  $$('[data-r17-level]').forEach(el=>{const x=el.dataset.r17Level===level;el.classList.toggle('is-active',x);el.setAttribute('aria-pressed',String(x))});
  $$('[data-r17-day]').forEach(el=>{const x=Number(el.dataset.r17Day)===day;el.classList.toggle('is-active',x);el.setAttribute('aria-pressed',String(x))});
  const [fr,en,minutes]=levels[level],d=days[day];
  $('[data-r17-level-name]').textContent=phrase(fr.toUpperCase(),en.toUpperCase());
  $('[data-r17-plan-title]').textContent=phrase('Plan d’entraînement — '+fr,'Training plan — '+en);
  $('[data-r17-duration]').textContent='~'+minutes+' min / '+phrase('jour','day');
  $('[data-r17-day-title]').textContent=phrase('Jour '+(day+1),'Day '+(day+1));
  const focus=$('[data-r17-focus]');
  focus.textContent=phrase(...d.title);
  focus.dataset.r17FocusKey=d.focus;
  $('[data-r17-day-description]').textContent=phrase(...d.description);
  $('[data-r17-min]').textContent=minutes;
 }
 $$('[data-r17-level]').forEach(el=>el.addEventListener('click',()=>{level=el.dataset.r17Level;update()}));
 $$('[data-r17-day]').forEach(el=>el.addEventListener('click',()=>{day=Number(el.dataset.r17Day);update()}));
 new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 function stats(){const store=window.AIMWeb?.getStore?.();if(!store)return;const sessions=Array.isArray(store.sessions)?store.sessions:[];const scores=sessions.filter(s=>Number.isFinite(s.accuracy));const minutes=sessions.reduce((sum,s)=>sum+(Number(s.minutes)||0),0);const avg=scores.length?scores.reduce((sum,s)=>sum+s.accuracy,0)/scores.length:null;const week=sessions.filter(s=>{const age=Date.now()-Date.parse(s.date);return age>=0&&age<=7*86400000}).length,goal=store.weeklyGoal||3;const values={minutes:minutes+' min',count:String(sessions.length),accuracy:avg===null?'—':avg.toFixed(1)+' %',streak:$('#streak-days')?.textContent||'0',goal:week+' / '+goal,week:week+' / '+goal,avg:avg===null?'—':avg.toFixed(1)+' %'};for(const [key,v] of Object.entries(values))if($('[data-r17-'+key+']'))$('[data-r17-'+key+']').textContent=v;for(const el of $$('[data-r17-meter],[data-r17-week-meter]'))el.style.width=Math.min(100,week/goal*100)+'%';const chart=$('[data-r17-chart]');if(chart&&scores.length){const items=scores.sort((a,b)=>a.date.localeCompare(b.date)).slice(-8),points=items.map((s,i)=>`${10+(items.length===1?.5:i/(items.length-1))*280},${125-s.accuracy}`).join(' ');chart.innerHTML=`<svg viewBox="0 0 300 145" role="img" aria-label="Précision déclarée"><path d="M10 125 H290" stroke="#496273"/><polyline points="${points}" stroke="#37e3dd" stroke-width="3" fill="none"/></svg>`}}
 window.addEventListener('aim-v5-ready',stats);window.addEventListener('aim-store-updated',stats);window.addEventListener('aim-cloud-data-changed',stats);update();stats();
}
function accountPage(){
 if(!$('.r17-account-wrap'))return;
 const dashboard=$('#dashboard-panel');function state(){const logged=dashboard&&!dashboard.hidden;const props={username:logged?($('#user-username')?.textContent?.trim()||phrase('Mon profil','My profile')):phrase('Ton compte AIM','Your AIM account'),email:logged?($('#user-email')?.textContent?.trim()||'—'):phrase('Connecte-toi pour afficher tes données','Sign in to view your data'),'account-sessions':logged?($('#cloud-sessions-count')?.textContent?.trim()||'—'):'—','account-routines':logged?($('#cloud-routines-count')?.textContent?.trim()||'—'):'—','cloud-label':logged?($('#cloud-enabled-status')?.textContent?.trim()||phrase('Compte connecté','Signed in')):phrase('Cloud non connecté','Cloud not signed in'),'sync-head':logged?($('#cloud-enabled-status')?.textContent?.trim()||phrase('Connecté','Connected')):phrase('Connexion nécessaire','Sign-in required'),'sync-copy':logged?phrase('Gère la sauvegarde dans tes paramètres.','Manage backup in account settings.'):phrase('Connecte-toi pour activer la sauvegarde.','Sign in to enable backup.')};for(const [k,v]of Object.entries(props))if($('[data-r17-'+k+']'))$('[data-r17-'+k+']').textContent=v;document.body.classList.toggle('r17-authenticated',Boolean(logged))}if(dashboard){new MutationObserver(state).observe(dashboard,{attributes:true,childList:true,subtree:true,characterData:true});state()}
 const select=$('[data-r17-language]');if(select){select.value=language();select.addEventListener('change',()=>{if(select.value!==language())$('[data-switch-lang]')?.click()});$('[data-switch-lang]')?.addEventListener('click',()=>queueMicrotask(()=>select.value=language()))}
}
function init(){
 if(route==='training.html')routinePage();
 if(route==='account.html')accountPage();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();