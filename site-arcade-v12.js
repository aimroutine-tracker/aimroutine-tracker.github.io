/* AimRoutine Arcade V12 — client-only, original mini AIM challenge.
   No account state, Supabase, Riot services, tracking, or local persistence. */
(()=>{
 'use strict';
 const game=document.querySelector('[data-ar11-game]');
 if(!game)return;
 const field=game.querySelector('[data-ar11-field]');
 const target=game.querySelector('[data-ar11-target]');
 const overlay=game.querySelector('[data-ar11-overlay]');
 const overlayTitle=game.querySelector('[data-ar11-overlay-title]');
 const overlayCopy=game.querySelector('[data-ar11-overlay-copy]');
 const startBtn=game.querySelector('[data-ar11-start]');
 const pauseBtn=game.querySelector('[data-ar11-pause]');
 const modeBtns=[...game.querySelectorAll('[data-ar11-mode]')];
 const durationBtns=[...game.querySelectorAll('[data-ar12-duration]')];
 const hitsNode=game.querySelector('[data-ar11-hits]');
 const missesNode=game.querySelector('[data-ar11-misses]');
 const accuracyNode=game.querySelector('[data-ar11-accuracy]');
 const timeNode=game.querySelector('[data-ar11-time]');
 const progress=game.querySelector('[data-ar11-progress]');
 const progressBar=game.querySelector('[data-ar11-progress-bar]');
 const status=game.querySelector('[data-ar11-status]');
 const comboNode=game.querySelector('[data-ar12-combo]');
 const bestNode=game.querySelector('[data-ar12-best]');
 const reactionNode=game.querySelector('[data-ar12-reaction]');
 const durationLabel=game.querySelector('[data-ar12-field-duration]');
 const copyBtn=game.querySelector('[data-ar12-copy]');
 if(!field||!target||!overlay||!startBtn||!pauseBtn||modeBtns.length!==2||durationBtns.length!==3)return;

 const DURATION=20000;
 const REFLEX_DELAY=1050;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const phrases={
  idle:{
   title:['Prêt pour le défi ?','Ready for the challenge?'],
   copy:['Choisis un mode et une durée, puis démarre pour faire apparaître les cibles.',
         'Choose a mode and duration, then start to reveal targets.'],
   status:['Sélectionne tes réglages pour commencer.','Choose your settings to begin.']
  },
  playing:{status:['Touche les cibles roses ; un clic dans le vide est un raté.',
                   'Hit the pink targets; empty clicks count as misses.']},
  paused:{
   title:['Partie en pause','Game paused'],
   copy:['Reprends quand tu es prêt : le chronomètre est arrêté.',
         'Resume when you are ready: the timer is paused.'],
   status:['En pause — ton score est conservé.','Paused — your score is preserved.']
  },
  finished:{
   title:['Défi terminé !','Challenge complete!'],
   copy:['Retente le défi ou copie ton résultat.','Try again or copy your result.']
  }
 };
 const isFrench=()=>document.documentElement.lang!=='en';
 const translate=(fr,en)=>isFrench()?fr:en;
 let state='idle',mode='precision',durationMs=DURATION;
 let hits=0,misses=0,combo=0,maxCombo=0;
 let reactionSum=0,reactionCount=0;
 let leftMs=DURATION,lastTick=0,lastSpawnAt=0,interval=null;
 const bestBySetup=Object.create(null);

 function stopClock(){if(interval!==null){clearInterval(interval);interval=null;}}
 function updateStats(){
  hitsNode.textContent=String(hits);
  missesNode.textContent=String(misses);
  accuracyNode.textContent=hits+misses>0?Math.round(hits/(hits+misses)*100)+'%':'—';
  if(comboNode)comboNode.textContent=String(combo);
  if(bestNode)bestNode.textContent=String(bestBySetup[mode+':'+durationMs]||'—');
  if(reactionNode)reactionNode.textContent=reactionCount?Math.round(reactionSum/reactionCount)+' ms':'—';
  const seconds=Math.max(0,Math.ceil(leftMs/1000));
  timeNode.textContent=String(seconds);
  progress.setAttribute('aria-valuemax',String(durationMs/1000));
  progress.setAttribute('aria-valuenow',String(seconds));
  progressBar.style.transform='scaleX('+Math.max(0,leftMs/durationMs).toFixed(4)+')';
 }
 function setOverlay(){
  if(state==='playing'){overlay.hidden=true;return;}
  overlay.hidden=false;
  overlayTitle.textContent=translate(...phrases[state].title);
  overlayCopy.textContent=translate(...phrases[state].copy);
 }
 function setButtons(){
  const active=state==='playing'||state==='paused';
  for(const button of modeBtns){
   button.disabled=active;
   button.setAttribute('aria-pressed',String(button.dataset.ar11Mode===mode));
  }
  for(const button of durationBtns){
   button.disabled=active;
   button.setAttribute('aria-pressed',String(Number(button.dataset.ar12Duration)===durationMs));
  }
  startBtn.textContent=translate(state==='idle'?'Démarrer le défi':'Recommencer',
     state==='idle'?'Start challenge':'Restart');
  pauseBtn.hidden=!active;
  pauseBtn.textContent=translate(state==='paused'?'Reprendre':'Pause',
                                state==='paused'?'Resume':'Pause');
  if(copyBtn){
   copyBtn.hidden=state!=='finished';
   copyBtn.textContent=translate('Copier mon score','Copy my score');
  }
  if(durationLabel)durationLabel.textContent=(durationMs/1000)+' SEC / NO RANKING';
  target.setAttribute('aria-label',translate('Toucher la cible','Hit target'));
  game.dataset.state=state;
  game.dataset.mode=mode;
 }
 function setStatus(){
  if(state==='finished'){
   status.textContent=translate(
    'Résultat : '+hits+' cibles touchées, '+misses+' ratés, '+accuracyNode.textContent+' de précision. Meilleur combo : '+maxCombo+'.',
    'Result: '+hits+' targets hit, '+misses+' misses, '+accuracyNode.textContent+' accuracy. Best streak: '+maxCombo+'.');
  }else status.textContent=translate(...phrases[state].status);
 }
 function render(){setButtons();setOverlay();updateStats();setStatus();}
 function spawn(now=performance.now()){
  const size=target.offsetWidth||(mode==='reflex'?68:49);
  const margin=18;
  const maxX=Math.max(0,field.clientWidth-size-margin*2);
  const maxY=Math.max(0,field.clientHeight-size-margin*2);
  target.style.left=margin+Math.round(Math.random()*maxX)+'px';
  target.style.top=margin+Math.round(Math.random()*maxY)+'px';
  lastSpawnAt=now;
  if(!reduced.matches){
   target.style.animation='none';void target.offsetWidth;target.style.animation='';
  }
 }
 function impact(kind,x,y){
  if(reduced.matches)return;
  const dot=document.createElement('span');
  dot.className=kind;dot.setAttribute('aria-hidden','true');
  dot.style.left=x+'px';dot.style.top=y+'px';
  field.append(dot);
  dot.addEventListener('animationend',()=>dot.remove(),{once:true});
 }
 function tick(){
  if(state!=='playing')return;
  const now=performance.now();
  leftMs=Math.max(0,leftMs-Math.max(0,now-lastTick));
  lastTick=now;
  if(leftMs===0){finish();return;}
  if(mode==='reflex'&&now-lastSpawnAt>=REFLEX_DELAY){
   misses++;combo=0;spawn(now);
  }
  updateStats();
 }
 function start(){
  stopClock();
  hits=0;misses=0;combo=0;maxCombo=0;reactionSum=0;reactionCount=0;
  leftMs=durationMs;state='playing';
  overlay.hidden=true;target.hidden=false;
  const now=performance.now();
  lastTick=now;spawn(now);
  render();
  interval=setInterval(tick,100);
  target.focus({preventScroll:true});
 }
 function pause(){
  if(state!=='playing')return;
  tick();
  if(state!=='playing')return;
  stopClock();state='paused';target.hidden=true;
  render();pauseBtn.focus({preventScroll:true});
 }
 function resume(){
  if(state!=='paused')return;
  state='playing';target.hidden=false;
  const now=performance.now();
  lastTick=now;spawn(now);
  render();interval=setInterval(tick,100);
  target.focus({preventScroll:true});
 }
 function finish(){
  if(state!=='playing')return;
  stopClock();state='finished';leftMs=0;target.hidden=true;
  const setup=mode+':'+durationMs;
  bestBySetup[setup]=Math.max(bestBySetup[setup]||0,hits);
  render();startBtn.focus({preventScroll:true});
 }
 function hit(event){
  if(state!=='playing')return;
  event.stopPropagation();tick();
  if(state!=='playing')return;
  const reaction=Math.max(0,performance.now()-lastSpawnAt);
  if(Number.isFinite(reaction)){reactionSum+=reaction;reactionCount++;}
  hits++;combo++;maxCombo=Math.max(maxCombo,combo);
  impact('ar12-impact',target.offsetLeft+target.offsetWidth/2,target.offsetTop+target.offsetHeight/2);
  spawn();updateStats();
  if(!reduced.matches){
   hitsNode.classList.remove('ar12-hit-pop');
   void hitsNode.offsetWidth;hitsNode.classList.add('ar12-hit-pop');
  }
 }
 function resetReady(){
  stopClock();state='idle';target.hidden=true;
  hits=0;misses=0;combo=0;maxCombo=0;reactionSum=0;reactionCount=0;
  leftMs=durationMs;render();
 }
 for(const button of modeBtns){
  button.addEventListener('click',()=>{
   if(state==='playing'||state==='paused')return;
   mode=button.dataset.ar11Mode==='reflex'?'reflex':'precision';
   resetReady();
  });
 }
 for(const button of durationBtns){
  button.addEventListener('click',()=>{
   if(state==='playing'||state==='paused')return;
   const d=Number(button.dataset.ar12Duration);
   if(![15000,20000,30000].includes(d))return;
   durationMs=d;resetReady();
  });
 }
 startBtn.addEventListener('click',start);
 pauseBtn.addEventListener('click',()=>state==='paused'?resume():pause());
 target.addEventListener('click',hit);
 field.addEventListener('click',event=>{
  if(state!=='playing'||target.contains(event.target))return;
  tick();
  if(state!=='playing')return;
  misses++;combo=0;
  if(event.clientX&&event.clientY){
   const rect=field.getBoundingClientRect();
   impact('ar12-miss-ring',event.clientX-rect.left,event.clientY-rect.top);
  }
  updateStats();
 });
 document.addEventListener('keydown',event=>{
  if(state!=='playing'&&state!=='paused')return;
  if(!game.contains(document.activeElement))return;
  if(event.target?.matches?.('input,textarea,select,[contenteditable="true"]'))return;
  if(event.key==='Escape'||event.key.toLowerCase()==='p'){
   event.preventDefault();if(state==='paused')resume();else pause();
  }
 });
 if(copyBtn)copyBtn.addEventListener('click',async()=>{
  if(state!=='finished')return;
  const result=translate(
   'AimRoutine Tracker — Défi AIM : '+hits+' cibles, '+accuracyNode.textContent+' de précision en '+durationMs/1000+' s ('+mode+').',
   'AimRoutine Tracker — AIM Challenge: '+hits+' hits, '+accuracyNode.textContent+' accuracy in '+durationMs/1000+' s ('+mode+').');
  try{
   if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
   await navigator.clipboard.writeText(result);
   copyBtn.textContent=translate('Score copié ✓','Score copied ✓');
  }catch{
   copyBtn.textContent=translate('Copie indisponible','Copy unavailable');
  }
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&state==='playing')pause();
 });
 window.addEventListener('pagehide',stopClock);
 for(const button of document.querySelectorAll('[data-switch-lang]')){
  button.addEventListener('click',()=>queueMicrotask(render));
 }
 render();
})();