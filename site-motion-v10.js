/* AimRoutine motion v10. Cosmetic, progressive enhancements only.
   No network requests, storage access, authentication, or tracking. */
(()=>{
  'use strict';
  if(!document.body.classList.contains('site31'))return;

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');

  /* A tiny, passive reading progress indicator shared by all site pages. */
  const progress=document.createElement('div');
  progress.className='ar10-scroll-progress';
  progress.setAttribute('aria-hidden','true');
  const progressBar=document.createElement('span');
  progressBar.className='ar10-scroll-progress__bar';
  progress.append(progressBar);
  document.body.append(progress);
  let progressPending=false;
  function drawProgress(){
    progressPending=false;
    const root=document.documentElement;
    const max=Math.max(0,root.scrollHeight-window.innerHeight);
    const ratio=max>0?Math.max(0,Math.min(1,window.scrollY/max)):0;
    progressBar.style.transform='scaleX('+ratio.toFixed(4)+')';
  }
  function updateProgress(){
    if(progressPending)return;
    progressPending=true;
    requestAnimationFrame(drawProgress);
  }
  window.addEventListener('scroll',updateProgress,{passive:true});
  window.addEventListener('resize',updateProgress,{passive:true});
  window.addEventListener('pageshow',updateProgress);
  updateProgress();

  /* Reveal only static sections that begin below the viewport. */
  if(!reduceMotion.matches&&'IntersectionObserver' in window){
    const targets=[...document.querySelectorAll([
      '.site31-home .v5-main>section',
      '.site31-product main>section',
      '.site31-overview main>section',
      '.site31-riot main>section',
      '.site31-releases main>section',
      '.site31-updates main>section',
      '.site31-legal main>section',
      '.site31-changelog main>section',
      '.site31-account .ar7-account-hero',
      '.site31-training .ar5-hero'
    ].join(','))];
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        entry.target.classList.add('ar10-revealed');
        observer.unobserve(entry.target);
      }
    },{rootMargin:'0px 0px 55px 0px',threshold:0.01});
    for(const element of targets){
      const rect=element.getBoundingClientRect();
      if(rect.top<window.innerHeight+40||rect.bottom<0)continue;
      element.classList.add('ar10-reveal');
      observer.observe(element);
    }
    function revealAll(){
      if(!reduceMotion.matches)return;
      for(const element of targets){
        element.classList.remove('ar10-reveal');
        element.classList.add('ar10-revealed');
      }
      observer.disconnect();
    }
    reduceMotion.addEventListener?.('change',revealAll);
    window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  }

  /* Cursor glow is decorative only, never covers links or keyboard focus. */
  if(finePointer.matches&&!reduceMotion.matches){
    for(const card of document.querySelectorAll('.site31-home .ar9-path-card')){
      let frame=0;
      card.addEventListener('pointermove',event=>{
        if(frame)return;
        frame=requestAnimationFrame(()=>{
          frame=0;
          const rect=card.getBoundingClientRect();
          card.style.setProperty('--ar10-glow-x',(event.clientX-rect.left)+'px');
          card.style.setProperty('--ar10-glow-y',(event.clientY-rect.top)+'px');
        });
      },{passive:true});
    }
  }

  /* A working 3-stage product demo, without simulated user performance. */
  const demo=document.querySelector('[data-ar10-demo]');
  if(!demo)return;
  const tabs=[...demo.querySelectorAll('[data-ar10-step]')];
  const panels=[...demo.querySelectorAll('[data-ar10-panel]')];
  const dots=[...demo.querySelectorAll('[data-ar10-dot]')];
  const count=demo.querySelector('[data-ar10-count]');
  if(tabs.length!==3||panels.length!==3)return;

  function activate(index,focus=false){
    if(index<0||index>=tabs.length)return;
    for(let i=0;i<tabs.length;i++){
      const selected=i===index;
      tabs[i].setAttribute('aria-selected',String(selected));
      tabs[i].tabIndex=selected?0:-1;
      panels[i].hidden=!selected;
      if(dots[i])dots[i].classList.toggle('ar10-active',selected);
    }
    if(count)count.textContent=String(index+1).padStart(2,'0')+' / 03';
    if(focus)tabs[index].focus();
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>activate(index));
    tab.addEventListener('keydown',event=>{
      let destination=null;
      if(event.key==='ArrowRight')destination=(index+1)%tabs.length;
      else if(event.key==='ArrowLeft')destination=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home')destination=0;
      else if(event.key==='End')destination=tabs.length-1;
      if(destination===null)return;
      event.preventDefault();
      activate(destination,true);
    });
  });
  activate(0);
})();