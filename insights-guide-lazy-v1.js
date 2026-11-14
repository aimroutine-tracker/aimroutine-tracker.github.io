/* Delay the optional, demo-only dashboard guide until its section is near.
 * Home hero and above-the-fold content stay identical; no user/cloud data.
 * The actual guide script is unchanged and still initializes all its controls.
 */
(()=>{
 'use strict';
 let started=false;
 const load=()=>{
  if(started)return;
  started=true;
  const script=document.createElement('script');
  script.src='insights-guide.js?v=2';
  script.async=true;
  document.head.append(script);
 };
 const init=()=>{
  const root=document.getElementById('insights');
  if(!root)return;
  if(!('IntersectionObserver' in window)){load();return;}
  if(location.hash==='#insights'){load();return;}
  const observer=new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){
    observer.disconnect();
    load();
   }
  },{rootMargin:'1400px 0px',threshold:0});
  observer.observe(root);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
