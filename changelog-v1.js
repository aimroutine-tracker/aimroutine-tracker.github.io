(function(){'use strict';
 const chapters=[...document.querySelectorAll('.ar-note-chapter')];
 document.getElementById('expand-changelog')?.addEventListener('click',()=>chapters.forEach(c=>{c.open=true}));
 document.getElementById('collapse-changelog')?.addEventListener('click',()=>chapters.forEach(c=>{c.open=false}));
 function jump(){const id=decodeURIComponent(location.hash.replace(/^#/,''));
  if(!id)return;const node=document.getElementById(id);
  if(node&&node.matches('.ar-note-chapter'))node.open=true;
 }
 window.addEventListener('hashchange',jump);jump();
 document.querySelectorAll('.ar-note-toc a').forEach(link=>link.addEventListener('click',()=>{
  const id=link.getAttribute('href').slice(1);const node=document.getElementById(id);
  if(node)node.open=true;
 }));
})();