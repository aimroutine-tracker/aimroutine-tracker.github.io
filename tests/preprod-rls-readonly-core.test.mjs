import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStagingOrigin,runPreprodRlsReadOnly} from '../scripts/preprod-rls-readonly-v3.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const STAGING='https://bbbbbbbbbbbbbbbbbbbb.supabase.co';
const env={
 AIM_QA_SUPABASE_URL:STAGING,AIM_QA_SUPABASE_ANON_KEY:'sb_publishable_qa_only',
 AIM_QA_UID_A:A,AIM_QA_UID_B:B,
 AIM_QA_JWT_A:'ephemeral-a',AIM_QA_JWT_B:'ephemeral-b'
};
function fake({leak=false,missing=false,wrongUser=false,anonLeak=false,anonEmpty=false,anonError=false}={}){
 const calls=[];
 async function fetchImpl(url,options){
  calls.push({url,options});
  assert.equal(options.method,'GET','QA must not write to the database');
  assert.equal(options.redirect,'error');
  assert.equal(options.cache,'no-store');
  assert.equal(new URL(url).origin,STAGING);
  if(!options.headers.Authorization){
   assert.equal(options.headers.apikey,env.AIM_QA_SUPABASE_ANON_KEY);
   if(anonError)return {ok:false,status:500,json:async()=>({})};
   if(anonLeak)return {ok:true,status:200,json:async()=>[{user_id:A}]};
   if(anonEmpty)return {ok:true,status:200,json:async()=>[]};
   return {ok:false,status:403,json:async()=>({})};
  }
  const viewer=options.headers.Authorization.endsWith('ephemeral-a')?A:B;
  if(url.endsWith('/auth/v1/user')){
   return {ok:true,status:200,json:async()=>({id:wrongUser?B:viewer})};
  }
  const u=new URL(url),table=u.pathname.split('/').pop();
  assert.ok(['aim_sessions','aim_presets','aim_profiles','aim_preferences'].includes(table));
  const owner=u.searchParams.get('user_id')?.replace(/^eq\./,'');
  const rows=leak&&viewer!==owner?[{user_id:owner}]:
   viewer===owner&&!missing?[{user_id:owner}]:[];
  return {ok:true,status:200,json:async()=>rows};
 }
 return {calls,fetchImpl};
}

test('preproduction verifier refuses production, other domains and injected origins',()=>{
 assert.equal(assertStagingOrigin(STAGING),STAGING);
 for(const input of [
  'https://lmzswtzboobpokumxzhy.supabase.co',
  'http://bbbbbbbbbbbbbbbbbbbb.supabase.co',
  'https://bbbbbbbbbbbbbbbbbbbb.supabase.co/sneaky',
  'https://bbbbbbbbbbbbbbbbbbbb.supabase.co@malicious.example/',
  'https://example.com','ftp://example.com','not a url'
 ]){
  assert.throws(()=>assertStagingOrigin(input));
 }
});

test('preproduction RLS QA never starts network calls with missing or reused credentials',async()=>{
 for(const overrides of [
  {AIM_QA_SUPABASE_URL:'https://lmzswtzboobpokumxzhy.supabase.co'},
  {AIM_QA_JWT_A:''},{AIM_QA_JWT_B:'ephemeral-a'},
  {AIM_QA_SUPABASE_ANON_KEY:'sb_secret_not_for_clients'},
  {AIM_QA_SUPABASE_ANON_KEY:'service_role'},
  {AIM_QA_SUPABASE_ANON_KEY:'public-qa-only'},
  {AIM_QA_SUPABASE_ANON_KEY:'a.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.b'},
  {AIM_QA_UID_B:A},{AIM_QA_UID_A:'not-an-uuid'}
 ]){
  const mocked=fake();
  await assert.rejects(runPreprodRlsReadOnly({env:{...env,...overrides},fetchImpl:mocked.fetchImpl}));
  assert.equal(mocked.calls.length,0);
 }
});

test('preproduction QA verifies Auth identities and RLS with read-only requests',async()=>{
 const mocked=fake();
 const result=await runPreprodRlsReadOnly({env,fetchImpl:mocked.fetchImpl});
 assert.equal(result.stagingVerified,true);
 assert.equal(result.tables.length,4);
 assert.equal(mocked.calls.length,22); // 2 Auth + 4 anonymous + 4 tables x 4 RLS checks.
 assert.equal(mocked.calls.filter(call=>!call.options.headers.Authorization).length,4);
 assert.ok(result.tables.every(table=>table.anonymousReadBlocked===true));
 assert.ok(mocked.calls.every(call=>call.options.method==='GET'));
 assert.ok(mocked.calls.every(call=>call.url.startsWith(STAGING)));
});

test('preproduction QA blocks missing fixtures, mismatched JWT and cross-account leaks',async()=>{
 for(const variant of [{missing:true},{wrongUser:true},{leak:true},{anonLeak:true},{anonError:true}]){
  const mocked=fake(variant);
  await assert.rejects(runPreprodRlsReadOnly({env,fetchImpl:mocked.fetchImpl}),
   /Fixture QA absente|JWT QA différent|isolation A\/B non respectée|lecture anonyme|Accès anonyme QA non vérifiable/);
 }
});

test('preproduction QA accepts an anonymous empty RLS result without false positives',async()=>{
 const mocked=fake({anonEmpty:true});
 const result=await runPreprodRlsReadOnly({env,fetchImpl:mocked.fetchImpl});
 assert.equal(result.tables.length,4);
 assert.equal(mocked.calls.length,22);
});

test('preproduction QA accepts only an anon legacy JWT and includes it in anonymous requests',async()=>{
 const anonToken='a.'+Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')+'.b';
 const mocked=fake();
 const normal=mocked.fetchImpl;
 const calls=[];
 const wrapper=async(url,opts)=>{
  if(opts.headers.Authorization==='Bearer '+anonToken){
   calls.push({url,opts});
   return {ok:false,status:403,json:async()=>({})};
  }
  return normal(url,opts);
 };
 const result=await runPreprodRlsReadOnly({
  env:{...env,AIM_QA_SUPABASE_ANON_KEY:anonToken},fetchImpl:wrapper
 });
 assert.equal(result.tables.length,4);
 assert.equal(calls.length,4);
 assert.ok(calls.every(call=>call.opts.method==='GET'));
});
