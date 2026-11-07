/* AimRoutine V11 mini AIM challenge — original client-side game.
   No APIs, account access, persistent storage, or third-party dependencies. */
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
 const hitsNode=game.querySelector('[data-ar11-hits]');
 const missesNode=game.querySelector('[data-ar11-misses]');
 const accuracyNode=game.querySelector('[data-ar11-accuracy]');
 const timeNode=game.querySelector('[data-ar11-time]');
 const progress=game.querySelector('[data-ar11-progress]');
 const progressBar=game.querySelector('[data-ar11-progress-bar]');
 const status=game.querySelector('[data-ar11-status]');
 if(!field||!target||!overlay||!startBtn||!pauseBtn||modeBtns.length!==2)return;

 const DURATION=20000;
 const REFLEX_DELAY=1050;
 const phrases={
  idle:{
   title:['Prêt pour le défi ?','Ready for the challenge?'],
   copy:['Sélectionne un mode, puis démarre pour faire apparaître les cibles.',
         'Choose a mode, then start to reveal the targets.'],
   status:['Tes résultats apparaîtront ici après le défi.',
           'Your results will appear here after the challenge.']
  },
  playing:{
   status:['Cible les cercles roses. Les clics dans le vide comptent comme des ratés.',
           'Aim for pink targets. Empty clicks count as misses.']
  },
  paused:{
   title:['Partie en pause','Game paused'],
   copy:['Reprends quand tu es prêt : le chronomètre est arrêté.',
         'Resume whenever you are ready: the clock is stopped.'],
   status:['En pause — ton score reste affiché.',
           'Paused — your current score is still visible.']
  },
  finished:{
   title:['Défi terminé !','Challenge complete!'],
   copy:['Relance une partie pour tenter d’améliorer ton résultat.',
         'Play again to try to improve your result.']
  }
 };
 let state='idle',mode='precision',hits=0,misses=0;
 let leftMs=DURATION,lastTick=0,lastSpawnAt=0,interval=null;
 const isFrench=()=>document.documentElement.lang!=='en';
 const translate=(fr,en)=>isFrench()?fr:en;

 function stopClock(){if(interval!==null){clearInterval(interval);interval=null;}}
 function updateStats(){
  hitsNode.textContent=String(hits);
  missesNode.textContent=String(misses);
  accuracyNode.textContent=hits+misses>0?Math.round(hits/(hits+misses)*100)+'%':'—';
  const seconds=Math.max(0,Math.ceil(leftMs/1000));
  timeNode.textContent=String(seconds);
  progress.setAttribute('aria-valuenow',String(seconds));
  progressBar.style.transform='scaleX('+Math.max(0,leftMs/DURATION).toFixed(4)+')';
 }
 function setOverlay(){
  if(state==='playing'){overlay.hidden=true;return;}
  overlay.hidden=false;
  overlayTitle.textContent=translate(...phrases[state].title);
  overlayCopy.textContent=translate(...phrases[state].copy);
 }
 function setButtons(){
  const gameActive=state==='playing'||state==='paused';
  for(const button of modeBtns){
   button.disabled=gameActive;
   button.setAttribute('aria-pressed',String(button.dataset.ar11Mode===mode));
  }
  startBtn.textContent=translate(state==='idle'?'Démarrer le défi':'Recommencer',
    state==='idle'?'Start challenge':'Restart');
  pauseBtn.hidden=!gameActive;
  pauseBtn.textContent=translate(state==='paused'?'Reprendre':'Pause',
    state==='paused'?'Resume':'Pause');
  target.setAttribute('aria-label',translate('Toucher la cible','Hit target'));
  game.dataset.state=state;
  game.dataset.mode=mode;
 }
 function setStatus(){
  if(state==='finished'){
   status.textContent=translate(
    'Résultat : '+hits+' cibles touchées, '+misses+' ratés, '+accuracyNode.textContent+' de précision.',
    'Result: '+hits+' targets hit, '+misses+' misses, '+accuracyNode.textContent+' accuracy.'
   );
  }else status.textContent=translate(...phrases[state].status);
 }
 function render(){setButtons();setOverlay();updateStats();setStatus();}
 function spawn(now=performance.now()){
  const size=target.offsetWidth||(mode==='reflex'?68:49);
  const margin=18;
  const maxX=Math.max(0,field.clientWidth-size-margin*2);
  const maxY=Math.max(0,field.clientHeight-size-margin*2);
  target.style.left=(margin+Math.round(Math.random()*maxX))+'px';
  target.style.top=(margin+Math.round(Math.random()*maxY))+'px';
  lastSpawnAt=now;
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   target.style.animation='none';
   void target.offsetWidth;
   target.style.animation='';
  }
 }
 function tick(){
  if(state!=='playing')return;
  const now=performance.now();
  leftMs=Math.max(0,leftMs-Math.max(0,now-lastTick));
  lastTick=now;
  if(leftMs===0){finish();return;}
  if(mode==='reflex'&&now-lastSpawnAt>=REFLEX_DELAY){
   misses++;spawn(now);
  }
  updateStats();
 }
 function start(){
  stopClock();
  hits=0;misses=0;leftMs=DURATION;
  state='playing';
  overlay.hidden=true;target.hidden=false;
  const now=performance.now();
  lastTick=now;
  spawn(now);
  render();
  interval=setInterval(tick,100);
  target.focus({preventScroll:true});
 }
 function pause(){
  if(state!=='playing')return;
  tick();
  if(state!=='playing')return;
  stopClock();state='paused';target.hidden=true;
  render();
  pauseBtn.focus({preventScroll:true});
 }
 function resume(){
  if(state!=='paused')return;
  state='playing';target.hidden=false;
  const now=performance.now();
  lastTick=now;lastSpawnAt=now;
  spawn(now);
  render();
  interval=setInterval(tick,100);
  target.focus({preventScroll:true});
 }
 function finish(){
  if(state!=='playing')return;
  stopClock();state='finished';leftMs=0;target.hidden=true;
  render();
  startBtn.focus({preventScroll:true});
 }
 function hit(event){
  if(state!=='playing')return;
  event.stopPropagation();
  tick();
  if(state!=='playing')return;
  hits++;
  spawn();
  updateStats();
 }
 for(const button of modeBtns){
  button.addEventListener('click',()=>{
   if(state==='playing'||state==='paused')return;
   mode=button.dataset.ar11Mode==='reflex'?'reflex':'precision';
   render();
  });
 }
 startBtn.addEventListener('click',start);
 pauseBtn.addEventListener('click',()=>state==='paused'?resume():pause());
 target.addEventListener('click',hit);
 field.addEventListener('click',event=>{
  if(state!=='playing'||target.contains(event.target))return;
  tick();
  if(state!=='playing')return;
  misses++;updateStats();
 });
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&state==='playing')pause();
 });
 window.addEventListener('pagehide',stopClock);
 for(const langButton of document.querySelectorAll('[data-switch-lang]')){
  langButton.addEventListener('click',()=>queueMicrotask(render));
 }
 render();
})();