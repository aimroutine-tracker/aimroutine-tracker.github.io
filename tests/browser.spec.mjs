import {test,expect} from '@playwright/test';

/* Verified mocked account: no real Supabase requests or data mutations. */
async function useVerifiedTestAccount(page){
 const uid='11111111-1111-4111-8111-111111111111';
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({status:200,contentType:'application/javascript',body:"const uid='11111111-1111-4111-8111-111111111111';\nconst rows={aim_sessions:[],aim_presets:[],aim_profiles:[],aim_preferences:[]};\nwindow.__testCloudWrites=[];\nexport const supabase={\n auth:{getSession:async()=>({data:{session:{user:{id:uid,email:'qa@example.test'}}},error:null}),getUser:async()=>({data:{user:{id:uid,email:'qa@example.test'}},error:null})},\n from(table){return {\n  select(){return {order(){return {range:async()=>({data:rows[table]||[],error:null})}},eq(){return {maybeSingle:async()=>({data:null,error:null})}}}},\n  upsert:async(input)=>{window.__testCloudWrites.push({table,items:input});return {error:null}},\n  update(){return {eq(){return {eq:async()=>({error:null})}}}}\n }}\n};"}));
 await page.evaluate(()=>localStorage.setItem('sb-lmzswtzboobpokumxzhy-auth-token','test-token'));
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.__aimCloudUserId),{timeout:15000}).toBe(uid);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.AIMWeb)),{timeout:15000}).toBe(true);
}

test.beforeEach(async ({page})=>{
 await page.route('https://cmsassets.rgpub.io/**',route=>route.abort());
 // Keep browser smoke tests deterministic: real Turnstile is validated only
 // after Supabase server-side CAPTCHA has been configured by the project owner.
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>
  route.fulfill({status:200,contentType:'application/javascript',
   body:"window.__turnstileResetCount=0;window.turnstile={render(element,options){element.dataset.rendered='yes';options.callback('qa-synthetic-captcha-token');return 42},reset(){window.__turnstileResetCount++}};"}));
 const failures=[];
 page.on('pageerror',e=>failures.push(e.message));
 await page.goto('/training.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#tab-dashboard')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>Boolean(window.AIMWeb)),{timeout:15000}).toBe(true);
});
test('Build, edit, run and save a player session',async ({page})=>{
 await useVerifiedTestAccount(page);
 await page.locator('#tab-builder').click();
 await page.locator('#builder-form button[type="submit"]').click();
 await expect(page.locator('#start-plan')).toBeEnabled();
 await page.locator('#start-plan').click();
 await expect(page.locator('#timer-toggle')).toBeVisible();
 await expect(page.locator('#timer-auto')).toBeChecked();
 await page.locator('#timer-toggle').click();
 await expect(page.locator('#timer-toggle')).toContainText('Pause');
 await page.locator('#timer-toggle').click();
 for(let i=0;i<5;i++)await page.locator('#next-exercise').click();
 await expect(page.locator('#finish-form')).toBeVisible();
 await page.locator('#accuracy').fill('80.5');
 await page.locator('#finish-form button[type="submit"]').click();
 await expect(page.locator('#total-sessions')).toHaveText('1');
 await expect(page.locator('#best-accuracy')).toContainText('80.5');
});
test('Profile, program and player achievements',async ({page})=>{
 await useVerifiedTestAccount(page);
 await page.locator('#tab-profile').click();
 await page.locator('#player-name').fill('NovaFox');
 await page.locator('#player-dpi').fill('1600');
 await page.locator('#player-sens').fill('0.215');
 await expect(page.locator('#player-edpi')).toContainText('344.0');
 await page.locator('#player-form button[type="submit"]').click();
 await expect(page.locator('#profile-status')).toContainText('Profil enregistré');
 await page.locator('#tab-program').click();
 await page.locator('#program-form button[type="submit"]').click();
 await expect(page.locator('#program-calendar > article')).toHaveCount(7);
 await page.locator('#program-calendar > article').first().locator('button').click();
 await expect(page.locator('#tab-builder')).toHaveAttribute('aria-selected','true');
 await page.locator('#tab-challenges').click();
 await expect(page.locator('.ar6-achievement')).toHaveCount(5);
});
test('Scenario-specific analytics and portable export',async ({page})=>{
 await useVerifiedTestAccount(page);
 const add=await page.evaluate(()=>{
  const sessions=Array.from({length:6},(_,i)=>({
   id:'case-'+i,date:new Date(Date.now()-(5-i)*86400000).toISOString(),
   rank:'silver',focus:'micro',tool:'Aim Lab',scenario:'Microshot',
   minutes:20,accuracy:65+i*2,feeling:'good',notes:''
  }));
  return window.AIMWeb.mergeData({sessions,presets:[],weeklyGoal:3});
 });
 expect(add).toBe(6);
 await page.locator('#tab-insights').click();
 await page.locator('#insight-focus').selectOption('micro');
 await page.locator('#insight-tool').selectOption('Aim Lab');
 await page.locator('#analysis-scenario').selectOption('Microshot');
 await expect(page.locator('#chart-count')).toContainText('6');
 await expect(page.locator('#chart svg')).toBeVisible();
 await expect(page.locator('#scenario-records')).toContainText('Microshot');
 await page.locator('#tab-data').click();
 const downloaded=page.waitForEvent('download');
 await page.locator('#export-portable').click();
 const file=await downloaded;
 expect(file.suggestedFilename()).toMatch(/^aimroutine-portable-\d{4}-\d{2}-\d{2}\.json$/);
});
test('Language switch and responsive navigation',async ({page,isMobile})=>{
 await page.locator('[data-switch-lang]').click();
 await expect(page.locator('#workspace-title')).toContainText('Your training');
 await expect(page.locator('#tab-program')).toHaveText('Programs');
 if(isMobile)await expect(page.locator('.site31-mobile-nav summary')).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});
test.describe('PWA cache integration',()=>{
 test.use({serviceWorkers:'allow'});
 test('Offline training works after initial install',async ({page,context,browserName})=>{
 test.skip(browserName!=='chromium','Offline service worker tested on Chromium; other engines checked for rendering');
 await page.evaluate(async()=>{if(!('serviceWorker'in navigator))throw Error('No service workers');await navigator.serviceWorker.ready});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#tab-dashboard')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>Boolean(window.AIMWeb))).toBe(true);
 await context.setOffline(false);
});

 test('V3 owner-reference assets remain cached and usable offline',async({page,context,browserName})=>{
  test.skip(browserName!=='chromium','Offline precache verified on Chromium');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  const cacheResults=await page.evaluate(async()=>{
   const urls=['site-owner-reference-v3.css','aimroutine-avatar-reference.svg'];
   return await Promise.all(urls.map(async file=>{
    const request=new Request(new URL(file,navigator.serviceWorker.controller?.scriptURL||location.href));
    for(const key of await caches.keys()){
     if(await (await caches.open(key)).match(request,{ignoreSearch:true}))return true;
    }
    return false;
   }));
  });
  expect(cacheResults,'The V3 stylesheet and avatar must be precached together').toEqual([true,true]);
  await context.setOffline(true);
  try{
   const response=await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
   expect(response?.status()).toBe(200);
   await expect(page.locator('.r17-progress-wrap')).toBeVisible();
   await expect.poll(()=>page.evaluate(()=>
    getComputedStyle(document.documentElement).getPropertyValue('--ar-v3-night').trim()
   ),{timeout:8000}).toBe('#07121b');
  }finally{
   await context.setOffline(false);
  }
 });

});


test('V3 reference hero bracket is decorative on all four pages',async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 for(const route of ['index.html','training.html','progress.html','account.html']){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
  const bracket=await page.locator('.r17-screen .r17-hero-content').evaluate(el=>{
   const style=getComputedStyle(el,'::before');
   return {
    content:style.content,
    left:style.left,
    width:style.width,
    border:style.borderTopWidth,
    pointerEvents:style.pointerEvents,
    documentWidth:document.documentElement.scrollWidth
   };
  });
  expect(bracket.content,route).toBe('""');
  expect(bracket.width,route).toBe('29px');
  expect(bracket.border,route).toBe('2px');
  expect(bracket.pointerEvents,route).toBe('none');
  expect(bracket.documentWidth,route).toBeLessThanOrEqual(1675);
 }
});




test('V3 home KPI strip matches reference vertical placement without moving features',async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
 const rail=page.locator('.r17-home-wrap .r17-stats');
 const features=page.locator('.r17-home-wrap .r17-features');
 await expect(rail).toBeVisible();
 await expect(features).toBeVisible();
 const a=await rail.boundingBox(),b=await features.boundingBox();
 expect(a.y).toBeGreaterThanOrEqual(402);
 expect(a.y).toBeLessThanOrEqual(414); // account for browser font metrics and antialiasing
 expect(b.y).toBeGreaterThanOrEqual(490);
 expect(b.y).toBeLessThanOrEqual(503);
 expect(a.y+a.height).toBeLessThan(b.y);
});

test('V3 routines hero CTAs keep source geometry and real navigation',async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 await page.goto('/training.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
 const buttons=page.locator('.r17-training-wrap .r17-hero-actions .r17-button');
 await expect(buttons).toHaveCount(2);
 const values=await buttons.evaluateAll(nodes=>nodes.map(n=>{
  const r=n.getBoundingClientRect();
  return {x:r.x,width:r.width,href:n.getAttribute('href'),visible:r.height>0};
 }));
 expect(values[0].visible&&values[1].visible).toBe(true);
 expect(values[0].width).toBeGreaterThanOrEqual(258);
 expect(values[1].width).toBeGreaterThanOrEqual(365);
 expect(values[1].x).toBeGreaterThan(values[0].x+values[0].width);
 expect(values.every(x=>x.href&&x.href!=='#')).toBe(true);
});


test('Shared Cloud navigation requires a verified account and follows FR/EN and logout',async({page})=>{
 // This scenario verifies the desktop header; the mobile menu is tested separately.
 await page.setViewportSize({width:1672,height:941});
 const uid='11111111-1111-4111-8111-111111111111';
 await page.addInitScript(()=>{
  window.__qaHeaderAuthenticated=false;
  localStorage.setItem('aimroutine_cloud_current_uid','11111111-1111-4111-8111-111111111111');
 });
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const id='11111111-1111-4111-8111-111111111111';
const listeners=[];
window.__qaEmitCloudAuth=event=>listeners.forEach(fn=>fn(event));
export const supabase={auth:{
 getUser:async()=>({data:{user:window.__qaHeaderAuthenticated?{id}:null},error:null}),
 onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){}}}}}
}};`
 }));
 await page.goto('/index.html',{waitUntil:'load'});
 const cloud=page.locator('.r18-cloud'),signin=page.locator('.r18-signin');
 await expect(page.locator('.r18-register')).toBeVisible();
 await expect(signin).toContainText('Se connecter');
 await expect(cloud).not.toHaveClass(/r18-connected/);
 // A forged local UID must not activate the Cloud indicator or eagerly
 // download the Supabase SDK before a real session token appears.
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaEmitCloudAuth)).toBe('undefined');
 await page.evaluate(()=>{
  const key='sb-lmzswtzboobpokumxzhy-auth-token';
  localStorage.setItem(key,'qa-session-only');
  window.dispatchEvent(new StorageEvent('storage',{key,newValue:'qa-session-only'}));
 });
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaEmitCloudAuth)).toBe('function');
 await page.evaluate(()=>{
  window.__qaHeaderAuthenticated=true;
  window.__qaEmitCloudAuth('SIGNED_IN');
 });
 await expect(cloud).toHaveClass(/r18-connected/);
 await expect(signin).toHaveText('Mon compte');
 await expect(signin).toHaveAttribute('href','account.html#dashboard-panel');
 await expect(page.locator('.r18-register')).toBeHidden();
 await page.locator('.ar-v3-language-footer [data-switch-lang]').click();
 await expect(signin).toHaveText('My account');
 await page.evaluate(()=>{
  window.__qaHeaderAuthenticated=false;
  window.__qaEmitCloudAuth('SIGNED_OUT');
 });
 await expect(cloud).not.toHaveClass(/r18-connected/);
 await expect(signin).toHaveText('Sign in');
 await expect(page.locator('.r18-register')).toBeVisible();
 // Another tab signs in without reloading this one: the existing SDK must
 // revalidate that user instead of permanently returning on 'subscribed'.
 await page.evaluate(()=>{
  const key='sb-lmzswtzboobpokumxzhy-auth-token';
  window.__qaHeaderAuthenticated=true;
  localStorage.setItem(key,'qa-other-tab-session');
  window.dispatchEvent(new StorageEvent('storage',{key,newValue:'qa-other-tab-session'}));
 });
 await expect(cloud).toHaveClass(/r18-connected/);
 await expect(signin).toHaveText('My account');
});

test('V3 profile label respects the selected locale without pretending there is a guest account',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const label=page.locator('.r17-account-profile .r17-section-label');
 await expect.poll(()=>label.evaluate(el=>el.innerText.trim())).toBe('PROFIL JOUEUR');
 await expect(page.locator('.r17-account-profile [data-r17-username]')).toContainText('Connecte-toi à ton profil');
 await page.locator('.ar-v3-language-footer [data-switch-lang]').click();
 await expect.poll(()=>label.evaluate(el=>el.innerText.trim())).toBe('PLAYER PROFILE');
 await expect(page.locator('.r17-account-profile [data-r17-username]')).toContainText('Sign in to your profile');
});

test('Google Cloud sign-in description is accurate and accessible in French and English',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const google=page.locator('#google-signin');
 const note=page.locator('#google-login-note');
 await expect(google).toHaveAttribute('aria-describedby','google-login-note');
 await expect(note).toContainText('Connecte-toi avec Google');
 await expect(note).not.toContainText('bêta');
 await expect(note).not.toContainText('Google Auth Platform');
 await page.locator('.ar-v3-language-footer [data-switch-lang]').click();
 await expect(note).toContainText('Sign in with Google');
 await expect(note).not.toContainText('beta');
 await expect(google).toContainText('Continue with Google');
});

test('Cloud account landing has single-border tags and a compact accessible guest button',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const chips=page.locator('.ar7-account-highlights > .ar7-account-chip');
 await expect(chips).toHaveCount(3);
 await expect(page.locator('.ar7-guest-link')).toBeVisible();
 const check=await page.evaluate(()=>{
   const badges=[...document.querySelectorAll('.ar7-account-highlights > .ar7-account-chip')];
   const borders=badges.map(chip=>({
     outer:getComputedStyle(chip).borderTopWidth,
     inner:getComputedStyle(chip.querySelector('span')).borderTopWidth,
     innerPadding:getComputedStyle(chip.querySelector('span')).paddingLeft
   }));
   const button=document.querySelector('.ar7-guest-link').getBoundingClientRect();
   return {borders,buttonWidth:button.width,overflow:document.documentElement.scrollWidth-window.innerWidth};
 });
 expect(check.borders.every(x=>x.outer==='1px'&&x.inner==='0px'&&x.innerPadding==='0px')).toBe(true);
 expect(check.buttonWidth).toBeLessThanOrEqual(page.viewportSize().width);
 expect(check.overflow).toBeLessThanOrEqual(2);
});

test('Account deletion UI exists but remains inaccessible to guests',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const section=page.locator('.ar7-delete-account');
 await expect(section).toHaveCount(1);
 // Dashboard is hidden for signed-out visitors: this test does NOT submit deletion.
 await expect(section).toBeHidden();
 await expect(section.locator('input[type="password"]')).toHaveCount(1);
 await expect(section.locator('input#delete-account-confirmation')).toHaveAttribute('maxlength','9');
 await expect(section.locator('#google-delete-flow')).toHaveCount(1);
 await expect(section.locator('#google-delete-reauth')).toHaveCount(0);
 await expect(section.locator('#delete-account-confirmation')).toHaveAttribute('pattern','SUPPRIMER');
 await expect(section.locator('#delete-account-final')).toHaveCount(1);
 await expect(section.locator('button[type="submit"]')).toHaveCount(1);
});

test('Google OAuth and email signup buttons are enabled with required password policy',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#google-login-wrap')).toBeVisible();
 await expect(page.locator('#google-signin')).toBeEnabled();
 await page.locator('#signup-mode').click();
 await expect(page.locator('#signup-password')).toHaveAttribute('minlength','8');
 await expect(page.locator('#signup-submit')).toBeEnabled();
 await expect(page.locator('#google-signin')).toBeEnabled();
 await page.locator('#login-mode').click();
 await expect(page.locator('#google-signin')).toBeEnabled();
});

test('All public pages render without overflow or script errors',async({page,isMobile})=>{
 const paths=['index.html','product.html','presentation.html','riot-integration.html',
  'updates.html','releases.html','changelog.html','privacy.html','terms.html','account.html','training.html','404.html'];
 const jsErrors=[];
 page.on('pageerror',error=>jsErrors.push(error.message));
 for(const path of paths){
  const response=await page.goto('/'+path,{waitUntil:'domcontentloaded'});
  expect(response?.status(),path).toBe(200);
  await expect(page.locator('main'),path).toHaveCount(1);
  await expect(page.locator('nav.site31-nav'),path).toHaveCount(1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow,path+' causes horizontal scrolling').toBeLessThanOrEqual(2);
  if(isMobile)await expect(page.locator('details.site31-mobile-nav > summary'),path).toBeVisible();
  if(isMobile&&path==='index.html'){
   const carousel=page.locator('.v15-focus-grid');
   await expect(carousel).toBeVisible();
   const scroll=await carousel.evaluate(el=>{
    const available=el.scrollWidth-el.clientWidth;
    el.scrollLeft=100;
    return {available,offset:el.scrollLeft};
   });
   expect(scroll.available).toBeGreaterThan(20);
   expect(scroll.offset).toBeGreaterThan(0);
  }
 }
 expect(jsErrors).toEqual([]);
});

test('Privacy and account pages describe the real Google self-deletion path',async({page})=>{
 await page.goto('/privacy.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('main')).toContainText('SUPPRIMER');
 await expect(page.locator('main')).toContainText('Supabase');
 await expect(page.locator('main a[href="mailto:aimroutine-tracker@outlook.fr"]')).toHaveCount(2);
 await page.goto('/terms.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('main a[href="mailto:aimroutine-tracker@outlook.fr"]')).toHaveCount(2);
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#delete-account-confirmation')).toHaveAttribute('pattern','SUPPRIMER');
 await expect(page.locator('#google-delete-reauth')).toHaveCount(0);
 await expect(page.locator('#signup-submit')).toBeEnabled();
});

test('Email signup sends Turnstile token and requests confirmation (mock Supabase/HIBP)',async({page})=>{
 let signups=0;
 await page.route('https://api.pwnedpasswords.com/range/**',route=>
  route.fulfill({status:200,contentType:'text/plain',body:''}));
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/signup**',route=>{
  signups++;
  expect(route.request().method()).toBe('POST');
  const body=JSON.parse(route.request().postData()||'{}');
  expect(body.email).toBe('new-user@example.invalid');
  expect(body.data?.aim_username).toBe('Player_2026');
  expect(body.gotrue_meta_security?.captcha_token||body.captcha_token).toBe('qa-synthetic-captcha-token');
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',email:body.email,confirmation_sent_at:'2026-11-07T20:00:00Z'
  })});
 });
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await page.locator('#signup-mode').click();
 await expect(page.locator('#signup-submit')).toBeEnabled();
 await expect(page.locator('#captcha-signup')).toHaveAttribute('data-rendered','yes');
 await page.locator('#signup-email').fill('new-user@example.invalid');
 await page.locator('#signup-username').fill('Player_2026');
 await page.locator('#signup-password').fill('AimRoutine_2026!Strong');
 await page.locator('#signup-submit').click();
 await expect(page.locator('#account-status')).toContainText('un e-mail de confirmation');
 expect(signups).toBe(1);
});

test('Google deletion UX uses exactly SUPPRIMER without a second Google login (mock account)',async({page})=>{
 const uid='33333333-3333-4333-8333-333333333333';
 const mockUser={id:uid,email:'test-google-delete@example.invalid',
   app_metadata:{provider:'google',providers:['google']},
   user_metadata:{aim_username:'GooglePlayer'},
   identities:[{provider:'google',id:'test-identity'}],
   aud:'authenticated',role:'authenticated',created_at:'2026-11-06T00:00:00Z'};
 const session={access_token:'mock-google-session-access-token',token_type:'bearer',
   expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,
   refresh_token:'mock-refresh-token',user:mockUser};
 await page.addInitScript(value=>{
   localStorage.setItem('sb-lmzswtzboobpokumxzhy-auth-token',JSON.stringify(value));
 },session);
 let deleteCalls=0,googleOAuthCalls=0,dialogCalls=0;
 page.on('dialog',dialog=>{dialogCalls++;dialog.dismiss()});
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/user',route=>
  route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockUser)}));
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/authorize**',route=>{
  googleOAuthCalls++;return route.abort();
 });
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/functions/v1/delete-aim-account',route=>{
  deleteCalls++;
  expect(route.request().method()).toBe('POST');
  expect(JSON.parse(route.request().postData()||'{}')).toEqual({
   action:'delete_my_account',confirmation:'SUPPRIMER'
  });
  return route.fulfill({status:200,contentType:'application/json',body:'{"deleted":true}'});
 });
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const details=page.locator('.ar7-delete-account');
 await expect(details).toBeVisible();
 await details.locator('summary').click();
 await expect(page.locator('#google-delete-flow')).toBeVisible();
 await expect(page.locator('#delete-password-row')).toBeHidden();
 await expect(page.locator('#delete-account-final')).toBeDisabled();
 await page.locator('#delete-account-confirmation').fill('SUPPRIMER');
 await expect(page.locator('#delete-account-final')).toBeEnabled();
 await page.locator('#delete-account-final').click();
 await expect(page.locator('#account-status')).toContainText('supprimés');
 expect(deleteCalls).toBe(1);
 expect(googleOAuthCalls).toBe(0);
 expect(dialogCalls).toBe(0);
});

test('Google account must choose a nickname before cloud dashboard (mock Auth)',async({page})=>{
 const uid='55555555-5555-4555-8555-555555555555';
 let mockUser={id:uid,email:'test-google-onboarding@example.invalid',
  app_metadata:{provider:'google',providers:['google']},
  user_metadata:{full_name:'Name from Google'},
  identities:[{provider:'google',id:'google-user-id'}],
  aud:'authenticated',role:'authenticated',created_at:'2026-11-07T00:00:00Z'};
 const session={access_token:'mock-google-onboarding-access-token',token_type:'bearer',
  expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,
  refresh_token:'mock-google-onboarding-refresh',user:mockUser};
 await page.addInitScript(value=>{
  localStorage.setItem('sb-lmzswtzboobpokumxzhy-auth-token',JSON.stringify(value));
 },session);
 let saved=0;
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/user',route=>{
  if(route.request().method()==='PUT'){
   const body=JSON.parse(route.request().postData()||'{}');
   expect(body.data?.aim_username).toBe('NewPlayer');
   saved++;
   mockUser={...mockUser,user_metadata:{...mockUser.user_metadata,aim_username:body.data.aim_username}};
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockUser)});
 });
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#username-panel')).toBeVisible();
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await page.locator('#username-input').fill('NewPlayer');
 await page.locator('#username-form button[type="submit"]').click();
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await expect(page.locator('#user-username')).toHaveText('NewPlayer');
 expect(saved).toBe(1);
});

test('Email account deletion sends Turnstile token during password reauthentication (mock account)',async({page})=>{
 const uid='44444444-4444-4444-8444-444444444444';
 const mockUser={id:uid,email:'test-email-delete@example.invalid',
  app_metadata:{provider:'email',providers:['email']},
  user_metadata:{aim_username:'EmailPlayer'},
  identities:[{provider:'email',id:'email-identity'}],
  aud:'authenticated',role:'authenticated',created_at:'2026-11-07T00:00:00Z'};
 const session={access_token:'mock-email-session-access-token',token_type:'bearer',
  expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,
  refresh_token:'mock-refresh-token',user:mockUser};
 await page.addInitScript(value=>{
  localStorage.setItem('sb-lmzswtzboobpokumxzhy-auth-token',JSON.stringify(value));
 },session);
 let reauth=0,deleted=0;
 page.on('dialog',dialog=>dialog.accept());
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/user',route=>
  route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mockUser)}));
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/token?grant_type=password',route=>{
  reauth++;
  const data=JSON.parse(route.request().postData()||'{}');
  expect(data.gotrue_meta_security?.captcha_token||data.captcha_token).toBe('qa-synthetic-captcha-token');
  expect(data.email).toBe(mockUser.email);
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session)});
 });
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/functions/v1/delete-aim-account',route=>{
  deleted++;
  return route.fulfill({status:200,contentType:'application/json',body:'{"deleted":true}'});
 });
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const details=page.locator('.ar7-delete-account');
 await expect(details).toBeVisible();
 await details.locator('summary').click();
 await expect(page.locator('#google-delete-flow')).toBeHidden();
 await expect(page.locator('#captcha-delete-wrap')).not.toHaveAttribute('hidden');
 await expect(page.locator('#captcha-delete')).toHaveAttribute('data-rendered','yes');
 await page.locator('#delete-account-password').fill('Ab1!cdef');
 await page.locator('#delete-account-confirmation').fill('SUPPRIMER');
 await page.locator('#delete-account-final').click();
 await expect(page.locator('#account-status')).toContainText('supprimés');
 expect(reauth).toBe(1);
 expect(deleted).toBe(1);
});

test('Password reset UI submits recovery request and reports generic success (mock SMTP)',async({page})=>{
 let sentEmail='';
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/recover**',route=>{
  sentEmail=JSON.parse(route.request().postData()||'{}').email;
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await page.locator('#reset-link').click();
 await page.locator('#reset-email').fill('test-recovery@example.invalid');
 await page.locator('#reset-form button[type="submit"]').first().click();
 await expect(page.locator('#account-status')).toContainText('Si un compte existe');
 expect(sentEmail).toBe('test-recovery@example.invalid');
});

test('Optimized Windows gallery previews preserve full-quality lightbox',async({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const shot=page.locator('#v16-gallery-dashboard img.v16-real-shot');
 await expect(shot).toHaveAttribute('src','aimroutine-29-dashboard-preview.webp');
 await expect(shot).toHaveAttribute('data-v16-full-src','aimroutine-29-dashboard.webp');
 await page.locator('.v16-expand[data-v16-expand]').click();
 const lightbox=page.locator('#v16-real-shot-dialog');
 await expect(lightbox).toBeVisible();
 await expect(lightbox.locator('img')).toHaveAttribute('src','aimroutine-29-dashboard.webp');
 await lightbox.locator('[data-v16-close]').click();
 await expect(lightbox).toBeHidden();
 await page.locator('[data-v16-gallery="coach"]').click();
 const coach=page.locator('#v16-gallery-coach img.v16-real-shot');
 await expect(coach).toHaveAttribute('src','aimroutine-29-coach-preview.webp');
 await expect(coach).toHaveAttribute('data-v16-full-src','aimroutine-29-coach.webp');
 await page.locator('.v16-expand[data-v16-expand]').click();
 await expect(lightbox.locator('img')).toHaveAttribute('src','aimroutine-29-coach.webp');
});
test('Password recovery deep link updates credentials through the auth SDK (mock)',async({page})=>{
 const uid='44444444-4444-4444-8444-444444444444';
 const user={id:uid,email:'recovery-ui@example.invalid',aud:'authenticated',
  role:'authenticated',app_metadata:{provider:'email',providers:['email']},
  identities:[],created_at:'2026-11-06T00:00:00Z'};
 const accessToken=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  Buffer.from(JSON.stringify({sub:uid,role:'authenticated',
   exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'testing'].join('.');
 let passwordUpdates=0;
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/user',route=>{
  if(route.request().method()==='PUT'){
   passwordUpdates++;
   expect(JSON.parse(route.request().postData()||'{}').password).toBe('Aa1!bcde');
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
 });
 await page.route('https://api.pwnedpasswords.com/range/**',route=>
  route.fulfill({status:200,contentType:'text/plain',body:''}));
 const hash='#access_token='+encodeURIComponent(accessToken)+
  '&expires_in=3600&token_type=bearer&refresh_token=mock-recovery-refresh&type=recovery';
 await page.goto('/account.html'+hash,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#new-password-form')).toBeVisible();
 await expect(page.locator('#new-password')).toHaveAttribute('minlength','8');
 await page.locator('#new-password').fill('Aa1!bcde');
 await page.locator('#new-password-form button[type="submit"]').click();
 await expect(page.locator('#account-status')).toContainText('Mot de passe mis à jour');
 expect(passwordUpdates).toBe(1);
});


test('Turnstile-enabled browser form forwards a token on login and password reset (mock provider)',async({page})=>{
 // Test replaces only the PUBLIC key in this Playwright browser. No secret used.
 await page.route('**/turnstile-v7.mjs',async route=>{
  const result=await route.fetch();
  const body=(await result.text()).replace(
   "export const TURNSTILE_SITE_KEY='0x4AAAAAAF32lny7msT5dyQh';",
   "export const TURNSTILE_SITE_KEY='qa-test-public-sitekey';");
  expect(body).toContain("TURNSTILE_SITE_KEY='qa-test-public-sitekey'");
  await route.fulfill({response:result,body});
 });
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>
  route.fulfill({status:200,contentType:'application/javascript',
   body:"window.__turnstileResetCount=0;window.turnstile={render(element,options){element.dataset.rendered='yes';options.callback('qa-synthetic-captcha-token');return 42},reset(){window.__turnstileResetCount++}};"}));
 const calls=[];
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/token?grant_type=password',route=>{
  const data=JSON.parse(route.request().postData()||'{}');
  calls.push({type:'login',captcha:data.gotrue_meta_security?.captcha_token||data.captcha_token});
  return route.fulfill({status:400,contentType:'application/json',
   body:JSON.stringify({code:'invalid_credentials',msg:'Invalid login credentials'})});
 });
 await page.route('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/recover**',route=>{
  const data=JSON.parse(route.request().postData()||'{}');
  calls.push({type:'recovery',captcha:data.gotrue_meta_security?.captcha_token||data.captcha_token});
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 // No CAPTCHA download until a guest begins using the login form.
 await expect(page.locator('#captcha-login')).not.toHaveAttribute('data-rendered','yes');
 await page.locator('#login-email').focus();
 await expect(page.locator('#captcha-login')).toHaveAttribute('data-rendered','yes');
 await page.locator('#login-email').fill('disposable@example.invalid');
 await page.locator('#login-password').fill('Ab1!cdef');
 await page.locator('#login-form button[type="submit"]').click();
 await expect.poll(()=>calls.filter(x=>x.type==='login').length).toBe(1);
 expect(calls[0].captcha).toBe('qa-synthetic-captcha-token');
 await page.locator('#reset-link').click();
 await expect(page.locator('#captcha-reset')).toHaveAttribute('data-rendered','yes');
 await page.locator('#reset-email').fill('disposable@example.invalid');
 await page.locator('#reset-form button[type="submit"]').click();
 await expect.poll(()=>calls.filter(x=>x.type==='recovery').length).toBe(1);
 expect(calls[1].captcha).toBe('qa-synthetic-captcha-token');
 await expect.poll(()=>page.evaluate(()=>window.__turnstileResetCount)).toBe(2);
});

test('AIM mini-challenge is playable with mouse and keyboard, and can pause',async ({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const game=page.locator('#aim-challenge');
 await game.scrollIntoViewIfNeeded();
 await expect(game).toBeVisible();
 // DOMContentLoaded may run before deferred scripts bind the game handlers.
 await expect(game).toHaveAttribute('data-ar12-ready','true');
 await page.locator('[data-ar11-mode="reflex"]').click();
 await expect(page.locator('[data-ar11-mode="reflex"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-ar11-mode="precision"]').click();
 await expect(page.locator('[data-ar11-mode="precision"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('[data-ar11-start]').click();
 await expect(game).toHaveAttribute('data-state','playing');
 await expect(page.locator('[data-ar11-target]')).toBeVisible();
 await page.locator('[data-ar11-target]').click();
 await expect(page.locator('[data-ar11-hits]')).toHaveText('1');
 await page.locator('[data-ar11-target]').focus();
 await page.keyboard.press('Enter');
 await expect(page.locator('[data-ar11-hits]')).toHaveText('2');
 await page.locator('[data-ar11-pause]').click();
 await expect(game).toHaveAttribute('data-state','paused');
 await expect(page.locator('[data-ar11-target]')).toBeHidden();
 await page.locator('[data-ar11-pause]').click();
 await expect(game).toHaveAttribute('data-state','playing');
 await expect(page.locator('[data-ar11-target]')).toBeVisible();
 await page.locator('[data-ar11-start]').click();
 await expect(page.locator('[data-ar11-hits]')).toHaveText('0');
 await expect(page.locator('[data-ar11-time]')).toHaveText('20');
});

test('V12 AIM duration, combos and keyboard pause',async ({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#aim-challenge').scrollIntoViewIfNeeded();
 await page.locator('[data-ar12-duration="15000"]').click();
 await expect(page.locator('[data-ar11-time]')).toHaveText('15');
 await expect(page.locator('[data-ar11-progress]')).toHaveAttribute('aria-valuemax','15');
 await page.locator('[data-ar11-start]').click();
 await page.locator('[data-ar11-target]').click();
 await expect(page.locator('[data-ar12-combo]')).toHaveText('1');
 await page.locator('[data-ar11-target]').click();
 await expect(page.locator('[data-ar12-combo]')).toHaveText('2');
 await expect(page.locator('[data-ar12-reaction]')).toContainText('ms');
 await page.keyboard.press('Escape');
 await expect(page.locator('#aim-challenge')).toHaveAttribute('data-state','paused');
 await page.locator('[data-ar11-pause]').click();
 await expect(page.locator('#aim-challenge')).toHaveAttribute('data-state','playing');
 await expect(page.locator('[data-ar12-duration="20000"]')).toBeDisabled();
 await page.locator('[data-ar11-start]').click();
 await expect(page.locator('[data-ar11-hits]')).toHaveText('0');
});

test('V13 tactical design loads across routes without hiding interactive elements',async ({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v5-hero .ar13-frame-corners')).toHaveCount(1);
 await expect(page.locator('.v5-hero .ar13-frame-corners')).toHaveAttribute('aria-hidden','true');
 await expect(page.locator('.ar9-path-grid .ar9-path-card')).toHaveCount(3);
 await expect(page.locator('link[href="site-future-v13.css?v=1"]')).toHaveCount(1);
 await expect(page.locator('#aim-challenge [data-ar11-start]')).toBeAttached();
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.ar7-account-hero .ar13-frame-corners')).toHaveCount(1);
 await expect(page.locator('#login-form')).toBeVisible();
 await expect(page.locator('#signup-mode')).toBeVisible();
});

test('V17 recreates the landing with real metrics and user-provided concept hero',async ({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-home-wrap .r17-hero')).toBeVisible();
 await expect(page.locator('.r17-features .r17-feature')).toHaveCount(3);
 await expect(page.locator('.r17-path-grid .r17-path')).toHaveCount(3);
 await expect(page.locator('.r17-challenge .r17-button')).toHaveAttribute('href','#aim-challenge');
 await expect(page.locator('.r17-stats [data-v15-stat]')).toHaveCount(4);
 await expect.poll(()=>page.locator('.r17-stats [data-v15-stat="sessions"]').textContent(),{timeout:15000}).toBe('—');
 await expect(page.locator('.r17-stats [data-v15-stat="accuracy"]')).toHaveText('—');
 await expect(page.locator('.r17-nav-actions a')).toHaveCount(3);
 await expect(page.locator('.r17-hero-art')).toHaveCSS('background-image',/r17-hero\.webp/);
});
test('V17 training five days and skill choices prepare the actual routine builder',async ({page})=>{
 await page.goto('/training.html?level=iron',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-training-grid')).toBeVisible();
 await expect(page.locator('.r17-level-options .r17-level')).toHaveCount(3);
 await expect(page.locator('.r17-days [data-r17-day]')).toHaveCount(5);
 await expect(page.locator('[data-r17-level="iron"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('.r17-days [data-r17-day="1"]').click();
 await expect(page.locator('.r17-weekdays [data-r17-day="1"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('.r17-plan-footer [data-r17-create]').click();
 await expect(page.locator('#rank')).toHaveValue('iron');
 await expect(page.locator('#focus')).toHaveValue('tracking');
 await expect(page.locator('#panel-builder')).toBeVisible();
});
test('V17 honest progress and unchanged authentication forms',async ({page})=>{
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-progress-wrap .r17-hero')).toBeVisible();
 await expect(page.locator('.r17-chart-grid .v14-panel')).toHaveCount(3);
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-account-cols')).toBeVisible();
 await expect(page.locator('[data-r17-cloud-label]')).toContainText(/Cloud non connecté|Cloud not signed in/);
 await expect(page.locator('#login-form')).toBeVisible();
 await page.locator('#signup-mode').click();
 await expect(page.locator('#signup-form')).toBeVisible();
 await expect(page.locator('#signup-username')).toBeVisible();
 await page.locator('#login-mode').click();
 await expect(page.locator('#login-form')).toBeVisible();
});

test('V16 official A logo renders in every flagship navigation and semantic colors match uploaded charter', async ({page})=>{
 for(const route of ['index.html','training.html','account.html','progress.html']){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  const logo=page.locator('.site31-brand img[src="aimroutine-brand-a-v2.svg?v=1"]');
  await expect(logo).toHaveCount(1);
  await expect.poll(()=>logo.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  await expect(page.locator('link[href="site-official-v16.css?v=1"]')).toHaveCount(1);
  await expect(page.locator('link[href="aimroutine-official-tokens-v2.css?v=1"]')).toHaveCount(1);
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ar-coral').trim())).toBe('#FF5B69');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ar-cyan').trim())).toBe('#37E3DD');
 }
});


test('V19 training preview uses the actual generator and every tool is reachable',async ({page})=>{
 await page.goto('/training.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r19-tool-grid button')).toHaveCount(8);
 await expect(page.locator('.r17-exercise strong').first()).toContainText('Stand de tir');
 await page.locator('.r19-tool-select').selectOption('Aim Lab');
 await expect(page.locator('.r17-exercise strong').first()).toContainText('Gridshot');
 await page.locator('[data-r19-panel="program"]').click();
 await expect(page.locator('.r19-workspace-dialog')).toBeVisible();
 await expect(page.locator('#program-form')).toBeVisible();
 await page.locator('.r19-close').click();
 await expect(page.locator('.r19-workspace-dialog')).not.toBeVisible();
 await page.locator('[data-r19-panel="insights"]').click();
 await expect(page.locator('#analysis-range')).toBeVisible();
});
test('V19 cloud screen is guest-safe and progress buttons drive real range',async ({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r19-cloud-actions')).toBeVisible();
 await expect(page.locator('.r19-cloud-login')).toBeVisible();
 await expect(page.locator('[data-r19-cloud="cloud-sync"]')).toBeHidden();
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 await page.locator('[data-r19-range="7"]').click();
 await expect(page.locator('#v14-progress-range')).toHaveValue('7');
 await expect(page.locator('[data-r19-range="7"]')).toHaveAttribute('aria-pressed','true');
});


test('Guest can explore routines but cannot save results or create guest storage',async({page})=>{
 await expect(page.locator('#ar-account-required')).toBeVisible();
 const state=await page.evaluate(()=>{
  const old={id:'guest-would-save',date:new Date().toISOString(),rank:'silver',focus:'flick',tool:'VALORANT',scenario:'Test',
   minutes:15,accuracy:90,feeling:'good',notes:''};
  let rejected=false;
  try{window.AIMWeb.mergeData({sessions:[old],presets:[],weeklyGoal:3})}catch{rejected=true}
  return {rejected,uid:window.__aimCloudUserId,local:localStorage.getItem('aimroutine_web_training_v2'),
   count:window.AIMWeb.getStore().sessions.length};
 });
 expect(state).toEqual({rejected:true,uid:null,local:null,count:0});
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#total-sessions')).toHaveText('0');
});
test('Verified account saves and syncs new sessions automatically without cloud buttons',async({page})=>{
 await useVerifiedTestAccount(page);
 const add=await page.evaluate(()=>{
  const one={id:'auto-case',date:new Date().toISOString(),rank:'silver',focus:'flick',tool:'VALORANT',
   scenario:'Stand de tir',minutes:20,accuracy:81,feeling:'good',notes:''};
  return window.AIMWeb.mergeData({sessions:[one],presets:[],weeklyGoal:3});
 });
 expect(add).toBe(1);
 await expect.poll(()=>page.evaluate(()=>window.__testCloudWrites.some(v=>v.table==='aim_sessions'&&v.items.some(x=>x.session_id==='auto-case'))),{timeout:15000}).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_web_training_v2'))).toBeNull();
 await expect(page.locator('#cloud-training-status')).toContainText('Cloud automatique');
});


test('V3 Cloud guest registration CTA opens the real mandatory-nickname signup form',async ({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-guest-registration')).toBeVisible();
 await page.locator('.r17-guest-signup-button').click();
 await expect(page.locator('#signup-mode')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#signup-form')).toBeVisible();
 await expect(page.locator('#signup-username')).toHaveAttribute('required','');
 await expect(page.locator('#signup-password')).toHaveAttribute('minlength','8');
 await expect(page.locator('#google-signin')).toBeVisible();
});


test('V3 progress composition preserves real live KPI values and all source panels',async({page})=>{
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 const row=page.locator('.r17-progress-wrap .r17-secondary-grid');
 await expect(row.locator('#v14-p-records')).toHaveCount(1);
 await expect(row.locator('.r17-progress-streak')).toHaveCount(1);
 await expect(row.locator('.r17-progress-journey')).toHaveCount(1);
 const bottom=page.locator('.r17-progress-bottom');
 await expect(bottom.locator('#v14-p-goals')).toHaveCount(1);
 await expect(bottom.locator('#v14-p-next')).toHaveCount(1);
 await expect(bottom.locator('a[href="training.html#panel-dashboard"]').first()).toBeVisible();
 await expect(row.locator('a[href="training.html#panel-program"]')).toBeVisible();
 await page.evaluate(()=>{
  // Test-only DOM changes assert forwarding from REAL bound elements;
  // no production data or network calls are created.
  document.querySelector('#v14-p-streak-detail').textContent='5 jours';
  document.querySelector('#v14-p-week').textContent='2';
  document.querySelector('#v14-p-average').textContent='73 %';
  document.querySelector('#v14-p-sessions').textContent='9';
 });
 await expect(row.locator('.r17-progress-live-metric').first()).toContainText('5 jours');
 await expect(row.locator('.r17-progress-live-metric').nth(1)).toContainText('2');
 await expect(bottom.locator('.r17-progress-goal-tile').first()).toContainText('73 %');
 await expect(bottom.locator('.r17-progress-goal-tile').nth(1)).toContainText('9');
 const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
 expect(documentWidth).toBeLessThanOrEqual(1675);
});


test('V3 four-reference headers stay clean and original locale control still works',async({page})=>{
 for(const route of ['index.html','training.html','progress.html','account.html']){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.site31-header [data-switch-lang]')).toHaveCount(0);
  const switcher=page.locator('.ar-v3-language-footer [data-switch-lang]');
  await expect(switcher).toHaveCount(1);
  const before=(await switcher.innerText()).trim();
  await switcher.click();
  const after=(await switcher.innerText()).trim();
  expect(after).not.toEqual(before);
  const label=page.locator('.ar-v3-language-footer');
  await expect(label).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(3);
 }
});



test('V3 chart header period selectors filter recorded weeks without fabricated data',async({page})=>{
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 const accuracy=page.locator('#v14-p-line-panel #v14-progress-range');
 const weeks=page.locator('#v14-p-bars-panel #v14-week-range');
 await expect(accuracy).toHaveValue('30');
 await expect(weeks).toHaveValue('8');
 await expect(page.locator('#v14-p-bars svg rect')).toHaveCount(8);
 await weeks.selectOption('4');
 await expect(page.locator('#v14-p-bars svg rect')).toHaveCount(4);
 await weeks.selectOption('12');
 await expect(page.locator('#v14-p-bars svg rect')).toHaveCount(12);
 await accuracy.selectOption('7');
 await expect(accuracy).toHaveValue('7');
 await page.locator('.ar-v3-language-footer [data-switch-lang]').click();
 await expect(weeks.locator('option:checked')).toHaveText('Last 12 weeks');
 await expect(accuracy.locator('option:checked')).toHaveText('Last 7 days');
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
});

test('V3 empty Progress radar shows tracked focus axes but no fabricated score', async ({page}) => {
 await page.goto('/progress.html', {waitUntil:'domcontentloaded'});
 const root=page.locator('#v14-p-distribution');
 const drawing=root.locator('.v3-empty-radar svg');
 await expect(drawing).toBeVisible();
 await expect(drawing.locator('polygon')).toHaveCount(4); // grid ONLY, no measured profile
 await expect(drawing.locator('text')).toHaveCount(4); // four real focus categories
 await expect(root.locator('.v3-empty-radar-caption')).toContainText('Aucune séance');
 await expect(page.locator('#v14-p-average')).toContainText('—');
 await expect(page.locator('#v14-p-sessions')).toContainText('0');
});


test('V3 account guest portrait uses the owner artwork asset without exposing a fake identity',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-account-profile .r17-avatar')).toBeVisible();
 const actual=await page.locator('.r17-account-profile .r17-avatar').evaluate(el=>getComputedStyle(el).backgroundImage);
 expect(actual).toContain('aimroutine-avatar-reference.svg');
 const source=await page.request.get('/aimroutine-avatar-reference.svg');
 expect(source.status()).toBe(200);
 expect(await source.text()).toContain('data:image/webp;base64,');
 await expect(page.locator('.r17-account-profile')).toContainText('Connecte-toi');
});


test('V3 Cloud FR/EN switch updates guest cards without clearing login inputs',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const button=page.locator('.ar-v3-language-footer [data-switch-lang]');
 const title=page.locator('#r17-guest-registration-heading');
 const perks=page.locator('.r17-account-benefits .r17-benefit-copy strong').first();
 const notice=page.locator('[data-r17-sync-copy]');
 const email=page.locator('#login-email');
 const guest=page.locator('.r17-guest-registration');
 await expect(guest).toBeVisible();
 if((await page.locator('html').getAttribute('lang'))==='en')await button.click();
 await expect(title).toHaveText('Créer un compte');
 await expect(perks).toHaveText('Progression partagée');
 await expect(notice).toContainText('Connecte-toi');
 await email.fill('test@example.com');
 const initialFormCount=await page.locator('#login-form').count();
 await button.click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(title).toHaveText('Create an account');
 await expect(perks).toHaveText('Shared progress');
 await expect(notice).toContainText('Sign in');
 await expect(email).toHaveValue('test@example.com');
 await expect(page.locator('#login-form')).toHaveCount(initialFormCount);
 await button.click();
 await expect(title).toHaveText('Créer un compte');
 await expect(perks).toHaveText('Progression partagée');
 await expect(email).toHaveValue('test@example.com');
 await expect(page.locator('.r17-guest-signup-button')).toBeVisible();
});


test('V3 Progress FR/EN switch localizes live cards and radar without changing data',async({page})=>{
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 const switcher=page.locator('.ar-v3-language-footer [data-switch-lang]');
 const headline=page.locator('.r17-progress-streak .v14-panel-head h2');
 const journey=page.locator('.r17-progress-journey .v14-panel-head h2');
 const axes=page.locator('.v3-empty-radar svg text');
 const caption=page.locator('.v3-empty-radar-caption');
 const sourceKpi=page.locator('#v14-p-sessions');
 const before=await sourceKpi.textContent();
 if((await page.locator('html').getAttribute('lang'))==='en')await switcher.click();
 await expect(headline).toHaveText('Séries d’entraînement');
 await expect(journey).toHaveText('Ton parcours d’entraînement');
 await expect(axes.nth(2)).toHaveText('Micro-correction');
 await expect(caption).toContainText('Aucune séance enregistrée');
 await switcher.click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(headline).toHaveText('Training streaks');
 await expect(journey).toHaveText('Your training path');
 await expect(axes.nth(2)).toHaveText('Micro-adjust');
 await expect(caption).toContainText('No recorded sessions');
 expect(await sourceKpi.textContent()).toBe(before);
 await switcher.click();
 await expect(headline).toHaveText('Séries d’entraînement');
 await expect(axes.nth(2)).toHaveText('Micro-correction');
 expect(await sourceKpi.textContent()).toBe(before);
});


test('V3 mobile Cloud profile keeps decorative portrait clear of real account title',async({page})=>{
 for(const width of [390,375]){
  await page.setViewportSize({width,height:850});
  await page.goto('/account.html',{waitUntil:'domcontentloaded'});
  const avatar=page.locator('.r17-account-profile>.r17-avatar');
  const details=page.locator('.r17-account-profile>div:nth-child(2)');
  await expect(avatar).toBeVisible();
  await expect(details).toBeVisible();
  const a=await avatar.boundingBox();
  const b=await details.boundingBox();
  expect(a).toBeTruthy();expect(b).toBeTruthy();
  expect(a.x+a.width).toBeLessThanOrEqual(b.x-2);
  const over=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(over).toBeLessThanOrEqual(3);
  await expect(page.locator('[data-r17-username]')).toBeVisible();
 }
});


test('V3 Progress unified KPI ribbon keeps all original real-data metric elements',async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 const ribbon=page.locator('.r17-progress-wrap .r17-progress-kpis');
 await expect(ribbon).toBeVisible();
 await expect(ribbon.locator('.v14-kpi')).toHaveCount(4);
 for(const id of ['v14-p-average','v14-p-minutes','v14-p-sessions','v14-p-streak'])
  await expect(ribbon.locator('#'+id)).toHaveCount(1);
 const rect=await ribbon.boundingBox();
 expect(rect.x).toBeGreaterThanOrEqual(20);
 expect(rect.x).toBeLessThanOrEqual(45);
 expect(rect.width).toBeGreaterThan(1530);
 expect(rect.height).toBeGreaterThanOrEqual(59);
 expect(rect.height).toBeLessThanOrEqual(66);
 const geometry=await ribbon.evaluate(node=>{
  const first=node.querySelector('.v14-kpi');
  const last=node.querySelector('.v14-kpi:last-child');
  return {
   firstBackground:getComputedStyle(first).backgroundImage,
   lastTriangle:getComputedStyle(last,'::before').content,
   lastDisplay:getComputedStyle(last,'::before').display
  };
 });
 expect(geometry.firstBackground).toBe('none');
 expect(geometry.lastDisplay).toBe('none');
 await page.setViewportSize({width:390,height:850});
 const scroll=await page.evaluate(()=>document.documentElement.scrollWidth);
 expect(scroll).toBeLessThanOrEqual(393);
});


test('V3 Cloud auth heading matches reference without losing active secure forms',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const title=page.locator('#ar7-auth-title');
 const subtitle=page.locator('#auth-panel .r17-auth-reference-copy .ar7-eyebrow');
 const panel=page.locator('#auth-panel');
 await expect(panel.locator('.r17-auth-reference-icon svg')).toHaveCount(1);
 await expect(title).toBeVisible();
 const lang=await page.locator('html').getAttribute('lang');
 const switcher=page.locator('.ar-v3-language-footer [data-switch-lang]');
 if(lang==='en')await switcher.click();
 await expect(title).toHaveText('Connexion');
 await expect(subtitle).toContainText('AimRoutine Tracker');
 await expect(page.locator('#google-signin')).toBeEnabled();
 await expect(page.locator('#login-form')).toBeVisible();
 await page.locator('#login-email').fill('regression@example.net');
 await page.locator('#signup-mode').click();
 await expect(title).toHaveText('Créer un compte');
 await expect(page.locator('#signup-form')).toBeVisible();
 await expect(page.locator('#signup-username')).toHaveAttribute('required','');
 await expect(page.locator('#google-signin')).toBeEnabled();
 await switcher.click();
 await expect(title).toHaveText('Create an account');
 await expect(page.locator('#signup-form')).toBeVisible();
 await page.locator('#login-mode').click();
 await expect(title).toHaveText('Sign in');
 await expect(page.locator('#login-email')).toHaveValue('regression@example.net');
 await expect(page.locator('#login-form')).toBeVisible();
 await expect(page.locator('#auth-panel .r17-auth-reference-heading')).toHaveCount(1);
});


test('V3 Cloud hero fills right edge without duplicating its sign artwork',async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 const hero=page.locator('.r17-account-wrap .r17-hero-art');
 await expect(hero).toBeVisible();
 const style=await hero.evaluate(el=>({
  original:getComputedStyle(el).backgroundImage,
  extension:getComputedStyle(el,'::after').backgroundImage,
  mask:getComputedStyle(el,'::after').maskImage
 }));
 expect(style.original).toContain('r17-hero.webp');
 expect(style.extension).toContain('linear-gradient');
 expect(style.extension).not.toContain('url(');
 expect(style.mask).toContain('linear-gradient');
 const width=await page.evaluate(()=>document.documentElement.scrollWidth);
 expect(width).toBeLessThanOrEqual(1675);
});


test('V3 owner-reference hero headings keep punctuation-free copy on every page',async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 const cases=[
  ['index.html','nouvelle génération'],
  ['training.html','d’entraînement'],
  ['progress.html','progression'],
  ['account.html','cloud']
 ];
 for(const [route,expected] of cases){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  const title=page.locator('.r17-screen .r17-hero h1').first();
  await expect(title).toBeVisible();
  const lang=await page.locator('html').getAttribute('lang');
  if(lang==='en')await page.locator('.ar-v3-language-footer [data-switch-lang]').click();
  const visibleFrenchTitle=title.locator('.fr strong');
  await expect(visibleFrenchTitle).toContainText(expected);
  const ending=(await visibleFrenchTitle.innerText()).trim();
  expect(ending.endsWith('.')).toBe(false);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(3);
 }
});


test('V3 hero landmarks expose their visible FR/EN heading to assistive technology',async({page})=>{
 const screens=[
  ['index.html',/Routine AIM nouvelle génération/i,/Next-gen AIM training routines/i],
  ['training.html',/Tes routines d’entraînement/i,/Your training routines/i],
  ['progress.html',/Suivi de progression/i,/Progress analytics/i],
  ['account.html',/Ton profil cloud/i,/Your cloud profile/i]
 ];
 for(const [route,french,english] of screens){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  const section=page.locator('.r17-screen .r17-hero').first();
  await expect(section).toBeVisible();
  await expect(section).toHaveAttribute('aria-labelledby','r17-main-hero-title');
  await expect(page.locator('#r17-main-hero-title')).toHaveCount(1);
  const switcher=page.locator('.ar-v3-language-footer [data-switch-lang]');
  if((await page.locator('html').getAttribute('lang'))==='en')await switcher.click();
  await expect(section).toHaveAccessibleName(french);
  await switcher.click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(section).toHaveAccessibleName(english);
 }
});


test('V3 mobile menu provides real account navigation at 390px',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const menu=page.locator('.site31-mobile-nav');
 await expect(menu.locator('summary')).toBeVisible();
 await menu.locator('summary').click();
 await expect(menu).toHaveAttribute('open','');
 const account=menu.locator('.site31-mobile-links a[href="account.html"]');
 await expect(account).toBeVisible();
 await expect(account).toContainText('Compte');
 await expect(account).toHaveAttribute('href','account.html');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
});

test('V3 reduced-motion preference disables ornamental transitions on four reference pages',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const route of ['index.html','training.html','progress.html','account.html']){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
  const duration=await page.locator('.r17-screen .r17-hero h1').evaluate(el=>{
   const style=getComputedStyle(el);
   return {animation:style.animationDuration,transition:style.transitionDuration};
  });
  expect(duration.animation,route).toBe('0s');
  expect(duration.transition,route).toBe('0s');
 }
});


test('Progress cross-tab sign-out never reveals stale user analytics',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 const dataKey='aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2';
 await page.evaluate(({authKey,dataKey})=>{
  const session={id:'private-qa-session',date:new Date().toISOString(),rank:'silver',
   focus:'flick',tool:'VALORANT',scenario:'Range test',minutes:15,accuracy:85,feeling:'good',notes:''};
  localStorage.setItem(authKey,'qa-test-token');
  localStorage.setItem(dataKey,JSON.stringify({sessions:[session],presets:[],weeklyGoal:3}));
 },{authKey,dataKey});
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const id='11111111-1111-4111-8111-111111111111';
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id}}},error:null}),
 getUser:async()=>new Promise(resolve=>{window.__qaReleaseProgressAuth=()=>resolve({data:{user:{id}},error:null})})
}};`
 }));
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseProgressAuth)).toBe('function');
 await page.evaluate(authKey=>{
  localStorage.removeItem(authKey);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,oldValue:'qa-test-token',newValue:null}));
 },authKey);
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await expect(page.locator('#v14-source-status')).toContainText('Connecte-toi');
 await page.evaluate(()=>window.__qaReleaseProgressAuth());
 // A slow, previously authenticated response must not re-display private data.
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await expect(page.locator('#v14-p-average')).toHaveText('—');
 await page.waitForTimeout(180);
 await expect(page.locator('#v14-source-status')).toContainText('Connecte-toi');
});
test('Progress clears already visible private KPIs on a cross-tab sign-out',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 await page.evaluate(({uid,authKey})=>{
  const session={id:'existing-private-qa-session',date:new Date().toISOString(),
   rank:'silver',focus:'tracking',tool:'VALORANT',scenario:'Tracking',
   minutes:20,accuracy:88,feeling:'good',notes:''};
  localStorage.setItem(authKey,'qa-test-token');
  localStorage.setItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2',
   JSON.stringify({sessions:[session],presets:[],weeklyGoal:3}));
 },{uid,authKey});
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const id='11111111-1111-4111-8111-111111111111';
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id}}},error:null}),
 getUser:async()=>({data:{user:{id}},error:null})
}};`
 }));
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v14-p-sessions')).toHaveText('1');
 await expect(page.locator('#v14-p-average')).toContainText('88');
 await page.evaluate(authKey=>{
  localStorage.removeItem(authKey);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,oldValue:'qa-test-token',newValue:null}));
 },authKey);
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await expect(page.locator('#v14-p-average')).toHaveText('—');
 await expect(page.locator('#v14-source-status')).toContainText('Connecte-toi');
});


test('Home guest-safe stats invalidate immediately on cross-tab logout',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 await page.evaluate(({uid,authKey})=>{
  const session={id:'private-home-qa-session',date:new Date().toISOString(),
   rank:'silver',focus:'flick',tool:'VALORANT',scenario:'Stand de tir',
   minutes:15,accuracy:85,feeling:'good',notes:''};
  localStorage.setItem(authKey,'qa-token');
  localStorage.setItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2',
   JSON.stringify({sessions:[session],presets:[],weeklyGoal:3}));
 },{uid,authKey});
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const uid='11111111-1111-4111-8111-111111111111';
let pending=[];
window.__qaDeferHomeAuth=false;
window.__qaAuthWaitingCount=()=>pending.length;
window.__qaReleaseHomeAuth=()=>{
 const list=pending.splice(0);
 for(const resolve of list)resolve({data:{user:{id:uid}},error:null});
};
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id:uid}}},error:null}),
 getUser:async()=>window.__qaDeferHomeAuth?
  new Promise(resolve=>pending.push(resolve)):
  {data:{user:{id:uid}},error:null},
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
 }));
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const sessions=page.locator('[data-v15-stat="sessions"]');
 const allValues=(selector,expected)=>page.locator(selector).evaluateAll((nodes,value)=>
  nodes.length>0&&nodes.every(node=>node.textContent.trim()===value),expected);
 await expect.poll(()=>allValues('[data-v15-stat="sessions"]','1')).toBe(true);
 // Trigger a deliberately slow authenticated refresh on the still-open tab.
 await page.evaluate(()=>{
  window.__qaDeferHomeAuth=true;
  window.dispatchEvent(new Event('focus'));
 });
 await expect.poll(()=>page.evaluate(()=>window.__qaAuthWaitingCount()),{timeout:15000}).toBeGreaterThan(0);
 await page.evaluate(authKey=>{
  localStorage.removeItem(authKey);
  window.dispatchEvent(new StorageEvent('storage',{
   key:authKey,oldValue:'qa-token',newValue:null
  }));
 },authKey);
 // Previously visible real-account metrics must be hidden synchronously.
 await expect.poll(()=>allValues('[data-v15-stat="sessions"]','—')).toBe(true);
 await expect.poll(()=>allValues('[data-v15-stat="accuracy"]','—')).toBe(true);
 await expect.poll(()=>page.locator('[data-v15-stat="cloud"]').evaluateAll(nodes=>
  nodes.length>0&&nodes.every(node=>node.textContent.includes('CONNEXION REQUISE')))).toBe(true);
 await page.evaluate(()=>window.__qaReleaseHomeAuth());
 await page.waitForTimeout(180);
 // The stale request must not re-display account data.
 await expect.poll(()=>allValues('[data-v15-stat="sessions"]','—')).toBe(true);
 await expect.poll(()=>allValues('[data-v15-stat="accuracy"]','—')).toBe(true);
});
