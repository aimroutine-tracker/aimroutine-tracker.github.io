import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronize,deleteCloudProgress,readUserLocal} from './fixtures/v2-cloud-sync-legacy.mjs';
import {TRAINING_KEY,LEGACY_KEY,EXT_KEY,scopedKey} from '../cloud-core-v7.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
class MemoryStorage{
 constructor(){this.data=new Map()}
 getItem(k){return this.data.get(k)??null}
 setItem(k,v){this.data.set(k,String(v))}
 removeItem(k){this.data.delete(k)}
}
const session=(id)=>({
 id,date:'2026-11-14T10:00:00.000Z',rank:'silver',focus:'micro',
 tool:'Aim Lab',scenario:'Microshot',minutes:15,accuracy:80,
 feeling:'good',notes:'Legacy V2 offline record'
});
const seed=(storage,uid,id)=>{
 storage.setItem(scopedKey(TRAINING_KEY,uid),
  JSON.stringify({sessions:[session(id)],presets:[],weeklyGoal:3}));
 storage.setItem(scopedKey(EXT_KEY,uid),JSON.stringify({}));
};
async function withLocal(storage,fn){
 const previous=globalThis.localStorage;
 globalThis.localStorage=storage;
 try{return await fn()}finally{globalThis.localStorage=previous}
}
const denied=()=>Object.assign(Error('permission denied for table'),{code:'42501'});
function legacyClient(){
 const writes=[];
 return {
  writes,
  auth:{getUser:async()=>({data:{user:{id:A}},error:null})},
  from(table){
   return {
    select(){return this},
    eq(){return this},
    order(){return this},
    async maybeSingle(){return {data:null,error:null}},
    async range(){return {data:[],error:null}},
    async upsert(records){
     writes.push({table,records});
     return {data:null,error:denied()};
    },
    update(){throw Error('Unexpected V2 tombstone mutation')},
   };
  },
  async rpc(name){
   assert.equal(name,'aim_reset_my_progress');
   return {data:null,error:denied()};
  },
 };
}

test('already-open V2 tab keeps its local sessions after V3 REST-write cutoff',async()=>{
 const storage=new MemoryStorage(),client=legacyClient();
 seed(storage,A,'old-offline-a');seed(storage,B,'private-b');
 const oldA=storage.getItem(scopedKey(TRAINING_KEY,A));
 const oldB=storage.getItem(scopedKey(TRAINING_KEY,B));
 await withLocal(storage,async()=>{
  await assert.rejects(synchronize(client,A),/permission denied for table/);
  assert.equal(client.writes.length,1,'Legacy V2 should encounter the denied direct REST write');
  assert.equal(client.writes[0].table,'aim_sessions');
  assert.equal(storage.getItem(scopedKey(TRAINING_KEY,A)),oldA,
   'Write permission errors must not clear the old account cache');
  assert.equal(storage.getItem(scopedKey(TRAINING_KEY,B)),oldB,
   'B local account data remains isolated');
  assert.deepEqual(readUserLocal(A).store.sessions.map(x=>x.id),['old-offline-a']);
 });
});

test('already-open V2 tab retains sessions when legacy reset RPC loses table grants',async()=>{
 const storage=new MemoryStorage(),client=legacyClient();
 seed(storage,A,'must-remain-a');
 const key=scopedKey(TRAINING_KEY,A);
 const original=storage.getItem(key);
 storage.setItem(scopedKey(LEGACY_KEY,A),original);
 await withLocal(storage,async()=>{
  await assert.rejects(deleteCloudProgress(client,A),/permission denied for table/);
  assert.equal(storage.getItem(key),original);
  assert.equal(storage.getItem(scopedKey(LEGACY_KEY,A)),original,
   'A failed old reset must not clear fallback data either');
  assert.deepEqual(readUserLocal(A).store.sessions.map(x=>x.id),['must-remain-a']);
 });
});
