/* V15 reference-faithful interaction layer. No auth, networking or data mutation. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 const fr=()=>document.documentElement.lang!=='en';
 const tr=(a,b)=>fr()?a:b;
 function nav(){
  const root=$('.site31-nav'),links=root?.querySelector('.site31-links'),ctrl=root?.querySelector('.site31-controls');
  if(!root||!links)return;
  const isCommunity=links.querySelector('a[href="index.html#community"]');
  if(!isCommunity){
   const link=document.createElement('a');
   link.href='index.html#community';link.className='v15-community-nav';
   link.innerHTML='<span class="fr">Communauté</span><span class="en">Community</span>';
   const explore=links.querySelector('.ar5-nav-explore');
   if(explore)explore.before(link);else links.append(link);
  }
  if(ctrl&&!root.querySelector('.v15-header-actions')){
   const actions=document.createElement('div');actions.className='v15-header-actions';
   actions.innerHTML='<a class="v15-cloud-action" href="account.html#dashboard-panel">☁ <span class="fr">Sync Cloud</span><span class="en">Cloud sync</span> <span class="v15-cyan" aria-hidden="true">●</span></a>'+
   '<a href="account.html#auth-panel"><span class="fr">Se connecter</span><span class="en">Sign in</span></a>'+
   '<a href="account.html?mode=signup#auth-panel"><span class="fr">Créer un compte</span><span class="en">Create account</span></a>';
   ctrl.before(actions);
  }
 }
 function days(){
  if(!document.body.classList.contains('site31-training'))return;
  const buttons=$$('[data-v15-day]'),week=$$('[data-v15-weekday]');
  if(!buttons.length)return;
  function focusDay(idx){
   buttons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.v15Day)===idx)));
   week.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.v15Weekday)===idx)));
   const title=$('[data-v14-plan-heading]');
   if(title){const labels=[
    tr('Jour 1 · Précision','Day 1 · Precision'),
    tr('Jour 2 · Tracking','Day 2 · Tracking'),
    tr('Jour 3 · Micro-correction','Day 3 · Micro-adjust'),
    tr('Jour 4 · Contrôle','Day 4 · Control'),
    tr('Jour 5 · Révision','Day 5 · Review')
   ];title.textContent=labels[idx-1]||labels[0];}
  }
  buttons.forEach(b=>b.addEventListener('click',()=>focusDay(Number(b.dataset.v15Day))));
  week.forEach(b=>b.addEventListener('click',()=>{
   const target=buttons.find(x=>x.dataset.v15Day===b.dataset.v15Weekday);
   if(target){target.click();target.scrollIntoView({block:'nearest',behavior:'smooth'});}
  }));
  function syncGoal(){
   const count=$('#goal-status')?.textContent?.trim()||'—';
   const m=$('[data-v15-week-goal]');if(m)m.textContent=count;
   const src=$('#weekly-meter-bar'),bar=$('[data-v15-week-meter]');
   if(bar)bar.style.width=src?.style?.width||'0%';
  }
  window.addEventListener('aim-v5-ready',syncGoal);
  window.addEventListener('aim-store-updated',syncGoal);
  syncGoal();focusDay(1);
 }
 function account(){
  if(!document.body.classList.contains('site31-account'))return;
  const dashboard=$('#dashboard-panel'),state=$('[data-v15-cloud-status]'),detail=$('[data-v15-cloud-details]');
  const selector=$('[data-v15-lang]');
  function render(){
   const logged=dashboard&&!dashboard.hidden;
   document.body.classList.toggle('v15-account-logged',Boolean(logged));
   if(state)state.textContent=logged?($('#cloud-enabled-status')?.textContent||'—'):tr('Connexion nécessaire','Sign-in required');
   if(detail)detail.textContent=logged?
    tr('État de ta sauvegarde personnelle','Your personal backup status'):
    tr('Connecte-toi pour activer ou consulter le Cloud.','Sign in to enable or review cloud backup.');
  }
  if(dashboard){
   new MutationObserver(render).observe(dashboard,{attributes:true,subtree:true,childList:true,characterData:true});
   render();
  }
  if(selector){
   selector.value=document.documentElement.lang==='en'?'en':'fr';
   selector.addEventListener('change',()=>{
    if(selector.value!==document.documentElement.lang)$('[data-switch-lang]')?.click();
   });
   $$('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(()=>{selector.value=document.documentElement.lang==='en'?'en':'fr';render();})));
  }
  if(new URLSearchParams(location.search).get('mode')==='signup'){
   const change=()=>{if(!$('#auth-panel')?.hidden)$('#signup-mode')?.click();};
   if(document.readyState==='complete')setTimeout(change,100);
   else window.addEventListener('load',()=>setTimeout(change,100),{once:true});
  }
 }
 function init(){nav();days();account()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();