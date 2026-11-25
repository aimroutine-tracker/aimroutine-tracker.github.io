import {validUid} from './cloud-core-v7.mjs';

const pendingKey='aimroutine_windows_pending_v1';
const signupKey='aimroutine_windows_signup_v1';
const challengePattern=/^[a-f0-9]{64}$/;
const desktopModes=['login','signup','google'];
const pairingLifetime=10*60*1000;
const translations={
  guest:['Connecte-toi pour consulter ou lier un profil Windows.','Sign in to view or connect a Windows profile.'],
  pending:['Connecte-toi et termine la configuration de ton compte pour autoriser cette liaison.','Sign in and finish setting up your account to approve this connection.'],
  approval:['Confirme la liaison Windows pour le compte indiqué.','Approve the Windows connection for the account shown.'],
  desktopApproval:['Vérifie le compte qui recevra les résultats de ce profil Windows.','Check which account will receive this Windows profile’s results.'],
  connecting:['Association du profil Windows…','Connecting the Windows profile…'],
  desktopApproved:['Ton compte est associé. Retourne dans AimRoutine Tracker pour retrouver ta progression.','Your account is connected. Return to AimRoutine Tracker to see your progress.'],
  embedded:['Ouvre cette page directement dans ton navigateur pour associer ton profil.','Open this page directly in your browser to connect your profile.'],
  expired:['Cette demande a expiré ou a déjà été utilisée. Relance la liaison depuis le logiciel Windows.','This request expired or was already used. Start a new connection in the Windows app.'],
  deviceLimit:['Nombre maximal de profils liés atteint. Délie un ancien profil puis réessaie.','The maximum number of connected profiles was reached. Disconnect an old profile and try again.'],
  approved:['Liaison autorisée. Retourne dans AimRoutine Tracker pour envoyer les résultats.','Connection approved. Return to AimRoutine Tracker to upload your results.'],
  canceled:['Demande écartée sur cette page.','The request was dismissed on this page.'],
  loading:['Chargement de l’historique Windows…','Loading Windows history…'],
  unlinked:['Aucun profil Windows lié. Ouvre les paramètres de synchronisation dans AimRoutine Tracker pour commencer.','No Windows profiles are connected. Open the sync settings in AimRoutine Tracker to get started.'],
  empty:['Le profil est lié. Aucun résultat Windows n’a encore été envoyé.','The profile is connected. No Windows results have been uploaded yet.'],
  loaded:['Historique Windows actualisé.','Windows history updated.'],
  error:['La requête n’a pas abouti. Vérifie ta connexion et réessaie.','The request failed. Check your connection and try again.'],
  revoked:['Profil délié. Sa copie cloud Windows a été supprimée. Les résultats restent sur le PC.','Profile disconnected. Its Windows cloud copy was deleted. The results remain on the PC.'],
  revokeConfirm:['Délier ce profil et supprimer sa copie cloud Windows ? Les résultats locaux resteront sur le PC.','Disconnect this profile and delete its Windows cloud copy? Local results will remain on the PC.']
};

export function readWindowsPairingFragment(hash,now=Date.now()) {
  const match=typeof hash==='string'&&hash.match(/^#aimroutine-windows=([a-f0-9]{64})(?:&flow=desktop&mode=(login|signup|google))?$/);
  if(!match)return null;
  const [,challenge,mode=null]=match;
  return {challenge,mode,expiresAt:mode?now+pairingLifetime:null};
}

function liveDesktopRequest(request,now) {
  return challengePattern.test(request?.challenge??'')&&desktopModes.includes(request.mode)
    &&Number.isSafeInteger(request.expiresAt)&&request.expiresAt>now&&request.expiresAt<=now+pairingLifetime;
}

export function captureWindowsPairing(location,history,storage,now=Date.now()) {
  const request=readWindowsPairingFragment(location.hash,now);
  if(request){
    savePairing(storage,request);
    const target=request.mode?'#windows-auth-context':'#windows-sync';
    history.replaceState(history.state,'',location.pathname+location.search+target);
    return request;
  }
  try{
    const previous=storage.getItem(pendingKey);
    if(challengePattern.test(previous??''))return {challenge:previous,mode:null,expiresAt:null};
    const restored=JSON.parse(previous);
    if(liveDesktopRequest(restored,now))return restored;
    storage.removeItem(pendingKey);
  }catch{return null}
  return null;
}

function savePairing(storage,request) {
  try{storage.setItem(pendingKey,request.mode?JSON.stringify(request):request.challenge)}catch{}
}

export function rememberWindowsSignup(storage,request,uid,now=Date.now()) {
  if(!liveDesktopRequest(request,now)||!validUid(uid))return;
  try{storage.setItem(signupKey,JSON.stringify({request,uid}))}catch{}
}

export function takeWindowsSignup(storage,user,now=Date.now()) {
  if(!validUid(user?.id)||!user.email_confirmed_at)return null;
  try{
    const stored=JSON.parse(storage.getItem(signupKey));
    if(!stored)return null;
    if(!liveDesktopRequest(stored.request,now)){storage.removeItem(signupKey);return null;}
    if(stored.uid!==user.id)return null;
    storage.removeItem(signupKey);
    return stored.request;
  }catch{return null}
}

export function discardWindowsSignup(storage,request) {
  try{
    const stored=JSON.parse(storage.getItem(signupKey));
    if(stored?.request?.challenge===request.challenge)storage.removeItem(signupKey);
  }catch{}
}

export async function requestWindowsSync(client,uid,body,pin=null) {
  if(!validUid(uid))throw Error('account_required');
  const {data,error}=await client.auth.getSession();
  const session=data?.session;
  if(error||session?.user?.id!==uid||typeof session.access_token!=='string'||!session.access_token)throw Error('account_changed');
  if(pin?.token&&session.access_token!==pin.token)throw Error('account_changed');
  const {data:identity,error:identityError}=await client.auth.getUser(session.access_token);
  if(identityError||identity?.user?.id!==uid)throw Error('account_changed');
  if(pin){
    const {data:latest,error:latestError}=await client.auth.getSession();
    if(latestError||latest?.session?.user?.id!==uid||latest?.session?.access_token!==session.access_token||!pin.active())throw Error('account_changed');
  }
  const {data:reply,error:requestError}=await client.functions.invoke('aimroutine-windows',{
    method:'POST',headers:{Authorization:'Bearer '+session.access_token},body
  });
  if(requestError){
    let code=null;
    try{
      const response=await requestError.context?.json();
      code=response?.code??response?.error??null;
    }catch{}
    throw Object.assign(Error('windows_sync_failed'),{status:requestError.context?.status,code});
  }
  return reply;
}

export function formatWindowsNumber(value,locale,unit='') {
  return typeof value==='number'&&Number.isFinite(value)
    ?new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value)+unit:'—';
}

function formatWindowsDate(value,locale,time=false) {
  if(typeof value!=='string')return '—';
  const date=new Date(value.length===10?value+'T12:00:00':value);
  return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(locale,{dateStyle:'short',...(time?{timeStyle:'short'}:{})}).format(date);
}
const displayString=value=>typeof value==='string'&&value?value:'—';

export function attachWindowsSync(client,{onPairingChange,onSwitchAccount}={}) {
  const node=id=>document.getElementById('windows-'+id);
  const panel=node('sync'),status=node('status'),pairing=node('pairing'),device=node('device');
  const approve=node('approve'),cancel=node('cancel'),refresh=node('refresh'),revoke=node('revoke'),more=node('more');
  const accountLabel=node('pairing-account'),linked=node('linked'),summary=node('device-summary');
  const table=node('table'),body=node('results');
  const desktop=node('auth-context'),desktopStatus=node('auth-status'),continueButton=node('continue'),switchButton=node('switch-account');
  const dismissButton=node('dismiss'),googleButton=node('google');
  const topLevel=window.self===window.top;
  const sessionStore={
    getItem:key=>window.sessionStorage.getItem(key),
    setItem:(key,value)=>window.sessionStorage.setItem(key,value),
    removeItem:key=>window.sessionStorage.removeItem(key)
  };
  let request=captureWindowsPairing(location,history,sessionStore);
  let account=null,ready=false,revision=0,busy=false,statusKey=request?'pending':'guest';
  let expiryTimer=null,desktopOutcome=null;
  let devices=[],selectedId=null,results=[],nextOffset=null;

  function language(){return document.documentElement.lang.startsWith('en')?1:0}
  function copy(key){return translations[key][language()]}
  function locale(){return language()?'en-GB':'fr-FR'}
  function clearChallenge(){
    const previous=request;
    request=null;
    clearTimeout(expiryTimer);
    try{sessionStore.removeItem(pendingKey)}catch{}
    if(previous)onPairingChange?.(null,previous);
  }
  function armExpiry(){
    clearTimeout(expiryTimer);
    if(!request?.mode)return;
    expiryTimer=setTimeout(()=>{
      clearChallenge();
      desktopOutcome='expired';
      statusKey='expired';
      render();
    },Math.max(0,request.expiresAt-Date.now()));
  }
  function render(){
    const english=language(),format=locale(),selection=devices.find(item=>item.id===selectedId);
    status.textContent=copy(statusKey);
    const desktopPending=Boolean(request?.mode);
    desktop.hidden=!desktopPending&&!desktopOutcome;
    desktopStatus.textContent=copy(desktopOutcome||(!topLevel?'embedded':statusKey));
    continueButton.hidden=!desktopPending||!ready;
    continueButton.disabled=busy||!topLevel;
    continueButton.textContent=(english?'Continue with ':'Continuer avec ')+(account?.email||(english?'this account':'ce compte'));
    switchButton.hidden=!desktopPending||!account;
    switchButton.disabled=busy||!topLevel;
    googleButton.hidden=request?.mode!=='google'||!account;
    googleButton.disabled=busy||!topLevel;
    dismissButton.hidden=!desktopPending;
    dismissButton.disabled=busy;
    pairing.hidden=!request||desktopPending;
    accountLabel.textContent=account?.email
      ?(english?'Signed-in account: ':'Compte connecté : ')+account.email:'';
    approve.disabled=!ready||busy||!request||!topLevel;
    cancel.disabled=busy;
    refresh.hidden=!ready;
    refresh.disabled=busy;
    revoke.disabled=busy;
    device.disabled=busy;
    more.disabled=busy;
    linked.hidden=!ready||!selection;
    table.hidden=!results.length;
    more.hidden=nextOffset===null;
    device.replaceChildren(...devices.map((item,index)=>{
      const option=document.createElement('option');
      option.value=item.id;
      option.textContent=(english?'Profile ':'Profil ')+(index+1)+' · '+formatWindowsDate(item.createdAt,format,true);
      option.selected=item.id===selectedId;
      return option;
    }));
    summary.textContent=selection
      ?(english?'Windows results: ':'Résultats Windows : ')+formatWindowsNumber(selection.resultCount,format)
        +' · '+(english?'Last upload: ':'Dernier envoi : ')+formatWindowsDate(selection.updatedAt,format,true)
      :'';
    body.replaceChildren(...results.map(result=>{
      const row=document.createElement('tr');
      const seconds=result.durationSeconds;
      const duration=Number.isInteger(seconds)&&seconds>=0
        ?(seconds>=60?Math.floor(seconds/60)+' min ':'')+seconds%60+' s':'—';
      const fields=[
        formatWindowsDate(result.date,format),null,duration,
        formatWindowsNumber(result.score,format),formatWindowsNumber(result.accuracy,format,' %'),
        formatWindowsNumber(result.headshot,format,' %'),formatWindowsNumber(result.mood,format,' / 5'),displayString(result.notes)
      ];
      for(const value of fields){
        const cell=row.insertCell();
        if(value!==null){cell.textContent=value;continue;}
        const name=document.createElement('strong'),software=document.createElement('small');
        name.textContent=displayString(result.exercise);software.textContent=displayString(result.software);
        cell.append(name,software);
      }
      return row;
    }));
  }

  function active(id,generation){return ready&&account?.id===id&&revision===generation}

  async function run(task,onFailure,approval=null){
    if(busy||!ready)return;
    const id=account.id,generation=revision;
    const current=()=>active(id,generation);
    const call=details=>requestWindowsSync(client,id,details,approval);
    busy=true;
    render();
    try{await task(call,current)}
    catch(error){if(current())statusKey=onFailure?.(error)??'error'}
    finally{if(current()){busy=false;render()}}
  }

  async function readResults(request,current,id,offset=0){
    const data=await request({action:'results',id,offset});
    if(!Array.isArray(data?.results)||!(data.nextOffset===null||Number.isSafeInteger(data.nextOffset)&&data.nextOffset>offset))throw Error('invalid_windows_results');
    if(!current())return;
    const items=data.results.filter(result=>typeof result?.id==='string');
    results=[...new Map([...(offset?results:[]),...items].map(result=>[result.id,result])).values()];
    nextOffset=data.nextOffset;
  }

  async function refreshHistory(call,current){
    const data=await call({action:'devices'});
    if(!Array.isArray(data?.devices))throw Error('invalid_windows_devices');
    if(!current())return;
    devices=data.devices.filter(item=>typeof item?.id==='string'&&item.id&&Number.isSafeInteger(item.resultCount)&&item.resultCount>=0);
    if(!devices.some(item=>item.id===selectedId))selectedId=devices[0]?.id??null;
    results=[];nextOffset=null;
    if(selectedId)await readResults(call,current,selectedId);
    if(current())statusKey=request?request.mode?'desktopApproval':'approval':!selectedId?'unlinked':results.length?'loaded':'empty';
  }

  function load(){
    if(!ready||busy)return;
    if(!request)statusKey='loading';
    void run(refreshHistory);
  }

  function approvePairing(pin=null){
    if(!request||!topLevel||!ready||busy)return;
    const captured=request;
    if(pin&&(pin.request!==captured||pin.uid!==account.id))return;
    if(captured.mode&&captured.expiresAt<=Date.now())return;
    statusKey='connecting';
    const uid=account.id;
    const activePairing=()=>ready&&account?.id===uid&&request===captured&&(!captured.mode||captured.expiresAt>Date.now());
    const approval={token:pin?.token,active:activePairing};
    void run(async(call,current)=>{
      const data=await call({action:'approve',challenge:captured.challenge});
      if(data?.ok!==true)throw Error('invalid_windows_approval');
      if(current()&&request===captured){
        clearChallenge();
        if(captured.mode)desktopOutcome='desktopApproved';
        statusKey='approved';
      }
    },error=>{
      if(!activePairing())return statusKey;
      if(error?.code==='device_limit')return 'deviceLimit';
      if(error?.message==='account_changed')return captured.mode?'desktopApproval':'approval';
      if([404,409,410].includes(error?.status)){
        clearChallenge();
        if(captured.mode)desktopOutcome='expired';
        return 'expired';
      }
      return 'error';
    },approval);
  }
  approve.addEventListener('click',()=>approvePairing());
  continueButton.addEventListener('click',()=>approvePairing());
  switchButton.addEventListener('click',()=>onSwitchAccount?.());
  function dismissPairing(){
    clearChallenge();
    statusKey=ready?'canceled':'guest';
    if(ready)load();
    else render();
  }
  cancel.addEventListener('click',dismissPairing);
  dismissButton.addEventListener('click',dismissPairing);
  refresh.addEventListener('click',load);
  device.addEventListener('change',()=>{
    if(!devices.some(item=>item.id===device.value))return;
    selectedId=device.value;results=[];nextOffset=null;statusKey='loading';
    void run(async(request,current)=>{
      await readResults(request,current,selectedId);
      if(current())statusKey=results.length?'loaded':'empty';
    });
  });
  more.addEventListener('click',()=>{
    if(!selectedId||nextOffset===null)return;
    void run(async(request,current)=>{
      await readResults(request,current,selectedId,nextOffset);
      if(current())statusKey='loaded';
    });
  });
  revoke.addEventListener('click',()=>{
    if(!selectedId||!window.confirm(copy('revokeConfirm')))return;
    const id=selectedId;
    void run(async(request,current)=>{
      const data=await request({action:'revoke',id});
      if(data?.ok!==true)throw Error('invalid_windows_revocation');
      if(!current())return;
      devices=devices.filter(item=>item.id!==id);
      selectedId=devices[0]?.id??null;
      results=[];nextOffset=null;
      statusKey='revoked';
      if(selectedId)await readResults(request,current,selectedId).catch(()=>{});
    });
  });
  function startPairing(next,scroll=true){
    request=next;
    desktopOutcome=null;
    statusKey=ready?(request.mode?'desktopApproval':'approval'):'pending';
    armExpiry();
    onPairingChange?.(request);
    render();
    if(scroll)(request.mode?desktop:panel).scrollIntoView({block:'start'});
  }
  window.addEventListener('hashchange',()=>{
    if(!readWindowsPairingFragment(location.hash))return;
    startPairing(captureWindowsPairing(location,history,sessionStore));
  });
  window.addEventListener('focus',()=>{if(!request&&['approved','unlinked','empty'].includes(statusKey))load()});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if(request){
    armExpiry();
    const target=request.mode?desktop:panel;
    if(!target.contains(document.activeElement))requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  }
  render();

  function setAccount(next,enabled,{preservePairing=false,approval=null}={}){
    const unchanged=account?.id===next?.id&&ready===Boolean(enabled);
    if(account&&account.id!==next?.id&&!preservePairing){
      clearChallenge();
      desktopOutcome=null;
    }
    account=next;
    ready=Boolean(account&&enabled);
    if(unchanged){
      if(approval&&request===approval.request)approvePairing(approval);
      else render();
      return;
    }
    revision+=1;busy=false;devices=[];selectedId=null;results=[];nextOffset=null;
    statusKey=ready?(request?request.mode?'desktopApproval':'approval':'loading'):(request?'pending':'guest');
    if(ready&&approval&&request===approval.request&&topLevel)approvePairing(approval);
    else if(ready&&!request?.mode)load();
    else render();
  }
  function adoptSignup(next){
    savePairing(sessionStore,next);
    startPairing(next);
  }
  return {setAccount,adoptSignup,pairing:()=>request,canPair:()=>topLevel&&Boolean(request?.mode)&&request.expiresAt>Date.now()};
}
