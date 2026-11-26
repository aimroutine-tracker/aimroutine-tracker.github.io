import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
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

const player = {
  onboarded:true, name:'Joueur Démo', rank:'Immortel', division:1,
  owned:['Valorant'], avatarDataUrl:null, goals:['Precision'], weaknesses:['overshoot'],
  mechanicalLevel:4, fatigue:1, dpi:800, sensitivity:0.42, pollingRate:1000, minutes:25,
  trainingDays:[1,3,5]
};

function avatar(size = 128) {
  function chunk(type, contents) {
    const body = Buffer.concat([Buffer.from(type), contents]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(contents.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size,4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',header),
    chunk('IDAT',deflateSync(Buffer.alloc(size * (size * 4 + 1)))), chunk('IEND',Buffer.alloc(0))
  ]);
}
const avatarUrl = bytes => 'data:image/png;base64,' + bytes.toString('base64');

test('private player profile requires the device secret and scopes the request to its digest', async () => {
  const headers = {'x-aim-device':device};
  const {backend,calls} = service();
  backend.call = async (op,args) => {
    calls.push([op,args]);
    return {accountId:id,profile:args.profile,revision:args.profile ? 1 : 0};
  };
  const read = {action:'profile', userId:'another', digest:'f'.repeat(64)};
  assert.equal((await handleWindows(request(read,{Authorization:'Bearer valid'}),backend)).status,401);
  const readReply = await handleWindows(request(read,headers),backend);
  assert.deepEqual(await readReply.json(),{accountId:id,profile:null,revision:0});
  assert.match(calls[0][1].digest,/^[a-f0-9]{64}$/);
  assert.notEqual(calls[0][1].digest,read.digest);
  assert.deepEqual(Object.keys(calls[0][1]).sort(),['digest','profile','revision']);

  const profile = {...player,avatarDataUrl:avatarUrl(avatar())};
  const reply = await handleWindows(request({...read, revision:0, profile},headers),backend);
  assert.equal(reply.status,200);
  assert.equal(reply.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(await reply.json(),{accountId:id,profile,revision:1});
  assert.deepEqual(calls[1],['profile',{digest:calls[0][1].digest,revision:0,profile}]);
});

test('player profile rejects unsafe fields, malformed avatars and invalid revisions', async () => {
  const {backend,calls} = service();
  const headers = {'x-aim-device':device};
  const damaged = avatar();
  damaged[damaged.length - 1] ^= 1;
  const malformed = [
    {...player, backupPath:'C:/Private'}, {...player, division:null},
    {...player,avatarDataUrl:'https://example.com/image.png'},
    {...player,avatarDataUrl:avatarUrl(avatar(1))}, {...player,avatarDataUrl:avatarUrl(damaged)},
    {...player,avatarDataUrl:'data:image/png;base64,iVBORw0KGgoAAAA='}
  ];
  for (const profile of malformed) {
    const reply = await handleWindows(request({action:'profile',revision:0,profile},headers),backend);
    assert.equal(reply.status,400);
    assert.deepEqual(await reply.json(),{error:'invalid_profile'});
  }
  for (const revision of [undefined,-1,0.5,2 ** 31 - 1]) {
    assert.equal((await handleWindows(request({action:'profile',revision,profile:player},headers),backend)).status,400);
  }
  assert.equal(calls.length,0);
});

test('player profile reports revision conflicts and revoked devices without leaking account data', async () => {
  const {backend} = service();
  const headers = {'x-aim-device':device};
  for (const [error,status] of [['profile_changed',409],['device_not_linked',403],['device_revoked',403]]) {
    backend.call = async () => ({error});
    const reply = await handleWindows(request({action:'profile',revision:1,profile:player},headers),backend);
    assert.equal(reply.status,status);
    assert.deepEqual(await reply.json(),{error});
  }
});

test('a web profile can be saved only as the verified bearer account', async () => {
  const {backend,calls} = service();
  const profile = {...player, avatarDataUrl:avatarUrl(avatar())};
  const body = {action:'save-profile',userId:'other',uid:'other',revision:0,profile};
  backend.call = async (operation,args) => {
    calls.push([operation,args]);
    return {accountId:args.uid,profile:args.profile,revision:1};
  };
  for (const headers of [{},{'x-aim-device':device},{Authorization:'Bearer invalid'}]) {
    const reply = await handleWindows(request(body,headers),backend);
    assert.equal(reply.status,401);
    assert.deepEqual(await reply.json(),{error:'authentication_required'});
  }
  assert.equal(calls.length,0);
  const reply = await handleWindows(request(body,{Authorization:'Bearer valid','x-aim-device':device}),backend);
  assert.equal(reply.status,200);
  assert.equal(reply.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(await reply.json(),{accountId:id,profile,revision:1});
  assert.deepEqual(calls,[['save-profile',{uid:id,revision:0,profile}]]);
});

test('web profile writes validate the desktop profile and never write stale data', async () => {
  const {backend,calls} = service();
  const headers = {Authorization:'Bearer valid'};
  for (const body of [{revision:1},{revision:1,profile:null},{revision:1,profile:{...player,pollingRate:0}},
    {revision:1,profile:{...player,userId:'other'}},{revision:0.5,profile:player}]) {
    const reply = await handleWindows(request({action:'save-profile',...body},headers),backend);
    assert.equal(reply.status,400);
    assert.deepEqual(await reply.json(),{error:'invalid_profile'});
  }
  assert.equal(calls.length,0);
  backend.call = async () => ({error:'profile_changed'});
  const reply = await handleWindows(request({action:'save-profile',revision:1,profile:player},headers),backend);
  assert.equal(reply.status,409);
  assert.deepEqual(await reply.json(),{error:'profile_changed'});
});
