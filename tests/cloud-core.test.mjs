import test from 'node:test';
import assert from 'node:assert/strict';
import {validUid,scopedKey,storageKey,safeMeta,uniqueById,mergeRecords,changedRecords,safeRedirect} from '../cloud-core-v7.mjs';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
test('validates user UUIDs before namespacing local data',()=>{
 assert.equal(validUid(A),true);
 assert.equal(validUid('not-a-user'),false);
 assert.equal(scopedKey('aimroutine_web_training_v2',A),'aimroutine_cloud_user_'+A+'_aimroutine_web_training_v2');
 assert.equal(scopedKey('aimroutine_web_training_v2',null),'aimroutine_web_training_v2');
 assert.notEqual(scopedKey('aimroutine_web_training_v2',A),scopedKey('aimroutine_web_training_v2',B));
 assert.throws(()=>scopedKey('sb-token',A));
});
test('merge only adds missing records and respects tombstones',()=>{
 const x={id:'a',name:'original'},y={id:'b',name:'new'},r={id:'a',name:'remote'};
 assert.deepEqual(mergeRecords([x,y],[r],[]),[r,y]);
 assert.deepEqual(mergeRecords([x,y],[r],['a']),[y]);
 assert.deepEqual(changedRecords([x,y],[r]),[y]);
});
test('malformed synced metadata cannot add arbitrary object content',()=>{
 const m=safeMeta({presetDeletedIds:[42,'a'],profileHash:123,prefsHash:'x'});
 assert.deepEqual(m.presetDeletedIds,['a']);
 assert.equal(m.profileHash,null);
});
test('restricts redirect URL to owned origin and allowed paths',()=>{
 assert.equal(safeRedirect('https://attacker.example/training.html'),'account.html');
 assert.equal(safeRedirect('https://aimroutine-tracker.github.io/training.html'),'training.html');
 assert.equal(safeRedirect('javascript:alert(1)'),'account.html');
});
