(function(){
  function setLang(v){
    document.documentElement.lang=v;
    try { localStorage.setItem('aimroutine_site_lang',v); } catch(e) {}
    document.querySelectorAll('[data-switch-lang]').forEach(b=>{
       b.setAttribute('aria-label',v==='en'?'Switch to French':'Passer en anglais');
       b.textContent=v==='en'?'FR':'EN';
    });
  }
  // Honor the saved choice; otherwise use the visitor's browser language.
  let preferred = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  try { preferred = localStorage.getItem('aimroutine_site_lang') || preferred; } catch(e) {}
  setLang(preferred==='fr'?'fr':'en');
  document.querySelectorAll('[data-switch-lang]').forEach(b=>b.addEventListener('click',()=>setLang(document.documentElement.lang==='en'?'fr':'en')));
})();