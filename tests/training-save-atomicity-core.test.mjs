import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Execute the exact save() function shipped to training.html, with deterministic
// storage failures. This checks the user's UI persistence path rather than a
// second implementation invented only for tests.
const source=readFileSync(new URL('../training-v5.js',import.meta.url),'utf8');
const start=source.indexOf('function save(next=store){');
const end=source.indexOf('\nfunction chooseTab(',start);
assert.ok(start>=0&&end>start,'Training save function must be present');
const functionSource=source.slice(start,end);
const UID='11111111-1111-4111-8111-111111111111';
const KEY='aimroutine_cloud_user_'+UID+'_aimroutine_web_training_v2';
const favored=id=>({id,name:'Routine '+id});
const original={sessions:[],presets:[favored('keep'),favored('remove')],weeklyGoal:4};
const updated={sessions:[],presets:[favored('keep')],weeklyGoal:4};
const string=s=>JSON.stringify(s);
function harness({failTraining=false,failQueue=false,overwriteDuringQueue=false}={}){
 const db=new Map([[KEY,string(original)]]);
 const alerts=[],events=[],queued=[];
 let failStorageWrite=failTraining;
 const storage={
  getItem:key=>db.get(key)??null,
  setItem(key,value){
   if(failStorageWrite&&key===KEY){failStorageWrite=false;throw Error('simulated quota');}
   db.set(key,String(value));
  },
  removeItem:key=>db.delete(key)
 };
 const context={
  store:structuredClone(original),localStorage:storage,
  activeUid:()=>UID,storageKey:()=>KEY,STORAGE_KEY:'aimroutine_web_training_v2',
  collectFavoriteDeletion(uid,ids){
   queued.push({uid,ids});
   if(overwriteDuringQueue){db.set(KEY,'{\"otherTab\":true}');throw Error('concurrent update');}
   if(failQueue)throw Error('simulated queue error');
  },
  window:{dispatchEvent(event){events.push(event.type)}},
  CustomEvent:class{constructor(type){this.type=type}},
  alert:text=>alerts.push(text),
  showMessage:()=>{}
 };
 const save=runInNewContext(functionSource+'\nsave;',context);
 return {save,context,db,alerts,events,queued};
}
test('training UI saves the new store and its Cloud favorite tombstone as one successful action',()=>{
 const h=harness();
 assert.equal(h.save(updated),true);
 assert.deepEqual(JSON.parse(h.db.get(KEY)),updated);
 assert.deepEqual(JSON.parse(JSON.stringify(h.context.store)),updated);
 assert.deepEqual(JSON.parse(JSON.stringify(h.queued)),[{uid:UID,ids:['remove']}]);
 assert.deepEqual(h.events,['aim-store-updated']);
 assert.equal(h.alerts.length,0);
});
test('failed training storage write cannot queue a destructive favorite deletion',()=>{
 const h=harness({failTraining:true});
 assert.equal(h.save(updated),false);
 assert.deepEqual(JSON.parse(h.db.get(KEY)),original);
 assert.deepEqual(JSON.parse(JSON.stringify(h.context.store)),original);
 assert.equal(h.queued.length,0);
 assert.equal(h.events.length,0);
 assert.equal(h.alerts.length,1);
});
test('failed tombstone queuing rolls back local routine removal and does not dispatch an update',()=>{
 const h=harness({failQueue:true});
 assert.equal(h.save(updated),false);
 assert.deepEqual(JSON.parse(h.db.get(KEY)),original);
 assert.deepEqual(JSON.parse(JSON.stringify(h.context.store)),original);
 assert.deepEqual(JSON.parse(JSON.stringify(h.queued)),[{uid:UID,ids:['remove']}]);
 assert.equal(h.events.length,0);
 assert.equal(h.alerts.length,1);
});
test('rollback must not erase a concurrent browser tab training write',()=>{
 const h=harness({overwriteDuringQueue:true});
 assert.equal(h.save(updated),false);
 assert.equal(h.db.get(KEY),'{"otherTab":true}');
 assert.deepEqual(JSON.parse(JSON.stringify(h.context.store)),original);
 assert.equal(h.events.length,0);
 assert.equal(h.alerts.length,1);
});
