/* AimRoutine V14 UI layer: real buttons, local training metrics, shared navigation.
   Preserves the preexisting account forms, local training and data boundaries. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
 const french=()=>document.documentElement.lang!=='en';
 const tr=(fr,en)=>french()?fr:en;
 function initNav(){
  const nav=$('.site31-header .site31-links');
  if(!nav)return;
  const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const trainLink=nav.querySelector('a[href="training.html"]');
  if(trainLink){
   trainLink.innerHTML='<span class="fr">Routines</span><span class="en">Routines</span>';
   if(current==='training.html')trainLink.setAttribute('aria-current','page');
  }
  const prodLink=nav.querySelector('a[href="product.html"]');
  if(prodLink)prodLink.classList.add('v14-nav-secondary');
  const releases=nav.querySelector('a[href="releases.html"]');
  if(releases)releases.classList.add('v14-nav-secondary');
  if(!nav.querySelector('[data-v14-nav="challenge"]')){
   const link=document.createElement('a');
   link.href='index.html#aim-challenge';link.dataset.v14Nav='challenge';
   link.className='v14-nav-link';
   link.innerHTML='<span class="fr">Défis AIM</span><span class="en">AIM challenges</span>';
   if(releases)releases.before(link);else nav.append(link);
  }
  if(!nav.querySelector('a[href="progress.html"]')){
   const link=document.createElement('a');
   link.href='progress.html';link.dataset.v14Nav='progress';link.className='v14-nav-link';
   link.innerHTML='<span class="fr">Suivi de progression</span><span class="en">Progress tracking</span>';
   if(current==='progress.html')link.setAttribute('aria-current','page');
   if(releases)releases.before(link);else nav.append(link);
  }
  const mob=$('.site31-mobile-links');
  if(mob&&!mob.querySelector('a[href="progress.html"]')){
   const link=document.createElement('a');link.href='progress.html';
   link.innerHTML='<span class="fr">Suivi de progression</span><span class="en">Progress tracking</span>';
   mob.append(link);
  }
  if(mob&&!mob.querySelector('a[href="index.html#aim-challenge"]')){
   const link=document.createElement('a');link.href='index.html#aim-challenge';
   link.innerHTML='<span class="fr">Défis AIM</span><span class="en">AIM challenges</span>';
   mob.append(link);
  }
  for(const link of nav.querySelectorAll('a[aria-current="page"]')){
   if(link.getAttribute('href')!==(current||'index.html'))link.removeAttribute('aria-current');
  }
 }
 function go(tab){
  if(window.AIMWeb?.openTab)window.AIMWeb.openTab(tab);
  else document.getElementById('tab-'+tab)?.click();
  const node=$('.ar5-tab-wrap');
  if(node)node.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 }
 function training(){
  if(!document.body.classList.contains('site31-training'))return;
  const modes=$$('[data-v14-level]');
  const focuses=$$('[data-v14-focus]');
  let rank='silver',focus='flick';
  const durationFor={iron:'15',silver:'25',immortal:'35'};
  function renderChoice(){
   modes.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v14Level===rank)));
   focuses.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v14Focus===focus)));
   const titles={
    flick:[tr('Flick & premier tir','Flick & first shot'),tr('Maîtrise le placement de ton viseur.','Practice crosshair placement.')],
    tracking:[tr('Tracking fluide','Smooth tracking'),tr('Travaille la stabilité sur une cible mobile.','Practice smooth tracking on moving targets.')],
    micro:[tr('Micro-corrections','Micro-adjustments'),tr('Affûte tes ajustements fins.','Improve small precise adjustments.')],
    control:[tr('Contrôle & précision','Control & accuracy'),tr('Réplique les mêmes conditions à chaque séance.','Use consistent conditions each session.')]
   };
   const title=$('[data-v14-plan-heading]'),description=$('[data-v14-plan-description]');
   const name=$('[data-v14-exercise-name]'),detail=$('[data-v14-exercise-desc]');
   if(title)title.textContent=titles[focus][0];
   if(description)description.textContent=titles[focus][1];
   if(name)name.textContent=focus==='micro'?tr('Micro-correction','Micro-adjustment'):focus==='control'?tr('Contrôle du viseur','Crosshair control'):focus==='tracking'?'Tracking':'Flick';
   if(detail)detail.textContent=titles[focus][1];
   const duration=durationFor[rank]||'25';
   const durationNode=$('[data-v14-plan-duration]'),durationSmall=$('[data-v14-plan-duration-small]');
   if(durationNode)durationNode.textContent=duration+' min';
   if(durationSmall)durationSmall.textContent=duration;
  }
  modes.forEach(b=>b.addEventListener('click',()=>{rank=b.dataset.v14Level;renderChoice()}));
  focuses.forEach(b=>b.addEventListener('click',()=>{focus=b.dataset.v14Focus;renderChoice()}));
  $$('[data-v14-open]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.v14Open)));
  $$('[data-v14-generate]').forEach(b=>b.addEventListener('click',()=>{
   const select=$('#rank'),f=$('#focus'),d=$('#duration');
   if(!window.AIMWeb||!select||!f||!d)return;
   select.value=rank;f.value=focus;d.value=durationFor[rank]||'25';
   go('builder');
   $('#builder-form button[type="submit"]')?.click();
  }));
  const params=new URLSearchParams(location.search);
  const chosen=params.get('level');
  if(['iron','silver','immortal'].includes(chosen))rank=chosen;
  renderChoice();
  function reflectMetrics(){
   const store=window.AIMWeb?.getStore?.();if(!store)return;
   const records=Array.isArray(store.sessions)?store.sessions:[];
   const counts=records.length;
   const minutes=records.reduce((sum,s)=>sum+(Number(s.minutes)||0),0);
   const scores=records.filter(s=>Number.isFinite(s.accuracy)).map(s=>s.accuracy);
   const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null;
   const now=Date.now();
   const week=records.filter(s=>{const age=now-Date.parse(s.date);return age>=0&&age<=7*86400000}).length;
   const goal=Number(store.weeklyGoal)||3;
   const stats={
    '[data-v14-tcount]':String(counts),
    '[data-v14-tminutes]':minutes.toLocaleString(french()?'fr-FR':'en-GB')+' min',
    '[data-v14-taccuracy]':avg===null?'—':avg.toFixed(1)+' %',
    '[data-v14-tstreak]':$('#streak-days')?.textContent||'0',
    '[data-v14-tgoal]':week+' / '+goal,
   };
   for(const [selector,value]of Object.entries(stats)){const node=$(selector);if(node)node.textContent=value;}
   const meter=$('[data-v14-tmeter]');if(meter)meter.style.width=Math.min(100,Math.round(week/goal*100))+'%';
   const out=$('[data-v14-tchart]'),score=$('[data-v14-tchart-value]');
   if(score)score.textContent=avg===null?'—':avg.toFixed(1)+' %';
   if(out){
    const recent=records.filter(s=>Number.isFinite(s.accuracy)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
    if(!recent.length){out.textContent=tr('Enregistre une séance pour voir ta courbe.','Record a session to see your chart.');out.classList.add('v14-chart-empty');}
    else{
     out.classList.remove('v14-chart-empty');out.replaceChildren();
     const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
     svg.setAttribute('viewBox','0 0 320 145');svg.setAttribute('aria-hidden','true');
     const vals=recent.map((s,i)=>({x:15+(recent.length===1?.5:i/(recent.length-1))*290,y:130-(s.accuracy/100)*115}));
     const make=(type,attrs)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',type);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));return node;};
     for(const y of [20,50,80,110])svg.append(make('line',{x1:10,y1:y,x2:308,y2:y,stroke:'#45606e','stroke-dasharray':'3 6'}));
     svg.append(make('path',{d:vals.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' '),fill:'none',stroke:'#ff8398','stroke-width':3}));
     vals.forEach(p=>svg.append(make('circle',{cx:p.x,cy:p.y,r:4,fill:'#ff8398',stroke:'#ffe2e9'})));
     out.append(svg);
    }
   }
  }
  window.addEventListener('aim-v5-ready',()=>{reflectMetrics();const h=location.hash;if(h.startsWith('#panel-'))go(h.slice(7));});
  window.addEventListener('aim-store-updated',reflectMetrics);
  window.addEventListener('aim-cloud-data-changed',reflectMetrics);
  $$('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(()=>{renderChoice();reflectMetrics()})));
  if(window.AIMWeb){reflectMetrics();if(location.hash.startsWith('#panel-'))go(location.hash.slice(7));}
  window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#panel-'))go(location.hash.slice(7));});
 }
 function account(){
  if(!document.body.classList.contains('site31-account'))return;
  const profile=$('[data-v14-account-profile]'),welcome=$('[data-v14-account-welcome]');
  const dashboard=$('#dashboard-panel');
  if(!profile||!dashboard)return;
  const copy=(source,target)=>{
   const value=$(source)?.textContent?.trim()||'—';
   const node=$(target);if(node)node.textContent=value;
  };
  function render(){
   const logged=!dashboard.hidden;
   profile.hidden=!logged;
   if(welcome)welcome.hidden=logged;
   if(!logged)return;
   copy('#user-username','[data-v14-profile-name]');
   copy('#user-email','[data-v14-profile-email]');
   copy('#cloud-sessions-count','[data-v14-profile-sessions]');
   copy('#cloud-routines-count','[data-v14-profile-routines]');
   copy('#cloud-enabled-status','[data-v14-profile-sync]');
  }
  const watch=new MutationObserver(render);
  watch.observe(dashboard,{attributes:true,attributeFilter:['hidden'],subtree:true,characterData:true,childList:true});
  render();
  $$('[data-v14-account-action]').forEach(button=>button.addEventListener('click',()=>{
   if(button.dataset.v14AccountAction==='signup')$('#signup-mode')?.click();
   const node=button.dataset.v14AccountAction==='cloud'?'#dashboard-panel':'#auth-panel';
   $(node)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }));
 }
 function ready(){initNav();training();account();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();