import test from 'node:test';
import assert from 'node:assert/strict';
import {captureWindowsPairing,formatWindowsNumber,readWindowsPairingFragment,rememberWindowsSignup,requestWindowsSync,takeWindowsSignup} from '../windows-sync-v1.mjs';

const challenge='b'.repeat(64);
const uid='a5c2d5f5-91be-4c57-9d3c-b2a3e45dc6c8';

test('pairing capture stores a valid challenge and does not consume OAuth redirects or other fragments',()=>{
  const values=new Map(),updates=[];
  const store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const history={state:{kept:true},replaceState:(...args)=>updates.push(args)};
  const location={pathname:'/account.html',search:'?from=windows',hash:'#aimroutine-windows='+challenge};
  const manual={challenge,mode:null,expiresAt:null};
  assert.deepEqual(readWindowsPairingFragment(location.hash),manual);
  assert.equal(readWindowsPairingFragment('#aimroutine-windows='+challenge.toUpperCase()),null);
  assert.equal(readWindowsPairingFragment(location.hash+'&access_token=other-flow'),null);
  assert.deepEqual(captureWindowsPairing(location,history,store),manual);
  assert.deepEqual([...values.values()],[challenge]);
  assert.deepEqual(updates,[[history.state,'','/account.html?from=windows#windows-sync']]);
  location.hash='#access_token=other-flow&token_type=bearer';
  assert.deepEqual(captureWindowsPairing(location,history,store),manual);
  assert.equal(updates.length,1);
  values.clear();
  location.hash='#profile';
  assert.equal(captureWindowsPairing(location,history,store),null);
  assert.equal(updates.length,1);
});

test('desktop pairing accepts only the declared modes and expires across a reload',()=>{
  const values=new Map(),updates=[];
  const store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const history={state:null,replaceState:(...args)=>updates.push(args)};
  const location={pathname:'/account.html',search:'',hash:'#aimroutine-windows='+challenge+'&flow=desktop&mode=signup'};
  const request=captureWindowsPairing(location,history,store,1000);
  assert.equal(request.mode,'signup');
  assert.deepEqual(updates,[[null,'','/account.html#windows-auth-context']]);
  assert.equal(readWindowsPairingFragment(location.hash+'&mode=login'),null);
  assert.equal(readWindowsPairingFragment(location.hash.replace('signup','recovery')),null);
  location.hash='#access_token=placeholder&type=signup';
  assert.deepEqual(captureWindowsPairing(location,history,store,1001),request);
  assert.equal(captureWindowsPairing(location,history,store,request.expiresAt),null);
  assert.equal(values.size,0);
  assert.equal(updates.length,1);
});

test('a signup handoff is read once by its exact verified confirmed account',()=>{
  const values=new Map();
  const store={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const differentUid='0401980e-fea9-4531-8f39-27c72616ca5b';
  const request=readWindowsPairingFragment('#aimroutine-windows='+challenge+'&flow=desktop&mode=signup',100);
  rememberWindowsSignup(store,request,uid,100);
  assert.equal(takeWindowsSignup(store,{id:uid},100),null);
  assert.equal(takeWindowsSignup(store,{id:differentUid,email_confirmed_at:'confirmed'},100),null);
  assert.deepEqual(takeWindowsSignup(store,{id:uid,email_confirmed_at:'confirmed'},100),request);
  assert.equal(takeWindowsSignup(store,{id:uid,email_confirmed_at:'confirmed'},100),null);
  rememberWindowsSignup(store,request,uid,100);
  assert.equal(takeWindowsSignup(store,{id:uid,email_confirmed_at:'confirmed'},request.expiresAt),null);
  assert.equal(values.size,0);
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

test('desktop approval refuses an access token change or an inactive pairing before calling Edge',async()=>{
  const accessToken='exact-login-token';
  let token=accessToken,activity=true,refreshWhileVerifying=true,calls=0;
  const client={
    auth:{
      getSession:async()=>({data:{session:{user:{id:uid},access_token:token}}}),
      getUser:async()=>{if(refreshWhileVerifying)token='new-token';return {data:{user:{id:uid}}}}
    },
    functions:{invoke:async()=>{calls+=1;return {data:{ok:true}}}}
  };
  const body={action:'approve',challenge};
  const pin={token:accessToken,active:()=>activity};
  await assert.rejects(requestWindowsSync(client,uid,body,pin),/account_changed/);
  token=accessToken;refreshWhileVerifying=false;activity=false;
  await assert.rejects(requestWindowsSync(client,uid,body,pin),/account_changed/);
  assert.equal(calls,0);
  activity=true;
  assert.deepEqual(await requestWindowsSync(client,uid,body,pin),{ok:true});
  assert.equal(calls,1);
});

test('missing measurements remain distinct from actual zero',()=>{
  assert.equal(formatWindowsNumber(null,'en-GB',' %'),'—');
  assert.equal(formatWindowsNumber(0,'en-GB',' %'),'0 %');
  assert.equal(formatWindowsNumber('0','en-GB'),'—');
  assert.equal(formatWindowsNumber(14.525,'fr-FR',' %'),'14,53 %');
});
