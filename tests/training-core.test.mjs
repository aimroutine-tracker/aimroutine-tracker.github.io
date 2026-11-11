import test from 'node:test';
import assert from 'node:assert/strict';
import {FOCUS,RANK,TOOLS,createRoutine,sessionMinutes,normalizeStore,
  validSession,validExercise,validPreset,computeStats,comparable,coach,
  exportPayload,importPayload,streak} from '../training-core-v5.mjs';

function sample(date='2026-11-01T17:00:00.000Z', accuracy=75, suffix='1',focus='flick',tool='VALORANT'){
 return {id:'test-'+suffix,date,rank:'immortal',focus,minutes:25,accuracy,feeling:'good',notes:'ok',tool,scenario:'Stand de tir'};
}
test('Routine builder gives a valid editable set and correct minutes',()=>{
 for(const tool of TOOLS){
  const p=createRoutine('immortal','tracking',tool,35,30);
  assert.equal(p.exercises.length,3);
  assert.equal(sessionMinutes(p),35);
  assert.ok(p.exercises.every(validExercise));
  assert.ok(p.exercises.every(x=>x.tool===tool));
 }
});
test('Custom plan validation rejects negative and oversized exercises',()=>{
 assert.equal(validExercise({name:'Aim',tool:'VALORANT',minutes:0,tip:''}),false);
 assert.equal(validExercise({name:'Aim',tool:'VALORANT',minutes:46,tip:''}),false);
 assert.equal(validExercise({name:'Aim',tool:'VALORANT',minutes:10,tip:''}),true);
});
test('Legacy v1 sessions survive migration',()=>{
 const old={sessions:[sample()]};
 const next=normalizeStore(null,old);
 assert.equal(next.sessions.length,1);
 assert.equal(next.sessions[0].id,'test-1');
 assert.equal(next.weeklyGoal,3);
 assert.deepEqual(next.presets,[]);
 assert.equal(normalizeStore(null,{sessions:[{...sample(),tool:undefined}]}).sessions[0].tool,'Non précisé');
});
test('Migration ignores invalid sessions and duplicate ids',()=>{
 const s=sample(),bad={...s,id:'x',accuracy:1000};
 const next=normalizeStore({sessions:[s,s,bad]},null);
 assert.equal(next.sessions.length,1);
});
test('Metrics use only submitted accuracy and session minutes',()=>{
 const sessions=[sample('2026-11-03T12:00:00.000Z',80,'a'),sample('2026-11-04T12:00:00.000Z',null,'b')];
 const stats=computeStats(sessions,4,new Date('2026-11-06T12:00:00.000Z'));
 assert.equal(stats.count,2);assert.equal(stats.week,2);assert.equal(stats.minutes,50);
 assert.equal(stats.avg,80);assert.equal(stats.best,80);assert.equal(stats.goal,4);
});
test('Recent streak uses daily activity not session count',()=>{
 const arr=[sample('2026-11-04T12:00:00.000Z',75,'a'),sample('2026-11-05T12:00:00.000Z',77,'b'),sample('2026-11-05T14:00:00.000Z',80,'c')];
 assert.equal(streak(arr,new Date('2026-11-06T12:00:00')),2);
});
test('Comparable sessions filter out different focuses and tools',()=>{
 const xs=[sample('2026-11-01T12:00:00Z',80,'a','micro','VALORANT'),sample('2026-11-02T12:00:00Z',88,'b','flick','Aim Lab')];
 assert.equal(comparable(xs,'micro','VALORANT').length,1);
 assert.equal(comparable(xs,'micro','Aim Lab').length,0);
});
test('Coach explicitly flags insufficient evidence',()=>{
 assert.match(coach([sample()],'flick','VALORANT').confidence,/insuffisantes/);
});
test('Coaching detects directional trend from four comparable records',()=>{
 const a=[65,63,77,79].map((x,i)=>sample(new Date(Date.UTC(2026,10,1+i)).toISOString(),x,String(i)));
 assert.match(coach(a,'flick','VALORANT').title,/Consolider/);
});
test('Presets can be stored with validated exercises',()=>{
 const p=createRoutine('silver','flick','Aim Lab',25,30);
 assert.equal(validPreset({id:'p1',name:'Routine de test',...p}),true);
 assert.equal(validPreset({id:'p1',name:'Routine de test',...p,exercises:[]}),false);
});
test('V1 import merges data without duplicates',()=>{
 const state=normalizeStore({sessions:[sample()]},null);
 const incoming={format:'aimroutine-web-v1',sessions:[sample(),sample('2026-11-02T12:00:00Z',81,'2')]};
 const res=importPayload(incoming,state);
 assert.equal(res.added,1);assert.equal(res.store.sessions.length,2);
});
test('V2 export and import preserve favorites and settings',()=>{
 const state=normalizeStore({sessions:[sample()],weeklyGoal:5},null);
 state.presets=[{id:'p1',name:'My routine',...createRoutine('iron','micro','Oblivity',15,15)}];
 const backup=exportPayload(state);
 const restored=importPayload(backup,normalizeStore(null,null));
 assert.equal(restored.store.sessions.length,1);
 assert.equal(restored.store.presets.length,1);
 assert.equal(backup.weeklyGoal,5);
 assert.equal(restored.store.weeklyGoal,5);
});
test('Import rejects malformed accuracy, format and presets',()=>{
 const state=normalizeStore(null,null);
 assert.throws(()=>importPayload({format:'invalid',sessions:[]},state));
 assert.throws(()=>importPayload({format:'aimroutine-web-v1',sessions:[{...sample(),accuracy:101}]},state));
 assert.throws(()=>importPayload({format:'aimroutine-web-v2',sessions:[],presets:[{id:'bad'}]},state));
});
test('Core exports remain defined',()=>{
 assert.ok(Object.keys(FOCUS).length===4&&Object.keys(RANK).length===4);
 assert.equal(validSession(sample()),true);
});

test('Coach never compares a mixture of different scenarios',()=>{
 const mixed=[65,63,77,79].map((x,i)=>({...sample(new Date(Date.UTC(2026,10,1+i)).toISOString(),x,'s'+i),scenario:i%2?'Cible B':'Cible A'}));
 assert.match(coach(mixed,'flick','VALORANT').confidence,/insuffisantes/);
});


test('Future timestamps cannot inflate totals, accuracy or the current streak',()=>{
 const now=new Date('2026-11-09T12:00:00.000Z');
 const yesterday=sample('2026-11-08T10:00:00.000Z',75,'past','flick');
 const tomorrow=sample('2026-11-10T10:00:00.000Z',99,'tomorrow','tracking');
 const laterToday=sample('2026-11-09T22:00:00.000Z',98,'future-today','micro');
 const invalid=sample('not a timestamp',99,'invalid','control');
 const entries=[yesterday,tomorrow,laterToday,invalid];
 const stats=computeStats(entries,3,now);
 assert.equal(stats.count,1);
 assert.equal(stats.minutes,25);
 assert.equal(stats.week,0);
 assert.equal(stats.avg,75);
 assert.equal(stats.best,75);
 assert.equal(stats.streak,1,'a future session on the same calendar day cannot extend a streak');
 assert.deepEqual(stats.byFocus,{flick:1,micro:0,tracking:0,control:0});
 assert.equal(streak(entries,now),1);
 assert.equal(normalizeStore({sessions:[tomorrow]},null).sessions.length,1,
  'stored history is preserved, even though a future timestamp is not yet counted');
});

test('At the exact timestamp, a valid session becomes eligible for all statistics',()=>{
 const now=new Date('2026-11-09T12:00:00.000Z');
 const yesterday=sample('2026-11-08T10:00:00.000Z',70,'yesterday');
 const nowSession=sample(now.toISOString(),90,'now');
 const future=sample('2026-11-09T12:00:00.001Z',100,'one-ms-future');
 const stats=computeStats([yesterday,nowSession,future],3,now);
 assert.equal(stats.count,2);
 assert.equal(stats.minutes,50);
 assert.equal(stats.week,1);
 assert.equal(stats.avg,80);
 assert.equal(stats.best,90);
 assert.equal(stats.streak,2);
});

test('Coaching never infers improvement from future or invalid sessions',()=>{
 const now=new Date('2026-11-09T12:00:00.000Z');
 const past=[
  sample('2026-11-09T09:00:00.000Z',65,'a'),
  sample('2026-11-09T11:00:00.000Z',67,'b')
 ];
 const projected=[
  sample('2026-11-09T14:00:00.000Z',88,'c'),
  sample('2026-11-09T16:00:00.000Z',96,'d'),
  sample('invalid date',99,'bad')
 ];
 const result=coach([...past,...projected],'flick','VALORANT',3,now);
 assert.match(result.confidence,/insuffisantes/);
 assert.doesNotMatch(result.title,/Consolider/);
 const onlyFuture=coach(projected,'flick','VALORANT',3,now);
 assert.equal(onlyFuture.title,'Premiers pas');
});
