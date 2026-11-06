/* Load original V6 application only after choosing a browser-local data namespace.
   No auth token? Guest mode, without requiring a network request. */
import {UID_STORAGE_KEY,validUid} from './cloud-core-v7.mjs';
import {synchronize,isEnabled} from './cloud-sync-v7.mjs';

const status=document.getElementById('cloud-training-status');
const authStorage='sb-lmzswtzboobpokumxzhy-auth-token';
let api=null,uid=null,syncing=false,queued=false,refreshNeeded=false;
function report(message){if(status)status.textContent=message}
try{
 if(localStorage.getItem(authStorage)){
   api=await import('./cloud-client-v7.mjs');
   const result=await api.supabase.auth.getSession();
   const user=result.data?.session?.user;
   if(!result.error&&validUid(user?.id)){
     uid=user.id;
     window.__aimCloudUserId=uid;
     localStorage.setItem(UID_STORAGE_KEY,uid);
     if(isEnabled(uid)){
       report('Connexion cloud : récupération de tes séances…');
       try{await synchronize(api.supabase,uid);report('Compte connecté · Progression cloud synchronisée')}
       catch(e){report('Compte connecté · Cloud indisponible : données locales conservées ('+e.message+')')}
     }else report('Compte connecté · Active la sauvegarde sur la page Mon compte.');
   }else {localStorage.removeItem(UID_STORAGE_KEY);}
 }
}catch(e){report('Cloud indisponible · Mode invité local maintenu.');}
if(!uid)window.__aimCloudUserId=null;

await import('./training-v5.js?v=3');
await import('./training-v6.js?v=2');

async function syncChanges(){
 if(!uid||!api||!isEnabled(uid)||syncing){queued=true;return}
 syncing=true;
 report('Sauvegarde de ta progression dans le cloud…');
 try{
   const before=JSON.stringify(window.AIMWeb?.getStore?.()||{});
   await synchronize(api.supabase,uid);
   const afterRaw=localStorage.getItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2');
   const after=JSON.stringify(JSON.parse(afterRaw||'{}'));
   refreshNeeded=before!==after;
   report(refreshNeeded?'Cloud synchronisé · Nouvelles données disponibles. Actualise la page pour les voir.':'Sauvegarde cloud à jour ✓');
 }catch(e){report('Sauvegarde cloud en attente · '+e.message)}
 finally{
  syncing=false;
  if(queued){queued=false;setTimeout(syncChanges,250);}
 }
}
let debounce;
function schedule(){if(!uid||!api||!isEnabled(uid))return;clearTimeout(debounce);debounce=setTimeout(syncChanges,900)}
window.addEventListener('aim-store-updated',schedule);
window.addEventListener('aim-cloud-data-changed',schedule);
window.addEventListener('online',schedule);
window.addEventListener('focus',()=>{if(uid&&isEnabled(uid))schedule()});
window.addEventListener('storage',e=>{
 if(e.key===UID_STORAGE_KEY&&e.newValue!==uid){location.reload()}
});
