/* Homepage V15 real figures. Guest data is local; account data is only read after auth verification. */
import {STORAGE_KEY,normalizeStore,computeStats} from './training-core-v5.mjs';
import {validUid,scopedKey} from './cloud-core-v7.mjs';
import {isEnabled,synchronize} from './cloud-sync-v7.mjs';
const set=(name,value)=>{const node=document.querySelector('[data-v15-stat="'+name+'"]');if(node)node.textContent=value};
const en=()=>document.documentElement.lang==='en';
const format=n=>Number(n).toLocaleString(en()?'en-GB':'fr-FR',{maximumFractionDigits:1});
const choose=(fr,english)=>en()?english:fr;
let lastCloudRead=0,hadCloudError=false;
async function render(){
 let key=STORAGE_KEY,allow=false,uid=null;
 try{
  const token=localStorage.getItem('sb-lmzswtzboobpokumxzhy-auth-token');
  if(token){
   allow=false;
   const {supabase}=await import('./cloud-client-v7.mjs');
   const {data,error}=await supabase.auth.getSession();
   if(!error&&validUid(data?.session?.user?.id)){
    const checked=await supabase.auth.getUser();
    if(!checked.error&&checked.data?.user?.id===data.session.user.id){
     uid=data.session.user.id;key=scopedKey(STORAGE_KEY,uid);allow=true;
     if(Date.now()-lastCloudRead>30000){
      lastCloudRead=Date.now();
      try{await synchronize(supabase,uid);hadCloudError=false}catch{hadCloudError=true}
     }
    }
   }
  }
 }catch{allow=false}
 if(!allow){
  for(const name of ['sessions','accuracy','week'])set(name,'—');
  set('cloud',choose('CONNEXION REQUISE','SIGN IN'));
  return;
 }
 let store;
 try{store=normalizeStore(JSON.parse(localStorage.getItem(key)||'null'),null)}
 catch{store=normalizeStore(null,null)}
 const stat=computeStats(store.sessions,store.weeklyGoal);
 set('sessions',format(stat.count));
 set('accuracy',stat.avg===null?'—':format(stat.avg)+' %');
 set('week',stat.week+' / '+stat.goal);
 set('cloud',uid?(hadCloudError?choose('EN ATTENTE','PENDING'):isEnabled(uid)?choose('AUTOMATIQUE','AUTOMATIC'):choose('NON DISPONIBLE','UNAVAILABLE')):choose('CONNEXION REQUISE','SIGN IN'));
}
document.querySelectorAll('[data-switch-lang]').forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(()=>void render())));
window.addEventListener('storage',e=>{if(e.key?.includes(STORAGE_KEY))void render()});
window.addEventListener('online',()=>void render());
window.addEventListener('focus',()=>void render());
void render();