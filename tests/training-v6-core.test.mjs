import test from 'node:test';
import assert from 'node:assert/strict';
import {EXT_KEY,INTERCHANGE,cleanProfile,cleanExtension,startProgram,scheduledDay,programCalendar,periodSessions,
  scenarioOptions,scenarioMetrics,calendarGrid,achievements,toInterchange,parseInterchange} from '../training-v6-core.mjs';
import {createRoutine,normalizeStore} from '../training-core-v5.mjs';
const ses=(date,id='s1',accuracy=78,scenario='Microshot')=>({
  id,date,rank:'immortal',focus:'micro',tool:'Aim Lab',scenario,minutes:20,accuracy,feeling:'good',notes:''
});
test('Profile sanitizes and never fabricates eDPI inputs',()=>{
 const p=cleanProfile({nickname:'X'.repeat(30),rank:'invalid',dpi:0,sensitivity:NaN});
 assert.equal(p.nickname.length,24);assert.equal(p.rank,'silver');assert.equal(p.dpi,null);
 assert.equal(p.sensitivity,null);assert.equal(p.tool,'VALORANT');
 assert.ok(EXT_KEY.includes('extensions'));
});
test('7/14/30-day programs are deterministic and include rest days',()=>{
 for(const days of [7,14,30]){
  const plan=startProgram(days,'immortal','VALORANT',new Date('2026-11-01T10:00:00Z'));
  assert.equal(programCalendar(plan).length,days);
  assert.equal(scheduledDay(plan,6).rest,true);
  assert.equal(scheduledDay(plan,0).focus,'flick');
  if(days>7)assert.equal(scheduledDay(plan,7).focus,'flick');
 }
});
test('Program completes only matching recorded sessions after start',()=>{
 const p=startProgram(7,'immortal','VALORANT',new Date(2026,10,1,10,0));
 const good={...ses(new Date(2026,10,1,12,0).toISOString(),'ok'),tool:'VALORANT',focus:'flick'};
 const wrong={...good,id:'bad',tool:'Aim Lab'};
 const before={...good,id:'before',date:new Date(2026,10,1,8,0).toISOString()};
 const days=programCalendar(p,[wrong,before,good]);
 assert.equal(days[0].completed,true);assert.equal(days[1].completed,false);
 assert.equal(programCalendar(p,[wrong,before])[0].completed,false);
});
test('Period filtering excludes future and outside-window samples',()=>{
 const now=new Date('2026-11-06T12:00:00Z');
 const sample=[ses('2026-10-01T11:00:00Z','old'),ses('2026-11-05T11:00:00Z','recent'),ses('2027-01-01T11:00:00Z','future')];
 assert.deepEqual(periodSessions(sample,7,now).map(s=>s.id),['recent']);
});
test('Scenario analysis does not mix scenario names or tools',()=>{
 const now=new Date('2026-11-06T12:00:00Z');
 const xs=[64,65,68,70,76,78].map((a,i)=>ses(new Date(Date.UTC(2026,10,1+i)).toISOString(),String(i),a));
 xs.push({...ses('2026-11-06T09:00:00Z','other',98),'scenario':'Gridshot'});
 xs.push({...ses('2026-11-06T09:00:00Z','other-tool',99),'tool':'KovaaK’s'});
 const result=scenarioMetrics(xs,{focus:'micro',tool:'Aim Lab',scenario:'Microshot',range:30,now});
 assert.equal(result.count,6);assert.equal(result.best,78);assert.equal(result.comparisonValid,true);
 assert.ok(result.change>0);
 assert.equal(scenarioOptions(xs,'micro','Aim Lab')[0].name,'Microshot');
});
test('Comparison requires explicitly identical tool and scenario with enough data',()=>{
 const xs=[ses('2026-11-06T09:00:00Z')];
 assert.equal(scenarioMetrics(xs,{focus:'micro',scenario:'Microshot',tool:'',range:0}).comparisonValid,false);
 assert.equal(scenarioMetrics(xs,{focus:'micro',scenario:'',tool:'Aim Lab',range:0}).comparisonValid,false);
});
test('Calendar displays the correct count for each day',()=>{
 const now=new Date(2026,10,6,12,0);
 const rows=calendarGrid([ses(new Date(2026,10,6,11,0).toISOString()),ses(new Date(2026,10,6,10,0).toISOString(),'s2')],now,35);
 assert.equal(rows.length,35);assert.equal(rows[34].count,2);
});
test('Achievements rely on real recorded sessions and consecutive days',()=>{
 const now=new Date('2026-11-06T12:00:00Z');
 const sessions=[1,2,3,4,5].map(i=>ses(new Date(Date.UTC(2026,10,i,12)).toISOString(),String(i)));
 const badges=achievements(sessions,now);
 assert.equal(badges.find(b=>b.id==='first').done,true);
 assert.equal(badges.find(b=>b.id==='regular').done,true);
 assert.equal(badges.find(b=>b.id==='streak').done,true);
 assert.equal(badges.find(b=>b.id==='dedicated').done,false);
});
test('Portable export is well-formed and imports profile and programs',()=>{
 const store=normalizeStore({sessions:[ses('2026-11-03T12:00:00Z')],weeklyGoal:5,presets:[{id:'p1',name:'Training',...createRoutine('iron','micro','VALORANT',15,30)}]},null);
 const ext=cleanExtension({profile:{nickname:'NovaFox',rank:'immortal',dpi:1600,sensitivity:.215},program:startProgram(7,'immortal','VALORANT')});
 const exported=toInterchange(store,ext);
 assert.equal(exported.format,INTERCHANGE);
 const imported=parseInterchange(exported);
 assert.equal(imported.sessions.length,1);assert.equal(imported.extension.profile.nickname,'NovaFox');
 assert.equal(imported.extension.program.days,7);assert.equal(imported.weeklyGoal,5);
});
test('Portable imports reject malformed or executable structures',()=>{
 assert.throws(()=>parseInterchange({format:INTERCHANGE,sessions:[{notes:'malicious'}],presets:[],weeklyGoal:3}));
 assert.throws(()=>parseInterchange({format:INTERCHANGE,sessions:[],presets:[],weeklyGoal:99}));
});


test('V6 advanced scenarios, activity calendar and records ignore unobserved future timestamps',()=>{
 const now=new Date('2026-11-06T12:00:00.000Z');
 const past=ses('2026-11-06T09:00:00.000Z','past',72,'Microshot');
 const laterToday=ses('2026-11-06T16:00:00.000Z','later-today',98,'Microshot');
 const tomorrow=ses('2026-11-07T09:00:00.000Z','tomorrow',99,'FutureOnly');
 const entries=[laterToday,tomorrow,past];
 assert.deepEqual(scenarioOptions(entries,'micro','Aim Lab',now),
  [{name:'Microshot',count:1}],'future-only scenarios must not become selectable');
 const metrics=scenarioMetrics(entries,{focus:'micro',tool:'Aim Lab',scenario:'Microshot',range:0,now});
 assert.equal(metrics.count,1);assert.equal(metrics.best,72);
 assert.deepEqual(metrics.sessions.map(x=>x.id),['past']);
 const calendar=calendarGrid(entries,now,35);
 assert.equal(calendar.at(-1).count,1,'later today should not be pre-awarded');
 assert.equal(calendar.reduce((total,day)=>total+day.count,0),1);
 const badges=achievements(entries,now);
 assert.equal(badges.find(x=>x.id==='first').done,true);
 assert.equal(badges.find(x=>x.id==='regular').progress,1);
 assert.equal(badges.find(x=>x.id==='regular').done,false);
 assert.equal(badges.find(x=>x.id==='streak').progress,1);
 assert.deepEqual(entries.map(s=>s.id),['later-today','tomorrow','past'],'the raw stored history is not mutated');
});

test('V6 future-only cache cannot unlock any achievement or advance a program',()=>{
 const now=new Date('2026-11-06T12:00:00.000Z');
 const future=Array.from({length:5},(_,i)=>ses(
  new Date(Date.UTC(2026,10,6+i,18)).toISOString(),'future-'+i,98
 ));
 const badges=achievements(future,now);
 for(const badge of badges){
  assert.equal(badge.done,false,badge.id+' must remain locked');
  assert.equal(badge.progress,0,badge.id+' has no observed progress');
 }
 assert.equal(scenarioOptions(future,'micro','Aim Lab',now).length,0);
 assert.equal(calendarGrid(future,now,35).reduce((total,day)=>total+day.count,0),0);
 const program=startProgram(7,'immortal','VALORANT',new Date('2026-11-06T08:00:00.000Z'));
 const projected={...ses('2026-11-06T18:00:00.000Z','program-future'),focus:'flick',tool:'VALORANT'};
 assert.equal(programCalendar(program,[projected],now)[0].completed,false);
 assert.equal(programCalendar(program,[projected],new Date('2026-11-06T19:00:00.000Z'))[0].completed,true,
  'the record becomes eligible when the real time catches up');
});
