/* AimRoutine: account-only persistence with automatic Cloud synchronization.
   Guest mode is a read-only training preview; old guest data is kept for import. */
import {UID_STORAGE_KEY,validUid} from './cloud-core-v7.mjs';
import {synchronize,isEnabled} from './cloud-sync-v7.mjs';

const status=document.getElementById('cloud-training-status');
const authStorage='sb-lmzswtzboobpokumxzhy-auth-token';
let api=null,uid=null,syncing=false,queued=false;
let currentNotice={fr:'',en:''};
const updateNoticeLanguage=()=>{
 if(status)status.textContent=document.documentElement.lang==='en'?currentNotice.en:currentNotice.fr;
};
const report=(fr,english=fr)=>{
 currentNotice={fr,en:english};
 updateNoticeLanguage();
};
// The same verified status must remain accurate after an instant FR/EN switch.
document.querySelectorAll('[data-switch-lang]').forEach(button=>
 button.addEventListener('click',()=>queueMicrotask(updateNoticeLanguage)));
window.addEventListener('aim-v3-locale-changed',updateNoticeLanguage);
try{
 if(localStorage.getItem(authStorage)){
  api=await import('./cloud-client-v7.mjs');
  const session=await api.supabase.auth.getSession();
  const candidate=session.data?.session?.user?.id;
  if(!session.error&&validUid(candidate)){
   // Never grant access to an account namespace from an unverified cache.
   const {data,error}=await api.supabase.auth.getUser();
   if(!error&&data?.user?.id===candidate){
    uid=candidate;
    window.__aimCloudUserId=uid;
    localStorage.setItem(UID_STORAGE_KEY,uid);
    report('Compte connecté · Récupération cloud automatique…','Signed in · Restoring your Cloud progress…');
    try{await synchronize(api.supabase,uid);report('Cloud automatique : progression à jour ✓','Automatic Cloud: progress is up to date ✓')}
    catch(e){report('Cloud indisponible · Tes données de compte restent en cache et seront synchronisées : '+e.message,'Cloud unavailable · Your account data is cached and will sync later: '+e.message)}
   }
  }
 }
}catch(e){report('Connexion non vérifiée · Aucune nouvelle sauvegarde : '+e.message,'Sign-in not verified · No new data is saved: '+e.message)}
if(!uid){
 document.body.classList.add('ar-guest-preview');
 document.getElementById('ar-account-required')?.removeAttribute('hidden');
 window.__aimCloudUserId=null;
 localStorage.removeItem(UID_STORAGE_KEY);
 report('Mode aperçu sans sauvegarde · Connecte-toi pour enregistrer tes résultats.','Preview only · Sign in to save your training results.');
}

await import('./training-v5.js?v=3');
await import('./training-v6.js?v=2');

async function syncChanges(){
 const requestedUid=uid,requestedApi=api;
 if(!requestedUid||!requestedApi||!isEnabled(requestedUid))return;
 if(syncing){queued=true;return}
 syncing=true;
 report('Synchronisation automatique de la progression…','Automatically syncing your training progress…');
 try{
  const before=JSON.stringify(window.AIMWeb?.getStore?.()||{});
  await synchronize(requestedApi.supabase,requestedUid);
  if(uid!==requestedUid)return; // Never repaint data after another tab signs out.
  const afterRaw=localStorage.getItem('aimroutine_cloud_user_'+requestedUid+'_aimroutine_web_training_v2');
  const after=JSON.stringify(JSON.parse(afterRaw||'{}'));
  if(before!==after){
   window.AIMWeb?.reloadFromCache?.();
   window.dispatchEvent(new CustomEvent('aim-sync-applied'));
  }
  report('Cloud automatique : progression à jour ✓','Automatic Cloud: progress is up to date ✓');
 }catch(e){if(uid===requestedUid)report('Sauvegarde cloud en attente · Données locales du compte conservées : '+e.message,'Cloud save pending · Local account data has been retained: '+e.message)}
 finally{
  syncing=false;
  if(uid!==requestedUid)queued=false;
  else if(queued){queued=false;setTimeout(syncChanges,400)}
 }
}
let debounce;
function schedule(){if(!uid||!api)return;clearTimeout(debounce);debounce=setTimeout(syncChanges,1100)}
window.addEventListener('aim-store-updated',schedule);
window.addEventListener('aim-cloud-data-changed',schedule);
window.addEventListener('online',schedule);
window.addEventListener('focus',schedule);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
// An access-token refresh for the same verified user is not a logout.
// React immediately when another tab signs out or switches accounts.
const tokenOwner=raw=>{
 try{const value=JSON.parse(raw);return validUid(value?.user?.id)?value.user.id:null}
 catch{return null}
};
window.addEventListener('storage',e=>{
 if(e.key===authStorage){
  const nextOwner=tokenOwner(e.newValue);
  if(!e.newValue||nextOwner!==uid){
   clearTimeout(debounce);
   queued=false;uid=null;api=null;
   window.__aimCloudUserId=null;
   document.body.classList.add('ar-guest-preview');
   document.getElementById('ar-account-required')?.removeAttribute('hidden');
   report('Session modifiée · Vérification du compte en cours…','Session changed · Verifying your account…');
   location.reload();
  }
  return;
 }
 if(e.key===UID_STORAGE_KEY&&e.newValue!==uid)location.reload();
 else if(uid&&e.key?.startsWith('aimroutine_cloud_user_'+uid+'_'))schedule();
});
setInterval(()=>{if(!document.hidden&&navigator.onLine)schedule()},45000);
