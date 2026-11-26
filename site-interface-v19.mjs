/* AimRoutine V19 — reference screens backed by the real AIM engines.
   UI only: no shadow persistence, fake player metrics or auth modifications. */
import {createRoutine, CATALOG, TOOLS, computeStats} from './training-core-v5.mjs';

const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const en=()=>document.documentElement.lang==='en';
const tr=(fr,english)=>en()?english:fr;
const tag=(fr,english)=>'<span class="fr">'+fr+'</span><span class="en">'+english+'</span>';
const route=location.pathname.split('/').pop()||'index.html';

function installWorkspace(){
 const screen=$('.r17-training-wrap');
 if(!screen||!$('#panel-program')||!$('#panel-builder'))return;
 screen.classList.add('r19-reference-workspace');

 const picker=document.createElement('label');
 picker.className='r19-tool-picker';
 picker.innerHTML='<span>'+tag('Outil d’entraînement','Training tool')+'</span>';
 const select=document.createElement('select');
 select.className='r19-tool-select';
 for(const name of TOOLS)select.add(new Option(name,name));
 picker.append(select);
 $('.r17-training-plan .r17-panel-title',screen).append(picker);

 const prepare=$('[data-r17-create]',screen);
 const pause=$('#break-length');
 const rows=$$('.r17-exercise',screen);
 let currentPlan;
 function renderPlan(){
  const level=$('.r17-level.is-active',screen)?.dataset.r17Level||'silver';
  const day=$('.r17-day.is-active',screen)?.dataset.r17Day||'0';
  const minutes=Number($('[data-r17-min]',screen).textContent);
  const focus=$('[data-r17-focus]',screen).dataset.r17FocusKey||'flick';
  const tool=select.value;
  currentPlan=createRoutine(level,focus,tool,minutes,Number(pause.value));
  if(day==='4'){
   for(const [offset,skill] of ['tracking','micro'].entries()){
    const exercise=currentPlan.exercises[offset+1];
    const specialist=CATALOG.find(item=>item.tool===tool&&item.focus===skill);
    if(specialist)Object.assign(exercise,{name:specialist.name,tip:specialist.tip});
   }
  }
  for(const [index,row] of rows.entries()){
   const exercise=currentPlan.exercises[index];
   $('strong',row).textContent=exercise.name;
   $('div small',row).textContent=exercise.tip;
   $('.r17-exercise-duration',row).textContent=exercise.minutes+' min';
  }
 }
 select.addEventListener('change',renderPlan);
 pause.addEventListener('change',renderPlan);
 $$('[data-r17-level],[data-r17-day]',screen).forEach(button=>button.addEventListener('click',renderPlan));
 prepare.addEventListener('click',()=>{
  renderPlan();
  if(window.AIMWeb?.setPlan(currentPlan,{scroll:false})){
   window.dispatchEvent(new Event('aim-open-session-editor'));
  }
 });
 const enablePrepare=()=>{prepare.disabled=false;};
 if(window.AIMWeb)enablePrepare();
 else window.addEventListener('aim-v5-ready',enablePrepare,{once:true});
 renderPlan();

 // Native training tabs remain the only controllers. The reference UI
 // simply opens their actual panels inside a modal with consistent styling.
 const toolbar=document.createElement('section');
 toolbar.className='r19-workspace-toolbar r17-panel';
 toolbar.innerHTML='<div class="r19-tools-heading"><div><span class="r17-section-label">/// TRAINING COMMAND CENTER</span><h2>'+tag('Tous tes outils AIM','Your complete AIM toolkit')+'</h2><p>'+tag('Tes vrais programmes, ton minuteur, tes données et tes sauvegardes.','Actual programs, timer, statistics and backups.')+'</p></div><span class="r19-tools-brand" aria-hidden="true">⌖</span></div>'+
 '<div class="r19-tool-grid">'+[
  ['builder','⌖','Mes routines','My routines'],['program','▱','Programmes','Programs'],
  ['dashboard','◷','Objectifs','Goals'],['insights','▥','Statistiques','Statistics'],
  ['challenges','♛','Défis','Challenges'],['coach','◇','Coach AIM','AIM coach'],
  ['profile','◉','Mon profil','My profile'],['data','☁','Sauvegardes','Backups']
 ].map(([key,icon,fr,english])=>'<button type="button" class="r19-tool-btn" data-r19-panel="'+key+'"><span aria-hidden="true">'+icon+'</span>'+tag(fr,english)+'<b aria-hidden="true">↗</b></button>').join('')+'</div>';
 const week=$('.r17-weekline',screen);
 if(week)week.before(toolbar);else screen.append(toolbar);

 const dialog=document.createElement('dialog');
 dialog.className='r19-workspace-dialog';
 dialog.setAttribute('aria-label',tr('Outils AimRoutine','AimRoutine tools'));
 dialog.innerHTML='<div class="r19-dialog-shell"><header class="r19-dialog-header"><div><small>/// AIMROUTINE TRACKER · LIVE DATA</small><h2 data-r19-title>'+tag('Mon espace AIM','My AIM workspace')+'</h2><p>'+tag('Tous les réglages sont connectés à ton véritable espace joueur.','These controls connect to your actual player workspace.')+'</p></div><button type="button" class="r19-close" aria-label="'+tr('Fermer','Close')+'">✕</button></header><div class="r19-dialog-host"></div></div>';
 document.body.append(dialog);
 const host=$('.r19-dialog-host',dialog);
 let activePanel=null,placeholder=null;
 const names={
  dashboard:['Mes objectifs','My goals'],program:['Mes programmes','My programs'],
  insights:['Mes statistiques','My statistics'],challenges:['Mes défis','My challenges'],
  coach:['Mon coach AIM','My AIM coach'],profile:['Mon profil joueur','My player profile'],
  data:['Mes sauvegardes','My backups']
 };
 function restore(){
  if(activePanel&&placeholder?.parentNode)placeholder.after(activePanel);
  placeholder?.remove();activePanel=null;placeholder=null;
 }
 const closePanel=()=>{if(dialog.open)dialog.close();restore();};
 dialog.addEventListener('close',()=>{if(!dialog.open)restore();});
 $('.r19-close',dialog)?.addEventListener('click',closePanel);
 dialog.addEventListener('click',event=>{
  if(event.target===dialog){closePanel();return;}
  // The workspace hides the current panel when an action selects another tab.
  if(!activePanel?.hidden)return;
  closePanel();
  $('[data-tab][aria-selected="true"]')?.focus();
 });
 function openPanel(key){
  if(key==='builder'){
   window.dispatchEvent(new Event('aim-open-session-editor'));
   return;
  }
  const panel=$('#panel-'+key);
  if(!panel||!names[key])return;
  if(dialog.open)closePanel();else if(activePanel)restore();
  placeholder=document.createComment('Native AIM panel home');
  panel.before(placeholder);
  $('#tab-'+key)?.click();
  host.append(panel);activePanel=panel;panel.hidden=false;
  const h=$('[data-r19-title]',dialog);
  if(h)h.textContent=tr(...names[key]);
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
 }
 $$('[data-r19-panel]',toolbar).forEach(button=>button.addEventListener('click',()=>openPanel(button.dataset.r19Panel)));

 // Keep the multi-day program available beside the guided session.
 const planButton=document.createElement('button');
 planButton.type='button';planButton.className='r19-plan-program';
 planButton.innerHTML='▱ '+tag('Planifier un programme','Plan a program')+' <span aria-hidden="true">↗</span>';
 const planFooter=$('.r17-plan-footer',screen);
 if(planFooter)planFooter.append(planButton);
 planButton.addEventListener('click',()=>openPanel('program'));

 const favorites=document.createElement('span');
 favorites.className='r19-favorites-count';
 favorites.setAttribute('aria-live','polite');
 const toolsHeading=$('.r19-tools-heading',toolbar);
 if(toolsHeading)toolsHeading.append(favorites);
 function stats(){
  const store=window.AIMWeb?.getStore?.();
  if(!store)return;
  const count=Array.isArray(store.presets)?store.presets.length:0;
  favorites.textContent=count+' '+tr('routine(s) favorite(s)','saved routine(s)');
  const s=computeStats(Array.isArray(store.sessions)?store.sessions:[],store.weeklyGoal||3);
  const weekTarget=$('.r17-weekprogress [data-r17-week]',screen);
  if(weekTarget)weekTarget.textContent=s.week+' / '+s.goal;
 }
 window.addEventListener('aim-v5-ready',stats);
 window.addEventListener('aim-store-updated',stats);
 window.addEventListener('aim-cloud-data-changed',stats);
 stats();

 const hash=()=>location.hash.match(/^#panel-(dashboard|program|insights|challenges|coach|profile|data)$/)?.[1];
 function openLink(){const key=hash();if(key)openPanel(key);}
 window.addEventListener('hashchange',openLink);
 window.addEventListener('load',openLink,{once:true});
 if(document.readyState==='complete')queueMicrotask(openLink);
}

function installAccountActions(){
 const panel=$('.r17-account-right .r17-cloud-split'),dashboard=$('#dashboard-panel');
 if(!panel||!dashboard)return;
 const controls=document.createElement('div');
 controls.className='r19-cloud-actions';
 controls.innerHTML='<div class="r19-cloud-head">'+tag('Actions sur ton vrai compte','Your real account actions')+'</div>'+
 '<div class="r19-cloud-commands">'+
 '<button type="button" data-r19-cloud="cloud-enable">'+tag('Gérer la sauvegarde','Manage backup')+'</button>'+
 '<span class="r19-cloud-auto">'+tag('☁ Synchronisation cloud automatique','☁ Automatic cloud synchronization')+'</span>'+
 '<button type="button" data-r19-cloud="cloud-import-guest">'+tag('Importer mon historique','Import guest history')+'</button>'+
 '<a href="#auth-panel" class="r19-cloud-login">'+tag('Se connecter pour utiliser le cloud','Sign in to use cloud')+' ↗</a>'+
 '</div>';
 panel.after(controls);
 const actions=$$('[data-r19-cloud]',controls);
 const login=$('.r19-cloud-login',controls);
 function render(){
  const logged=!dashboard.hidden;
  for(const button of actions){const manual=['cloud-enable','cloud-sync'].includes(button.dataset.r19Cloud);button.hidden=!logged||manual;button.disabled=!logged||manual;}
  if(login)login.hidden=logged;
  const state=$('#cloud-enabled-status')?.textContent?.trim();
  const label=controls.querySelector('[data-r19-cloud="cloud-enable"]');
  if(label && logged && state)label.title=tr('État actuel : ','Current status: ')+state;
 }
 new MutationObserver(render).observe(dashboard,{attributes:true,subtree:true,childList:true,characterData:true});
 render();
 for(const button of actions)button.addEventListener('click',()=>{
  if(dashboard.hidden)return;
  $('#'+button.dataset.r19Cloud)?.click();
  $('#account-status')?.scrollIntoView({behavior:'smooth',block:'nearest'});
 });
}

function installProgressActions(){
 const container=$('.r17-progress-wrap .r17-toolbar'),selector=$('#v14-progress-range');
 if(!container||!selector)return;
 const chooser=document.createElement('div');
 chooser.className='r19-range-buttons';
 chooser.setAttribute('role','group');
 chooser.setAttribute('aria-label',tr('Période des statistiques','Statistics period'));
 for(const [value,fr,english] of [['7','7 jours','7 days'],['30','30 jours','30 days'],['90','90 jours','90 days'],['0','Tout','All']]){
  const button=document.createElement('button');
  button.type='button';button.dataset.r19Range=value;
  button.innerHTML=tag(fr,english);
  button.addEventListener('click',()=>{selector.value=value;selector.dispatchEvent(new Event('change',{bubbles:true}));update()});
  chooser.append(button);
 }
 function update(){
  $$('[data-r19-range]',chooser).forEach(button=>{
   const active=button.dataset.r19Range===selector.value;
   button.setAttribute('aria-pressed',String(active));
   button.classList.toggle('is-active',active);
  });
 }
 selector.addEventListener('change',update);
 container.append(chooser);update();
}

function installHomeActions(){
 const home=$('.r17-home-wrap');
 if(!home)return;
 const stat=$('.r17-stats',home);
 if(!stat)return;
 const action=document.createElement('a');
 action.className='r19-home-progress';
 action.href='progress.html';
 action.innerHTML='▥ '+tag('Mes statistiques détaillées','My detailed statistics')+' <span aria-hidden="true">↗</span>';
 const heading=$('.r17-home-paths',home);
 if(heading)heading.append(action);
}

function init(){
 if(route==='training.html')installWorkspace();
 else if(route==='account.html')installAccountActions();
 else if(route==='progress.html')installProgressActions();
 else if(route==='index.html')installHomeActions();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
