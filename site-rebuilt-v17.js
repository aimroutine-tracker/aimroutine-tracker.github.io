/* V17 design interactions. All persistence, authentication, routine generation
   and analytics remain owned by existing tested application modules. */
(()=>{
'use strict';
const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
const bilingual=()=>document.documentElement.lang==='en';
const say=(fr,en)=>bilingual()?en:fr;
function training(){
 if(!document.body.classList.contains('site31-training'))return;
 const activeDay=$('[data-v17-day-label]');
 const levelName=$('.ar17-plan-sublevel');
 const tierLabels={
  iron:['Débutant','Beginner'],
  silver:['Intermédiaire','Intermediate'],
  immortal:['Compétitif','Competitive']
 };
 const levelButtons=$$('[data-v14-level]');
 const dayButtons=$$('[data-v15-day]');
 function refresh(){
  const selected=levelButtons.find(btn=>btn.getAttribute('aria-pressed')==='true');
  if(levelName)levelName.textContent='— '+say(...(tierLabels[selected?.dataset.v14Level]||tierLabels.silver));
  const day=dayButtons.find(btn=>btn.getAttribute('aria-pressed')==='true');
  if(activeDay)activeDay.textContent=String(day?.dataset.v15Day||1).padStart(2,'0');
 }
 [...levelButtons,...dayButtons].forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(refresh)));
 $$('[data-switch-lang]').forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(refresh)));
 const watch=$('.ar17-training-grid');
 if(watch){
  const observer=new MutationObserver(records=>{
   if(records.some(record=>record.attributeName==='aria-pressed'))refresh();
  });
  observer.observe(watch,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});
 }
 refresh();
}
function progress(){
 const value=$('#v14-p-streak'),mirror=$('#ar17-streak-mirror');
 if(!value||!mirror)return;
 const refresh=()=>{mirror.textContent=value.textContent.trim()||'—'};
 new MutationObserver(refresh).observe(value,{childList:true,subtree:true,characterData:true});
 refresh();
}
function anchorHandoff(){
 // Preserve hash links to training tabs even when a route is opened fresh.
 if(!document.body.classList.contains('site31-training'))return;
 window.addEventListener('hashchange',()=>{
  const key=location.hash.match(/^#panel-(dashboard|builder|program|insights|challenges|coach|profile|data)$/)?.[1];
  if(key)$('[data-tab="'+key+'"]')?.click();
 });
}
function start(){training();progress();anchorHandoff();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();