import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Single-use production test: beta Auth Hook is enabled; no account should be
// created. The disposable e-mail alias belongs to AimRoutine's own mailbox.
// Never log actual credentials, tokens or confirmation URLs.
const key=readFileSync('cloud-client-v7.mjs','utf8')
  .match(/PUBLISHABLE_KEY='(sb_publishable_[A-Za-z0-9_]+)'/)?.[1];
assert.ok(key,'Missing publishable key');
const api='https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/signup';
const tests=[
 {name:'7 characters, otherwise strong',password:'Aa1!bcd',expected:'too_short'},
 {name:'8 characters, required complexity',password:'Aa1!bcde',expected:'beta_gate'},
 {name:'8 characters, no complexity',password:'abcdefgh',expected:'weak_complexity'}
];
for(const [i,test] of tests.entries()){
 const email='aimroutine-tracker+eight-policy-'+(i+1)+'-20261106@outlook.fr';
 const result=await fetch(api,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
  body:JSON.stringify({email,password:test.password})});
 const response=await result.json().catch(()=>({}));
 const message=String(response.msg||response.message||'');
 console.log(test.name+': HTTP '+result.status+
  '; minimum eight mentioned='+/at least 8|8 characters|at least eight/i.test(message)+
  '; beta hook denial='+message.includes('New email registrations are not available'));
 assert.ok(result.status>=400&&result.status<500,
  'Unexpected successful signup, investigate and remove test account');
 if(test.expected==='beta_gate'){
  assert.equal(result.status,403,'Eight-character complex password must reach beta signup gate');
  assert.ok(message.includes('New email registrations are not available'),
   'Eight-character password was rejected before beta gate');
 }else if(test.expected==='too_short'){
  assert.ok(result.status===400||result.status===422,'Seven-character password should fail server validation');
  assert.ok(!message.includes('New email registrations are not available'),
   'Cannot verify minimum if beta gate precedes password validation');
 }else{
  assert.ok(result.status===400||result.status===422,
   'Eight-character password without complexity should be rejected by server policy');
  assert.ok(!message.includes('New email registrations are not available'),
   'Cannot verify character requirement if gate precedes password validation');
 }
}
console.log('RESULT: Supabase enforces 8-character length and character complexity; beta signup hook remains active.');
