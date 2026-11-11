import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronize,deleteCloudProgress} from '../cloud-sync-v7.mjs';
import {TRAINING_KEY,LEGACY_KEY,EXT_KEY,CLOUD_META_PREFIX,scopedKey} from '../cloud-core-v7.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const now='2026-11-10T18:00:00.000Z';

function testStorage(){
 const data=new Map();
 return {
  get length(){return data.size},
  key:i=>[...data.keys()][i]??null,
  getItem:key=>data.has(String(key))?data.get(String(key)):null,
  setItem:(key,value)=>data.set(String(key),String(value)),
  removeItem:key=>data.delete(String(key)),
  clear:()=>data.clear()
 };
}

function delayedFailedSave(currentUser){
 let finishSaveAuth;
 let authCalls=0;
 let rpcCalls=0;
 const client={
  auth:{getUser(){
   authCalls++;
   if(authCalls===1){
    return new Promise(resolve=>{finishSaveAuth=resolve});
   }
   return Promise.resolve({data:{user:{id:currentUser()}},error:null});
  }},
  async rpc(name){
   assert.equal(name,'aim_reset_my_progress');
   rpcCalls++;
   return {data:now,error:null};
  },
  from(){throw Error('A blocked/failed save should not access database tables')}
 };
 const pendingSave=synchronize(client,A);
 // Handle its intentionally simulated failure immediately to avoid an
 // unhandled-rejection warning from Node's test runner.
 const saveResult=pendingSave.then(()=>null,error=>error);
 const resetResult=deleteCloudProgress(client,A);
 return {
  finishSave:()=>finishSaveAuth({data:{user:null},error:new Error('Network save failed')}),
  saveResult,resetResult,
  get rpcCalls(){return rpcCalls},
  get authCalls(){return authCalls}
 };
}

test('Cloud reset must NOT erase B when account switches while waiting for A save',async()=>{
 const previousStorage=globalThis.localStorage;
 globalThis.localStorage=testStorage();
 try{
  let current=A;
  const AKey=scopedKey(TRAINING_KEY,A),BKey=scopedKey(TRAINING_KEY,B);
  localStorage.setItem(AKey,'keep-data-a');
  localStorage.setItem(BKey,'keep-data-b');
  const task=delayedFailedSave(()=>current);
  assert.equal(task.authCalls,2,'A reset must begin while A save is waiting');
  current=B;
  task.finishSave();
  assert.match((await task.saveResult).message,/Session non validée/);
  await assert.rejects(task.resetResult,/Session modifiée pendant la suppression/);
  assert.equal(task.authCalls,3,'A second verified identity check is required');
  assert.equal(task.rpcCalls,0,'Destructive RPC must never run as B');
  assert.equal(localStorage.getItem(AKey),'keep-data-a');
  assert.equal(localStorage.getItem(BKey),'keep-data-b');
 }finally{globalThis.localStorage=previousStorage}
});

test('Cloud reset still succeeds for A after failed previous save if identity stays A',async()=>{
 const previousStorage=globalThis.localStorage;
 globalThis.localStorage=testStorage();
 try{
  const AKey=scopedKey(TRAINING_KEY,A);
  const legacy=scopedKey(LEGACY_KEY,A),ext=scopedKey(EXT_KEY,A);
  const BKey=scopedKey(TRAINING_KEY,B);
  localStorage.setItem(AKey,'sessions-a');
  localStorage.setItem(legacy,'old-sessions-a');
  localStorage.setItem(ext,'extension-a');
  localStorage.setItem(BKey,'sessions-b');
  localStorage.setItem(TRAINING_KEY,'guest-sessions');
  const task=delayedFailedSave(()=>A);
  task.finishSave();
  assert.match((await task.saveResult).message,/Session non validée/);
  assert.equal(await task.resetResult,true);
  assert.equal(task.authCalls,4,'Verify same owner before and after the destructive RPC, even after a failed save');
  assert.equal(task.rpcCalls,1,'Only A deletion RPC is issued');
  for(const key of [AKey,legacy,ext])assert.equal(localStorage.getItem(key),null,key);
  assert.equal(localStorage.getItem(BKey),'sessions-b');
  assert.equal(localStorage.getItem(TRAINING_KEY),'guest-sessions');
  assert.equal(JSON.parse(localStorage.getItem(CLOUD_META_PREFIX+A)).resetAt,now);
 }finally{globalThis.localStorage=previousStorage}
});
