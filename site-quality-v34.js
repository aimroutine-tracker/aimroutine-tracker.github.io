/* Small shared enhancements; no APIs, account state or tracking. */
(function(){
  'use strict';
  const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  // Make only the actual page active, in desktop and mobile navigation.
  document.querySelectorAll('.site31-header a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));
  document.querySelectorAll('.site31-header a[href]').forEach(a=>{
    const target=a.getAttribute('href').split('#')[0].split('?')[0].toLowerCase();
    if(target===current && !a.classList.contains('site31-brand')) a.setAttribute('aria-current','page');
  });
  // Support direct fragment links on long pages without hiding the section beneath the sticky header.
  const top=document.createElement('button');
  top.type='button'; top.className='site34-top'; top.hidden=true;
  top.innerHTML='<span aria-hidden="true">↑</span>';
  function setLabel(){top.setAttribute('aria-label',document.documentElement.lang==='fr'?'Retour en haut de page':'Back to top');top.title=top.getAttribute('aria-label');}
  setLabel();
  top.addEventListener('click',()=>{
    window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  document.body.appendChild(top);
  let queued=false;
  function update(){
    queued=false;
    top.hidden=window.scrollY<Math.max(450,window.innerHeight*.65);
  }
  window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update);}}, {passive:true});
  document.querySelectorAll('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>queueMicrotask(setLabel)));
  window.addEventListener('pageshow',update);
  update();
})();
