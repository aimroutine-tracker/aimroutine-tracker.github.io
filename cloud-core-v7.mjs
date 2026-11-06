/* AimRoutine Tracker Cloud v7 — browser-agnostic safety helpers. */
export const UID_STORAGE_KEY='aimroutine_cloud_current_uid';
export const TRAINING_KEY='aimroutine_web_training_v2';
export const LEGACY_KEY='aimroutine_web_training_v1';
export const EXT_KEY='aimroutine_player_extensions_v1';
export const GUEST_PREFIX='aimroutine_';
export const CLOUD_STATUS_PREFIX='aimroutine_cloud_enabled_';
export const CLOUD_META_PREFIX='aimroutine_cloud_meta_';

export const validUid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function scopedKey(key,uid){
  if(!validUid(uid))return key;
  if(typeof key!=='string'||!key.startsWith('aimroutine_'))throw Error('Clé locale invalide');
  return 'aimroutine_cloud_user_'+uid+'_'+key;
}
export function activeUid(){
  const id=typeof window!=='undefined'?window.__aimCloudUserId:null;
  return validUid(id)?id:null;
}
export function storageKey(key){return scopedKey(key,activeUid());}
export function freshCloudMeta(){return {version:1,profileHash:null,prefsHash:null,presetDeletedIds:[]};}
export function safeMeta(meta){
  if(!meta||typeof meta!=='object')return freshCloudMeta();
  return {version:1,profileHash:typeof meta.profileHash==='string'?meta.profileHash:null,
    prefsHash:typeof meta.prefsHash==='string'?meta.prefsHash:null,
    presetDeletedIds:Array.isArray(meta.presetDeletedIds)?meta.presetDeletedIds.filter(x=>typeof x==='string'&&x.length<101).slice(-100):[]};
}
export function uniqueById(values){
 const found=new Map();
 for(const v of values||[])if(v&&typeof v==='object'&&typeof v.id==='string')found.set(v.id,v);
 return [...found.values()];
}
export function mergeRecords(local,remote,deletedIds=[]){
 const deleteSet=new Set(deletedIds);
 const found=new Map(uniqueById(remote).map(x=>[x.id,x]));
 for(const row of uniqueById(local))if(!deleteSet.has(row.id)&&!found.has(row.id))found.set(row.id,row);
 for(const id of deleteSet)found.delete(id);
 return [...found.values()];
}
export function changedRecords(local,remote){
 const ids=new Set(uniqueById(remote).map(v=>v.id));
 return uniqueById(local).filter(x=>!ids.has(x.id));
}
export function safeRedirect(raw,allow=['account.html','training.html']){
 try{
  const u=new URL(raw,'https://aimroutine-tracker.github.io/');
  if(u.origin!=='https://aimroutine-tracker.github.io')return 'account.html';
  const pathname=u.pathname.split('/').pop();
  return allow.includes(pathname)?pathname:'account.html';
 }catch{return 'account.html'}
}
