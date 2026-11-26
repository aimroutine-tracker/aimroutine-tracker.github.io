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
test('Built-in exercises and tips translate on tool and language changes',async ({page})=>{
 await page.evaluate(()=>localStorage.setItem('aimroutine_site_lang','fr'));
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('html')).toHaveAttribute('lang','fr');
 await page.locator('[data-switch-lang]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('.r17-exercise strong').first()).toContainText('VALORANT range');
 await expect(page.locator('.r17-exercise div small').first()).toContainText('Come to a full stop');
 await page.locator('.r19-tool-select').selectOption('Aim Lab');
 await expect(page.locator('.r17-exercise strong').first()).toContainText('Gridshot / Controlled flicks');
 await expect(page.locator('.r17-exercise div small').first()).toContainText('Slow down if accuracy drops');
 await page.locator('[data-switch-lang]').click();
 await expect(page.locator('html')).toHaveAttribute('lang','fr');
 await expect(page.locator('.r17-exercise strong').first()).toContainText('Gridshot / flicks contrôlés');
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
});

test('The account page keeps login, Cloud information and guest navigation accessible',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-r17-auth-slot] #login-form')).toBeVisible();
 await expect(page.locator('.ar7-guest-link')).toHaveAttribute('href','training.html');
 await expect(page.locator('.r17-cloud-split')).toBeVisible();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
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
  'updates.html','releases.html','changelog.html','privacy.html','terms.html','account.html','training.html','progress.html','404.html'];
 const jsErrors=[];
 page.on('pageerror',error=>jsErrors.push(error.message));
 for(const path of paths){
  const response=await page.goto('/'+path,{waitUntil:'domcontentloaded'});
  expect(response?.status(),path).toBe(200);
  await expect(page.locator('main'),path).toHaveCount(1);
  await expect(page.locator('footer.ar22-footer'),path).toBeVisible();
  await expect(page.locator('nav.site31-nav[data-site-navigation="valorant"]'),path).toHaveCount(1);
  await expect(page.locator('link[href="site-valorant-theme.css?v=2"]'),path).toHaveCount(1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow,path+' causes horizontal scrolling').toBeLessThanOrEqual(2);
  if(isMobile)await expect(page.locator('details.site31-mobile-nav > summary'),path).toBeVisible();
  if(isMobile&&path==='index.html'){
   await page.locator('#home-details > summary').click();
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

test('Windows 3.11 gallery tabs open the matching real screenshot',async({page})=>{
 await page.goto('/index.html#app-gallery',{waitUntil:'domcontentloaded'});
 const gallery=page.locator('#app-gallery');
 const lightbox=page.locator('#v16-real-shot-dialog');
 for(const selector of ['.v16-gallery-tabs','.v33-gallery-captions','.v16-gallery-foot']){
  await expect(gallery.locator(selector)).toHaveCSS('background-color','rgb(21, 19, 24)');
 }
 for(const view of ['dashboard','startup','training','matches']){
  await page.locator(`[data-v16-gallery="${view}"]`).click();
  const shot=page.locator(`#v16-gallery-${view} img.v16-real-shot`);
  const source=`aimroutine-311-${view}.webp`;
  await expect(shot).toBeVisible();
  await expect(shot).toHaveCSS('background-color','rgb(17, 17, 21)');
  await expect(shot).toHaveAttribute('src',source);
  await expect.poll(()=>shot.evaluate(img=>img.naturalWidth)).toBe(1440);
  await page.locator('.v16-expand[data-v16-expand]').click();
  await expect(lightbox).toBeVisible();
  await expect(lightbox).toHaveCSS('background-color','rgb(21, 19, 24)');
  await expect(lightbox.locator('img')).toHaveAttribute('src',source);
  await lightbox.locator('[data-v16-close]').click();
  await expect(lightbox).toBeHidden();
 }
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
 await page.goto('/index.html#aim-challenge',{waitUntil:'domcontentloaded'});
 const game=page.locator('#aim-challenge');
 await game.scrollIntoViewIfNeeded();
 await expect(game).toBeVisible();
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
 await page.goto('/index.html#aim-challenge',{waitUntil:'domcontentloaded'});
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
 await expect(page.locator('.valorant-hero h1')).toBeVisible();
 await expect(page.locator('.ar9-path-grid .ar9-path-card')).toHaveCount(3);
 await expect(page.locator('link[href="site-future-v13.css?v=1"]')).toHaveCount(1);
 await expect(page.locator('#aim-challenge [data-ar11-start]')).toBeAttached();
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.ar22-intro #page-title')).toBeVisible();
 await expect(page.locator('#login-form')).toBeVisible();
 await expect(page.locator('#signup-mode')).toBeVisible();
});

test('Valorant landing prioritizes routines and opens secondary content on demand',async ({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.valorant-hero h1')).toBeVisible();
 await expect(page.locator('.valorant-routine-grid .ar-drill')).toHaveCount(3);
 await expect(page.locator('#aim-challenge')).not.toBeVisible();
 expect(await page.locator('.valorant-hero').evaluate(el=>getComputedStyle(el,'::before').backgroundImage)).toContain('valorant-hero.webp');
 await page.locator('.home-destinations a[href="#aim-challenge"]').click();
 await expect(page.locator('#aim-challenge')).toBeVisible();
 await expect(page.locator('#home-details')).toHaveAttribute('open','');
 await expect(page.locator('.v14-signal-strip [data-v15-stat="sessions"]')).toHaveText('—');
 await expect(page.locator('.site31-nav a.valorant-account')).toHaveAttribute('href','account.html');

 await page.locator('#home-details > summary').click();
 await expect(page.locator('#aim-challenge')).not.toBeVisible();
 await page.locator('.home-destinations a[href="#aim-challenge"]').click();
 await expect(page.locator('#aim-challenge')).toBeVisible();

 await page.locator('.home-demo-directory a[href="#routine"]').click();
 await page.locator('#exp-duration').selectOption('15');
 await expect(page.locator('[data-routine-total]')).toHaveText(/15/);
 await page.locator('.home-demo-directory a[href="#project-overview"]').click();
 await expect(page.locator('#app-gallery [role="tabpanel"]:visible img')).toBeVisible();

 await page.goto('/index.html#community',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#community')).toBeVisible();
 await expect(page.locator('.home-detail-group').filter({has:page.locator('#community')})).toHaveAttribute('open','');
});
test('Home routine opens a real plan with the advertised duration',async ({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('.valorant-hero .home-starter').click();
 await expect(page).toHaveURL(/training\.html\?routine=precision#panel-builder$/);
 await expect(page.locator('#panel-builder')).toBeVisible();
 await expect(page.locator('#duration')).toHaveValue('10');
 await expect(page.locator('#focus')).toHaveValue('control');
 await expect(page.locator('#tool')).toHaveValue('VALORANT');
 await expect.poll(()=>page.evaluate(()=>window.AIMWeb?.getPlan().exercises.reduce((sum,item)=>sum+item.minutes,0))).toBe(10);
});

test('V17 training five days and skill choices prepare the actual routine builder',async ({page})=>{
 await page.goto('/training.html?level=iron',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-training-grid')).toBeVisible();
 await expect(page.locator('.r17-level-options .r17-level')).toHaveCount(3);
 await expect(page.locator('.r17-days [data-r17-day]')).toHaveCount(5);
 await expect(page.locator('[data-r17-level="iron"]')).toHaveAttribute('aria-pressed','true');
 const days=page.locator('.r17-days [data-r17-day]');
 const prepare=page.locator('[data-r17-create]');
 const preview=page.locator('.r17-exercise strong');
 await expect(prepare).toHaveCount(1);
 await days.nth(4).click();
 await expect.poll(async()=>new Set(await preview.allTextContents()).size).toBe(3);
 await days.nth(1).click();
 await expect(page.locator('.r17-weekdays [data-r17-day="1"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('[data-r17-day-description]')).toContainText('cible en mouvement');
 await page.locator('.r19-tool-select').selectOption('Aim Lab');
 const exerciseNames=await preview.allTextContents();
 await prepare.click();
 await expect(page.locator('.r18-training-dialog')).toBeVisible();
 await expect(page.locator('#rank')).toHaveValue('iron');
 await expect(page.locator('#focus')).toHaveValue('tracking');
 await expect(page.locator('#tool')).toHaveValue('Aim Lab');
 await expect(page.locator('#duration')).toHaveValue('15');
 expect(await page.evaluate(()=>window.AIMWeb.getPlan().exercises.map(({name})=>name))).toEqual(exerciseNames);
 await page.locator('#start-plan').click();
 await expect(page.locator('#timer-toggle')).toBeVisible();
 await page.locator('.r18-dialog-close').click();
 await days.nth(0).click();
 await page.locator('.r19-tool-select').selectOption('VALORANT');
 page.once('dialog',dialog=>dialog.dismiss());
 await prepare.click();
 await expect(page.locator('.r18-training-dialog')).not.toBeVisible();
 await expect(page.locator('#tool')).toHaveValue('Aim Lab');
 expect(await page.evaluate(()=>window.AIMWeb.getPlan().focus)).toBe('tracking');
});
test('Progress range keeps the frequency chart and recorded sessions in sync',async ({page})=>{
 await useVerifiedTestAccount(page);
 const imported=await page.evaluate(()=>{
  const sessions=[0,10,75,120].map((days,index)=>({
   id:'progress-'+index,date:new Date(Date.now()-days*86400000).toISOString(),
   rank:'silver',focus:'micro',tool:index===1?'VALORANT':'Aim Lab',
   scenario:index<2?'Microshot':'Microshot '+index,
   minutes:15,accuracy:60+index,feeling:'good',notes:''
  }));
  return window.AIMWeb.mergeData({sessions,presets:[],weeklyGoal:3});
 });
 expect(imported).toBe(4);
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 const rows=page.locator('#v14-p-recent li');
 for(const [range,count] of [['7',1],['30',2],['90',3],['0',4]]){
  await page.locator('[data-r19-range="'+range+'"]').click();
  await expect(page.locator('#v14-p-sessions')).toHaveText(String(count));
  await expect(rows).toHaveCount(count);
  const buckets=await page.locator('#v14-p-bars [data-session-count]').allTextContents();
  expect(buckets.reduce((sum,n)=>sum+Number(n),0)).toBe(count);
 }
 await expect(rows.last()).toContainText('Microshot 3');
 const tool=page.locator('#v14-progress-tool');
 const scenario=page.locator('#v14-progress-scenario');
 await scenario.selectOption({label:'Microshot · Aim Lab'});
 await expect(page.locator('#v14-p-sessions')).toHaveText('1');
 await expect(page.locator('#v14-p-average')).toHaveText('60 %');
 await expect(rows.first()).toContainText('Aim Lab');
 await tool.selectOption('VALORANT');
 await expect(scenario).toHaveValue('');
 await expect(page.locator('#v14-p-average')).toHaveText('61 %');
 await page.locator('[data-r19-range="7"]').click();
 await expect(tool).toHaveValue('VALORANT');
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await expect(page.locator('#v14-p-goal')).toHaveText('1 / 3');
 await expect(page.locator('#v14-source-signin')).toBeHidden();
});

test('V17 honest progress and unchanged authentication forms',async ({page})=>{
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.r17-progress-wrap .r17-hero')).toBeVisible();
 await expect(page.locator('.r17-chart-grid .v14-panel')).toHaveCount(3);
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await expect(page.locator('#v14-source-status a')).toHaveAttribute('href','account.html#auth-panel');
 await expect(page.locator('#v14-progress-filters')).toBeHidden();
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

test('Training dashboard matches the site and its shortcuts leave the goals dialog',async ({page})=>{
 const dashboard=page.locator('#panel-dashboard');
 const dashboardTab=page.locator('#tab-dashboard');
 const dialog=page.locator('.r19-workspace-dialog');
 await expect(page.locator('.ar5-tab-wrap')).toHaveCSS('background-color','rgb(25, 24, 30)');
 await expect(dashboard.locator('.ar5-goal')).toHaveCSS('background-color','rgb(34, 31, 40)');
 await expect(dashboardTab).toHaveCSS('color','rgb(244, 240, 233)');

 await page.goto('/training.html#panel-dashboard');
 await expect(dialog.locator('#panel-dashboard')).toBeVisible();
 await dialog.locator('[data-go="coach"]').click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('#tab-coach')).toBeFocused();
 await expect(page.locator('#panel-coach')).toBeVisible();

 await dashboardTab.click();
 await dashboard.locator('[data-go="insights"]').click();
 await expect(page.locator('#panel-insights')).toBeVisible();
 await page.locator('[data-r19-panel="dashboard"]').click();
 await dialog.locator('[data-go="builder"]').click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('#tab-builder')).toBeFocused();
 await expect(page.locator('#panel-builder')).toBeVisible();

 await page.locator('[data-r19-panel="coach"]').click();
 await dialog.locator('#coach-build').click();
 await expect(dialog).not.toBeVisible();
 await expect(page.locator('#tab-builder')).toBeFocused();
 await expect(page.locator('#start-plan')).toBeEnabled();
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

test('navigation dropdown stays compact, unclipped and keyboard accessible', async ({page,isMobile})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const details=page.locator(isMobile?'.site31-mobile-nav':'.ar5-nav-explore');
 const trigger=details.locator('summary');
 const panel=details.locator(isMobile?'.site31-mobile-links':'.ar5-nav-dropdown');
 const row=panel.locator(isMobile?'a[href="progress.html"]':'a[href="index.html#aim-challenge"]');
 await expect(panel).toBeHidden();
 if(isMobile)await trigger.click();
 else await trigger.press('Enter');
 await expect(panel).toBeVisible();
 await expect(panel.getByRole('link')).toHaveCount(isMobile?14:9);
 await expect(row).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 const bounds=await panel.boundingBox();
 const viewport=page.viewportSize();
 expect(bounds.x).toBeGreaterThanOrEqual(0);
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width+1);
 expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height+1);
 if(isMobile){
  await expect(row).toHaveCSS('min-height','44px');
 }else{
  expect(bounds.height).toBeLessThanOrEqual(350);
  await page.keyboard.press('Tab');
  await expect(row).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
 }
});
