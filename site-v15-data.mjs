/* Homepage V15 real figures. Guest data is local; account data is only read after auth verification. */
import {STORAGE_KEY,normalizeStore,computeStats} from './training-core-v5.mjs';
import {validUid,scopedKey} from './cloud-core-v7.mjs';
import {isEnabled,synchronize} from './cloud-sync-v7.mjs';
const set=(name,value)=>{document.querySelectorAll('[data-v15-stat="'+name+'"]').forEach(node=>{node.textContent=value})};
const en=()=>document.documentElement.lang==='en';
const format=n=>Number(n).toLocaleString(en()?'en-GB':'fr-FR',{maximumFractionDigits:1});
const choose=(fr,english)=>en()?english:fr;
const AUTH_KEY='sb-lmzswtzboobpokumxzhy-auth-token';
// Never share a Cloud refresh timer or error state between account identities.
const cloudReads=new Map();
let activeCloudUid=null,renderGeneration=0;
async function refreshCloud(client,uid){
 const previous=cloudReads.get(uid);
 const changedAccount=activeCloudUid!==uid;
 activeCloudUid=uid;
 if(!changedAccount&&previous&&Date.now()-previous.startedAt<30000){
  await previous.promise;
  return;
 }
 const status={startedAt:Date.now(),error:false,promise:null};
 // A slow request from an old account updates only its own status, not
 // the newly active account's badge.
 status.promise=Promise.resolve().then(()=>synchronize(client,uid))
  .then(()=>{status.error=false},()=>{status.error=true});
 cloudReads.set(uid,status);
 await status.promise;
}
const readToken=()=>{try{return localStorage.getItem(AUTH_KEY)}catch{return null}};
function hidePrivateStats(){
 activeCloudUid=null;
 cloudReads.clear();
 for(const name of ['sessions','accuracy','week'])set(name,'—');
 set('cloud',choose('CONNEXION REQUISE','SIGN IN'));
}
async function render(){
 const generation=++renderGeneration;
 const startingToken=readToken();
 let key=STORAGE_KEY,allow=false,uid=null;
 try{
  if(startingToken){
   allow=false;
   const {supabase}=await import('./cloud-client-v7.mjs');
   const {data,error}=await supabase.auth.getSession();
   if(!error&&validUid(data?.session?.user?.id)){
    const checked=await supabase.auth.getUser();
    if(!checked.error&&checked.data?.user?.id===data.session.user.id){
     uid=data.session.user.id;key=scopedKey(STORAGE_KEY,uid);allow=true;
     await refreshCloud(supabase,uid);
    }
   }
  }
 }catch{allow=false}
 // Never render user data from a cloud request that finished after logout or
 // an account switch in another browser tab.
 if(generation!==renderGeneration||startingToken!==readToken())return;
 if(!allow){hidePrivateStats();return}
 let store;
 try{store=normalizeStore(JSON.parse(localStorage.getItem(key)||'null'),null)}
 catch{store=normalizeStore(null,null)}
 const stat=computeStats(store.sessions,store.weeklyGoal);
 set('sessions',format(stat.count));
 set('accuracy',stat.avg===null?'—':format(stat.avg)+' %');
 set('week',stat.week+' / '+stat.goal);
 set('cloud',uid?(cloudReads.get(uid)?.error?choose('EN ATTENTE','PENDING'):isEnabled(uid)?choose('AUTOMATIQUE','AUTOMATIC'):choose('NON DISPONIBLE','UNAVAILABLE')):choose('CONNEXION REQUISE','SIGN IN'));
}
document.querySelectorAll('[data-switch-lang]').forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(()=>void render())));
window.addEventListener('storage',e=>{
 // storage.clear() from another tab has a null key, and must hide account KPIs.
 if(e.key===null||e.key===AUTH_KEY){
  ++renderGeneration;
  hidePrivateStats();
  if(e.newValue)void render();
 }else if(e.key?.includes(STORAGE_KEY))void render();
});
window.addEventListener('online',()=>void render());
window.addEventListener('focus',()=>void render());
// A different device cannot dispatch a storage event in this browser.
// Refresh an active dashboard periodically without polling guests/hidden tabs.
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void render()});
setInterval(()=>{if(!document.hidden&&navigator.onLine&&readToken())void render()},45000);
void render();