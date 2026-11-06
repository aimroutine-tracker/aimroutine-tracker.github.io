import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
// One-time, safe production negative signup check. Test address belongs to the
// project's Outlook mailbox. No user credentials, tokens or links are logged.
const cfg=readFileSync('cloud-client-v7.mjs','utf8');
const key=cfg.match(/PUBLISHABLE_KEY='(sb_publishable_[A-Za-z0-9_]+)'/)?.[1];
assert.ok(key,'Public Supabase key missing');
const email='aimroutine-tracker+hookcheck-20261106@outlook.fr';
const password=randomBytes(24).toString('base64url')+'A1!';
const base='https://lmzswtzboobpokumxzhy.supabase.co';
const headers={'apikey':key,'Content-Type':'application/json'};
const response=await fetch(base+'/auth/v1/signup',{method:'POST',headers,body:JSON.stringify({email,password})});
const body=await response.json().catch(()=>({}));
console.log('New email user signup: HTTP '+response.status);
console.log('Auth error code: '+String(body.code||body.error_code||'none').slice(0,100));
console.log('Auth error reflects beta gate: '+String(body.msg||body.message||'').toLowerCase().includes('new email registrations are not available'));
assert.equal(response.status,403,'Expected 403 by beta signup hook; if accepted, remove disposable user via DB');
assert.ok(String(body.msg||body.message||'').includes('New email registrations are not available'),'Unexpected Auth failure; hook restriction not proven');
const providers=await fetch(base+'/auth/v1/settings',{headers:{apikey:key}});
assert.ok(providers.ok);
const settings=await providers.json();
console.log('Google OAuth enabled: '+Boolean(settings.external?.google));
assert.equal(settings.external?.google,true);
console.log('SERVER-SIDE BETA GATE VERIFIED');
