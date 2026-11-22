import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {calendarWeeksAgo,weeklySessionCounts,computeStats} from '../training-core-v5.mjs';

const rec=date=>({id:date,date,accuracy:null,minutes:15,focus:'flick'});
const monday=(year,month,day,hour=12)=>new Date(year,month,day,hour);

test('calendar week resets at local Monday, not after 168 rolling hours',()=>{
 const now=monday(2026,10,9,9); // Monday November 9
 const sunday=new Date(2026,10,8,23,59);
 const mondayStart=new Date(2026,10,9,0,0);
 assert.equal(calendarWeeksAgo(sunday,now),1);
 assert.equal(calendarWeeksAgo(mondayStart,now),0);
 const records=[rec(sunday.toISOString()),rec(mondayStart.toISOString())];
 assert.deepEqual(weeklySessionCounts(records,4,now),[0,0,1,1]);
 const stats=computeStats(records,3,now);
 assert.equal(stats.count,2);
 assert.equal(stats.week,1,'KPI includes only current Monday–Sunday sessions');
});

test('weekly chart respects chronological 4/8/12 calendar-week buckets',()=>{
 const now=monday(2026,10,9,12);
 const records=[
  rec(new Date(2026,10,9,10).toISOString()), // current week
  rec(new Date(2026,10,2,9).toISOString()), // last week
  rec(new Date(2026,9,12,13).toISOString()), // 4 weeks ago
  rec(new Date(2026,8,14,13).toISOString()), // 8 weeks ago
 ];
 assert.deepEqual(weeklySessionCounts(records,4,now),[0,0,1,1]);
 assert.deepEqual(weeklySessionCounts(records,8,now),[0,0,0,1,0,0,1,1]);
 assert.deepEqual(weeklySessionCounts(records,12,now),[0,0,0,1,0,0,0,1,0,0,1,1]);
});

test('invalid or future timestamps never generate player activity',()=>{
 const now=monday(2026,10,9,9);
 assert.equal(calendarWeeksAgo('invalid date',now),null);
 assert.equal(calendarWeeksAgo(new Date(2026,10,9,9,1),now),null);
 assert.deepEqual(weeklySessionCounts([
  {date:'not-a-date'}, {date:new Date(2026,10,10,9).toISOString()}
 ],4,now),[0,0,0,0]);
 assert.deepEqual(weeklySessionCounts([],8,now),Array(8).fill(0));
 assert.throws(()=>weeklySessionCounts([],3,now),/Période hebdomadaire invalide/);
});

test('Sunday-to-Monday boundary remains consistent over New Year',()=>{
 const now=monday(2027,0,4,11); // Monday January 4, 2027
 assert.equal(calendarWeeksAgo(new Date(2027,0,3,23,59),now),1);
 assert.equal(calendarWeeksAgo(new Date(2027,0,4,0,0),now),0);
 assert.equal(calendarWeeksAgo(new Date(2026,11,21,17),now),2);
});

test('Europe/Paris DST changes do not shift weeks or mix Sunday with Monday',()=>{
 const url=new URL('../training-core-v5.mjs',import.meta.url).href;
 const script=`
import assert from 'node:assert/strict';
import {calendarWeeksAgo,weeklySessionCounts,computeStats} from '${url}';
const now=new Date('2026-03-30T10:00:00Z'); // Monday 12:00 CEST
const prevMonday=new Date('2026-03-23T11:00:00Z'); // Monday 12:00 CET
const sunday=new Date('2026-03-29T21:00:00Z'); // Sunday 23:00 CEST
const monday=new Date('2026-03-29T22:30:00Z'); // Monday 00:30 CEST
assert.equal(calendarWeeksAgo(prevMonday,now),1);
assert.equal(calendarWeeksAgo(sunday,now),1);
assert.equal(calendarWeeksAgo(monday,now),0);
const rows=[prevMonday,sunday,monday].map((d,i)=>({id:String(i),date:d.toISOString(),minutes:5,accuracy:null,focus:'flick'}));
assert.deepEqual(weeklySessionCounts(rows,4,now),[0,0,2,1]);
assert.equal(computeStats(rows,3,now).week,1);
`;
 const run=spawnSync(process.execPath,['--input-type=module','-e',script],{
  env:{...process.env,TZ:'Europe/Paris'},encoding:'utf8',timeout:10000
 });
 assert.equal(run.status,0,run.stderr||run.stdout);
});
