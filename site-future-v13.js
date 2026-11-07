/* AimRoutine v13: harmless decorative HUD + pointer-light enhancements.
   No network access, no storage, and no application state changes. */
(()=>{
 'use strict';
 if(!document.body.classList.contains('site31'))return;
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 const pointer=window.matchMedia('(hover: hover) and (pointer: fine)');
 const main=document.querySelector('main');
 if(!main)return;
 const hero=main.querySelector([
  '.v5-hero','.show-hero','.ar5-hero','.ar7-account-hero',
  '.ar-note-hero','.updates33-hero','.ar5-release-hero',
  '.detail-hero','.riot32-hero','.legal'
 ].join(','))||(
  document.body.classList.contains('site31-error')?main:null
 );
 if(hero){
  hero.classList.add('ar13-tactical-frame');
  const frame=document.createElement('span');
  frame.className='ar13-frame-corners';
  frame.setAttribute('aria-hidden','true');
  for(let i=0;i<4;i++)frame.append(document.createElement('i'));
  hero.append(frame);
 }
 if(reduce.matches||!pointer.matches)return;
 const cards=main.querySelectorAll([
  '.ar9-path-card','.ar5-release-card','.v5-feature',
  '.show-features article','.ar7-service-grid>div'
 ].join(','));
 cards.forEach(card=>{
  if(card.classList.contains('ar13-spotlight-card'))return;
  card.classList.add('ar13-spotlight-card');
  const glow=document.createElement('span');
  glow.className='ar13-spotlight-glow';
  glow.setAttribute('aria-hidden','true');
  card.append(glow);
  let frame=0;
  let x=0,y=0;
  card.addEventListener('pointermove',event=>{
   const bounds=card.getBoundingClientRect();
   x=event.clientX-bounds.left;
   y=event.clientY-bounds.top;
   if(frame)return;
   frame=requestAnimationFrame(()=>{
    frame=0;
    card.style.setProperty('--ar13-x',x+'px');
    card.style.setProperty('--ar13-y',y+'px');
   });
  },{passive:true});
 });
})();
