/* AimRoutine Cloud v7. Initial and incremental synchronization.
   User ownership is enforced by Supabase RLS; browser-side checks are defense in depth. */
import {TRAINING_KEY,LEGACY_KEY,EXT_KEY,scopedKey,CLOUD_META_PREFIX,safeMeta,mergeRecords,changedRecords} from './cloud-core-v7.mjs';
import {normalizeStore,validSession,validPreset} from './training-core-v5.mjs';
import {cleanExtension} from './training-v6-core.mjs';

const STORAGE_LIMIT=1000;
const parseJSON=s=>{try{return JSON.parse(s)}catch{return null}};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const metaKey=uid=>CLOUD_META_PREFIX+uid;
const enabledKey=uid=>'aimroutine_cloud_enabled_'+uid;
export const isEnabled=uid=>localStorage.getItem(enabledKey(uid))==='yes';
export const setEnabled=(uid,value)=>localStorage.setItem(enabledKey(uid),value?'yes':'no');
export function readUserLocal(uid){
 const s=parseJSON(localStorage.getItem(scopedKey(TRAINING_KEY,uid)));
 const old=parseJSON(localStorage.getItem(scopedKey(LEGACY_KEY,uid)));
 const ext=parseJSON(localStorage.getItem(scopedKey(EXT_KEY,uid)));
 return {store:normalizeStore(s,old),ext:cleanExtension(ext)};
}
function readMeta(uid){return safeMeta(parseJSON(localStorage.getItem(metaKey(uid))))}
function jsonSize(value){return new TextEncoder().encode(JSON.stringify(value)).length}
function writeLocal(uid,store,ext,meta){
 // Persist the validated data, then the synchronization cursor.
 localStorage.setItem(scopedKey(TRAINING_KEY,uid),JSON.stringify(normalizeStore(store,null)));
 localStorage.setItem(scopedKey(EXT_KEY,uid),JSON.stringify(cleanExtension(ext)));
 localStorage.setItem(metaKey(uid),JSON.stringify(meta));
}
async function fetchAll(client,table,order){
 const items=[];
 for(let from=0;from<11000;from+=1000){
  const {data,error}=await client.from(table).select('*').order(order,{ascending:true}).range(from,from+999);
  if(error)throw error;
  items.push(...(data||[]));
  if(!data||data.length<1000)return items;
 }
 throw Error('Trop de données pour la synchronisation automatique : contactez le support.');
}
async function upsertChunks(client,table,records){
 for(let i=0;i<records.length;i+=80){
  const {error}=await client.from(table).upsert(records.slice(i,i+80));
  if(error)throw error;
 }
}
export async function synchronize(client,uid,{guestImport=false}={}){
 if(!isEnabled(uid))throw Error('La sauvegarde cloud doit être activée depuis Mon compte.');
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user||user.id!==uid)throw Error('Session non validée : reconnecte-toi à ton compte.');
 const local=readUserLocal(uid);
 const meta=readMeta(uid);
 const [remoteSessions,remotePresets,profileResult,prefResult]=await Promise.all([
  fetchAll(client,'aim_sessions','session_id'),
  fetchAll(client,'aim_presets','preset_id'),
  client.from('aim_profiles').select('profile').eq('user_id',uid).maybeSingle(),
  client.from('aim_preferences').select('weekly_goal,settings').eq('user_id',uid).maybeSingle()
 ]);
 if(profileResult.error)throw profileResult.error;
 if(prefResult.error)throw prefResult.error;
 const count=remoteSessions.filter(x=>!x.deleted_at).length;
 const pcount=remotePresets.filter(x=>!x.deleted_at).length;
 if(count>STORAGE_LIMIT||pcount>25)throw Error('Le volume cloud dépasse les limites de l’espace AIM web.');

 // New sessions are immutable by ID, previously uploaded entries win if a copy differs.
 const sessById=new Map(remoteSessions.map(r=>[r.session_id,r]));
 const activeRemoteSessions=remoteSessions.filter(r=>!r.deleted_at).map(r=>r.payload).filter(validSession);
 const newSessions=local.store.sessions.filter(x=>!sessById.has(x.id));
 const mergedSessions=mergeRecords(local.store.sessions,activeRemoteSessions,
   remoteSessions.filter(x=>x.deleted_at).map(x=>x.session_id)).filter(validSession).slice(-STORAGE_LIMIT);

 // A deleted favorite is represented by a soft-delete tombstone, not an absence.
 const presetById=new Map(remotePresets.map(r=>[r.preset_id,r]));
 const pending=new Set(meta.presetDeletedIds);
 const validDeleted=[...pending].filter(id=>presetById.has(id)&&!presetById.get(id).deleted_at);
 for(const id of validDeleted){
  const row=presetById.get(id);
  const {error}=await client.from('aim_presets').update({deleted_at:new Date().toISOString()}).eq('user_id',uid).eq('preset_id',id);
  if(error)throw error;
  row.deleted_at=new Date().toISOString();
 }
 const cloudPresets=remotePresets.filter(r=>!r.deleted_at).map(r=>r.payload).filter(validPreset);
 const tombstones=[...pending,...remotePresets.filter(x=>x.deleted_at).map(x=>x.preset_id)];
 const mergedPresets=mergeRecords(local.store.presets,cloudPresets,tombstones).filter(validPreset).slice(-25);
 const newPresets=local.store.presets.filter(p=>!presetById.has(p.id)&&!pending.has(p.id));
 await upsertChunks(client,'aim_sessions',newSessions.map(x=>({user_id:uid,session_id:x.id,payload:x,deleted_at:null})));
 await upsertChunks(client,'aim_presets',newPresets.map(x=>({user_id:uid,preset_id:x.id,payload:x,deleted_at:null})));

 const localProfile=cleanExtension(local.ext);
 const remoteProfile=profileResult.data?.profile?cleanExtension(profileResult.data.profile):null;
 const localProfileString=JSON.stringify(localProfile);
 const profileWasModified=meta.profileHash!==null&&meta.profileHash!==localProfileString;
 let finalProfile=remoteProfile||localProfile;
 if(!remoteProfile||profileWasModified||guestImport){
   finalProfile=localProfile;
   if(jsonSize(finalProfile)>16000)throw Error('Le profil dépasse la taille maximale du cloud.');
   const {error}=await client.from('aim_profiles').upsert({user_id:uid,profile:finalProfile});
   if(error)throw error;
 }
 const localGoal=local.store.weeklyGoal;
 const localPrefsString=JSON.stringify({weeklyGoal:localGoal});
 const prefsChanged=meta.prefsHash!==null&&meta.prefsHash!==localPrefsString;
 let finalGoal=prefResult.data?.weekly_goal??localGoal;
 if(!prefResult.data||prefsChanged||guestImport){
   finalGoal=localGoal;
   const {error}=await client.from('aim_preferences').upsert({user_id:uid,weekly_goal:finalGoal,settings:{format:'aimroutine-web-v2'}});
   if(error)throw error;
 }
 const finalStore={...local.store,sessions:mergedSessions,presets:mergedPresets,weeklyGoal:finalGoal};
 meta.presetDeletedIds=[];
 meta.profileHash=JSON.stringify(finalProfile);
 meta.prefsHash=JSON.stringify({weeklyGoal:finalGoal});
 writeLocal(uid,finalStore,finalProfile,meta);
 return {
  synced:true,uploadedSessions:newSessions.length,uploadedFavorites:newPresets.length,
  downloadedSessions:mergedSessions.length,downloadedFavorites:mergedPresets.length,
  hadRemoteData:count>0||pcount>0
 };
}
export function collectFavoriteDeletion(uid,removed){
 if(!uid||!removed?.length)return;
 const meta=readMeta(uid);
 meta.presetDeletedIds=[...new Set([...meta.presetDeletedIds,...removed.map(x=>String(x))])].slice(-100);
 localStorage.setItem(metaKey(uid),JSON.stringify(meta));
}
export function importGuestIntoAccount(uid){
 const guest=normalizeStore(parseJSON(localStorage.getItem(TRAINING_KEY)),parseJSON(localStorage.getItem(LEGACY_KEY)));
 const guestExt=cleanExtension(parseJSON(localStorage.getItem(EXT_KEY)));
 const current=readUserLocal(uid),meta=readMeta(uid);
 const map=new Map(current.store.sessions.map(x=>[x.id,x]));
 for(const x of guest.sessions)if(!map.has(x.id))map.set(x.id,x);
 const presets=new Map(current.store.presets.map(x=>[x.id,x]));
 for(const x of guest.presets)if(!presets.has(x.id))presets.set(x.id,x);
 const store={...current.store,sessions:[...map.values()].slice(-STORAGE_LIMIT),presets:[...presets.values()].slice(-25),
   weeklyGoal:current.store.sessions.length?current.store.weeklyGoal:guest.weeklyGoal};
 const ext=current.store.sessions.length?current.ext:guestExt;
 // Preserve the guest copy untouched for recovery.
 writeLocal(uid,store,ext,meta);
 return {sessions:guest.sessions.length,favorites:guest.presets.length};
}
export async function deleteCloudProgress(client,uid){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user||user.id!==uid)throw Error('Session non validée.');
 // Remove only this user's AIM data. Auth account deletion is a separate operation.
 for(const table of ['aim_sessions','aim_presets','aim_profiles','aim_preferences']){
  const {error:deleteError}=await client.from(table).delete().eq('user_id',uid);
  if(deleteError)throw deleteError;
 }
 localStorage.removeItem(metaKey(uid));
 localStorage.removeItem(scopedKey(TRAINING_KEY,uid));
 localStorage.removeItem(scopedKey(EXT_KEY,uid));
 return true;
}
