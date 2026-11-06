/* AimRoutine Cloud v7 account portal. No privileged credentials in browser. */
import {supabase,SITE_URL} from './cloud-client-v7.mjs';
import {UID_STORAGE_KEY,validUid,scopedKey,TRAINING_KEY} from './cloud-core-v7.mjs';
import {synchronize,isEnabled,setEnabled,readUserLocal,importGuestIntoAccount,deleteCloudProgress} from './cloud-sync-v7.mjs';
const SIGNUPS_READY=false; // Keep closed until owner configures Supabase Auth Site URL and redirect allowlist.
const $=s=>document.querySelector(s);
let user=null,working=false,recovery=false;
const msg=(message)=>{$('#account-status').textContent=message};
function authMode(mode='login'){
 $('#login-form').hidden=mode!=='login';
 $('#signup-form').hidden=mode!=='signup';
 $('#reset-form').hidden=mode!=='reset';
 $('#new-password-form').hidden=mode!=='new-password';
 $('#login-mode').setAttribute('aria-pressed',String(mode==='login'));
 $('#signup-mode').setAttribute('aria-pressed',String(mode==='signup'));
}
function showUser(next){
 user=next&&validUid(next.id)?next:null;
 $('#auth-panel').hidden=!!user;
 $('#dashboard-panel').hidden=!user;
 if(user){
   $('#user-email').textContent=user.email||'Compte AimRoutine';
   localStorage.setItem(UID_STORAGE_KEY,user.id);
   renderCounts();
   msg('Compte connecté. La sauvegarde cloud est facultative et doit être activée pour ce compte.');
 }else{
   localStorage.removeItem(UID_STORAGE_KEY);
   msg('Tu peux te connecter ou continuer à utiliser AimRoutine sans compte.');
 }
}
function renderCounts(){
 if(!user)return;
 const {store}=readUserLocal(user.id);
 $('#cloud-sessions-count').textContent=String(store.sessions.length);
 $('#cloud-routines-count').textContent=String(store.presets.length);
 const enabled=isEnabled(user.id);
 $('#cloud-enabled-status').textContent=enabled?'Activée':'Désactivée';
 $('#cloud-enable').hidden=enabled;
 $('#cloud-sync').disabled=!enabled||working;
}
async function run(task){
 if(working)return;
 working=true;
 document.querySelectorAll('.ar7-account-panel button').forEach(x=>{if(x.type==='submit'||x.id?.startsWith('cloud-'))x.disabled=true});
 try{await task()}
 catch(e){msg('Opération impossible : '+(e?.message||String(e)))}
 finally{
  working=false;
  document.querySelectorAll('.ar7-account-panel button').forEach(x=>{if(x.type==='submit'||x.id?.startsWith('cloud-'))x.disabled=false});
  $('#signup-submit').disabled=!SIGNUPS_READY;
  renderCounts();
 }
}
$('#login-mode').addEventListener('click',()=>authMode('login'));
$('#signup-mode').addEventListener('click',()=>authMode('signup'));
$('#reset-link').addEventListener('click',()=>authMode('reset'));
$('#back-to-login').addEventListener('click',()=>authMode('login'));
$('#login-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 const {error}=await supabase.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
 if(error)throw error;
 const {data:{user:validated},error:validationError}=await supabase.auth.getUser();
 if(validationError||!validated)throw validationError||Error('Connexion non validée.');
 showUser(validated);$('#login-password').value='';
 if(isEnabled(validated.id)){
  try{const result=await synchronize(supabase,validated.id);msg('Compte connecté · Synchronisation réussie ('+result.downloadedSessions+' séances).')}
  catch(err){msg('Compte connecté · Sauvegarde en attente : '+err.message)}
 }
})});
$('#signup-form').addEventListener('submit',e=>{e.preventDefault();
 if(!SIGNUPS_READY){msg("Les inscriptions sont désactivées jusqu'à la configuration des redirections d'e-mails Supabase.");return}
 run(async()=>{
 const {error}=await supabase.auth.signUp({email:$('#signup-email').value.trim(),password:$('#signup-password').value,
  options:{emailRedirectTo:SITE_URL+'account.html'}});
 if(error)throw error;
 $('#signup-password').value='';
 msg('Si cette adresse est éligible, un e-mail de confirmation sera envoyé. Vérifie aussi tes indésirables.');
 })});
$('#reset-form').addEventListener('submit',e=>{e.preventDefault();if(!SIGNUPS_READY){msg('Les liens de réinitialisation attendent la configuration des redirections Supabase.');return;}run(async()=>{
 const {error}=await supabase.auth.resetPasswordForEmail($('#reset-email').value.trim(),{redirectTo:SITE_URL+'account.html?reset=1'});
 if(error)throw error;
 msg('Si un compte existe pour cette adresse, tu recevras les instructions de réinitialisation.');
})});
$('#new-password-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 const {error}=await supabase.auth.updateUser({password:$('#new-password').value});
 if(error)throw error;
 $('#new-password').value='';
 authMode('login');
 msg('Mot de passe mis à jour.');
})});
$('#logout').addEventListener('click',()=>run(async()=>{
 const {error}=await supabase.auth.signOut();
 if(error)throw error;
 showUser(null);msg('Tu es déconnecté. Les copies locales déjà enregistrées sur cet appareil ne sont pas effacées.');
}));
$('#cloud-enable').addEventListener('click',()=>run(async()=>{
 if(!user||!confirm('Activer la sauvegarde cloud pour ce compte ? Les nouvelles séances de ton espace personnel pourront être envoyées à Supabase.'))return;
 setEnabled(user.id,true);
 try{const result=await synchronize(supabase,user.id);
  msg('Sauvegarde cloud activée. '+result.downloadedSessions+' séances dans ton espace. Les nouvelles séances seront sauvegardées automatiquement lorsque tu seras connecté.');
 }catch(e){setEnabled(user.id,false);throw e}
}));
$('#cloud-sync').addEventListener('click',()=>run(async()=>{
 if(!user)return;
 msg('Synchronisation en cours…');
 const result=await synchronize(supabase,user.id);
 msg('Synchronisation effectuée : '+result.downloadedSessions+' séances et '+result.downloadedFavorites+' routines. Retourne dans l’espace AIM pour voir les données actualisées.');
}));
$('#cloud-import-guest').addEventListener('click',()=>run(async()=>{
 if(!user||!confirm('Importer les données invitées de ce navigateur dans ton compte ? Leurs copies locales ne seront pas supprimées.'))return;
 if(!isEnabled(user.id)){
  setEnabled(user.id,true);
  try{await synchronize(supabase,user.id)}
  catch(e){setEnabled(user.id,false);throw e}
 }
 const result=importGuestIntoAccount(user.id);
 const sync=await synchronize(supabase,user.id,{guestImport:true});
 msg('Import réalisé : '+result.sessions+' séances invitées trouvées, '+sync.downloadedSessions+' séances maintenant dans ton espace cloud.');
}));
$('#cloud-delete').addEventListener('click',()=>run(async()=>{
 if(!user)return;
 if(!confirm('Supprimer définitivement toute ta progression cloud pour ce compte ?'))return;
 if(!confirm('Dernière confirmation : tu as exporté une copie de tes données ?'))return;
 await deleteCloudProgress(supabase,user.id);
 setEnabled(user.id,false);
 msg('La progression cloud a été supprimée. Le compte existe toujours et les données invitées n’ont pas été modifiées.');
}));
supabase.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){recovery=true;authMode('new-password')}
 if(event==='SIGNED_OUT'){showUser(null)}
});
(async()=>{
 try{
  const {data:{user:validated},error}=await supabase.auth.getUser();
  if(error||!validated){showUser(null);if(new URLSearchParams(location.search).has('reset'))msg('Ouvre le lien reçu par e-mail pour terminer la réinitialisation.');return;}
  showUser(validated);
  if(isEnabled(validated.id)){
   try{await synchronize(supabase,validated.id);renderCounts();msg('Compte connecté · Sauvegarde cloud synchronisée.')}
   catch(e){msg('Compte connecté · Cloud indisponible : '+e.message)}
  }
 }catch(e){showUser(null);msg('Service indisponible : '+e.message)}
})();
