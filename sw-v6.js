/* AimRoutine offline shell — V7 cache refresh fix.
   All same-origin static assets are network-first to stop stale CSS from persisting
   across deployments. Offline fallback still supports AIM sessions stored locally. */
const CACHE='aimroutine-v7-network-first-20261106b';
const BASE=new URL(self.registration.scope);
const OFFLINE=[
 './','./index.html','./training.html','./account.html','./product.html','./releases.html',
 './training.css','./training-v5.css','./training-v6.css','./account-v7.css',
 './training-v5.js','./training-v6.js','./training-core-v5.mjs','./training-v6-core.mjs',
 './training-entry-v7.mjs','./cloud-core-v7.mjs','./cloud-sync-v7.mjs',
 './site-global-v31.css','./site-shared-v5.css','./site-quality-v34.js','./site.js',
 './favicon.svg','./manifest.webmanifest','./aimroutine-logo.png'
].map(x=>new URL(x,BASE).toString());

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const results=await Promise.allSettled(OFFLINE.map(url=>cache.add(url)));
  const failed=results.filter(x=>x.status==='rejected');
  if(failed.length)console.warn('Some offline assets could not be precached',failed.length);
 }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(
  keys.filter(x=>x.startsWith('aimroutine-v')&&x!==CACHE).map(x=>caches.delete(x))
 )).then(()=>self.clients.claim()));
});
async function cacheOnline(request,response){
 if(response.ok&&response.type==='basic'){
  try{const cache=await caches.open(CACHE);await cache.put(request,response.clone())}
  catch(e){console.warn('Optional offline cache write failed',e)}
 }
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE.pathname))return;
 if(url.pathname.endsWith('/riot.txt'))return;
 event.respondWith((async()=>{
  // Network-first on all HTML, CSS, JS and asset requests to honor new version URLs.
  try{
   const response=await fetch(request);
   await cacheOnline(request,response);
   return response;
  }catch(error){
   const cache=await caches.open(CACHE);
   // Exact URL first. Only on a genuine network failure allow an old query version.
   const fallback=await cache.match(request)||
     await cache.match(request,{ignoreSearch:true});
   if(fallback)return fallback;
   if(request.mode==='navigate'){
    return await cache.match(new URL('./training.html',BASE).toString())||Response.error();
   }
   return Response.error();
  }
 })());
});
