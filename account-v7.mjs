/* AimRoutine Cloud v7 account portal. No privileged credentials in browser. */
import {supabase,SITE_URL} from './cloud-client-v7.mjs';
import {UID_STORAGE_KEY,validUid,scopedKey,TRAINING_KEY} from './cloud-core-v7.mjs';
import {synchronize,isEnabled,setEnabled,readUserLocal,importGuestIntoAccount,deleteCloudProgress} from './cloud-sync-v7.mjs';
import {checkLeakedPassword} from './password-security-v7.mjs';
import {validateUsername,usernameFromUser,saveUsername} from './username-v7.mjs';
import {hasGoogleIdentity} from './google-delete-v7.mjs';
import {signOutEverywhere} from './session-security-v7.mjs';
import {TURNSTILE_SITE_KEY,createAuthCaptcha} from './turnstile-v7.mjs';
import {attachWindowsSync,discardWindowsSignup,rememberWindowsSignup,takeWindowsSignup} from './windows-sync-v1.mjs?v=3';
const SIGNUPS_READY=true; // Email signups: Turnstile enforced by Supabase Auth, confirmation required, provider allowlisted by server hook.
const GOOGLE_READY=true; // Provider enabled by project owner; live OAuth is in beta until end-to-end testing.
const RESET_LINKS_CONFIGURED=true; // Redirect allowlist was configured; real email delivery and recovery completion still require confirmation.
const $=s=>document.querySelector(s);
let user=null,working=false,recovery=false;
let switchingWindowsAccount=false,passwordApproval=null;
let playerOwner=null,playerRequest=null;
const playerRankEn=new Map(Object.entries({Fer:'Iron',Bronze:'Bronze',Argent:'Silver',Or:'Gold',Platine:'Platinum',Diamant:'Diamond',Ascendant:'Ascendant',Immortel:'Immortal',Radiant:'Radiant'}));
const edpiFormat={fr:new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}),en:new Intl.NumberFormat('en',{maximumFractionDigits:1})};
const windows=attachWindowsSync(supabase,{onPairingChange:showWindowsMode,onSwitchAccount:switchWindowsAccount});
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
function showWindowsMode(request,previous){
 const desktop=Boolean(request?.mode);
 $('#login-default-action').hidden=desktop;
 $('#login-windows-action').hidden=!desktop;
 if(previous?.mode){discardWindowsSignup(localStorage,previous);passwordApproval=null;}
 if(desktop&&!recovery)authMode(request.mode==='signup'?'signup':'login');
}
async function switchWindowsAccount(){
 if(switchingWindowsAccount||!windows.canPair())return;
 switchingWindowsAccount=true;
 passwordApproval=null;
 try{
  const {error}=await supabase.auth.signOut({scope:'local'});
  if(error)throw error;
  showUser(null);
  showWindowsMode(windows.pairing());
  $(windows.pairing()?.mode==='signup'?'#signup-email':'#login-email').focus();
 }catch{msg('Impossible de changer de compte. Réessaie.')}
 finally{switchingWindowsAccount=false;}
}
function offerWindowsSignup(validated){
 if(!validated||recovery||window.self!==window.top||windows.pairing()
   ||document.documentElement.dataset.windowsSignupReturn!=='true')return;
 const request=takeWindowsSignup(localStorage,validated);
 if(request){
  delete document.documentElement.dataset.windowsSignupReturn;
  windows.adoptSignup(request);
 }
}
function showPlayerStatus(status){
 $('#account-player-status').hidden=!status;
 for(const state of ['loading','empty','error'])$('#account-player .ar7-player-'+state).hidden=state!==status;
}
function clearPlayerSummary(){
 $('#account-player-summary').hidden=true;
 const image=$('#account-player-avatar');
 image.hidden=true;
 image.removeAttribute('src');
 for(const id of ['initials','name','rank-fr','rank-en','edpi-fr','edpi-en'])$('#account-player-'+id).textContent='';
}
function renderPlayer(profile){
 if(!profile?.onboarded||typeof profile.name!=='string'||!profile.name.trim()){
  clearPlayerSummary();
  showPlayerStatus('empty');
  return;
 }
 const name=profile.name.trim().slice(0,80);
 const division=[1,2,3].includes(profile.division)?' '+profile.division:'';
 const rank=playerRankEn.has(profile.rank)?profile.rank:'';
 const edpi=Number.isFinite(profile.dpi)&&Number.isFinite(profile.sensitivity)?profile.dpi*profile.sensitivity:NaN;
 $('#account-player-name').textContent=name;
 $('#account-player-initials').textContent=Array.from(name).slice(0,2).join('').toUpperCase();
 $('#account-player-rank-fr').textContent=rank?rank+division:'—';
 $('#account-player-rank-en').textContent=rank?playerRankEn.get(rank)+division:'—';
 for(const locale of ['fr','en'])$('#account-player-edpi-'+locale).textContent=Number.isFinite(edpi)?edpiFormat[locale].format(edpi):'—';
 const avatar=$('#account-player-avatar');
 const url=profile.avatarDataUrl;
 if(typeof url==='string'&&url.length<=100000&&/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(url)){
  if(avatar.getAttribute('src')!==url){avatar.src=url;avatar.hidden=false;}
 }else{
  avatar.hidden=true;
  avatar.removeAttribute('src');
 }
 showPlayerStatus(null);
 $('#account-player-summary').hidden=false;
}
$('#account-player-avatar').addEventListener('error',event=>{event.currentTarget.hidden=true});
function showPlayerFor(id){
 if(playerOwner!==id){
  playerOwner=id;
  playerRequest=null;
  clearPlayerSummary();
  $('#account-player').hidden=!id;
  if(id)showPlayerStatus('loading');
 }
 if(!id||playerRequest)return;
 const request={id};
 playerRequest=request;
 void (async()=>{
  try{
   const {data,error}=await supabase.from('aim_account_player_profiles').select('profile').eq('user_id',request.id).maybeSingle();
   if(playerRequest!==request)return;
   if(error)throw error;
   renderPlayer(data?.profile);
  }catch{
   if(playerRequest!==request)return;
   if($('#account-player-summary').hidden)showPlayerStatus('error');
  }finally{
   if(playerRequest===request)playerRequest=null;
  }
 })();
}
function showUser(next,approval=null){
 user=next&&validUid(next.id)?next:null;
 if(!user||passwordApproval?.uid!==user.id)passwordApproval=null;
 offerWindowsSignup(user);
 const username=usernameFromUser(user);
 const needsUsername=Boolean(user&&!username);
 $('#auth-panel').hidden=!!user&&!recovery;
 $('#username-panel').hidden=!needsUsername||recovery;
 $('#dashboard-panel').hidden=!user||needsUsername||recovery;
 showPlayerFor(user&&!needsUsername&&!recovery?user.id:null);
 windows.setAccount(user,Boolean(user&&!needsUsername&&!recovery),{approval,preservePairing:switchingWindowsAccount});
 if(user){
   $('#user-email').textContent=user.email||'Compte AimRoutine';
   $('#user-username').textContent=username||'—';
   $('#username-email').textContent=user.email||'ton adresse e-mail';
   localStorage.setItem(UID_STORAGE_KEY,user.id);
   renderCounts();
   renderDeleteOptions();
   msg(needsUsername?'Choisis ton pseudo pour terminer ton inscription AimRoutine.':
     'Compte connecté · Synchronisation cloud automatique activée.');
 }else{
   localStorage.removeItem(UID_STORAGE_KEY);
   msg('Connecte-toi pour sauvegarder ta progression. Le mode aperçu sans compte ne conserve aucune séance.');
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
 if(!user)return;
 const google=hasGoogleIdentity(user);
 $('#google-delete-flow').hidden=!google;
 $('#delete-password-row').hidden=google;
 $('#captcha-delete-wrap').hidden=google;
 $('#delete-account-password').required=!google;
 if(!google&&document.querySelector('.ar7-delete-account')?.open)showCaptcha('delete');
 $('#google-delete-status').textContent=google?'Pour supprimer le compte, écris exactement SUPPRIMER en majuscules.':'';
 $('#delete-account-final').disabled=working||(google&&$('#delete-account-confirmation').value!=='SUPPRIMER');
}
async function run(task){
 if(working)return;
 working=true;
 document.querySelectorAll('.ar7-account-panel button').forEach(x=>{if(x.type==='submit'||x.id?.startsWith('cloud-')||x.id?.startsWith('session-'))x.disabled=true});
 try{await task()}
 catch(e){
  const detail=String(e?.message||e);
  const rejected=e?.code==='captcha_failed'||/captcha protection|invalid-input-response|timeout-or-duplicate/i.test(detail);
  msg(rejected?'Vérification anti-robots refusée par le serveur. Valide le nouveau CAPTCHA puis réessaie. Si le problème persiste, contacte le support.':'Opération impossible : '+detail);
 }
 finally{
  working=false;
  document.querySelectorAll('.ar7-account-panel button').forEach(x=>{if(x.type==='submit'||x.id?.startsWith('cloud-')||x.id?.startsWith('session-'))x.disabled=false});
  $('#signup-submit').disabled=!SIGNUPS_READY;
  renderCounts();
  renderDeleteOptions();
 }
}
if(windows.pairing()?.mode)showWindowsMode(windows.pairing());
else showCaptcha('login');
$('#signup-submit').disabled=!SIGNUPS_READY;
$('#google-signin').disabled=!GOOGLE_READY;
function startGoogle(){
 if(!GOOGLE_READY){msg('La connexion Google n’est pas encore configurée.');return;}
 run(async()=>{
   const options={redirectTo:SITE_URL+'account.html'};
   if(windows.canPair())options.queryParams={prompt:'select_account'};
   const {error}=await supabase.auth.signInWithOAuth({provider:'google',options});
   if(error)throw error;
 });
}
$('#google-signin').addEventListener('click',startGoogle);
$('#windows-google').addEventListener('click',startGoogle);
$('#login-mode').addEventListener('click',()=>authMode('login'));
$('#signup-mode').addEventListener('click',()=>authMode('signup'));
$('#reset-link').addEventListener('click',()=>authMode('reset'));
$('#back-to-login').addEventListener('click',()=>authMode('login'));
$('#login-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 const pairing=windows.canPair()&&!$('#login-windows-action').hidden?windows.pairing():null;
 const captchaOptions=captcha.options('login');
 let loginResult;
 try{loginResult=await supabase.auth.signInWithPassword({
  email:$('#login-email').value.trim(),password:$('#login-password').value,
  options:captchaOptions
 });}finally{captcha.reset('login')}
 const {error}=loginResult;
 if(error)throw error;
 const session=loginResult.data?.session;
 const token=session?.access_token;
 if(typeof token!=='string'||!token||!validUid(session?.user?.id))throw Error('Connexion non validée.');
 const {data:{user:validated},error:validationError}=await supabase.auth.getUser(token);
 if(validationError||validated?.id!==session.user.id)throw validationError||Error('Connexion non validée.');
 const {data:latest,error:sessionError}=await supabase.auth.getSession();
 if(sessionError||latest?.session?.user?.id!==validated.id)throw Error('Le compte actif a changé. Réessaie.');
 const approval=pairing&&windows.pairing()===pairing?{request:pairing,uid:validated.id,token}:null;
 passwordApproval=approval&&!usernameFromUser(validated)?approval:null;
 showUser(validated,approval);$('#login-password').value='';
 if(usernameFromUser(validated)&&isEnabled(validated.id)){
  try{const result=await synchronize(supabase,validated.id);msg('Compte connecté · Synchronisation réussie ('+result.downloadedSessions+' séances).')}
  catch(err){msg('Compte connecté · Sauvegarde en attente : '+err.message)}
 }
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
 const pairing=windows.canPair()?windows.pairing():null;
 let signupResult;
 try{signupResult=await supabase.auth.signUp({email:$('#signup-email').value.trim(),password,
  options:{emailRedirectTo:SITE_URL+'account.html',data:{aim_username:username},...captchaOptions}});}
 finally{captcha.reset('signup')}
 const {error}=signupResult;
 if(error)throw error;
 if(pairing&&windows.pairing()===pairing)rememberWindowsSignup(localStorage,pairing,signupResult.data?.user?.id);
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
 const {error}=await supabase.auth.updateUser({password});
 if(error)throw error;
 $('#new-password').value='';
 recovery=false;
 authMode('login');
 showUser(user);
 msg('Mot de passe mis à jour.');
})});
$('#username-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{
 if(!user)throw Error('Connecte-toi pour enregistrer ton pseudo.');
 const saved=await saveUsername(supabase.auth,user.id,$('#username-input').value);
 const approval=passwordApproval?.uid===saved.id?passwordApproval:null;
 passwordApproval=null;
 showUser(saved,approval);
 $('#username-input').value='';
 msg('Pseudo enregistré : '+usernameFromUser(saved)+'. Ton compte est prêt.');
 if(isEnabled(saved.id)){
  try{const result=await synchronize(supabase,saved.id);msg('Pseudo enregistré · Synchronisation réussie ('+result.downloadedSessions+' séances).')}
  catch(err){msg('Pseudo enregistré · Sauvegarde en attente : '+err.message)}
 }
})});
$('#username-signout').addEventListener('click',()=>$('#logout').click());
$('#logout').addEventListener('click',()=>run(async()=>{
 // A single logout button revokes refresh tokens for ALL sessions, including this browser.
 await signOutEverywhere(supabase.auth);
 showUser(null);
 msg('Tu es déconnecté de ton compte sur tous les appareils. Les jetons d’accès déjà émis restent valides jusqu’à leur expiration. Les copies locales ne sont pas effacées.');
}));
$('#cloud-enable').addEventListener('click',()=>run(async()=>{
 if(!user)return; // Automatic sync has no opt-in confirmation.
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
 const id=user.id;
 await deleteCloudProgress(supabase,id);
 if(user?.id!==id)return;
 showPlayerFor(null);
 if(!recovery&&usernameFromUser(user))showPlayerFor(id);
 setEnabled(id,true);
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
  if(authError||checked?.id!==oldUid)throw Error('Identité différente : aucune suppression effectuée.');
  
  const {data,error:deleteError}=await supabase.functions.invoke('delete-aim-account',{
   method:'POST',body:{action:'delete_my_account',confirmation:'SUPPRIMER'}
  });
  if(deleteError||data?.deleted!==true){
   throw Error('Le serveur a refusé la suppression : ton compte est conservé. Reconnecte-toi si nécessaire.');
  }
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
 showPlayerFor(user.id);
 if(automaticSync)return automaticSync;
 const id=user.id;
 automaticSync=(async()=>{
  try{
   await synchronize(supabase,id);
   if(user?.id===id){renderCounts();msg('Compte connecté · Synchronisation automatique à jour ✓')}
  }catch(e){if(user?.id===id)msg('Synchronisation cloud en attente : '+e.message)}
 })().finally(()=>{automaticSync=null});
 return automaticSync;
}
window.addEventListener('online',()=>void autoSync());
window.addEventListener('focus',()=>void autoSync());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void autoSync()});
setInterval(()=>{if(!document.hidden)void autoSync()},45000);
let authRevision=0;
supabase.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){
   authRevision+=1;
   recovery=true;authMode('new-password');
   $('#auth-panel').hidden=false;
   $('#dashboard-panel').hidden=true;
   showPlayerFor(null);
   passwordApproval=null;
   windows.setAccount(user,false);
 }
 if(event==='SIGNED_OUT'){authRevision+=1;showUser(null)}
 if(event==='SIGNED_IN'&&!recovery&&session?.user?.id&&user?.id!==session.user.id){
   const expected=session.user.id,revision=++authRevision;
   if(user)showUser(null);
   // The Auth event itself must return before making additional Auth requests.
   setTimeout(async()=>{
    try{
     const {data,error}=await supabase.auth.getUser();
     if(!error&&data?.user?.id===expected&&revision===authRevision&&!recovery)showUser(data.user);
    }catch{}
   },0);
 }
});
(async()=>{
 const revision=authRevision;
 try{
  const {data:{user:validated},error}=await supabase.auth.getUser();
  if(revision!==authRevision)return;
  if(error||!validated){showUser(null);if(new URLSearchParams(location.search).has('reset'))msg('Ouvre le lien reçu par e-mail pour terminer la réinitialisation.');return;}
  showUser(validated);
  if(usernameFromUser(validated)&&isEnabled(validated.id)){
   try{await synchronize(supabase,validated.id);if(revision===authRevision&&user?.id===validated.id){renderCounts();msg('Compte connecté · Sauvegarde cloud synchronisée.')}}
   catch(e){if(revision===authRevision&&user?.id===validated.id)msg('Compte connecté · Cloud indisponible : '+e.message)}
  }
 }catch(e){if(revision===authRevision){showUser(null);msg('Service indisponible : '+e.message)}}
})();
