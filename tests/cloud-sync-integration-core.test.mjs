import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronize,setEnabled,readUserLocal,collectFavoriteDeletion,deleteCloudProgress} from '../cloud-sync-v7.mjs';
import {scopedKey,TRAINING_KEY,LEGACY_KEY} from '../cloud-core-v7.mjs';

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
   async rpc(name){
    assert.equal(name,'aim_reset_my_progress');
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
