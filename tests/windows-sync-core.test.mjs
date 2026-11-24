import test from 'node:test';
import assert from 'node:assert/strict';
import {captureWindowsPairing,formatWindowsNumber,readWindowsPairingFragment,requestWindowsSync} from '../windows-sync-v1.mjs';

const challenge='b'.repeat(64);
const uid='a5c2d5f5-91be-4c57-9d3c-b2a3e45dc6c8';

test('pairing capture stores a valid challenge and does not consume OAuth redirects or other fragments',()=>{
  const values=new Map(),updates=[];
  const store={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const history={state:{kept:true},replaceState:(...args)=>updates.push(args)};
  const location={pathname:'/account.html',search:'?from=windows',hash:'#aimroutine-windows='+challenge};
  assert.equal(readWindowsPairingFragment(location.hash),challenge);
  assert.equal(readWindowsPairingFragment('#aimroutine-windows='+challenge.toUpperCase()),null);
  assert.equal(readWindowsPairingFragment(location.hash+'&access_token=other-flow'),null);
  assert.equal(captureWindowsPairing(location,history,store),challenge);
  assert.deepEqual([...values.values()],[challenge]);
  assert.deepEqual(updates,[[history.state,'','/account.html?from=windows#windows-sync']]);
  location.hash='#access_token=other-flow&token_type=bearer';
  assert.equal(captureWindowsPairing(location,history,store),challenge);
  assert.equal(updates.length,1);
  values.clear();
  location.hash='#profile';
  assert.equal(captureWindowsPairing(location,history,store),null);
  assert.equal(updates.length,1);
});

test('the request is pinned to the token of the verified owner and rejects a different session',async()=>{
  const calls=[];
  const client={
    auth:{
      getSession:async()=>({data:{session:{user:{id:uid},access_token:'test-authorization'}}}),
      getUser:async token=>{calls.push(token);return {data:{user:{id:uid}}}}
    },
    functions:{
      invoke:async (name,options)=>{calls.push({name,options});return {data:{ok:true}}}
    }
  };
  const body={action:'approve',challenge};
  assert.deepEqual(await requestWindowsSync(client,uid,body),{ok:true});
  assert.deepEqual(calls,['test-authorization',{name:'aimroutine-windows',options:{
    method:'POST',headers:{Authorization:'Bearer test-authorization'},body
  }}]);
  calls.length=0;
  await assert.rejects(requestWindowsSync(client,'0401980e-fea9-4531-8f39-27c72616ca5b',body),/account_changed/);
  assert.deepEqual(calls,[]);
});

test('missing measurements remain distinct from actual zero',()=>{
  assert.equal(formatWindowsNumber(null,'en-GB',' %'),'—');
  assert.equal(formatWindowsNumber(0,'en-GB',' %'),'0 %');
  assert.equal(formatWindowsNumber('0','en-GB'),'—');
  assert.equal(formatWindowsNumber(14.525,'fr-FR',' %'),'14,53 %');
});
