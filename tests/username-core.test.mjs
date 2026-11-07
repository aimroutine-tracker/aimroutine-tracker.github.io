import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUsername,usernameFromUser,saveUsername} from '../username-v7.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('pseudo mandatory and safe',()=>{
 for(const value of ['',null,'ab','a'.repeat(25),'bad name','<script>','_bad','àbc'])assert.throws(()=>validateUsername(value));
 assert.equal(validateUsername(' NovaFox_21 '),'NovaFox_21');
 assert.equal(validateUsername('x-7'),'x-7');
});
test('Google name is not silently accepted as chosen pseudo',()=>{
 assert.equal(usernameFromUser({user_metadata:{full_name:'Google Name'}}),null);
 assert.equal(usernameFromUser({user_metadata:{aim_username:'Player_123'}}),'Player_123');
});
test('email signup sends pseudo in Auth metadata, cloud remains optional',()=>{
 const js=read('account-v7.mjs'),html=read('account.html');
 assert.match(js,/data:\{aim_username:username\}/);
 assert.match(js,/validateUsername\(\$\('#signup-username'\)\.value\)/);
 assert.match(html,/id="signup-username"[^>]*required/);
 assert.match(html,/id="username-panel"[^>]*hidden/);
 assert.match(html,/id="username-input"[^>]*required/);
 assert.match(html,/id="user-username"/);
 assert.match(js,/usernameFromUser\(validated\)&&isEnabled\(validated\.id\)/);
});
test('Google and existing accounts persist pseudo and verify session',async()=>{
 let saved=null;
 const auth={
  getUser:async()=>({data:{user:{id:'u1',user_metadata:saved?{aim_username:saved}:{full_name:'Google User'}}},error:null}),
  updateUser:async({data})=>{saved=data.aim_username;return {data:{user:{id:'u1',user_metadata:data}},error:null}}
 };
 const user=await saveUsername(auth,'u1','Gamer_123');
 assert.equal(usernameFromUser(user),'Gamer_123');
 assert.equal(saved,'Gamer_123');
});
test('do not overwrite nickname chosen on another device',async()=>{
 let didUpdate=false;
 const auth={getUser:async()=>({data:{user:{id:'u1',user_metadata:{aim_username:'Existing'}}},error:null}),
 updateUser:async()=>{didUpdate=true}};
 const user=await saveUsername(auth,'u1','NewPlayer');
 assert.equal(usernameFromUser(user),'Existing');
 assert.equal(didUpdate,false);
});
test('no update from a different account',async()=>{
 const auth={getUser:async()=>({data:{user:{id:'wrong',user_metadata:{}}},error:null}),
 updateUser:async()=>{throw Error('unexpected')}};
 await assert.rejects(saveUsername(auth,'u1','NovaFox'),/Session non validée/);
});
test('email creation hook validates pseudo server-side but permits Google OAuth',()=>{
 const sql=read('supabase/migrations/20261107225000_require_username_signup.sql');
 assert.match(sql,/provider = 'email'/);
 assert.match(sql,/user_metadata/);
 assert.match(sql,/aim_username/);
 assert.match(sql,/provider in \('email','google'\)/);
});
