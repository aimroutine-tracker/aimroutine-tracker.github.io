import {storageKey,activeUid} from './cloud-core-v7.mjs';
import {collectFavoriteDeletion} from './cloud-sync-v7.mjs';
import {STORAGE_KEY,LEGACY_KEY,FOCUS,RANK,TOOLS,CATALOG,normalizeStore,
  createRoutine,validPreset,validExercise,sessionMinutes,computeStats,comparable,coach,
  exportPayload,importPayload} from './training-core-v5.mjs';

(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
const id=()=>crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
const showMessage=message=>{$('#data-message').textContent=message;};
function readJSON(key){try{return JSON.parse(localStorage.getItem(storageKey(key))||'null')}catch{return null}}
let store=activeUid()?normalizeStore(readJSON(STORAGE_KEY),readJSON(LEGACY_KEY)):normalizeStore(null,null);
let plan=null,active=null,interval=null,remaining=0,deadline=0,running=false;
function save(next=store){
  if(!activeUid()){
    showMessage('Aucune sauvegarde sans compte. Connecte-toi pour enregistrer et synchroniser automatiquement.');
    alert('Connecte-toi à AimRoutine pour enregistrer ta progression.');
    return false;
  }
  try{
    const removed=store.presets.filter(p=>!next.presets.some(n=>n.id===p.id)).map(p=>p.id);
    const uid=activeUid();
    if(uid&&removed.length)collectFavoriteDeletion(uid,removed);
    localStorage.setItem(storageKey(STORAGE_KEY),JSON.stringify(next));store=next;
      window.dispatchEvent(new CustomEvent('aim-store-updated'));
      return true}
  catch{alert('Le navigateur ne permet pas cet enregistrement. Vérifie son espace de stockage et ses paramètres.');return false}
}
function chooseTab(name,focus=false){
  const tabs=$$('[data-tab]');
  tabs.forEach(t=>{
    const selected=t.dataset.tab===name;
    t.setAttribute('aria-selected',String(selected));
    t.tabIndex=selected?0:-1;
    $('#panel-'+t.dataset.tab).hidden=!selected;
  });
  if(focus)tabs.find(t=>t.dataset.tab===name)?.focus();
  if(name==='insights')renderInsights();
  if(name==='coach')renderCoach();
}
$$('[data-tab]').forEach((b,i,all)=>{
  b.addEventListener('click',()=>chooseTab(b.dataset.tab));
  b.addEventListener('keydown',event=>{
    let n=-1;
    if(event.key==='ArrowRight')n=(i+1)%all.length;
    if(event.key==='ArrowLeft')n=(i-1+all.length)%all.length;
    if(event.key==='Home')n=0;
    if(event.key==='End')n=all.length-1;
    if(n!==-1){event.preventDefault();chooseTab(all[n].dataset.tab,true)}
  });
});
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>{
  chooseTab(b.dataset.go);
  $('.ar5-tab-wrap').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}));
function labelDate(s){return new Date(s.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
function formatPercent(n){return n===null?'—':n.toFixed(1)+' %'}
function renderDashboard(){
  const stats=computeStats(store.sessions,store.weeklyGoal);
  $('#total-sessions').textContent=stats.count;
  $('#total-minutes').textContent=stats.minutes.toLocaleString('fr-FR');
  $('#avg-accuracy').textContent=formatPercent(stats.avg);
  $('#best-accuracy').textContent=formatPercent(stats.best);
  $('#weekly-goal').value=store.weeklyGoal;
  $('#weekly-sessions').textContent=stats.week;
  $('#streak-days').textContent=stats.streak;
  $('#goal-status').textContent=stats.week+' / '+stats.goal;
  const meter=$('#weekly-meter');
  meter.setAttribute('aria-valuenow',String(Math.min(stats.goal,stats.week)));
  meter.setAttribute('aria-valuemax',String(stats.goal));
  $('#weekly-meter-bar').style.width=(Math.min(100,Math.round(stats.week/stats.goal*100)))+'%';
  const report=coach(store.sessions,$('#insight-focus').value,$('#insight-tool').value,store.weeklyGoal);
  $('#tip-title').textContent=report.title;
  $('#coaching-tip').textContent=report.message;
  const history=$('#history');
  history.replaceChildren();
  if(!store.sessions.length)history.append(make('p','Aucune séance enregistrée pour le moment. Commence par une routine courte.','muted'));
  store.sessions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).forEach(s=>{
    const row=make('div',undefined,'history-row'),left=make('div');
    left.append(make('strong',FOCUS[s.focus]),make('small',labelDate(s)+' · '+s.minutes+' min · '+(s.tool||'Outil non précisé')));
    row.append(left,make('span',s.accuracy===null?'Séance terminée':formatPercent(s.accuracy),'score'));
    history.append(row);
  });
}
$('#weekly-goal').addEventListener('change',()=>{
  const x=Number($('#weekly-goal').value);
  if(!Number.isInteger(x)||x<1||x>14){$('#weekly-goal').value=store.weeklyGoal;return;}
  save({...store,weeklyGoal:x});renderDashboard();
});
function sectionTitle(parent,title,sub){
  parent.append(make('h3',title));
  if(sub)parent.append(make('p',sub,'muted'));
}
function makeInput(type,value,label,onChange,min,max){
  const wrapper=make('label',undefined,'ar5-field');
  wrapper.append(make('span',label));
  const input=document.createElement('input');
  input.type=type;input.value=value;
  if(min!==undefined)input.min=String(min);
  if(max!==undefined)input.max=String(max);
  if(type==='number')input.step='1';
  input.addEventListener('change',()=>onChange(input.value,input));
  wrapper.append(input);
  return wrapper;
}
function makeSelect(items,value,label,onChange){
  const wrapper=make('label',undefined,'ar5-field');
  wrapper.append(make('span',label));
  const select=document.createElement('select');
  items.forEach(item=>{
    const option=document.createElement('option');
    option.value=typeof item==='string'?item:item.value;
    option.textContent=typeof item==='string'?item:item.label;
    select.append(option);
  });
  select.value=value;
  select.addEventListener('change',()=>onChange(select.value));
  wrapper.append(select);
  return wrapper;
}
function editor(){
 const container=$('#routine-output');
 container.replaceChildren();
 if(!plan){sectionTitle(container,'Atelier d’entraînement','Choisis ton rang, ta compétence et ton outil pour générer une routine.');return}
 sectionTitle(container,'Personnalise ta séance','Modifie librement l’outil, le nom et la durée de chaque exercice. Les temps de pause ne sont pas inclus dans la durée totale.');
 const status=make('p',undefined,'ar5-plan-summary');status.id='plan-summary';container.append(status);
 const list=make('div',undefined,'ar5-edit-list');
 plan.exercises.forEach((ex,index)=>{
   const card=make('div',undefined,'ar5-edit-row');
   const head=make('div',undefined,'ar5-edit-head');
   head.append(make('strong',String(index+1).padStart(2,'0')+' / Exercice'));
   const actions=make('div',undefined,'ar5-row-actions');
   [['↑','Déplacer vers le haut',index-1],['↓','Déplacer vers le bas',index+1]].forEach(([symbol,aria,destination])=>{
     const b=make('button',symbol,'ar5-icon-button');b.type='button';b.setAttribute('aria-label',aria);b.disabled=destination<0||destination>=plan.exercises.length;
     b.addEventListener('click',()=>{const moved=plan.exercises.splice(index,1)[0];plan.exercises.splice(destination,0,moved);editor()});actions.append(b);
   });
   const remove=make('button','Retirer','ar5-quiet-button');
   remove.type='button';remove.disabled=plan.exercises.length<=1;
   remove.addEventListener('click',()=>{plan.exercises.splice(index,1);editor()});
   actions.append(remove);head.append(actions);card.append(head);
   const row=make('div',undefined,'ar5-fields');
   row.append(makeInput('text',ex.name,'Scénario / nom de l’exercice',(v,field)=>{ex.name=v.trim().slice(0,90);field.value=ex.name;updateTotal()},undefined,undefined));
   row.append(makeSelect(TOOLS,ex.tool,'Logiciel',v=>{ex.tool=v;updateTotal()}));
   row.append(makeInput('number',ex.minutes,'Minutes',(v,field)=>{const n=Number(v);if(!Number.isInteger(n)||n<1||n>45){field.value=ex.minutes;return;}ex.minutes=n;updateTotal()},1,45));
   card.append(row);
   card.append(makeInput('text',ex.tip,'Consigne (facultative)',(v,field)=>{ex.tip=v.slice(0,180);field.value=ex.tip}));
   list.append(card);
 });
 container.append(list);
 const actions=make('div',undefined,'ar5-edit-actions');
 const add=make('button','+ Ajouter un exercice','outline');add.type='button';add.disabled=plan.exercises.length>=10;
 add.addEventListener('click',()=>{if(plan.exercises.length>=10)return;const x=CATALOG.find(x=>x.tool===plan.exercises[0].tool&&x.focus===plan.focus)||CATALOG[0];plan.exercises.push({name:x.name,tool:x.tool,minutes:5,tip:x.tip});editor()});
 const favorite=make('button','☆ Enregistrer comme favori','outline');favorite.type='button';favorite.addEventListener('click',savePreset);
 const start=make('button','Lancer la séance →','primary');start.type='button';start.id='start-plan';start.addEventListener('click',startSession);
 actions.append(add,favorite,start);container.append(actions);
 updateTotal();
}
function updateTotal(){
 const status=$('#plan-summary');if(!status||!plan)return;
 const total=sessionMinutes(plan);
 const valid=plan.exercises.every(validExercise)&&total<=120;
 status.textContent=plan.exercises.length+' exercice(s) · '+total+' min prévues · '+plan.breakSeconds+' s de pause entre exercices'+(valid?'':' · Limite : 120 min et 10 exercices');
 const start=$('#start-plan');if(start)start.disabled=!valid;
}
$('#builder-form').addEventListener('submit',event=>{
 event.preventDefault();
 if(active&&!confirm('Une séance est en cours. Remplacer la routine ?'))return;
 stopTimer();active=null;$('#session-area').hidden=true;$('#finish-form').hidden=true;
 const rank=$('#rank').value,focus=$('#focus').value,tool=$('#tool').value,minutes=Number($('#duration').value),breakSeconds=Number($('#break-length').value);
 plan=createRoutine(rank,focus,tool,minutes,breakSeconds);editor();
 $('#routine-output').scrollIntoView({block:'start',behavior:'smooth'});
});
function savePreset(){
 if(!plan||!plan.exercises.every(validExercise)||sessionMinutes(plan)>120){alert('Vérifie ta routine avant de l’enregistrer.');return}
 if(store.presets.length>=25){alert('25 favoris maximum. Supprime un ancien favori.');return}
 const label=prompt('Nom de la routine favorite (60 caractères max) :',FOCUS[plan.focus]+' · '+sessionMinutes(plan)+' min');
 if(label===null)return;const name=label.trim().slice(0,60);if(!name){alert('Choisis un nom.');return}
 const preset={id:id(),name,rank:plan.rank,focus:plan.focus,breakSeconds:plan.breakSeconds,exercises:plan.exercises.map(x=>({...x}))};
 if(!validPreset(preset))return;
 if(save({...store,presets:[...store.presets,preset]}))renderFavorites();
}
function renderFavorites(){
 const target=$('#favorite-list');target.replaceChildren();
 if(!store.presets.length){target.append(make('p','Aucun favori. Personnalise puis enregistre ta première routine.','muted'));return}
 store.presets.forEach(p=>{
  const card=make('div',undefined,'ar5-favorite');
  const info=make('div');info.append(make('strong',p.name),make('small',p.exercises.length+' exercices · '+sessionMinutes(p)+' min'));
  const btns=make('div',undefined,'controls');
  const load=make('button','Charger','outline');load.type='button';
  load.addEventListener('click',()=>{if(active&&!confirm('Remplacer la séance actuelle ?'))return;stopTimer();active=null;$('#session-area').hidden=true;$('#finish-form').hidden=true;plan={rank:p.rank,focus:p.focus,breakSeconds:p.breakSeconds,exercises:p.exercises.map(x=>({...x}))};$('#rank').value=p.rank;$('#focus').value=p.focus;$('#tool').value=p.exercises[0].tool;editor();$('#routine-output').scrollIntoView({block:'start',behavior:'smooth'})});
  const del=make('button','Supprimer','ar5-quiet-button');del.type='button';
  del.addEventListener('click',()=>{if(confirm('Supprimer le favori « '+p.name+' » ?')&&save({...store,presets:store.presets.filter(x=>x.id!==p.id)}))renderFavorites()});
  btns.append(load,del);card.append(info,btns);target.append(card);
 });
}
function stopTimer(){if(interval!==null)clearInterval(interval);interval=null;running=false}
function setRemaining(ms){remaining=Math.max(0,ms);updateClock()}
let audioContext=null;
function transitionCue(){
  if(!$('#timer-sound')?.checked)return;
  try{
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return;
    if(!audioContext)audioContext=new Context();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const tone=audioContext.createOscillator(),gain=audioContext.createGain();
    tone.type='sine';tone.frequency.value=784;gain.gain.value=.035;
    tone.connect(gain);gain.connect(audioContext.destination);
    tone.start();tone.stop(audioContext.currentTime+.15);
  }catch{}
}
function transitionStep(){
  if(!active||!plan)return false;
  if(active.phase==='break'){active.index++;active.phase='exercise'}
  else if(active.index===plan.exercises.length-1){
    stopTimer();$('#session-area').hidden=true;$('#finish-form').hidden=false;
    document.body.classList.remove('ar6-immersive');
    if(document.fullscreenElement=== $('#session-area'))document.exitFullscreen?.().catch(()=>{});
    $('#finish-form').scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }else if(plan.breakSeconds>0){active.phase='break'}
  else{active.index++}
  return true;
}
function stepDuration(){return (active.phase==='break'?plan.breakSeconds:plan.exercises[active.index].minutes*60)*1000;}

function updateClock(){
 $('#clock').textContent=String(Math.floor(Math.ceil(remaining/1000)/60)).padStart(2,'0')+':'+String(Math.ceil(remaining/1000)%60).padStart(2,'0');
 if(!active||!plan)return;
 const isPause=active.phase==='break',current=plan.exercises[active.index],duration=(isPause?plan.breakSeconds:current.minutes*60)*1000;
 $('#phase-label').textContent=isPause?'PAUSE / RÉCUPÉRATION':'EXERCICE EN COURS';
 $('#active-exercise').textContent=(active.index+1)+' / '+plan.exercises.length+' — '+(isPause?'Pause':current.name);
 $('#active-detail').textContent=isPause?'Respire, relâche les épaules et prépare le prochain exercice.':current.tool+' · '+current.tip;
 $('#timer-toggle').textContent=running?'Pause':remaining===0?'Relancer':'Démarrer / Reprendre';
 $('#next-exercise').textContent=active.phase==='exercise'&&active.index===plan.exercises.length-1?'Terminer et noter →':isPause?'Reprendre la routine →':'Étape suivante →';
 const share=(active.index+(isPause?1:1-remaining/Math.max(1,duration)))/plan.exercises.length;
 $('#progress-fill').style.width=Math.max(0,Math.min(100,share*100)).toFixed(1)+'%';
}
function startSession(){
 if(!plan||!plan.exercises.every(validExercise)||sessionMinutes(plan)>120)return;
 stopTimer();active={index:0,phase:'exercise'};$('#finish-form').hidden=true;$('#session-area').hidden=false;
 setRemaining(plan.exercises[0].minutes*60000);$('#session-area').scrollIntoView({block:'center',behavior:'smooth'});
}
function tick(){
 if(!running||!active)return;
 const now=performance.now();
 if(now<deadline){setRemaining(deadline-now);return}
 if(!$('#timer-auto')?.checked){
   stopTimer();setRemaining(0);transitionCue();
   return;
 }
 let count=0;
 while(active&&now>=deadline&&count++<40){
   const elapsedDeadline=deadline;
   transitionCue();
   if(!transitionStep())return;
   deadline=elapsedDeadline+stepDuration();
 }
 if(count>=40&&now>=deadline)deadline=now+stepDuration();
 setRemaining(Math.max(0,deadline-now));
}
$('#timer-toggle').addEventListener('click',()=>{
 if(!active)return;
 if(running){tick();stopTimer();updateClock()}
 else{if(remaining===0)remaining=(active.phase==='break'?plan.breakSeconds*1000:plan.exercises[active.index].minutes*60000);running=true;deadline=performance.now()+remaining;interval=setInterval(tick,200);updateClock()}
});
$('#next-exercise').addEventListener('click',()=>{
 if(!active)return;
 const wasRunning=running;
 stopTimer();
 if(!transitionStep())return;
 setRemaining(stepDuration());
 transitionCue();
 if(wasRunning){running=true;deadline=performance.now()+remaining;interval=setInterval(tick,200);updateClock()}
});
$('#focus-mode').addEventListener('click',async()=>{
 const panel=$('#session-area');
 const activeMode=!!document.fullscreenElement||document.body.classList.contains('ar6-immersive');
 if(activeMode){
   document.body.classList.remove('ar6-immersive');
   if(document.fullscreenElement)await document.exitFullscreen?.().catch(()=>{});
 }else{
   if(panel.requestFullscreen){
     try{await panel.requestFullscreen()}catch{document.body.classList.add('ar6-immersive')}
   }else document.body.classList.add('ar6-immersive');
 }
 $('#focus-mode').textContent=(document.fullscreenElement||document.body.classList.contains('ar6-immersive'))?'Quitter le plein écran':'Mode immersion';
});
document.addEventListener('fullscreenchange',()=>{
 $('#focus-mode').textContent=document.fullscreenElement?'Quitter le plein écran':'Mode immersion';
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&document.body.classList.contains('ar6-immersive')){
   document.body.classList.remove('ar6-immersive');
   $('#focus-mode').textContent='Mode immersion';
 }
});
$('#cancel-session').addEventListener('click',()=>{
 if(!active||!confirm('Annuler cette séance sans l’enregistrer ?'))return;
 stopTimer();active=null;document.body.classList.remove('ar6-immersive');$('#session-area').hidden=true;$('#finish-form').hidden=true;
});
document.addEventListener('visibilitychange',()=>{if(running)tick()});
window.addEventListener('pagehide',()=>{
 if(document.body.classList.contains('ar6-immersive'))document.body.classList.remove('ar6-immersive');
});
$('#finish-form').addEventListener('submit',event=>{
 event.preventDefault();if(!active||!plan)return;
 const raw=$('#accuracy').value.trim().replace(',','.');
 const accuracy=raw===''?null:Number(raw);
 if(accuracy!==null&&(!Number.isFinite(accuracy)||accuracy<0||accuracy>100)){alert('Précision entre 0 et 100 uniquement.');return}
 const data={id:id(),date:new Date().toISOString(),rank:plan.rank,focus:plan.focus,
  tool:plan.exercises[0].tool,scenario:plan.exercises[0].name,
  minutes:sessionMinutes(plan),breakSeconds:plan.breakSeconds,accuracy,
  feeling:$('#feeling').value,notes:$('#notes').value.slice(0,240)};
 if(!save({...store,sessions:[...store.sessions,data].slice(-1000)}))return;
 stopTimer();active=null;$('#finish-form').hidden=true;$('#accuracy').value='';$('#notes').value='';
 renderDashboard();renderInsights();renderCoach();chooseTab('dashboard');$('.ar5-tab-wrap').scrollIntoView({block:'start',behavior:'smooth'});
});
function renderInsights(){
 const focus=$('#insight-focus').value,tool=$('#insight-tool').value;
 const xs=comparable(store.sessions,focus,tool).slice(-20);
 $('#chart-count').textContent=xs.length+' valeur'+(xs.length>1?'s':'');
 const chart=$('#chart');chart.replaceChildren();
 if(!xs.length){chart.append(make('p','Pas encore de précision renseignée pour cette sélection.','muted'))}
 else{
  const NS='http://www.w3.org/2000/svg',el=(tag,attrs={})=>{const node=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));return node};
  const svg=el('svg',{viewBox:'0 0 720 270',role:'img','aria-label':'Graphique des précisions des '+xs.length+' dernières séances'});
  [0,25,50,75,100].forEach(p=>{const y=238-p*1.92;svg.append(el('line',{x1:46,y1:y,x2:690,y2:y,stroke:'#355065','stroke-width':1}));const t=el('text',{x:3,y:y+4,fill:'#a8bbc9','font-size':12});t.textContent=p+'%';svg.append(t)});
  const points=xs.map((s,i)=>[46+i/Math.max(1,xs.length-1)*644,238-s.accuracy*1.92]);
  svg.append(el('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#ff586f','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
  xs.forEach((s,i)=>{const dot=el('circle',{cx:points[i][0],cy:points[i][1],r:5,fill:'#8bded3'});const title=el('title');title.textContent=labelDate(s)+' · '+formatPercent(s.accuracy);dot.append(title);svg.append(dot)});
  chart.append(svg);
 }
 const counts=computeStats(store.sessions,store.weeklyGoal).byFocus;
 const target=$('#focus-breakdown');target.replaceChildren();
 Object.entries(FOCUS).forEach(([k,v])=>{const row=make('div',undefined,'breakdown');row.append(make('span',v),make('strong',counts[k]+' séance(s)'));target.append(row)});
 $('#insight-advice').textContent=coach(store.sessions,focus,tool,store.weeklyGoal).message;
}
['insight-focus','insight-tool'].forEach(id=>$('#'+id).addEventListener('change',()=>{renderInsights();renderCoach();renderDashboard()}));
function renderCoach(){
 const report=coach(store.sessions,$('#insight-focus').value,$('#insight-tool').value,store.weeklyGoal);
 $('#coach-title').textContent=report.title;$('#coach-message').textContent=report.message;$('#coach-confidence').textContent=report.confidence;
}
$('#coach-build').addEventListener('click',()=>{
 $('#focus').value=$('#insight-focus').value;
 const tool=$('#insight-tool').value;
 if(tool&&TOOLS.includes(tool))$('#tool').value=tool;
 chooseTab('builder');$('#builder-form').requestSubmit(); 
});
$('#export-data').addEventListener('click',()=>{
 if(!activeUid()){showMessage('Connecte-toi pour exporter ta progression.');return;}
 const payload=exportPayload(store),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='aimroutine-v5-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 showMessage('Sauvegarde JSON préparée : conserve-la en lieu sûr.');
});
$('#import-data').addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>2e6)throw Error('La sauvegarde dépasse 2 Mo.');
  const payload=JSON.parse(await file.text());
  const result=importPayload(payload,store);
  if(!save(result.store))return;
  renderDashboard();renderInsights();renderCoach();renderFavorites();
  showMessage(result.added+' nouvelle(s) séance(s) importée(s), favoris conservés.');
 }catch(error){showMessage('Import impossible : '+error.message)}
 finally{event.target.value=''}
});
$('#clear-data').addEventListener('click',()=>{
 if(!activeUid()){showMessage('Aucune donnée invitée n’est enregistrée par cette version. Connecte-toi pour gérer ta sauvegarde.');return}
 if(!confirm('Effacer définitivement toutes tes séances, routines favorites et objectifs locaux ?'))return;
 if(!confirm('Dernière confirmation : as-tu exporté ta sauvegarde ?'))return;
 try{localStorage.removeItem(storageKey(STORAGE_KEY));localStorage.removeItem(storageKey(LEGACY_KEY))}catch{showMessage('Impossible d’effacer le stockage de ce navigateur.');return}
 store=normalizeStore(null,null);plan=null;active=null;stopTimer();editor();renderFavorites();renderDashboard();renderInsights();renderCoach();
 $('#session-area').hidden=true;$('#finish-form').hidden=true;showMessage(activeUid()?'Cache de cet appareil effacé. Les sauvegardes cloud restent disponibles dans Mon compte.':'Les données de cet espace ont été effacées.');
});
window.AIMWeb=Object.freeze({
  getStore:()=>JSON.parse(JSON.stringify(store)),
  reloadFromCache:()=>{
    if(!activeUid())return false;
    store=normalizeStore(readJSON(STORAGE_KEY),readJSON(LEGACY_KEY));
    renderDashboard();renderInsights();renderCoach();renderFavorites();
    return true;
  },
  getPlan:()=>plan?JSON.parse(JSON.stringify(plan)):null,
  setPlan:next=>{
    if(!next||!Object.hasOwn(RANK,next.rank)||!Object.hasOwn(FOCUS,next.focus)||
       !Array.isArray(next.exercises)||!next.exercises.length||
       !next.exercises.every(validExercise)||sessionMinutes(next)>120)return false;
    if(active&&!confirm('Remplacer la routine actuelle ?'))return false;
    stopTimer();active=null;$('#session-area').hidden=true;$('#finish-form').hidden=true;
    plan=JSON.parse(JSON.stringify(next));
    $('#rank').value=next.rank;$('#focus').value=next.focus;$('#tool').value=next.exercises[0].tool;
    editor();chooseTab('builder');
    $('#routine-output').scrollIntoView({block:'start',behavior:'smooth'});
    return true;
  },
  openTab:name=>chooseTab(name),
  mergeData:payload=>{
    const result=importPayload({format:'aimroutine-web-v2',sessions:payload.sessions,presets:payload.presets,weeklyGoal:payload.weeklyGoal},store);
    if(!save(result.store))throw Error('Enregistrement impossible');
    renderDashboard();renderInsights();renderCoach();renderFavorites();
    return result.added;
  },
  refresh:()=>{renderDashboard();renderInsights();renderCoach();renderFavorites()}
});
window.dispatchEvent(new CustomEvent('aim-v5-ready'));
window.addEventListener('storage',event=>{
 if([storageKey(STORAGE_KEY),storageKey(LEGACY_KEY)].includes(event.key)){
  store=activeUid()?normalizeStore(readJSON(STORAGE_KEY),readJSON(LEGACY_KEY)):normalizeStore(null,null);
  renderDashboard();renderInsights();renderCoach();renderFavorites();
 }
});
renderDashboard();renderFavorites();renderInsights();renderCoach();
})();
