/* Offline-first static files for personal local AIM training. Never cache player data or Riot APIs. */
const CACHE='aimroutine-v6-offline-20261106';
const BASE=new URL(self.registration.scope);
const OFFLINE=[
 './','./index.html','./training.html','./product.html','./releases.html',
 './training.css','./training-v5.css','./training-v6.css',
 './training-v5.js','./training-v6.js','./training-core-v5.mjs','./training-v6-core.mjs',
 './site-global-v31.css','./site-shared-v5.css','./site-quality-v34.js','./site.js',
 './favicon.svg','./manifest.webmanifest','./aimroutine-logo.png'
].map(x=>new URL(x,BASE).toString());
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
   const results=await Promise.allSettled(OFFLINE.map(url=>cache.add(url)));
   const failed=results.filter(x=>x.status==='rejected');
   if(failed.length)console.warn('Some offline assets could not be cached:',failed.length);
 }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith('aimroutine-v')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return; // External Riot imagery must not be cached.
 if(url.pathname.endsWith('/riot.txt'))return;
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
   return response;
  }).catch(async()=>{
   const cached=await caches.match(event.request,{ignoreSearch:true});
   return cached||await caches.match(new URL('./training.html',BASE).toString())||Response.error();
  }));
  return;
 }
 event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>{
  if(cached)return cached;
  return fetch(event.request).then(response=>{
   if(response.ok&&url.pathname.startsWith(BASE.pathname)){
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));
   }
   return response;
  });
 }));
});
