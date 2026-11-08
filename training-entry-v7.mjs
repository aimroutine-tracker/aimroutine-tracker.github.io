/* AimRoutine: account-only persistence with automatic Cloud synchronization.
   Guest mode is a read-only training preview; old guest data is kept for import. */
import {UID_STORAGE_KEY,validUid} from './cloud-core-v7.mjs';
import {synchronize,isEnabled} from './cloud-sync-v7.mjs';

const status=document.getElementById('cloud-training-status');
const authStorage='sb-lmzswtzboobpokumxzhy-auth-token';
let api=null,uid=null,syncing=false,queued=false;
const report=message=>{if(status)status.textContent=message};
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
    report('Compte connecté · Récupération cloud automatique…');
    try{await synchronize(api.supabase,uid);report('Cloud automatique : progression à jour ✓')}
    catch(e){report('Cloud indisponible · Tes données de compte restent en cache et seront synchronisées : '+e.message)}
   }
  }
 }
}catch(e){report('Connexion non vérifiée · Aucune nouvelle sauvegarde : '+e.message)}
if(!uid){
 document.body.classList.add('ar-guest-preview');
 document.getElementById('ar-account-required')?.removeAttribute('hidden');
 window.__aimCloudUserId=null;
 localStorage.removeItem(UID_STORAGE_KEY);
 report('Mode aperçu sans sauvegarde · Connecte-toi pour enregistrer tes résultats.');
}

await import('./training-v5.js?v=3');
await import('./training-v6.js?v=2');

async function syncChanges(){
 if(!uid||!api||!isEnabled(uid))return;
 if(syncing){queued=true;return}
 syncing=true;
 report('Synchronisation automatique de la progression…');
 try{
  const before=JSON.stringify(window.AIMWeb?.getStore?.()||{});
  await synchronize(api.supabase,uid);
  const afterRaw=localStorage.getItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2');
  const after=JSON.stringify(JSON.parse(afterRaw||'{}'));
  if(before!==after){
   window.AIMWeb?.reloadFromCache?.();
   window.dispatchEvent(new CustomEvent('aim-sync-applied'));
  }
  report('Cloud automatique : progression à jour ✓');
 }catch(e){report('Sauvegarde cloud en attente · Données locales du compte conservées : '+e.message)}
 finally{
  syncing=false;
  if(queued){queued=false;setTimeout(syncChanges,400)}
 }
}
let debounce;
function schedule(){if(!uid||!api)return;clearTimeout(debounce);debounce=setTimeout(syncChanges,1100)}
window.addEventListener('aim-store-updated',schedule);
window.addEventListener('aim-cloud-data-changed',schedule);
window.addEventListener('online',schedule);
window.addEventListener('focus',schedule);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
window.addEventListener('storage',e=>{
 if(e.key===UID_STORAGE_KEY&&e.newValue!==uid)location.reload();
 else if(uid&&e.key?.startsWith('aimroutine_cloud_user_'+uid+'_'))schedule();
});
setInterval(()=>{if(!document.hidden&&navigator.onLine)schedule()},45000);
