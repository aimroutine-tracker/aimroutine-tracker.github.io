import test from 'node:test';
import assert from 'node:assert/strict';
import {hasGoogleIdentity} from '../google-delete-v7.mjs';
const uid='11111111-1111-4111-8111-111111111111';
test('Google accounts are identified for a simplified deletion form',()=>{
 assert.equal(hasGoogleIdentity({id:uid,identities:[{provider:'google'}]}),true);
 assert.equal(hasGoogleIdentity({id:uid,app_metadata:{provider:'google'}}),true);
 assert.equal(hasGoogleIdentity({id:uid,app_metadata:{providers:['google','email']}}),true);
 assert.equal(hasGoogleIdentity({id:uid,identities:[{provider:'email'}]}),false);
 assert.equal(hasGoogleIdentity(null),false);
});
