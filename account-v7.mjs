/* AimRoutine Cloud v7 account portal. No privileged credentials in browser. */
import {supabase,SITE_URL} from './cloud-client-v7.mjs';
import {UID_STORAGE_KEY,validUid,scopedKey,TRAINING_KEY} from './cloud-core-v7.mjs';
import {synchronize,isEnabled,setEnabled,readUserLocal,importGuestIntoAccount,deleteCloudProgress} from './cloud-sync-v7.mjs';
import {checkLeakedPassword} from './password-security-v7.mjs';
import {validateUsername,usernameFromUser,saveUsername} from './username-v7.mjs';
import {hasGoogleIdentity} from './google-delete-v7.mjs';
import {signOutEverywhere} from './session-security-v7.mjs';
import {TURNSTILE_SITE_KEY,createAuthCaptcha} from './turnstile-v7.mjs';
const SIGNUPS_READY=true; // Email signups: Turnstile enforced by Supabase Auth, confirmation required, provider allowlisted by server hook.
const GOOGLE_READY=true; // Provider enabled by project owner; live OAuth is in beta until end-to-end testing.
const RESET_LINKS_CONFIGURED=true; // Redirect allowlist was configured; real email delivery and recovery completion still require confirmation.
const $=s=>document.querySelector(s);
let user=null,working=false,recovery=false,authRevision=0;
let passwordRecoveryNoticeUid=null;
// A slow operation belongs to its original account, not the next signed-in account.
let activeOperation=null;
// A delayed getUser()/Cloud response must never re-display a signed-out account.
const captcha=createAuthCaptcha(TURNSTILE_SITE_KEY);
function showCaptcha(mode){
 if(!captcha.enabled||!['login','signup','reset','delete'].includes(mode))return;
 void captcha.mount(mode,document.getElementById('captcha-'+mode))
  .catch(()=>msg('Protection anti-robots indisponible. Réessaie après avoir vérifié ta connexion.'));
}
const msg=(message)=>{$('#account-status').textContent=message};
function authMode(mode='login'){
 $('#login-form').hidden=mode!=='login';
 $('#signup-form').hidden=mode!=='signup';
 $('#reset-form').hidden=mode!=='reset';
 $('#new-password-form').hidden=mode!=='new-password';
 $('#google-login-wrap').hidden=!['login','signup'].includes(mode);
 showCaptcha(mode);
 $('#login-mode').setAttribute('aria-pressed',String(mode==='login'));
 $('#signup-mode').setAttribute('aria-pressed',String(mode==='signup'));
}
function clearPreviousIdentityForms(){
 // A hidden form still holds the previous account's secret input values.
 // Clear them only when the verified account identity actually changes,
 // not during ordinary token refreshes or first guest-page hydration.
 for(const selector of [
  // E-mail addresses and unsubmitted nicknames are private too: hidden
  // login/signup/recovery forms must not keep a former user's identity.
  '#login-email','#signup-email','#reset-email','#signup-username',
  '#login-password','#signup-password','#new-password',
  '#delete-account-password','#delete-account-confirmation','#username-input'
 ]){
  const input=$(selector);
  if(input)input.value='';
 }
 const deleteSection=document.querySelector('.ar7-delete-account');
 if(deleteSection)deleteSection.open=false;
 const finalButton=$('#delete-account-final');
 if(finalButton)finalButton.disabled=true;
 try{captcha.reset('delete')}catch{} // Prevent reuse of a prior account's CAPTCHA.
}
function showUser(next){
 const previousUid=user?.id||null;
 const nextUid=next&&validUid(next.id)?next.id:null;
 // A completed recovery notice must never follow a different account.
 if(passwordRecoveryNoticeUid&&passwordRecoveryNoticeUid!==nextUid)passwordRecoveryNoticeUid=null;
 if(previousUid!==nextUid){
  clearPreviousIdentityForms();
  activeOperation=null;
  working=false;
 }
 ++authRevision;
 user=nextUid?next:null;
 const username=usernameFromUser(user);
 const needsUsername=Boolean(user&&!username);
 $('#auth-panel').hidden=!!user&&!recovery;
 $('#username-panel').hidden=!needsUsername||recovery;
 $('#dashboard-panel').hidden=!user||needsUsername||recovery;
 if(user){
   $('#user-email').textContent=user.email||'Compte AimRoutine';
   $('#user-username').textContent=username||'—';
   $('#username-email').textContent=user.email||'ton adresse e-mail';
   localStorage.setItem(UID_STORAGE_KEY,user.id);
   renderCounts();
   renderDeleteOptions();
   // Ignore late identity callbacks only for the short-lived explicit recovery
   // feedback; keep the real account/username state fully updated.
   if(passwordRecoveryNoticeUid!==user.id)
    msg(needsUsername?'Choisis ton pseudo pour terminer ton inscription AimRoutine.':
     'Compte connecté · Synchronisation cloud automatique activée.');
 }else{
   localStorage.removeItem(UID_STORAGE_KEY);
   // Remove stale personally identifying text even from now-hidden panels.
   $('#user-email').textContent='';
   $('#user-username').textContent='';
   $('#username-email').textContent='';
   $('#cloud-sessions-count').textContent='—';
   $('#cloud-routines-count').textContent='—';
   $('#cloud-enabled-status').textContent='Connexion nécessaire';
   msg('Connecte-toi pour sauvegarder ta progression. Le mode aperçu sans compte ne conserve aucune séance.');
 }
 if(previousUid!==nextUid){
  // Release disabled controls held by an old account without granting
  // privileges: the new identity was already verified by the caller.
  document.querySelectorAll('.ar7-account-panel button').forEach(x=>{
   if(x.type==='submit'||x.id?.startsWith('cloud-')||x.id?.startsWith('session-'))x.disabled=false;
  });
  $('#signup-submit').disabled=!SIGNUPS_READY;
  if(user)renderCounts();
  renderDeleteOptions();
 }
}
function renderCounts(){
 if(!user)return;
 const {store}=readUserLocal(user.id);
 $('#cloud-sessions-count').textContent=String(store.sessions.length);
 $('#cloud-routines-count').textContent=String(store.presets.length);
 const enabled=isEnabled(user.id);
 $('#cloud-enabled-status').textContent=enabled?'Automatique':'Connexion nécessaire';
 $('#cloud-enable').hidden=true;
 $('#cloud-sync').hidden=true;
 $('#cloud-sync').disabled=true;
}
function renderDeleteOptions(){
 if(!user){
  $('#delete-account-final').disabled=true;
  return;
 }
 const google=hasGoogleIdentity(user);
 $('#google-delete-flow').hidden=!google;
 $('#delete-password-row').hidden=google;
 $('#captcha-delete-wrap').hidden=google;
 $('#delete-account-password').required=!google;
 if(!google&&document.querySelector('.ar7-delete-account')?.open)showCaptcha('delete');
 $('#google-delete-status').textContent=google?'Pour supprimer le compte, écris exactement SUPPRIMER en majuscules.':'';
 $('#delete-account-final').disabled=working||$('#delete-account-confirmation').value!=='SUPPRIMER';
}
async function run(task){
 if(working)return;
 const originatingUid=user?.id||null;
 const operation={uid:originatingUid};
 activeOperation=operation;
 working=true;
 document.querySelectorAll('.ar7-account-panel button').forEach(x=>{if(x.type==='submit'||x.id?.startsWith('cloud-')||x.id?.startsWith('session-'))x.disabled=true});
 try{await task()}
 catch(e){
  // An async Cloud/Auth failure from A must not be displayed on B's account
  // or on the signed-out guest screen after an account change.
  if(activeOperation!==operation||(user?.id||null)!==originatingUid)return;
  const detail=String(e?.message||e);
  const rejected=e?.code==='captcha_failed'||/captcha protection|invalid-input-response|timeout-or-duplicate/i.test(detail);
  msg(rejected?'Vérification anti-robots refusée par le serveur. Valide le nouveau CAPTCHA puis réessaie. Si le problème persiste, contacte le support.':'Opération impossible : '+detail);
 }
 finally{
  // A must not unlock B's controls when A finishes after B has started.
  if(activeOperation!==operation)return;
  activeOperation=null;
  working=false;
  document.querySelectorAll('.ar7-account-panel button').forEach(x=>{if(x.type==='submit'||x.id?.startsWith('cloud-')||x.id?.startsWith('session-'))x.disabled=false});
  $('#signup-submit').disabled=!SIGNUPS_READY;
  renderCounts();
  renderDeleteOptions();
 }
}
// Do not download the multi-megabyte Turnstile challenge at guest first paint.
// Keep server-enforced CAPTCHA unchanged; load on the first real form interaction.
// Signup and recovery already mount their own widgets when those tabs are chosen.
const loginCaptchaForm=$('#login-form');
if(loginCaptchaForm){
 let firstInteractionPending=true;
 const activateLoginCaptcha=()=>{
  if(!firstInteractionPending)return;
  firstInteractionPending=false;
  loginCaptchaForm.removeEventListener('focusin',activateLoginCaptcha);
  loginCaptchaForm.removeEventListener('pointerdown',activateLoginCaptcha);
  showCaptcha('login');
 };
 loginCaptchaForm.addEventListener('focusin',activateLoginCaptcha);
 loginCaptchaForm.addEventListener('pointerdown',activateLoginCaptcha);
}
$('#signup-submit').disabled=!SIGNUPS_READY;
$('#google-signin').disabled=!GOOGLE_READY;
$('#google-signin').addEventListener('click',()=>{
 if(!GOOGLE_READY){msg('La connexion Google n’est pas encore configurée.');return;}
 run(async()=>{
   const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:SITE_URL+'account.html'}});
   if(error)throw error;
 });
});
$('#login-mode').addEventListener('click',()=>authMode('login'));
$('#signup-mode').addEventListener('click',()=>authMode('signup'));
$('#reset-link').addEventListener('click',()=>authMode('reset'));
$('#back-to-login').addEventListener('click',()=>authMode('login'));
$('#login-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 const captchaOptions=captcha.options('login');
 let loginResult;
 try{loginResult=await supabase.auth.signInWithPassword({
  email:$('#login-email').value.trim(),password:$('#login-password').value,
  options:captchaOptions
 });}finally{captcha.reset('login')}
 const {error}=loginResult;
 if(error)throw error;
 // The SDK or another tab can change accounts while the server verifies login.
 // An old getUser() response must never replace that newer authenticated view.
 const loginRevision=authRevision,loginToken=currentAuthToken();
 const {data:{user:validated},error:validationError}=await supabase.auth.getUser();
 if(authRevision!==loginRevision||loginToken!==currentAuthToken())return;
 if(validationError||!validated)throw validationError||Error('Connexion non validée.');
 const tokenOwner=tokenUserId(loginToken);
 if(tokenOwner&&validated.id!==tokenOwner)return;
 showUser(validated);$('#login-password').value='';
 // A slow first Cloud fetch must not block the global logout action.
 // autoSync() checks the current user ID after awaiting the network.
 if(usernameFromUser(validated)&&isEnabled(validated.id))void autoSync();
})});
$('#signup-form').addEventListener('submit',e=>{e.preventDefault();
 if(!SIGNUPS_READY){msg("Les inscriptions par e-mail sont encore fermées pendant les tests de sécurité et de synchronisation.");return}
 run(async()=>{
 const username=validateUsername($('#signup-username').value);
 const password=$('#signup-password').value;
 msg('Vérification de la sécurité du nouveau mot de passe…');
 const assessment=await checkLeakedPassword(password);
 if(!assessment.safe)throw Error('Ce mot de passe figure dans des fuites connues. Choisis-en un autre.');
 const captchaOptions=captcha.options('signup');
 let signupResult;
 try{signupResult=await supabase.auth.signUp({email:$('#signup-email').value.trim(),password,
  options:{emailRedirectTo:SITE_URL+'account.html',data:{aim_username:username},...captchaOptions}});}
 finally{captcha.reset('signup')}
 const {error}=signupResult;
 if(error)throw error;
 $('#signup-password').value='';
 $('#signup-username').value='';
 msg('Si cette adresse est éligible, un e-mail de confirmation sera envoyé. Vérifie aussi tes indésirables.');
 })});
$('#reset-form').addEventListener('submit',e=>{e.preventDefault();if(!RESET_LINKS_CONFIGURED){msg('Les URL de réinitialisation ne sont pas encore configurées.');return;}run(async()=>{
 const captchaOptions=captcha.options('reset');
 let recoveryResult;
 try{recoveryResult=await supabase.auth.resetPasswordForEmail(
  $('#reset-email').value.trim(),{redirectTo:SITE_URL+'account.html?reset=1',...captchaOptions}
 );}finally{captcha.reset('reset')}
 const {error}=recoveryResult;
 if(error)throw error;
 msg('Si un compte existe pour cette adresse, tu recevras les instructions de réinitialisation.');
})});
$('#new-password-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 const password=$('#new-password').value;
 msg('Vérification du nouveau mot de passe…');
 const assessment=await checkLeakedPassword(password);
 if(!assessment.safe)throw Error('Ce mot de passe a déjà été compromis dans des fuites connues. Choisis-en un autre.');
 const {data,error}=await supabase.auth.updateUser({password});
 if(error)throw error;
 $('#new-password').value='';
 recovery=false;
 authMode('login');
 // The update response includes the verified account. Show it immediately
 // instead of depending on the order of asynchronous USER_UPDATED callbacks.
 showUser(data?.user||user);
 passwordRecoveryNoticeUid=user?.id||null;
 msg('Mot de passe mis à jour.'+
  (user&&!usernameFromUser(user)?' Choisis ton pseudo pour terminer ton inscription.':''));
})});
$('#username-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 if(!user)throw Error('Connecte-toi pour enregistrer ton pseudo.');
 const accountId=user.id,requestedRevision=authRevision;
 const saved=await saveUsername(supabase.auth,accountId,$('#username-input').value);
 // A cross-tab sign-out during updateUser must not restore the old account.
 if(authRevision!==requestedRevision||user?.id!==accountId)return;
 showUser(saved);
 $('#username-input').value='';
 msg('Pseudo enregistré : '+usernameFromUser(saved)+'. Ton compte est prêt.');
 if(isEnabled(saved.id))void autoSync();
})});
$('#username-signout').addEventListener('click',()=>$('#logout').click());
$('#logout').addEventListener('click',()=>run(async()=>{
 // An earlier global logout may finish after another verified login.
 const logoutUid=user?.id||null,logoutRevision=authRevision;
 await signOutEverywhere(supabase.auth);
 if(authRevision!==logoutRevision||(user?.id||null)!==logoutUid)return;
 showUser(null);
 msg('Tu es déconnecté de ton compte sur tous les appareils. Les jetons d’accès déjà émis restent valides jusqu’à leur expiration. Les copies locales ne sont pas effacées.');
}));
$('#cloud-enable').addEventListener('click',()=>run(async()=>{
 if(!user)return; // Automatic sync has no opt-in confirmation.
 const uid=user.id;
 setEnabled(uid,true);
 try{
  const result=await synchronize(supabase,uid);
  if(user?.id!==uid)return;
  msg('Sauvegarde cloud activée. '+result.downloadedSessions+' séances dans ton espace. Les nouvelles séances seront sauvegardées automatiquement lorsque tu seras connecté.');
 }catch(e){
  setEnabled(uid,false);
  if(user?.id===uid)throw e;
 }
}));
$('#cloud-sync').addEventListener('click',()=>run(async()=>{
 if(!user)return;
 const uid=user.id;
 msg('Synchronisation en cours…');
 const result=await synchronize(supabase,uid);
 if(user?.id!==uid)return; // Do not advertise A's sync from B's dashboard.
 msg('Synchronisation effectuée : '+result.downloadedSessions+' séances et '+result.downloadedFavorites+' routines. Retourne dans l’espace AIM pour voir les données actualisées.');
}));
$('#cloud-import-guest').addEventListener('click',()=>run(async()=>{
 if(!user||!confirm('Importer les données invitées de ce navigateur dans ton compte ? Leurs copies locales ne seront pas supprimées.'))return;
 const uid=user.id;
 if(!isEnabled(uid)){
  setEnabled(uid,true);
  try{await synchronize(supabase,uid)}
  catch(e){setEnabled(uid,false);if(user?.id===uid)throw e;return}
 }
 if(user?.id!==uid)return;
 const result=importGuestIntoAccount(uid);
 const sync=await synchronize(supabase,uid,{guestImport:true});
 if(user?.id!==uid)return;
 msg('Import réalisé : '+result.sessions+' séances invitées trouvées, '+sync.downloadedSessions+' séances maintenant dans ton espace cloud.');
}));
$('#cloud-delete').addEventListener('click',()=>run(async()=>{
 if(!user)return;
 const uid=user.id;
 if(!confirm('Supprimer définitivement toute ta progression cloud pour ce compte ?'))return;
 if(!confirm('Dernière confirmation : tu as exporté une copie de tes données ?'))return;
 if(user?.id!==uid)return;
 await deleteCloudProgress(supabase,uid);
 // The remote deletion may have succeeded while another tab switched A to B.
 // Never set B's preferences or show A's deletion result on B's dashboard.
 if(user?.id!==uid)return;
 setEnabled(uid,true);
 msg('Progression cloud supprimée. La sauvegarde automatique reste active pour tes prochaines séances ; les anciennes données invitées sont conservées pour un import manuel.');
}));
document.querySelector('.ar7-delete-account')?.addEventListener('toggle',()=>{
 if(user&&!hasGoogleIdentity(user)&&document.querySelector('.ar7-delete-account')?.open)showCaptcha('delete');
});
$('#delete-account-confirmation').addEventListener('input',renderDeleteOptions);
$('#delete-account-form').addEventListener('submit',event=>{
 event.preventDefault();
 const confirmation=$('#delete-account-confirmation').value;
 if(!user||confirmation!=='SUPPRIMER'){
  msg('Écris exactement SUPPRIMER pour confirmer la suppression définitive.');return;
 }
 const google=hasGoogleIdentity(user);
 
 if(!google&&!confirm('SUPPRESSION IRRÉVERSIBLE : supprimer ton compte et toutes ses données cloud ?'))return;
 run(async()=>{
  const oldUid=user.id;
  if(!google){
   const email=user.email,password=$('#delete-account-password').value;
   if(!email||!password)throw Error('Indique ton mot de passe actuel.');
   const captchaOptions=captcha.options('delete');
   let authResult;
   try{authResult=await supabase.auth.signInWithPassword({email,password,options:captchaOptions});}
   finally{captcha.reset('delete')}
   if(authResult.error)throw Error('Mot de passe invalide ou reconnexion impossible.');
  }
  // Validate the signed-in identity after the recent Google or password auth.
  const {data:{user:checked},error:authError}=await supabase.auth.getUser();
  if(authError||checked?.id!==oldUid||user?.id!==oldUid)
   throw Error('Identité différente : aucune suppression effectuée.');
  
  const {data,error:deleteError}=await supabase.functions.invoke('delete-aim-account',{
   method:'POST',body:{action:'delete_my_account',confirmation:'SUPPRIMER'}
  });
  if(deleteError||data?.deleted!==true){
   throw Error('Le serveur a refusé la suppression : ton compte est conservé. Reconnecte-toi si nécessaire.');
  }
  // The server may have deleted A just as a different tab signed into B.
  // Never sign B out or clear B's local state after A's delayed completion.
  if(user?.id!==oldUid)return;
  $('#delete-account-password').value='';
  $('#delete-account-confirmation').value='';
  // Only this account's local copies are erased. Guest data remains untouched.
  const prefix='aimroutine_cloud_user_'+oldUid+'_';
  for(let i=localStorage.length-1;i>=0;i--){
   const key=localStorage.key(i);
   if(key?.startsWith(prefix))localStorage.removeItem(key);
  }
  localStorage.removeItem('aimroutine_cloud_enabled_'+oldUid);
  localStorage.removeItem('aimroutine_cloud_meta_'+oldUid);
  localStorage.removeItem(UID_STORAGE_KEY);
  try{await supabase.auth.signOut({scope:'local'})}catch{}
  localStorage.removeItem('sb-lmzswtzboobpokumxzhy-auth-token');
  showUser(null);
  msg('Ton compte et ses données cloud ont été supprimés. Les copies invitées restent présentes.');
 });
});
// Sync account data on reconnect and periodically while the account page is active.
let automaticSync=null;
async function autoSync(){
 if(!user||!usernameFromUser(user)||recovery||document.hidden||!navigator.onLine)return;
 const id=user.id,revision=authRevision;
 // A -> B -> A is a new session even though A's UID is unchanged.
 const stillCurrent=()=>user?.id===id&&authRevision===revision;
 if(automaticSync?.id===id&&automaticSync?.revision===revision)return automaticSync.promise;
 const task=(async()=>{
  try{
   await synchronize(supabase,id);
   if(stillCurrent()){renderCounts();msg('Compte connecté · Synchronisation automatique à jour ✓')}
  }catch(e){if(stillCurrent())msg('Synchronisation cloud en attente : '+e.message)}
 })().finally(()=>{if(automaticSync?.promise===task)automaticSync=null});
 automaticSync={id,revision,promise:task};
 return task;
}
window.addEventListener('online',()=>void autoSync());
window.addEventListener('focus',()=>void autoSync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void autoSync()});
setInterval(()=>{if(!document.hidden)void autoSync()},45000);
const AUTH_KEY='sb-lmzswtzboobpokumxzhy-auth-token';
let accountVerification=0;
const currentAuthToken=()=>{
 try{return localStorage.getItem(AUTH_KEY)}catch{return null}
};
const tokenUserId=token=>{
 try{const id=JSON.parse(token)?.user?.id;return validUid(id)?id:null}
 catch{return null}
};
async function verifyAccountChange(){
 const ticket=++accountVerification;
 const initialToken=currentAuthToken();
 try{
  const {data,error}=await supabase.auth.getUser();
  // Never restore old identity after a second cross-tab switch or logout.
  if(ticket!==accountVerification||initialToken!==currentAuthToken())return;
  // A verified response may still belong to a previous SDK session while
  // another tab has already written a different account's auth token.
  const expectedOwner=tokenUserId(initialToken);
  const checked=!error&&validUid(data?.user?.id)&&
   (!expectedOwner||data.user.id===expectedOwner)?data.user:null;
  if(!checked){showUser(null);return}
  if(user?.id!==checked.id){
   showUser(checked);
   void autoSync();
  }else if(usernameFromUser(checked)!==usernameFromUser(user)){
   showUser(checked);
   void autoSync();
  }
 }catch{
  if(ticket===accountVerification&&initialToken===currentAuthToken())showUser(null);
 }
}
window.addEventListener('storage',event=>{
 if(event.key!==null&&event.key!==AUTH_KEY)return;
 const latest=currentAuthToken();
 if(!latest){
  ++accountVerification;
  showUser(null); // Remove old identity and private counters immediately.
  return;
 }
 if(user?.id&&tokenUserId(latest)===user.id)return; // Same-owner token refresh.
 // Do not show account A's dashboard while B's token is being verified.
 ++accountVerification;
 if(user)showUser(null);
 void verifyAccountChange();
});
supabase.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){
   recovery=true;authMode('new-password');
   $('#auth-panel').hidden=false;
   $('#dashboard-panel').hidden=true;
 }
 if(event==='SIGNED_OUT'){
  ++accountVerification;
  showUser(null);
 }else if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
  // Supabase advises invoking async Auth methods outside the callback.
  if(!user||session?.user?.id!==user.id||event==='USER_UPDATED')
   setTimeout(()=>void verifyAccountChange(),0);
 }
});
(async()=>{
 const startingRevision=authRevision;
 const startingToken=currentAuthToken();
 try{
  const {data:{user:validated},error}=await supabase.auth.getUser();
  // SIGNED_OUT, an account switch, or a manual login may have happened
  // while this initial request was in flight; never replace its newer UI.
  if(authRevision!==startingRevision||startingToken!==currentAuthToken())return;
  if(error||!validated||(tokenUserId(startingToken)&&validated.id!==tokenUserId(startingToken))){
   showUser(null);
   if(new URLSearchParams(location.search).has('reset'))msg('Ouvre le lien reçu par e-mail pour terminer la réinitialisation.');
   return;
  }
  showUser(validated);
  const signedInRevision=authRevision;
  if(usernameFromUser(validated)&&isEnabled(validated.id)){
   try{
    await synchronize(supabase,validated.id);
    if(authRevision!==signedInRevision||user?.id!==validated.id)return;
    renderCounts();msg('Compte connecté · Sauvegarde cloud synchronisée.');
   }catch(e){
    if(authRevision===signedInRevision&&user?.id===validated.id)
     msg('Compte connecté · Cloud indisponible : '+e.message);
   }
  }
 }catch(e){
  if(authRevision!==startingRevision||startingToken!==currentAuthToken())return;
  showUser(null);msg('Service indisponible : '+e.message);
 }
})();
