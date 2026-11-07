import {test,expect} from '@playwright/test';
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
 await page.locator('#tab-profile').click();
 await page.locator('#player-name').fill('IKAZU');
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
 await expect(page.locator('#workspace-title')).toContainText('Your AIM.');
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
 await page.locator('#signup-password').fill('AimRoutine_2026!Strong');
 await page.locator('#signup-submit').click();
 await expect(page.locator('#account-status')).toContainText('un e-mail de confirmation');
 expect(signups).toBe(1);
});

test('Google deletion UX uses exactly SUPPRIMER without a second Google login (mock account)',async({page})=>{
 const uid='33333333-3333-4333-8333-333333333333';
 const mockUser={id:uid,email:'test-google-delete@example.invalid',
   app_metadata:{provider:'google',providers:['google']},
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

test('Email account deletion sends Turnstile token during password reauthentication (mock account)',async({page})=>{
 const uid='44444444-4444-4444-8444-444444444444';
 const mockUser={id:uid,email:'test-email-delete@example.invalid',
  app_metadata:{provider:'email',providers:['email']},
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
