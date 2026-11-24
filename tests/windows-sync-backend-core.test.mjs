import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWindows } from '../supabase/functions/aimroutine-windows/handler.mjs';

const origin = 'https://aimroutine-tracker.github.io';
const device = 'A'.repeat(43);
const id = 'e8dab3af-3672-4886-b341-27808180c905';
const result = {
  id:'attempt', date:'2026-11-24', createdAt:'2026-11-24T01:20:00Z',
  software:'Aim Lab', exercise:'Gridshot', durationSeconds:60, score:100,
  accuracy:90, headshot:null, notes:'', mood:3
};
function request(body, headers = {}, requestOrigin = origin) {
  return new Request('https://example.com/functions/v1/aimroutine-windows', {
    method:'POST', headers:{Origin: requestOrigin, ...headers}, body:JSON.stringify(body)
  });
}
function service() {
  const calls = [];
  return { calls, backend:{
    verify: async token => token === 'valid' ? { id, label:'person@example.com' } : null,
    call: async (operation, args) => {
      calls.push([operation, args]);
      if (operation === 'approve') return {ok:true};
      if (operation === 'status') return {state:'pending'};
      if (operation === 'disconnect') return {ok:true};
      return {state:'linked', uploaded:args.results?.length || 0, sessions:[]};
    }
  }};
}
test('approval uses only verified identity and takes a digest', async () => {
  const {backend,calls} = service();
  const body = {action:'approve', challenge:'f'.repeat(64), userId:'another', label:'spoof'};
  assert.equal((await handleWindows(request(body),backend)).status,401);
  const reply = await handleWindows(request(body,{Authorization:'Bearer valid'}),backend);
  assert.equal(reply.status,200);
  assert.equal(reply.headers.get('Access-Control-Allow-Origin'),origin);
  assert.deepEqual(calls,[['approve',{uid:id,label:'person@example.com',digest:body.challenge}]]);
});
test('desktop uses a digest and rejects unexpected, duplicate or invalid results', async () => {
  const {backend,calls} = service();
  const headers = {'x-aim-device':device};
  for (const results of [[{...result, extra:'secret'}],[{...result,date:'2026-02-30'}],
    [{...result,accuracy:101}],[result,result]]) {
    assert.equal((await handleWindows(request({action:'sync',results},headers),backend)).status,400);
  }
  assert.equal((await handleWindows(request({action:'sync',results:[result]}),backend)).status,401);
  const reply = await handleWindows(request({action:'sync',results:[result]},headers),backend);
  assert.equal(reply.status,200);
  assert.equal(calls.length,1);
  assert.match(calls[0][1].digest,/^[a-f0-9]{64}$/);
  assert.notEqual(calls[0][1].digest,device);
  assert.deepEqual(calls[0][1].results,[result]);
});
test('device disconnect is password-authenticated and does not require a browser session', async () => {
  const {backend,calls} = service();
  const reply = await handleWindows(request({action:'disconnect'},{'x-aim-device':device},''),backend);
  assert.deepEqual(await reply.json(),{ok:true});
  assert.equal(calls[0][0],'disconnect');
});
test('arbitrary browser origins are refused', async () => {
  const {backend,calls} = service();
  const reply = await handleWindows(request({action:'devices'},{Authorization:'Bearer valid'},'https://malicious.example'),backend);
  assert.equal(reply.status,403);
  assert.equal(reply.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal(calls.length,0);
});

test('web-session download projects safe DTO fields and normalizes legacy tools', async () => {
  const {backend} = service();
  backend.call = async () => ({
    state:'linked', nextOffset:50, sessions:[
      {id:'web-1',date:'2026-11-24',rank:'silver',focus:'tracking',minutes:'6',
        accuracy:null,feeling:'ok',notes:'',privateField:'never exposed'},
      {id:'web-2',date:'not a date'}
    ]
  });
  const reply = await handleWindows(request({action:'sync'},{'x-aim-device':device},''),backend);
  const data = await reply.json();
  assert.equal(data.nextOffset,50);
  assert.deepEqual(data.sessions,[{
    id:'web-1',date:'2026-11-24T00:00:00.000Z',rank:'silver',focus:'tracking',
    minutes:6,accuracy:null,feeling:'ok',notes:'',tool:'Non précisé',scenario:'',breakSeconds:0
  }]);
});

test('requests above the snapshot limit are rejected before processing', async () => {
  const {backend,calls} = service();
  const oversized = new Request('https://example.com/functions/v1/aimroutine-windows', {
    method:'POST', headers:{'x-aim-device':device, 'Content-Length':String(20*1024*1024+1)},
    body:'{"action":"sync"}'
  });
  assert.equal((await handleWindows(oversized,backend)).status,413);
  assert.equal(calls.length,0);
});

test('revoked device response carries no session or account data', async () => {
  const {backend} = service();
  backend.call = async () => ({state:'revoked'});
  const reply = await handleWindows(request({action:'sync',results:[result]},{'x-aim-device':device},''),backend);
  assert.equal(reply.status,200);
  assert.deepEqual(await reply.json(),{state:'revoked'});
});
