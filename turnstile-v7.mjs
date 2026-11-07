/* AimRoutine account Cloudflare Turnstile adapter. Public site key ONLY.
 * Siteverify runs inside Supabase Auth once the project owner enables
 * Cloudflare Turnstile in Authentication > Attack Protection.
 * Never add the Turnstile secret key to this repository or HTML. */
export const TURNSTILE_SITE_KEY='0x4AAAAAAF32lny7msT5dyQh';
export const TURNSTILE_SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise=null;
function loadTurnstile(){
 if(typeof window==='undefined'||typeof document==='undefined')throw Error('Turnstile est uniquement disponible dans le navigateur.');
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!scriptPromise){
  scriptPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=TURNSTILE_SCRIPT;
   script.async=true;
   script.defer=true;
   script.onload=()=>{
    if(window.turnstile)resolve(window.turnstile);
    else reject(Error('La protection Turnstile ne s’est pas initialisée.'));
   };
   script.onerror=()=>reject(Error('Impossible de charger la protection anti-robots.'));
   document.head.appendChild(script);
  }).catch(error=>{scriptPromise=null;throw error});
 }
 return scriptPromise;
}

export function createAuthCaptcha(siteKey=TURNSTILE_SITE_KEY,{loadApi=loadTurnstile}={}){
 if(typeof siteKey!=='string')throw TypeError('Site key must be a string');
 const enabled=siteKey.trim().length>0;
 const widgets=new Map(),tokens=new Map(),pending=new Map();
 async function mount(mode,element){
  if(!enabled)return false;
  if(!['login','signup','reset','delete'].includes(mode))throw Error('Mode CAPTCHA inconnu');
  if(!element)throw Error('Emplacement Turnstile introuvable.');
  if(widgets.has(mode))return true;
  if(pending.has(mode))return pending.get(mode);
  const run=(async()=>{
   const api=await loadApi();
   if(!api||typeof api.render!=='function')throw Error('Turnstile indisponible.');
   const widgetId=api.render(element,{
    sitekey:siteKey,
    action:mode,
    theme:'auto',
    callback:token=>{
     if(typeof token==='string'&&token)tokens.set(mode,token);
     else tokens.delete(mode);
    },
    'expired-callback':()=>tokens.delete(mode),
    'error-callback':()=>tokens.delete(mode),
    'timeout-callback':()=>tokens.delete(mode)
   });
   if(widgetId===null||widgetId===undefined)throw Error('Échec de l’affichage du CAPTCHA.');
   widgets.set(mode,{api,id:widgetId});
   return true;
  })();
  pending.set(mode,run);
  try{return await run}finally{pending.delete(mode)}
 }
 function options(mode){
  if(!enabled)return {};
  const token=tokens.get(mode);
  if(!token||!widgets.has(mode))throw Error('Valide la vérification anti-robots avant de continuer.');
  return {captchaToken:token};
 }
 function reset(mode){
  tokens.delete(mode);
  const widget=widgets.get(mode);
  if(widget&&typeof widget.api.reset==='function')widget.api.reset(widget.id);
 }
 return {enabled,mount,options,reset};
}
