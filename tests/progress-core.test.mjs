import test from 'node:test';
import assert from 'node:assert/strict';
import {progressPeriod,progressScenarioOptions,filterProgressSessions} from '../progress-core.mjs';

const now = new Date(2026, 10, 22, 9, 0);
const session = (daysAgo, hour = 8) => ({
  date: new Date(2026, 10, 22 - daysAgo, hour).toISOString()
});

test('each range counts the same sessions in its totals and date buckets', () => {
  const history = [session(0), session(6), session(7), session(29), session(58), session(89), session(90), session(180), session(0, 10)];
  for (const [days, expected] of [[7, 2], [30, 4], [90, 6], [0, 8]]) {
    const {sessions, buckets} = progressPeriod(history, days, now);
    assert.equal(sessions.length, expected);
    assert.equal(buckets.reduce((sum, b) => sum + b.count, 0), expected);
    assert.ok(buckets.length <= 7);
  }
});

test('seven days shows separate local calendar days, including all of the first day', () => {
  const {buckets} = progressPeriod([session(6, 0), session(0)], 7, now);
  assert.deepEqual(buckets.map(b => b.count), [1, 0, 0, 0, 0, 0, 1]);
  assert.equal(buckets[0].start.getUTCDate(), 16);
  assert.equal(buckets.at(-1).end.getUTCDate(), 22);
});

test('all history covers old sessions and empty histories need no buckets', () => {
  const {buckets} = progressPeriod([session(2000), session(1999)], 0, now);
  assert.deepEqual(buckets.map(b => b.count), [1, 1]);
  assert.equal(buckets[0].start.getUTCFullYear(), new Date(session(2000).date).getFullYear());
  assert.deepEqual(progressPeriod([], 90, now), {sessions: [], buckets: []});
});

test('scenario filters keep matching names from different tools separate', () => {
  const aimLab={tool:'Aim Lab',scenario:' Gridshot '};
  const valorant={tool:'VALORANT',scenario:'Gridshot'};
  const unnamed={tool:'Aim Lab',scenario:''};
  const legacy={tool:'Non précisé'};
  const history=[aimLab,valorant,unnamed,legacy];
  const [aimLabOption,valorantOption]=progressScenarioOptions(history);

  assert.equal(aimLabOption.name,'Gridshot');
  assert.notEqual(aimLabOption.value,valorantOption.value);
  assert.deepEqual(progressScenarioOptions(history,'Aim Lab'),[aimLabOption]);
  assert.deepEqual(filterProgressSessions(history,'',aimLabOption.value),[aimLab]);
  assert.deepEqual(filterProgressSessions(history,'VALORANT',aimLabOption.value),[]);
  assert.deepEqual(filterProgressSessions(history,'Aim Lab',''),[aimLab,unnamed]);
  assert.deepEqual(filterProgressSessions(history,'',''),history);
});
