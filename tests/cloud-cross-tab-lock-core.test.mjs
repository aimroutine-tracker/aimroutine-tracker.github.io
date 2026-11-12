import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedKey,TRAINING_KEY} from '../cloud-core-v7.mjs';

// Import two separate instances: each browser tab has its own module maps.
// The Web Locks API is the common coordinator across the same origin.
const tabOne=await import('../cloud-sync-v7.mjs?cloud-lock-qa-tab-one');
const tabTwo=await import('../cloud-sync-v7.mjs?cloud-lock-qa-tab-two');

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

function memoryStorage(){
 const map=new Map();
 return {
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>map.set(key,String(value)),
  removeItem:key=>map.delete(key),
  key:i=>[...map.keys()][i]??null,
  get length(){return map.size}
 };
}

function lockManager(){
 const tails=new Map();
 const events=[];
 return {
  events,
  request(name,options,callback){
   assert.match(name,/^aimroutine-cloud-account-[0-9a-f-]+$/);
   assert.deepEqual(options,{mode:'exclusive'});
   const previous=tails.get(name)||Promise.resolve();
   let release;
   const current=new Promise(resolve=>{release=resolve});
   tails.set(name,current);
   events.push({name,kind:'queued'});
   return previous.then(async()=>{
    events.push({name,kind:'entered'});
    try{return await callback({name,mode:'exclusive'})}
    finally{
     events.push({name,kind:'released'});
     release();
     if(tails.get(name)===current)tails.delete(name);
    }
   });
  }
 };
}

async function withMockEnvironment(fn){
 const priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const priorNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const storage=memoryStorage(),locks=lockManager();
 Object.defineProperty(globalThis,'localStorage',{value:storage,writable:true,configurable:true});
 Object.defineProperty(globalThis,'navigator',{value:{locks},writable:true,configurable:true});
 try{return await fn({storage,locks})}
 finally{
  if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);
  else delete globalThis.localStorage;
  if(priorNavigator)Object.defineProperty(globalThis,'navigator',priorNavigator);
  else delete globalThis.navigator;
 }
}

test('a reset in tab two waits for an in-flight sync in tab one before deleting',async()=>{
 await withMockEnvironment(async({storage,locks})=>{
  const aKey=scopedKey(TRAINING_KEY,A),bKey=scopedKey(TRAINING_KEY,B);
  storage.setItem(aKey,'account-a-before-reset');
  storage.setItem(bKey,'account-b-unchanged');
  let startAuth,releaseAuth;
  const syncAuthEntered=new Promise(resolve=>{startAuth=resolve});
  const suspendedAuth=new Promise(resolve=>{releaseAuth=resolve});
  const syncClient={
   auth:{getUser:()=>{startAuth();return suspendedAuth}},
   from(){throw Error('Sync should fail auth before accessing tables')}
  };
  const syncing=tabOne.synchronize(syncClient,A);
  const syncingRejection=assert.rejects(syncing,/Session non validée/);
  await syncAuthEntered; // tab one now holds account A's Web Lock.
  let rpcCalls=0;
  const resetClient={
   auth:{getUser:async()=>({data:{user:{id:A}},error:null})},
   rpc:async(name,args)=>{
    rpcCalls++;
    assert.equal(name,'aim_reset_my_progress_for_user');
    assert.deepEqual(args,{expected_uid:A});
    return {data:'2026-11-12T12:00:00.000Z',error:null};
   }
  };
  const deleting=tabTwo.deleteCloudProgress(resetClient,A);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(rpcCalls,0,'A reset cannot overtake another tab saving A');
  releaseAuth({data:{user:null},error:Error('Network interrupted')});
  await syncingRejection;
  assert.equal(await deleting,true);
  assert.equal(rpcCalls,1);
  assert.equal(storage.getItem(aKey),null);
  assert.equal(storage.getItem(bKey),'account-b-unchanged');
  assert.deepEqual(locks.events.map(e=>e.kind),
   ['queued','entered','queued','released','entered','released']);
 });
});

test('a lock for account A does not block independent account B',async()=>{
 await withMockEnvironment(async({locks})=>{
  let releaseA,startA;
  const aEntered=new Promise(resolve=>{startA=resolve});
  const aBlocked=new Promise(resolve=>{releaseA=resolve});
  const aClient={auth:{getUser:()=>{startA();return aBlocked}},
   from(){throw Error('A sync deliberately halted before DB reads')}};
  const syncing=tabOne.synchronize(aClient,A);
  const rejected=assert.rejects(syncing,/Session non validée/);
  await aEntered;
  let called=0;
  const bClient={
   auth:{getUser:async()=>({data:{user:{id:B}},error:null})},
   rpc:async(name,args)=>{
    called++;
    assert.deepEqual(args,{expected_uid:B});
    return {data:'2026-11-12T12:15:00.000Z',error:null};
   }
  };
  assert.equal(await tabTwo.deleteCloudProgress(bClient,B),true);
  assert.equal(called,1,'B should be independent of A lock');
  releaseA({data:{user:null},error:Error('Expected auth failure')});
  await rejected;
  assert.equal(locks.events.filter(e=>e.kind==='entered').length,2);
 });
});
