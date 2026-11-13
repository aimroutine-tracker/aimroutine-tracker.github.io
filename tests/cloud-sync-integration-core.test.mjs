import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronize,setEnabled,readUserLocal,collectFavoriteDeletion,deleteCloudProgress} from '../cloud-sync-v7.mjs';
import {scopedKey,TRAINING_KEY,LEGACY_KEY,EXT_KEY} from '../cloud-core-v7.mjs';

// Deterministic in-memory Supabase API: emulates owner-only RLS for sync logic.
// Live PostgreSQL RLS is tested separately, inside a fully rolled-back transaction.
const USER_A='11111111-1111-4111-8111-111111111111';
const USER_B='22222222-2222-4222-8222-222222222222';
class MemoryStorage {
 constructor(){this.data=new Map()}
 getItem(key){return this.data.has(key)?this.data.get(key):null}
 setItem(key,value){this.data.set(String(key),String(value))}
 removeItem(key){this.data.delete(key)}
 key(index){return [...this.data.keys()][index]??null}
 get length(){return this.data.size}
}
function makeDb(){return Object.fromEntries(['aim_profiles','aim_preferences','aim_sessions','aim_presets'].map(k=>[k,[]]))}
function primary(table,row){
 return table==='aim_sessions'?row.user_id+'/'+row.session_id:
   table==='aim_presets'?row.user_id+'/'+row.preset_id:row.user_id;
}
function clientFor(db,uid){
 class Query {
  constructor(table,mode='select',values=null){this.table=table;this.mode=mode;this.values=values;this.filters=[];this.sortKey=null}
  select(){return this}
  eq(key,value){this.filters.push([key,value]);return this}
  order(key){this.sortKey=key;return this}
  range(start,end){return this.exec().then(({data,error})=>({error,data:data.slice(start,end+1)}))}
  maybeSingle(){return this.exec().then(({data,error})=>({error,data:data[0]??null}))}
  update(values){return new Query(this.table,'update',values)}
  delete(){return new Query(this.table,'delete')}
  async upsert(values,options={}){
   for(const source of (Array.isArray(values)?values:[values])){
    if(source.user_id!==uid)return {error:Error('permission denied by RLS')};
    const rows=db[this.table], key=primary(this.table,source);
    const existing=rows.findIndex(x=>primary(this.table,x)===key);
    if(existing>=0){if(!options.ignoreDuplicates)rows[existing]={...rows[existing],...structuredClone(source)};}
    else rows.push(structuredClone(source));
   }
   return {error:null};
  }
  async exec(){
   const rows=db[this.table];
   const selected=rows.filter(row=>row.user_id===uid&&this.filters.every(([key,value])=>row[key]===value));
   if(this.mode==='select')return {data:this.sortKey?[...selected].sort((a,b)=>String(a[this.sortKey]).localeCompare(String(b[this.sortKey]))):[...selected],error:null};
   if(this.mode==='update')for(const row of selected)Object.assign(row,structuredClone(this.values));
   if(this.mode==='delete')for(const row of selected){const i=rows.indexOf(row);if(i>=0)rows.splice(i,1)}
   return {data:selected,error:null};
  }
  then(resolve,reject){return this.exec().then(resolve,reject)}
 }
 return {auth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
   from(table){assert.ok(db[table],table);return new Query(table)},
   async rpc(name,args){
    assert.equal(name,'aim_reset_my_progress_for_user');
    assert.equal(typeof args?.expected_uid,'string','Client must pass expected_uid');
    // The new RPC rejects a mismatched expected owner even if the JWT belongs to
    // an authenticated but different user.
    if(args?.expected_uid!==uid)return {data:null,error:Object.assign(Error('account_mismatch'),{code:'42501'})};
    // Real function uses SECURITY INVOKER + RLS and returns the reset cursor.
    for(const table of ['aim_sessions','aim_presets','aim_profiles']){
     db[table]=db[table].filter(row=>row.user_id!==uid);
    }
    const stamp=new Date().toISOString();
    const marker={user_id:uid,weekly_goal:3,
      settings:{format:'aimroutine-web-v2',reset_at:stamp}};
    const preferences=db.aim_preferences;
    const idx=preferences.findIndex(x=>x.user_id===uid);
    if(idx>=0)preferences[idx]={...preferences[idx],...marker};
    else preferences.push(marker);
    return {data:stamp,error:null};
   }
 };
}
const session=id=>({id,date:'2026-11-06T12:00:00.000Z',rank:'silver',
 focus:'micro',tool:'Aim Lab',scenario:'Microshot',minutes:15,accuracy:80,
 feeling:'good',notes:''});
const preset=id=>({id,name:'Aim 15min',rank:'silver',focus:'micro',
 breakSeconds:30,exercises:[{name:'Microshot',tool:'Aim Lab',minutes:15,tip:''}]});
function write(store,uid,sessions=[],presets=[]){
 store.setItem(scopedKey(TRAINING_KEY,uid),JSON.stringify({sessions,presets,weeklyGoal:4}));
}
async function use(store,fn){
 globalThis.localStorage=store;
 return await fn();
}
test('account-bound RPC rejects a late JWT switch from A to B without deleting either user',async()=>{
 const db=makeDb(),store=new MemoryStorage(),asB=clientFor(db,USER_B);
 db.aim_sessions.push(
  {user_id:USER_A,session_id:'private-a',payload:session('private-a'),deleted_at:null},
  {user_id:USER_B,session_id:'private-b',payload:session('private-b'),deleted_at:null}
 );
 let identityChecks=0,requests=0;
 const client={
  auth:{getUser:async()=>{
   identityChecks++;
   // The Auth checks see A, but the HTTP request carries a newer B JWT.
   return {data:{user:{id:USER_A}},error:null};
  }},
  async rpc(name,args){requests++;return asB.rpc(name,args)}
 };
 await use(store,async()=>{
  write(store,USER_A,[session('cached-a')]);
  await assert.rejects(deleteCloudProgress(client,USER_A),/Suppression annulée.*session/);
  assert.equal(identityChecks,2,'A was verified before the destructive request');
  assert.equal(requests,1,'New bound RPC was invoked exactly once');
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(s=>s.id),['cached-a']);
  assert.equal(store.getItem(scopedKey(TRAINING_KEY,USER_B)),null);
 });
 assert.deepEqual(db.aim_sessions.map(r=>r.session_id),['private-a','private-b'],
  'Neither account can be wiped by a request with mismatched JWT and expected UID');
});

test('Cloud deletion fails closed if bound RPC is not deployed, keeping local progress',async()=>{
 const db=makeDb(),store=new MemoryStorage(),base=clientFor(db,USER_A);
 let calls=0;
 const client={...base,async rpc(name,args){
  calls++;
  assert.equal(name,'aim_reset_my_progress_for_user');
  assert.deepEqual(args,{expected_uid:USER_A});
  return {data:null,error:Object.assign(Error('Could not find the function'),{code:'PGRST202'})};
 }};
 await use(store,async()=>{
  write(store,USER_A,[session('never-erase-without-server')]);
  await assert.rejects(deleteCloudProgress(client,USER_A),/Suppression indisponible.*serveur Cloud.*conservée/);
  assert.equal(calls,1);
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(s=>s.id),
   ['never-erase-without-server']);
 });
});

test('two devices merge offline training without cross-account data, honor favorite tombstones',async()=>{
 const db=makeDb(),a1=new MemoryStorage(),a2=new MemoryStorage(),b1=new MemoryStorage();
 const ca=clientFor(db,USER_A),cb=clientFor(db,USER_B);
 await use(a1,async()=>{
  setEnabled(USER_A,true);write(a1,USER_A,[session('a-one')],[preset('fav')]);
  const r=await synchronize(ca,USER_A);
  assert.equal(r.uploadedSessions,1);assert.equal(r.uploadedFavorites,1);
 });
 await use(a2,async()=>{
  setEnabled(USER_A,true);
  const r=await synchronize(ca,USER_A);
  assert.equal(r.downloadedSessions,1);
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(s=>s.id),['a-one']);
 });
 await use(b1,async()=>{
  setEnabled(USER_B,true);write(b1,USER_B,[session('b-one')]);
  const r=await synchronize(cb,USER_B);
  assert.equal(r.uploadedSessions,1);
  assert.deepEqual(readUserLocal(USER_B).store.sessions.map(s=>s.id),['b-one']);
 });
 assert.equal(db.aim_sessions.length,2);
 // Two devices modify A's training while offline; reconnect in opposite order.
 await use(a2,async()=>{
  write(a2,USER_A,[session('a-one'),session('a-offline')],[preset('fav')]);
 });
 await use(a1,async()=>{
  write(a1,USER_A,[session('a-one'),session('a-online')],[preset('fav')]);
  await synchronize(ca,USER_A);
 });
 await use(a2,async()=>{
  const r=await synchronize(ca,USER_A);
  assert.equal(r.uploadedSessions,1);
  assert.deepEqual(new Set(readUserLocal(USER_A).store.sessions.map(s=>s.id)),
   new Set(['a-one','a-online','a-offline']));
  // Favorite deletion on device 2 must not reappear after device 1 syncs.
  const current=readUserLocal(USER_A).store;
  write(a2,USER_A,current.sessions,[]);
  collectFavoriteDeletion(USER_A,['fav']);
  await synchronize(ca,USER_A);
  assert.equal(readUserLocal(USER_A).store.presets.length,0);
 });
 await use(a1,async()=>{
  await synchronize(ca,USER_A);
  assert.equal(readUserLocal(USER_A).store.presets.length,0);
 });
 assert.equal(db.aim_presets.find(x=>x.user_id===USER_A)?.deleted_at!==null,true);
 assert.equal(db.aim_sessions.filter(x=>x.user_id===USER_B).length,1);
 await use(b1,async()=>{
  assert.deepEqual(readUserLocal(USER_B).store.sessions.map(s=>s.id),['b-one']);
  const r=await synchronize(cb,USER_B);
  assert.equal(r.downloadedSessions,1);
 });
 await use(a1,async()=>{
  // Old V1 data must never reappear when deleting V2 and cloud progress.
  a1.setItem(scopedKey(LEGACY_KEY,USER_A),JSON.stringify({sessions:[session('legacy-reborn')]}));
  await deleteCloudProgress(ca,USER_A);
  assert.equal(a1.getItem(scopedKey(LEGACY_KEY,USER_A)),null);
  assert.equal(readUserLocal(USER_A).store.sessions.length,0);
 });
 assert.equal(db.aim_sessions.filter(x=>x.user_id===USER_A).length,0);
 assert.equal(db.aim_sessions.filter(x=>x.user_id===USER_B).length,1);
 const cloudReset=db.aim_preferences.find(x=>x.user_id===USER_A)?.settings?.reset_at;
 assert.ok(Number.isFinite(Date.parse(cloudReset)),'Cloud deletion must publish a reset cursor');
 await use(a2,async()=>{
  // Device 2 remained offline during deletion; it still holds obsolete local V2/V1 data.
  assert.ok(readUserLocal(USER_A).store.sessions.length>0);
  a2.setItem(scopedKey(LEGACY_KEY,USER_A),JSON.stringify({sessions:[session('resurrected-v1')]}));
  await synchronize(ca,USER_A);
  assert.deepEqual(readUserLocal(USER_A).store.sessions,[]);
  assert.deepEqual(readUserLocal(USER_A).store.presets,[]);
  assert.equal(a2.getItem(scopedKey(LEGACY_KEY,USER_A)),null);
 });
 assert.equal(db.aim_sessions.filter(x=>x.user_id===USER_A).length,0,
  'Offline device must not restore deleted sessions on reconnect');
 assert.equal(db.aim_presets.filter(x=>x.user_id===USER_A).length,0,
  'Offline device must not restore deleted presets on reconnect');
 await use(a1,async()=>{
  write(a1,USER_A,[session('post-reset-new')]);
  await synchronize(ca,USER_A);
  assert.equal(db.aim_preferences.find(x=>x.user_id===USER_A).settings.reset_at,cloudReset,
   'Regular sync must preserve reset marker after new training');
 });
 await use(a2,async()=>{
  await synchronize(ca,USER_A);
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(x=>x.id),['post-reset-new']);
 });
 assert.equal(db.aim_sessions.filter(x=>x.user_id===USER_B).length,1);
});
test('authenticated uid mismatch rejects sync and cloud deletion',async()=>{
 const db=makeDb(),store=new MemoryStorage(),cb=clientFor(db,USER_B);
 await use(store,async()=>{
  setEnabled(USER_A,true);
  await assert.rejects(synchronize(cb,USER_A),/Session non validée/);
  await assert.rejects(deleteCloudProgress(cb,USER_A),/Session non validée/);
 });
});

test('concurrent inserts of the same session ID preserve the first database writer',async()=>{
 const db=makeDb(),storage=new MemoryStorage(),client=clientFor(db,USER_A);
 let raceInjected=false;
 const competingClient={
  ...client,
  from(table){
   const query=client.from(table);
   if(table==='aim_sessions'){
    const original=query.upsert.bind(query);
    query.upsert=async(records,options)=>{
     assert.equal(options?.ignoreDuplicates,true);
     assert.equal(options?.onConflict,'user_id,session_id');
     if(!raceInjected){
      raceInjected=true;
      const won={...session('same-id'),accuracy:97};
      db.aim_sessions.push({user_id:USER_A,session_id:won.id,payload:won,deleted_at:null});
     }
     return original(records,options);
    };
   }
   return query;
  }
 };
 await use(storage,async()=>{
  setEnabled(USER_A,true);
  write(storage,USER_A,[session('same-id')]);
  await synchronize(competingClient,USER_A);
  assert.equal(db.aim_sessions.length,1);
  assert.equal(db.aim_sessions[0].payload.accuracy,97,'Never overwrite a concurrent writer');
  await synchronize(client,USER_A);
  assert.equal(readUserLocal(USER_A).store.sessions[0].accuracy,97,'Next sync converges on cloud winner');
 });
});


test('reset never calls its destructive RPC if the account switches without a pending save',async()=>{
 const db=makeDb(),store=new MemoryStorage(),base=clientFor(db,USER_A);
 let checks=0,rpcCalls=0;
 const client={...base,
  auth:{getUser:async()=>({data:{user:{id:++checks===1?USER_A:USER_B}},error:null})},
  rpc:async(...args)=>{rpcCalls++;return base.rpc(...args)}
 };
 await use(store,async()=>{
  write(store,USER_A,[session('kept-on-owner-switch')]);
  await assert.rejects(deleteCloudProgress(client,USER_A),/Session modifiée pendant la suppression/);
  assert.equal(checks,2,'Owner must be validated again even when there is no pending save');
  assert.equal(rpcCalls,0,'Never execute destructive RPC with a different authenticated owner');
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(x=>x.id),['kept-on-owner-switch']);
 });
});

test('reset response cannot clear the old account cache after a session change',async()=>{
 const db=makeDb(),store=new MemoryStorage(),base=clientFor(db,USER_A);
 let owner=USER_A,rpcCalls=0,unblockRpc,notifyRpc;
 const waitRpc=new Promise(resolve=>{unblockRpc=resolve});
 const rpcStarted=new Promise(resolve=>{notifyRpc=resolve});
 const client={...base,
  auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},
  async rpc(...args){
   rpcCalls++;
   notifyRpc();
   await waitRpc;
   return base.rpc(...args);
  }
 };
 await use(store,async()=>{
  write(store,USER_A,[session('locally-kept-until-user-revalidates')]);
  const deleting=deleteCloudProgress(client,USER_A);
  await rpcStarted;
  owner=USER_B; // B signs in while A's network response is still pending.
  unblockRpc();
  await assert.rejects(deleting,/Session modifiée pendant la suppression/);
  assert.equal(rpcCalls,1);
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(x=>x.id),
   ['locally-kept-until-user-revalidates'],
   'Do not clear A namespace after B becomes the authenticated account');
  assert.equal(store.getItem(scopedKey(TRAINING_KEY,USER_B)),null);
 });
});

test('reset waits for the in-flight save and queues subsequent syncs, preventing resurrection',async()=>{
 const db=makeDb(),store=new MemoryStorage(),base=clientFor(db,USER_A);
 let unblockSave,markSaveStarted;
 const saveGate=new Promise(resolve=>{unblockSave=resolve});
 const saveStarted=new Promise(resolve=>{markSaveStarted=resolve});
 let resetCalls=0;
 const client={
  ...base,
  from(table){
   const query=base.from(table);
   if(table==='aim_sessions'){
    const original=query.upsert.bind(query);
    query.upsert=async(...args)=>{
     markSaveStarted();
     await saveGate;
     return original(...args);
    };
   }
   return query;
  },
  async rpc(...args){resetCalls++;return base.rpc(...args)}
 };
 await use(store,async()=>{
  write(store,USER_A,[session('old-save-in-flight')]);
  const saving=synchronize(client,USER_A);
  await saveStarted;
  // Delete while the first network write is deliberately blocked.
  const deleting=deleteCloudProgress(client,USER_A);
  const duplicateDelete=deleteCloudProgress(client,USER_A);
  assert.strictEqual(deleting,duplicateDelete,'Duplicate reset requests should share one RPC');
  // An automatic sync triggered after Delete must run only after the reset.
  const queuedSync=synchronize(client,USER_A);
  await Promise.resolve();
  assert.equal(resetCalls,0,'Cloud reset must wait for pending writes');
  unblockSave();
  await saving;
  await deleting;
  await queuedSync;
  assert.equal(resetCalls,1,'Exactly one destructive RPC is allowed');
  assert.deepEqual(db.aim_sessions.filter(x=>x.user_id===USER_A),[],
   'Queued sync must never reupload sessions deleted by the reset');
  assert.equal(readUserLocal(USER_A).store.sessions.length,0);
  const resetAt=db.aim_preferences.find(x=>x.user_id===USER_A)?.settings?.reset_at;
  assert.ok(Number.isFinite(Date.parse(resetAt)));
  // A real new session created AFTER deletion is allowed to sync normally.
  write(store,USER_A,[session('created-after-reset')]);
  await synchronize(client,USER_A);
  assert.deepEqual(db.aim_sessions.filter(x=>x.user_id===USER_A).map(x=>x.session_id),
   ['created-after-reset']);
 });
});


test('failed reset releases its lock and preserves data for a safe retry',async()=>{
 const db=makeDb(),store=new MemoryStorage(),base=clientFor(db,USER_A);
 let rejectFirst=true;
 const client={...base,async rpc(name,args){
  if(rejectFirst){rejectFirst=false;return {data:null,error:Error('temporary reset error')};}
  return base.rpc(name,args);
 }};
 await use(store,async()=>{
  write(store,USER_A,[session('retain-until-confirmed')]);
  await synchronize(client,USER_A);
  await assert.rejects(deleteCloudProgress(client,USER_A),/temporary reset error/);
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(s=>s.id),
   ['retain-until-confirmed'],'A failed server reset must not erase local progress');
  await synchronize(client,USER_A); // Must not hang on a rejected reset lock.
  assert.equal(db.aim_sessions.filter(x=>x.user_id===USER_A).length,1);
  assert.equal(await deleteCloudProgress(client,USER_A),true);
  assert.equal(db.aim_sessions.filter(x=>x.user_id===USER_A).length,0);
  assert.equal(readUserLocal(USER_A).store.sessions.length,0);
 });
});


test('in-flight A sync cannot cache cloud data after the authenticated session changes to B',async()=>{
 const db=makeDb(),store=new MemoryStorage();
 db.aim_sessions.push(
  {user_id:USER_A,session_id:'cloud-a',payload:session('cloud-a'),deleted_at:null},
  {user_id:USER_B,session_id:'private-b',payload:session('private-b'),deleted_at:null}
 );
 // With a pre-existing profile and preferences, the sync can proceed from
 // remote reads straight to local persistence without a remote upsert.
 db.aim_profiles.push({user_id:USER_A,profile:{}});
 db.aim_preferences.push({user_id:USER_A,weekly_goal:3,settings:{format:'aimroutine-web-v2'}});
 const base=clientFor(db,USER_A);
 let authenticated=USER_A,verifiedCalls=0,switched=false;
 const ownerFilters=[];
 const client={
  ...base,
  auth:{getUser:async()=>{
   verifiedCalls++;
   return {data:{user:{id:authenticated}},error:null};
  }},
  from(table){
   const q=base.from(table);
   if(['aim_sessions','aim_presets'].includes(table)){
    const originalEq=q.eq.bind(q);
    q.eq=(column,value)=>{
     ownerFilters.push({table,column,value});
     return originalEq(column,value);
    };
   }
   if(table==='aim_sessions'){
    const originalRange=q.range.bind(q);
    q.range=async(...args)=>{
     const response=await originalRange(...args);
     if(!switched){switched=true;authenticated=USER_B}
     return response;
    };
   }
   return q;
  }
 };
 await use(store,async()=>{
  await assert.rejects(synchronize(client,USER_A),/Session modifiée pendant la synchronisation/);
  assert.equal(verifiedCalls,2,'Verify the session at entry and immediately before local persistence');
  assert.equal(store.getItem(scopedKey(TRAINING_KEY,USER_A)),null,'Do not cache A cloud data after account B takes over');
  assert.equal(store.getItem(scopedKey(TRAINING_KEY,USER_B)),null,'Do not leak A data into B cache');
  assert.deepEqual(ownerFilters,[
   {table:'aim_sessions',column:'user_id',value:USER_A},
   {table:'aim_presets',column:'user_id',value:USER_A}
  ]);
 });
 assert.deepEqual(db.aim_sessions.map(r=>r.session_id),['cloud-a','private-b'],'Neither account cloud data should be changed');
});

test('two devices converge on real player profile and weekly goal without leaking between accounts',async()=>{
 const db=makeDb();
 const deviceA1=new MemoryStorage(),deviceA2=new MemoryStorage(),deviceB=new MemoryStorage();
 const cloudA=clientFor(db,USER_A),cloudB=clientFor(db,USER_B);
 // First A device saves a genuine locally authored profile (no fictitious
 // account statistics) and a customized weekly goal.
 await use(deviceA1,async()=>{
  write(deviceA1,USER_A,[session('a-profile-session')]);
  deviceA1.setItem(scopedKey(EXT_KEY,USER_A),
   JSON.stringify({profile:{nickname:'AlphaTrainer',dpi:1600,sensitivity:0.215}}));
  await synchronize(cloudA,USER_A);
  assert.equal(db.aim_profiles.find(r=>r.user_id===USER_A).profile.profile.nickname,'AlphaTrainer');
  assert.equal(db.aim_preferences.find(r=>r.user_id===USER_A).weekly_goal,4);
 });
 // Device 2 must receive the profile and goal automatically after sync,
 // not just the session records already covered by the older integration test.
 await use(deviceA2,async()=>{
  await synchronize(cloudA,USER_A);
  const local=readUserLocal(USER_A);
  assert.equal(local.ext.profile.nickname,'AlphaTrainer');
  assert.equal(local.ext.profile.dpi,1600);
  assert.equal(local.store.weeklyGoal,4);
  assert.deepEqual(local.store.sessions.map(x=>x.id),['a-profile-session']);
 });
 // B remains completely independent, even though both users share one DB.
 await use(deviceB,async()=>{
  write(deviceB,USER_B,[session('private-b-profile')]);
  deviceB.setItem(scopedKey(EXT_KEY,USER_B),
   JSON.stringify({profile:{nickname:'BravoTrainer',dpi:800,sensitivity:0.3}}));
  await synchronize(cloudB,USER_B);
  assert.equal(readUserLocal(USER_B).ext.profile.nickname,'BravoTrainer');
  assert.deepEqual(readUserLocal(USER_B).store.sessions.map(x=>x.id),['private-b-profile']);
 });
 assert.equal(db.aim_profiles.length,2);
 assert.equal(db.aim_profiles.find(r=>r.user_id===USER_B).profile.profile.nickname,'BravoTrainer');
 // Edit A's profile and weekly target on device 2, after previously syncing.
 // Hash tracking must propagate the changes back to device 1.
 await use(deviceA2,async()=>{
  write(deviceA2,USER_A,[session('a-profile-session')]);
  deviceA2.setItem(scopedKey(TRAINING_KEY,USER_A),
   JSON.stringify({sessions:[session('a-profile-session')],presets:[],weeklyGoal:6}));
  deviceA2.setItem(scopedKey(EXT_KEY,USER_A),
   JSON.stringify({profile:{nickname:'AlphaUpdated',dpi:1200,sensitivity:0.22}}));
  await synchronize(cloudA,USER_A);
 });
 await use(deviceA1,async()=>{
  await synchronize(cloudA,USER_A);
  const local=readUserLocal(USER_A);
  assert.equal(local.ext.profile.nickname,'AlphaUpdated');
  assert.equal(local.ext.profile.dpi,1200);
  assert.equal(local.store.weeklyGoal,6);
  assert.deepEqual(local.store.sessions.map(x=>x.id),['a-profile-session']);
 });
 await use(deviceB,async()=>{
  await synchronize(cloudB,USER_B);
  assert.equal(readUserLocal(USER_B).ext.profile.nickname,'BravoTrainer');
  assert.equal(readUserLocal(USER_B).store.weeklyGoal,4);
  assert.deepEqual(readUserLocal(USER_B).store.sessions.map(x=>x.id),['private-b-profile']);
  assert.equal(deviceB.getItem(scopedKey(EXT_KEY,USER_A)),null);
 });
 assert.equal(db.aim_preferences.find(r=>r.user_id===USER_A).weekly_goal,6);
 assert.equal(db.aim_preferences.find(r=>r.user_id===USER_B).weekly_goal,4);
});

test('offline device cannot resurrect reset profile and weekly goal or alter a second account',async()=>{
 const db=makeDb(),a1=new MemoryStorage(),a2=new MemoryStorage(),b1=new MemoryStorage();
 const clientA=clientFor(db,USER_A),clientB=clientFor(db,USER_B);
 const profile=(name)=>JSON.stringify({profile:{nickname:name,dpi:1600,sensitivity:0.215}});
 // A and B have independent real user-owned settings.
 await use(a1,async()=>{
  write(a1,USER_A,[session('before-delete')]);
  a1.setItem(scopedKey(TRAINING_KEY,USER_A),JSON.stringify({
   sessions:[session('before-delete')],presets:[],weeklyGoal:6
  }));
  a1.setItem(scopedKey(EXT_KEY,USER_A),profile('BeforeReset'));
  await synchronize(clientA,USER_A);
 });
 await use(a2,async()=>{
  await synchronize(clientA,USER_A);
  assert.equal(readUserLocal(USER_A).ext.profile.nickname,'BeforeReset');
  assert.equal(readUserLocal(USER_A).store.weeklyGoal,6);
 });
 await use(b1,async()=>{
  write(b1,USER_B,[session('private-b-stays')]);
  b1.setItem(scopedKey(EXT_KEY,USER_B),profile('PrivateBravo'));
  await synchronize(clientB,USER_B);
 });
 // A1 deletes its own progress while A2 is offline with obsolete cache.
 await use(a1,async()=>{
  assert.equal(await deleteCloudProgress(clientA,USER_A),true);
  assert.equal(readUserLocal(USER_A).ext.profile.nickname,'');
  assert.equal(readUserLocal(USER_A).store.sessions.length,0);
 });
 await use(a2,async()=>{
  assert.equal(readUserLocal(USER_A).ext.profile.nickname,'BeforeReset');
  assert.equal(readUserLocal(USER_A).store.weeklyGoal,6);
  await synchronize(clientA,USER_A);
  const after=readUserLocal(USER_A);
  assert.equal(after.ext.profile.nickname,'','Offline profile must not resurrect after remote reset');
  assert.equal(after.store.weeklyGoal,3,'Old weekly goal must not be reuploaded after reset');
  assert.deepEqual(after.store.sessions,[],'Old offline session must not come back');
 });
 assert.equal(db.aim_sessions.filter(row=>row.user_id===USER_A).length,0);
 assert.equal(db.aim_profiles.find(row=>row.user_id===USER_A)?.profile?.profile?.nickname??'','');
 assert.equal(db.aim_preferences.find(row=>row.user_id===USER_A)?.weekly_goal,3);
 await use(b1,async()=>{
  await synchronize(clientB,USER_B);
  assert.equal(readUserLocal(USER_B).ext.profile.nickname,'PrivateBravo');
  assert.deepEqual(readUserLocal(USER_B).store.sessions.map(s=>s.id),['private-b-stays']);
  assert.equal(db.aim_profiles.find(row=>row.user_id===USER_B).profile.profile.nickname,'PrivateBravo');
 });
});


test('cross-device reset between cloud reads and writes auto-recovers without stale uploads',async()=>{
 const db=makeDb(),storage=new MemoryStorage(),base=clientFor(db,USER_A);
 // B must be completely isolated from both the reset and the retry.
 db.aim_sessions.push({user_id:USER_B,session_id:'b-private',
  payload:session('b-private'),deleted_at:null});
 let preferenceReads=0,resetCalls=0,remoteResetAt=null;
 const client={...base,
  from(table){
   const q=base.from(table);
   if(table==='aim_preferences'){
    const original=q.maybeSingle.bind(q);
    q.maybeSingle=async()=>{
     preferenceReads++;
     // A second device resets A precisely after the first snapshot is read,
     // just before the first device starts its cloud mutations.
     if(preferenceReads===2){
      resetCalls++;
      const result=await base.rpc('aim_reset_my_progress_for_user',{expected_uid:USER_A});
      assert.equal(result.error,null);
      remoteResetAt=result.data;
     }
     if(preferenceReads===3){
      assert.deepEqual(readUserLocal(USER_A).store.sessions.map(s=>s.id),['stale-offline-a'],
       'First attempt must not erase local data before confirmed recovery');
     }
     return original();
    };
   }
   return q;
  }
 };
 await use(storage,async()=>{
  write(storage,USER_A,[session('stale-offline-a')]);
  const recovered=await synchronize(client,USER_A);
  assert.equal(recovered.synced,true,'The single bounded retry should recover automatically');
  assert.equal(resetCalls,1);
  assert.equal(preferenceReads,4,'The retry must repeat both authoritative cloud reads');
  assert.ok(Number.isFinite(Date.parse(remoteResetAt)));
  assert.deepEqual(db.aim_sessions.filter(r=>r.user_id===USER_A),[],
   'Old sessions must not be uploaded after another device reset');
  assert.deepEqual(readUserLocal(USER_A).store.sessions,[],
   'Automatic recovery must apply the authoritative reset to the stale cache');
  assert.deepEqual(db.aim_sessions.filter(r=>r.user_id===USER_A),[]);
  assert.deepEqual(db.aim_sessions.filter(r=>r.user_id===USER_B).map(r=>r.session_id),
   ['b-private'],'B records must remain untouched');
 });
});


test('repeated cross-device resets stop after one retry and never erase local cache on failure',async()=>{
 const db=makeDb(),storage=new MemoryStorage(),base=clientFor(db,USER_A);
 let preferenceReads=0,resetCalls=0;
 const client={...base,from(table){
  const q=base.from(table);
  if(table==='aim_preferences'){
   const original=q.maybeSingle.bind(q);
   q.maybeSingle=async()=>{
    preferenceReads++;
    if(preferenceReads===2||preferenceReads===4){
     resetCalls++;
     const response=await base.rpc('aim_reset_my_progress_for_user',{expected_uid:USER_A});
     assert.equal(response.error,null);
     // Force distinct markers even when both synthetic resets share a millisecond.
     const p=db.aim_preferences.find(row=>row.user_id===USER_A);
     p.settings.reset_at=`2026-11-13T13:00:0${resetCalls}.000Z`;
    }
    return original();
   };
  }
  return q;
 }};
 await use(storage,async()=>{
  write(storage,USER_A,[session('retain-until-recovered')]);
  await assert.rejects(synchronize(client,USER_A),error=>{
   assert.equal(error.code,'AIM_RESET_CURSOR_CHANGED');
   assert.match(error.message,/réinitialisée pendant la synchronisation/);
   return true;
  });
  assert.equal(resetCalls,2);
  assert.equal(preferenceReads,4,'Only two complete snapshots may be attempted');
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(s=>s.id),
   ['retain-until-recovered'],'A failed automatic retry must not wipe unconfirmed local data');
  assert.equal(db.aim_sessions.filter(row=>row.user_id===USER_A).length,0);
  const result=await synchronize(client,USER_A);
  assert.equal(result.synced,true,'Later explicit attempts are not permanently locked');
  assert.equal(preferenceReads,6);
  assert.deepEqual(readUserLocal(USER_A).store.sessions,[],
   'Next successful sync must accept the authoritative cloud reset');
 });
});

test('network errors are not automatically retried by remote-reset reconciliation',async()=>{
 const db=makeDb(),storage=new MemoryStorage(),base=clientFor(db,USER_A);
 let preferenceReads=0;
 const client={...base,from(table){
  const q=base.from(table);
  if(table==='aim_preferences'){
   const original=q.maybeSingle.bind(q);
   q.maybeSingle=async()=>{
    preferenceReads++;
    if(preferenceReads===2)return {data:null,error:Error('simulated transient network failure')};
    return original();
   };
  }
  return q;
 }};
 await use(storage,async()=>{
  write(storage,USER_A,[session('keep-after-network-failure')]);
  await assert.rejects(synchronize(client,USER_A),/simulated transient network failure/);
  assert.equal(preferenceReads,2,'Only reset conflicts may be auto-retried');
  assert.deepEqual(readUserLocal(USER_A).store.sessions.map(s=>s.id),
   ['keep-after-network-failure']);
 });
});
