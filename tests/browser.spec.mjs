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


test('Training Cloud status follows FR and EN without inventing a guest account',async({page})=>{
 const status=page.locator('#cloud-training-status');
 await expect(status).toContainText('Mode aperçu sans sauvegarde');
 await page.locator('[data-switch-lang]').first().click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('en');
 await expect(status).toContainText('Preview only');
 await expect(status).toContainText('Sign in to save');
 await page.locator('[data-switch-lang]').first().click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('fr');
 await expect(status).toContainText('Mode aperçu sans sauvegarde');
 await useVerifiedTestAccount(page);
 await expect(status).toContainText('Cloud automatique');
 await page.locator('[data-switch-lang]').first().click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('en');
 await expect(status).toContainText('Automatic Cloud');
});

test('Training rejects a forged cached account ID unless getUser verifies it',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const uid='11111111-1111-4111-8111-111111111111';
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id:uid}}},error:null}),
 getUser:async()=>({data:{user:null},error:{message:'invalid JWT'}})
}};`
 }));
 await page.evaluate(owner=>{
  localStorage.setItem('sb-lmzswtzboobpokumxzhy-auth-token',
   JSON.stringify({user:{id:owner},access_token:'forged-token'}));
  localStorage.setItem('aimroutine_cloud_current_uid',owner);
 },uid);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>Boolean(window.AIMWeb))).toBe(true);
 await expect(page.locator('body')).toHaveClass(/ar-guest-preview/);
 await expect(page.locator('#ar-account-required')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.__aimCloudUserId)).toBe(null);
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
 const denied=await page.evaluate(()=>{
  try{
   window.AIMWeb.mergeData({sessions:[{
    id:'forged-user-must-not-save',date:new Date().toISOString(),rank:'iron',
    focus:'tracking',tool:'VALORANT',scenario:'Test',minutes:10,accuracy:70,feeling:'good',notes:''
   }],presets:[],weeklyGoal:3});
   return false;
  }catch{return true}
 });
 expect(denied).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_web_training_v2'))).toBeNull();
});

test('Training workspace hides account data after cross-tab token removal without reacting to same-user refresh',async({page})=>{
 await useVerifiedTestAccount(page);
 const uid='11111111-1111-4111-8111-111111111111';
 const firstLoad=await page.evaluate(()=>performance.timeOrigin);
 // A normal Supabase access-token refresh keeps the same verified owner.
 await page.evaluate(owner=>{
  const key='sb-lmzswtzboobpokumxzhy-auth-token';
  const next=JSON.stringify({user:{id:owner},access_token:'qa-new-access-token'});
  localStorage.setItem(key,next);
  window.dispatchEvent(new StorageEvent('storage',{key,oldValue:'test-token',newValue:next}));
 },uid);
 await page.waitForTimeout(250);
 expect(await page.evaluate(()=>performance.timeOrigin)).toBe(firstLoad);
 await expect.poll(()=>page.evaluate(()=>window.__aimCloudUserId)).toBe(uid);
 await page.evaluate(()=>{
  window.AIMWeb.mergeData({sessions:[{
   id:'cross-tab-logout-fixture',date:new Date().toISOString(),rank:'silver',
   focus:'flick',tool:'VALORANT',scenario:'Stand de tir',minutes:10,
   accuracy:72,feeling:'good',notes:''
  }],presets:[],weeklyGoal:3});
 });
 await expect(page.locator('#total-sessions')).toHaveText('1');
 // Revoking the auth token from another tab must immediately stop use of
 // the old namespace and reload the page into guest-only preview mode.
 const navigation=page.waitForEvent('framenavigated');
 await page.evaluate(()=>{
  setTimeout(()=>{
   const key='sb-lmzswtzboobpokumxzhy-auth-token';
   const oldValue=localStorage.getItem(key);
   localStorage.removeItem(key);
   window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue:null}));
  },0);
 });
 await navigation;
 await expect(page.locator('#ar-account-required')).toBeVisible();
 await expect(page.locator('body')).toHaveClass(/ar-guest-preview/);
 await expect.poll(()=>page.evaluate(()=>window.__aimCloudUserId)).toBe(null);
 await expect.poll(()=>page.evaluate(()=>window.AIMWeb?.getStore?.().sessions.length)).toBe(0);
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
 const rejected=await page.evaluate(()=>{
  try{
   window.AIMWeb.mergeData({sessions:[{
    id:'forbidden-guest-save',date:new Date().toISOString(),rank:'silver',
    focus:'flick',tool:'VALORANT',scenario:'Test',minutes:10,accuracy:70,feeling:'good',notes:''
   }],presets:[],weeklyGoal:3});
   return false;
  }catch{return true}
 });
 expect(rejected).toBe(true);
});

test('V3 challenge chips fit at intermediate desktop widths',async({page})=>{
 for(const width of [1350,1440,1599,1672]){
  await page.setViewportSize({width,height:941});
  await page.goto('/index.html',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
  const dims=await page.locator('.r17-home-wrap .r17-challenge').evaluate(panel=>{
   const r=panel.getBoundingClientRect();
   const chips=[...panel.querySelectorAll('.r17-chipbar>span')].map(el=>{
    const rect=el.getBoundingClientRect();
    return {left:rect.left,right:rect.right,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
   });
   return {left:r.left,right:r.right,clientWidth:document.documentElement.clientWidth,
    documentWidth:document.documentElement.scrollWidth,chips};
  });
  expect(dims.chips).toHaveLength(3);
  for(const chip of dims.chips){
   expect(chip.left, String(width)).toBeGreaterThanOrEqual(dims.left);
   expect(chip.right,String(width)).toBeLessThanOrEqual(dims.right-2);
   expect(chip.scrollWidth-chip.clientWidth,String(width)).toBeLessThanOrEqual(2);
  }
  expect(dims.documentWidth-dims.clientWidth,String(width)).toBeLessThanOrEqual(3);
 }
});

test('V3 challenge reticle is decorative and leaves functional start link available',async({page})=>{
 await page.setViewportSize({width:1672,height:941});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
 const challenge=page.locator('.r17-home-wrap .r17-challenge');
 const heading=challenge.locator('h3');
 const badge=await heading.evaluate(el=>{
  const before=getComputedStyle(el,'::before'),after=getComputedStyle(el,'::after');
  const title=el.getBoundingClientRect(),panel=el.closest('.r17-challenge').getBoundingClientRect();
  return {titleLeft:title.left,panelLeft:panel.left,
   beforeContent:before.content,afterContent:after.content,
   beforeWidth:before.width,afterWidth:after.width,
   beforePointerEvents:before.pointerEvents,afterPointerEvents:after.pointerEvents};
 });
 expect(badge.titleLeft-badge.panelLeft).toBeGreaterThan(90);
 expect(badge.beforeContent).toBe('""');
 expect(badge.afterContent).toBe('""');
 expect(badge.beforeWidth).toBe('64px');
 expect(badge.afterWidth).toBe('49px');
 expect(badge.beforePointerEvents).toBe('none');
 expect(badge.afterPointerEvents).toBe('none');
 await expect(challenge.locator('.r17-button')).toHaveAttribute('href','#aim-challenge');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(3);
});

test('V3 home feature descriptions match owner reference without synthetic statistics',async({page})=>{
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const cards=page.locator('.r17-home-wrap .r17-feature');
 await expect(cards).toHaveCount(3);
 await expect(cards.nth(0)).toContainText('Des entraînements ciblés et efficaces');
 await expect(cards.nth(1)).toContainText('Des routines prêtes à l’emploi et personnalisables');
 await expect(cards.nth(2)).toContainText('des objectifs clairs pour mesurer tes vrais progrès');
 await expect(page.locator('.r17-home-wrap [data-v15-stat="sessions"]')).not.toContainText('12 846');
 await page.locator('[data-switch-lang]').first().click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('en');
 await expect(cards.nth(0)).toContainText('Effective, focused training');
 await expect(cards.nth(1)).toContainText('Ready-to-use customizable routines');
 await expect(cards.nth(2)).toContainText('your real training results');
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


test('Progress chart descriptions expose real weekly counts and respect the language',async({page})=>{
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 const counts=page.locator('#v14-p-bars .r17-visually-hidden');
 await expect(counts).toHaveCount(1);
 await expect(counts).toContainText('Séances par semaine');
 await expect(counts).toContainText('Cette semaine : 0 séance(s)');
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await page.locator('#v14-week-range').selectOption('4');
 await expect(counts).toContainText('S-3 : 0 séance(s)');
 await expect(counts).not.toContainText('S-7');
 await page.locator('[data-switch-lang]').first().click();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.lang)).toBe('en');
 await expect(counts).toContainText('Sessions per week');
 await expect(counts).toContainText('This week : 0 session(s)');
 await expect(page.locator('#v14-p-line .v14-chart-empty')).toContainText('No accuracy recorded');
 await expect(page.locator('#v14-p-distribution .v3-empty-radar-caption')).toContainText('No recorded sessions');
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


test('Progress guest Cloud notice follows FR/EN switches without synthetic data',async({page})=>{
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 const source=page.locator('#v14-source-status');
 await expect(source).toContainText('Connecte-toi pour consulter tes statistiques');
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await page.locator('.ar-v3-language-footer [data-switch-lang]').click();
 await expect(source).toContainText('Sign in to see your statistics');
 await expect(page.locator('#v14-p-sessions')).toHaveText('0');
 await page.locator('.ar-v3-language-footer [data-switch-lang]').click();
 await expect(source).toContainText('Connecte-toi pour consulter tes statistiques');
});


// Cross-device updates cannot create 'storage' events in another browser.
// Test real visible-page refresh wiring with a deterministic simulated Cloud;
// do not connect or write to the production database.
for(const [route,selector] of [
 ['index.html','[data-v15-stat="sessions"]'],
 ['progress.html','#v14-p-sessions']
]){
 test('Visible '+route+' automatically receives a newer remote session without navigation',async({page,browserName})=>{
  test.skip(browserName!=='chromium','Deterministic browser clock is verified in Chromium');
  const uid='11111111-1111-4111-8111-111111111111';
  await page.clock.install({time:new Date('2026-11-10T12:00:00.000Z')});
  await page.addInitScript(({uid})=>{
   localStorage.setItem('sb-lmzswtzboobpokumxzhy-auth-token','qa-polling-token');
   window.__qaRemoteTraining=[];
   window.__qaVisibleCloudSyncs=0;
  },{uid});
  await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
   status:200,contentType:'application/javascript',
   body:`const id='11111111-1111-4111-8111-111111111111';
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id}}},error:null}),
 getUser:async()=>({data:{user:{id}},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
  }));
  await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
   status:200,contentType:'application/javascript',
   body:`export const isEnabled=()=>true;
export const synchronize=async(_client,uid)=>{
 window.__qaVisibleCloudSyncs=(window.__qaVisibleCloudSyncs||0)+1;
 const data={sessions:window.__qaRemoteTraining||[],presets:[],weeklyGoal:3};
 localStorage.setItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2',JSON.stringify(data));
 return {synced:true};
};`
  }));
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>window.__qaVisibleCloudSyncs||0)).toBeGreaterThan(0);
  const value=page.locator(selector);
  await expect(value.first()).toHaveText('0');
  await page.evaluate(()=>{
   window.__qaRemoteTraining=[{
    id:'fresh-from-other-device',date:new Date().toISOString(),rank:'silver',
    focus:'flick',tool:'VALORANT',scenario:'Range',minutes:15,
    accuracy:84,feeling:'good',notes:''
   }];
  });
  // The tab never loses focus and receives neither focus nor storage events.
  await page.clock.fastForward(46000);
  await expect.poll(()=>page.evaluate(()=>window.__qaVisibleCloudSyncs||0)).toBeGreaterThan(1);
  await expect(value.first()).toHaveText('1');
  // No periodic cloud reads after a cross-tab logout.
  const before=await page.evaluate(()=>window.__qaVisibleCloudSyncs);
  await page.evaluate(()=>{
   const key='sb-lmzswtzboobpokumxzhy-auth-token';
   localStorage.removeItem(key);
   window.dispatchEvent(new StorageEvent('storage',{key,oldValue:'qa-polling-token',newValue:null}));
  });
  await page.clock.fastForward(46000);
  expect(await page.evaluate(()=>window.__qaVisibleCloudSyncs)).toBe(before);
 });
}


// storage.clear() from a different tab dispatches StorageEvent with key=null.
// It must revoke visible account views even if no individual auth-key event fires.
for(const [route,metric] of [
 ['index.html','[data-v15-stat="sessions"]'],
 ['progress.html','#v14-p-sessions']
]){
 test('V3 '+route+' hides private results immediately after a remote storage.clear()',async({page})=>{
  const uid='11111111-1111-4111-8111-111111111111';
  const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
  await page.addInitScript(({uid,authKey})=>{
   localStorage.setItem(authKey,'qa-storage-clear-token');
   const session={id:'private-clear-case',date:new Date().toISOString(),
    rank:'silver',focus:'tracking',tool:'VALORANT',scenario:'Range',
    minutes:20,accuracy:91,feeling:'good',notes:''};
   localStorage.setItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2',
     JSON.stringify({sessions:[session],presets:[],weeklyGoal:3}));
  },{uid,authKey});
  await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
   status:200,contentType:'application/javascript',
   body:`const id='11111111-1111-4111-8111-111111111111';
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id}}},error:null}),
 getUser:async()=>({data:{user:{id}},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
  }));
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  await expect(page.locator(metric).first()).toHaveText('1');
  await page.evaluate(()=>{
   localStorage.clear();
   window.dispatchEvent(new StorageEvent('storage',{key:null,oldValue:null,newValue:null}));
  });
  await expect(page.locator(metric).first()).toHaveText(route==='index.html'?'—':'0');
  await page.waitForTimeout(180);
  await expect(page.locator(metric).first()).toHaveText(route==='index.html'?'—':'0');
 });
}

test('V3 training returns to account-free preview after a remote storage.clear()',async({page})=>{
 await useVerifiedTestAccount(page);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.__aimCloudUserId))).toBe(true);
 await page.evaluate(()=>{
  localStorage.clear();
  window.dispatchEvent(new StorageEvent('storage',{key:null,oldValue:null,newValue:null}));
 });
 await expect(page.locator('body')).toHaveClass(/ar-guest-preview/);
 await expect.poll(()=>page.evaluate(()=>window.__aimCloudUserId)).toBe(null);
 await expect(page.locator('#ar-account-required')).toBeVisible();
});


test('V3 Cloud mobile hero starts near the top without overlapping the benefits',async({page})=>{
 for(const width of [320,375,390,720]){
  await page.setViewportSize({width,height:900});
  await page.goto('/account.html',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
  const data=await page.evaluate(()=>{
   const rect=s=>document.querySelector(s)?.getBoundingClientRect();
   const hero=rect('.r17-account-wrap .r17-hero');
   const content=rect('.r17-account-wrap .r17-hero-content');
   const benefits=rect('.r17-account-wrap .r17-account-benefits');
   return {heroY:hero?.top,heroBottom:hero?.bottom,contentY:content?.top,
    benefitsY:benefits?.top,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(data.heroY,width).toBeDefined();
  expect(data.contentY-data.heroY,width).toBeLessThanOrEqual(60);
  expect(data.benefitsY,width).toBeGreaterThanOrEqual(data.heroBottom-4);
  expect(data.overflow,width).toBeLessThanOrEqual(3);
 }
});


test('V3 action icons and challenge badges use real SVG instead of missing-font glyphs',async({page})=>{
 for(const [route,minimum] of [['index.html',3],['training.html',2]]){
  await page.goto('/'+route,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
  const button=page.locator('.r17-hero-actions .r17-button--outline').first();
  await expect(button.locator('svg.r17-inline-symbol[aria-hidden="true"]')).toHaveCount(1);
  const challenge=page.locator('.r17-challenge .r17-chipbar, .r17-side-challenge .r17-chipbar').first();
  await expect.poll(()=>challenge.locator('svg.r17-inline-symbol').count()).toBeGreaterThanOrEqual(minimum);
  const sizes=await challenge.locator('svg.r17-inline-symbol').evaluateAll(nodes=>
   nodes.map(node=>({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,
    paths:node.querySelectorAll('path,circle').length})));
  expect(sizes.every(size=>size.width>=14&&size.height>=14&&size.paths>0),route).toBe(true);
 }
});


test('Training startup discards a stale getUser result after sign-out before hydration',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const id='11111111-1111-4111-8111-111111111111';
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id}}},error:null}),
 getUser:async()=>new Promise(resolve=>{
  window.__qaReleaseInitialGetUser=()=>resolve({data:{user:{id}},error:null});
 })
}};`
 }));
 await page.evaluate(({uid,authKey})=>{
  localStorage.setItem(authKey,JSON.stringify({user:{id:uid},access_token:'initial'}));
  const session={id:'old-private-startup',date:new Date().toISOString(),
   rank:'silver',focus:'flick',tool:'VALORANT',scenario:'Range',minutes:10,
   accuracy:82,feeling:'good',notes:''};
  localStorage.setItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2',
   JSON.stringify({sessions:[session],presets:[],weeklyGoal:3}));
 },{uid,authKey});
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseInitialGetUser)).toBe('function');
 // This occurs BEFORE training-entry-v7 registers its regular storage listener.
 await page.evaluate(authKey=>{
  localStorage.removeItem(authKey);
  window.__qaReleaseInitialGetUser();
 },authKey);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.AIMWeb))).toBe(true);
 await expect(page.locator('body')).toHaveClass(/ar-guest-preview/);
 await expect(page.locator('#total-sessions')).toHaveText('0');
 await expect.poll(()=>page.evaluate(()=>window.__aimCloudUserId)).toBe(null);
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
});

test('Training startup does not restore user data after logout during initial Cloud sync',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const id='11111111-1111-4111-8111-111111111111';
export const supabase={auth:{
 getSession:async()=>({data:{session:{user:{id}}},error:null}),
 getUser:async()=>({data:{user:{id}},error:null})
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const collectFavoriteDeletion=()=>{};
export const synchronize=()=>new Promise(resolve=>{
 window.__qaReleaseInitialCloud=()=>resolve({synced:true});
});`
 }));
 await page.evaluate(({uid,authKey})=>{
  localStorage.setItem(authKey,JSON.stringify({user:{id:uid},access_token:'initial'}));
  const session={id:'private-before-logout',date:new Date().toISOString(),
   rank:'silver',focus:'micro',tool:'VALORANT',scenario:'Range',minutes:12,
   accuracy:75,feeling:'good',notes:''};
  localStorage.setItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2',
   JSON.stringify({sessions:[session],presets:[],weeklyGoal:3}));
 },{uid,authKey});
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseInitialCloud)).toBe('function');
 await page.evaluate(authKey=>{
  localStorage.removeItem(authKey);
  window.__qaReleaseInitialCloud();
 },authKey);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.AIMWeb))).toBe(true);
 await expect(page.locator('body')).toHaveClass(/ar-guest-preview/);
 await expect(page.locator('#total-sessions')).toHaveText('0');
 await expect.poll(()=>page.evaluate(()=>window.__aimCloudUserId)).toBe(null);
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
});


test('V3 Home refreshes the second account immediately and does not inherit Cloud errors',async({page})=>{
 const first='11111111-1111-4111-8111-111111111111';
 const second='22222222-2222-4222-8222-222222222222';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 const mkToken=uid=>JSON.stringify({user:{id:uid},access_token:'qa-'+uid});
 await page.addInitScript(({first,second,authKey})=>{
  localStorage.setItem(authKey,JSON.stringify({user:{id:first},access_token:'qa-'+first}));
  window.__qaCloudReads=[];
  window.__qaCloudFailure=first;
  const session=(id)=>({id,date:new Date().toISOString(),
   rank:'silver',focus:'flick',tool:'VALORANT',scenario:'Range',
   minutes:10,accuracy:82,feeling:'good',notes:''});
  window.__qaCloudRemote={
   [first]:[session('first-a')],
   [second]:[session('second-a'),session('second-b')]
  };
 },{first,second,authKey});
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
const account=()=>JSON.parse(localStorage.getItem(authKey)||'null')?.user||null;
export const supabase={auth:{
 getSession:async()=>({data:{session:account()?{user:account()}:null},error:null}),
 getUser:async()=>({data:{user:account()},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const synchronize=async(_client,uid)=>{
 window.__qaCloudReads.push(uid);
 if(window.__qaCloudFailure===uid)throw Error('qa cloud unavailable');
 localStorage.setItem('aimroutine_cloud_user_'+uid+'_aimroutine_web_training_v2',
 JSON.stringify({sessions:window.__qaCloudRemote[uid]||[],presets:[],weeklyGoal:3}));
 return {synced:true};
};`
 }));
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 const numbers=page.locator('[data-v15-stat="sessions"]');
 const cloud=page.locator('[data-v15-stat="cloud"]');
 await expect(cloud.first()).toHaveText('EN ATTENTE');
 const firstReadsBeforeSwitch=await page.evaluate(uid=>
  window.__qaCloudReads.filter(x=>x===uid).length,first);
 expect(firstReadsBeforeSwitch).toBeGreaterThan(0);
 // Switching to a different verified UID must bypass the old 30s cooldown.
 await page.evaluate(({authKey,second,mk})=>{
  localStorage.setItem(authKey,mk);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:mk}));
 },{authKey,second,mk:mkToken(second)});
 await expect(numbers.first()).toHaveText('2');
 await expect(cloud.first()).toHaveText('AUTOMATIQUE');
 expect(await page.evaluate(uid=>window.__qaCloudReads.includes(uid),second)).toBe(true);
 // Returning to account A must also initiate a new refresh, not reuse B's.
 await page.evaluate(({authKey,mk})=>{
  localStorage.setItem(authKey,mk);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:mk}));
 },{authKey,mk:mkToken(first)});
 await expect(cloud.first()).toHaveText('EN ATTENTE');
 expect(await page.evaluate(uid=>window.__qaCloudReads.filter(x=>x===uid).length,first))
  .toBeGreaterThan(firstReadsBeforeSwitch);
});


// Regressions for the account portal itself, not merely the Training workspace.
// The delayed Auth service is mocked: never touch live users or data.
test('Cloud portal does not resurrect a user after SIGNED_OUT during bootstrap',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const id='11111111-1111-4111-8111-111111111111';
const user={id,email:'private-account@example.invalid',user_metadata:{aim_username:'PrivateUser'}};
let notify=null;
window.__qaSendAccountSignOut=()=>notify?.('SIGNED_OUT',null);
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:()=>new Promise(resolve=>{
  window.__qaReleaseAccountIdentity=()=>resolve({data:{user},error:null});
 }),
 onAuthStateChange:callback=>{notify=callback;return {data:{subscription:{unsubscribe(){}}}};}
}};`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseAccountIdentity)).toBe('function');
 await page.evaluate(()=>{
  window.__qaSendAccountSignOut();
  window.__qaReleaseAccountIdentity();
 });
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await expect(page.locator('#user-email')).toBeEmpty();
 await expect(page.locator('#cloud-sessions-count')).toHaveText('—');
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
});

test('Cloud portal hides personal details after SIGNED_OUT during first Cloud download',async({page})=>{
 const uid='11111111-1111-4111-8111-111111111111';
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const user={id:'11111111-1111-4111-8111-111111111111',
 email:'private-account@example.invalid',user_metadata:{aim_username:'PrivateUser'}};
let notify=null;
window.__qaSendAccountSignOut=()=>notify?.('SIGNED_OUT',null);
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>({data:{user},error:null}),
 onAuthStateChange:callback=>{notify=callback;return {data:{subscription:{unsubscribe(){}}}};}
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=()=>new Promise(resolve=>{
 window.__qaReleaseAccountCloud=()=>resolve({synced:true,downloadedSessions:3});
});`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseAccountCloud)).toBe('function');
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await page.evaluate(()=>{
  window.__qaSendAccountSignOut();
  window.__qaReleaseAccountCloud();
 });
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await expect(page.locator('#user-email')).toBeEmpty();
 await expect(page.locator('#user-username')).toBeEmpty();
 await expect(page.locator('#cloud-sessions-count')).toHaveText('—');
 await expect(page.locator('#account-status')).not.toContainText('Sauvegarde cloud synchronisée');
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
});


test('Email login never blocks global logout behind the initial Cloud download',async({page})=>{
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const user={id:'11111111-1111-4111-8111-111111111111',
  email:'account-login@example.invalid',user_metadata:{aim_username:'LoggedUser'}};
let active=null,notify=null;
window.__qaGlobalLogoutCount=0;
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>({data:{user:active},error:null}),
 signInWithPassword:async()=>{active=user;return {data:{user},error:null};},
 signOut:async({scope})=>{
   if(scope==='global')window.__qaGlobalLogoutCount++;
   active=null;notify?.('SIGNED_OUT',null);return {error:null};
 },
 onAuthStateChange:callback=>{notify=callback;return {data:{subscription:{unsubscribe(){}}}};}
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=()=>new Promise(resolve=>{
 window.__qaReleaseSlowLoginCloud=()=>resolve({synced:true,downloadedSessions:7});
});`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await page.locator('#login-email').fill('account-login@example.invalid');
 await page.locator('#login-password').fill('TestPass_2026!');
 await page.locator('#login-form button[type="submit"]').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseSlowLoginCloud)).toBe('function');
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 // Logout must remain available while synchronize() has not resolved.
 await page.locator('#logout').click();
 await expect.poll(()=>page.evaluate(()=>window.__qaGlobalLogoutCount)).toBe(1);
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await page.evaluate(()=>window.__qaReleaseSlowLoginCloud());
 await expect(page.locator('#user-email')).toBeEmpty();
 await expect(page.locator('#account-status')).not.toContainText('Synchronisation automatique à jour');
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
});


test('Cloud portal hides account A immediately during cross-tab switch to B',async({page})=>{
 const a='11111111-1111-4111-8111-111111111111';
 const b='22222222-2222-4222-8222-222222222222';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 const mk=id=>JSON.stringify({user:{id},access_token:'qa-'+id});
 await page.addInitScript(({a,authKey})=>
  localStorage.setItem(authKey,JSON.stringify({user:{id:a},access_token:'qa-'+a})),{a,authKey});
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const people={[a]:{id:a,email:'private-a@example.invalid',user_metadata:{aim_username:'PrivateA'}},
 [b]:{id:b,email:'private-b@example.invalid',user_metadata:{aim_username:'PrivateB'}}};
window.__qaVerifyAccountCalls=0;
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>{
  ++window.__qaVerifyAccountCalls;
  const id=JSON.parse(localStorage.getItem(authKey)||'null')?.user?.id;
  if(id===b)return new Promise(resolve=>{window.__qaAllowSwitchToB=()=>resolve({data:{user:people[b]},error:null})});
  return {data:{user:people[id]||null},error:null};
 },
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=async()=>({synced:true});`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await expect(page.locator('#user-email')).toHaveText('private-a@example.invalid');
 await page.evaluate(({authKey,token})=>{
  localStorage.setItem(authKey,token);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:token}));
 },{authKey,token:mk(b)});
 // The previous account's identity must disappear BEFORE B's auth check resolves.
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await expect(page.locator('#user-email')).toBeEmpty();
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaAllowSwitchToB)).toBe('function');
 await page.evaluate(()=>window.__qaAllowSwitchToB());
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await expect(page.locator('#user-email')).toHaveText('private-b@example.invalid');
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBe(b);
 // Refreshing the same verified account's access token must not hide its view.
 await page.evaluate(({authKey,token})=>{
  localStorage.setItem(authKey,token);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:token}));
 },{authKey,token:JSON.stringify({user:{id:b},access_token:'qa-b-refreshed'})});
 await expect(page.locator('#user-email')).toHaveText('private-b@example.invalid');
 await expect(page.locator('#dashboard-panel')).toBeVisible();
});

test('Cloud portal starts B sync while a previous account A sync is unresolved',async({page})=>{
 const a='11111111-1111-4111-8111-111111111111';
 const b='22222222-2222-4222-8222-222222222222';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 const mk=id=>JSON.stringify({user:{id},access_token:'qa-'+id});
 await page.addInitScript(({a,authKey})=>
  localStorage.setItem(authKey,JSON.stringify({user:{id:a},access_token:'qa-'+a})),{a,authKey});
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const users={[a]:{id:a,email:'private-a@example.invalid',user_metadata:{aim_username:'PrivateA'}},
 [b]:{id:b,email:'private-b@example.invalid',user_metadata:{aim_username:'PrivateB'}}};
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>({data:{user:users[JSON.parse(localStorage.getItem(authKey)||'null')?.user?.id]||null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
window.__qaAccountSyncCalls=[];
export const synchronize=(_client,uid)=>{
 window.__qaAccountSyncCalls.push(uid);
 if(uid==='11111111-1111-4111-8111-111111111111')
  return new Promise(resolve=>{window.__qaFinishOldCloud=()=>resolve({synced:true})});
 return Promise.resolve({synced:true});
};`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.__qaAccountSyncCalls?.includes('11111111-1111-4111-8111-111111111111'))).toBe(true);
 await page.evaluate(({authKey,token})=>{
  localStorage.setItem(authKey,token);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:token}));
 },{authKey,token:mk(b)});
 await expect(page.locator('#user-email')).toHaveText('private-b@example.invalid');
 await expect.poll(()=>page.evaluate(()=>window.__qaAccountSyncCalls?.includes('22222222-2222-4222-8222-222222222222'))).toBe(true);
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await page.evaluate(()=>window.__qaFinishOldCloud());
 await expect(page.locator('#user-email')).toHaveText('private-b@example.invalid');
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBe(b);
});


test('Cloud portal rejects bootstrap account A after a token switches to B before any user is shown',async({page})=>{
 const a='11111111-1111-4111-8111-111111111111';
 const b='22222222-2222-4222-8222-222222222222';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 await page.addInitScript(({a,authKey})=>{
  localStorage.setItem(authKey,JSON.stringify({user:{id:a},access_token:'qa-a'}));
 },{a,authKey});
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const people={[a]:{id:a,email:'stale-private-a@example.invalid',user_metadata:{aim_username:'PrivateA'}},
 [b]:{id:b,email:'private-b@example.invalid',user_metadata:{aim_username:'PrivateB'}}};
let calls=0;
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:()=>new Promise(resolve=>{
  if(++calls===1)window.__qaReleaseStaleBootstrap=()=>resolve({data:{user:people[a]},error:null});
  else window.__qaReleaseCurrentB=()=>resolve({data:{user:people[b]},error:null});
 }),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=async()=>({synced:true});`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseStaleBootstrap)).toBe('function');
 // The Auth token changes while bootstrap getUser(A) is still unresolved,
 // and no account has yet been painted on the screen.
 await page.evaluate(({authKey,b})=>{
  const next=JSON.stringify({user:{id:b},access_token:'qa-b'});
  localStorage.setItem(authKey,next);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:next}));
 },{authKey,b});
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseCurrentB)).toBe('function');
 await page.evaluate(()=>window.__qaReleaseStaleBootstrap());
 // A's late response must not be allowed to render before B is verified.
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 // A signed-out first paint may show the neutral '—' placeholder.
 // The security property is that no previous account email was exposed.
 await expect(page.locator('#user-email')).not.toContainText('stale-private-a@example.invalid');
 await expect(page.locator('#user-email')).toHaveText('—');
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
 await page.evaluate(()=>window.__qaReleaseCurrentB());
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await expect(page.locator('#user-email')).toHaveText('private-b@example.invalid');
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBe(b);
});


test('Cloud portal rejects a verified but stale account A response while the token belongs to B',async({page})=>{
 const a='11111111-1111-4111-8111-111111111111';
 const b='22222222-2222-4222-8222-222222222222';
 const authKey='sb-lmzswtzboobpokumxzhy-auth-token';
 await page.addInitScript(({a,authKey})=>
  localStorage.setItem(authKey,JSON.stringify({user:{id:a},access_token:'qa-a'})),{a,authKey});
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const people={[a]:{id:a,email:'private-old-a@example.invalid',user_metadata:{aim_username:'PrivateA'}},
 [b]:{id:b,email:'private-current-b@example.invalid',user_metadata:{aim_username:'PrivateB'}}};
window.__qaAuthChecks=0;
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>{
  window.__qaAuthChecks++;
  // Simulate the SDK initially answering from its previous account A session
  // even after the separate browser tab has stored B's token.
  const returned=window.__qaAuthChecks<=2?a:b;
  return {data:{user:people[returned]},error:null};
 },
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=async()=>({synced:true});`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#user-email')).toHaveText('private-old-a@example.invalid');
 const bToken=JSON.stringify({user:{id:b},access_token:'qa-b'});
 await page.evaluate(({authKey,bToken})=>{
  localStorage.setItem(authKey,bToken);
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:bToken}));
 },{authKey,bToken});
 await expect.poll(()=>page.evaluate(()=>window.__qaAuthChecks)).toBe(2);
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await expect(page.locator('#user-email')).toBeEmpty();
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBeNull();
 // A subsequent legitimate B verification must restore B without A flashing.
 await page.evaluate(({authKey,bToken})=>
  window.dispatchEvent(new StorageEvent('storage',{key:authKey,newValue:bToken})),{authKey,bToken});
 await expect.poll(()=>page.evaluate(()=>window.__qaAuthChecks)).toBe(3);
 await expect(page.locator('#user-email')).toHaveText('private-current-b@example.invalid');
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('aimroutine_cloud_current_uid'))).toBe(b);
});


test('Cloud portal clears hidden deletion password and confirmation on global logout',async({page})=>{
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const user={id:'11111111-1111-4111-8111-111111111111',
 email:'private-account@example.invalid',user_metadata:{aim_username:'PrivateA'},
 app_metadata:{provider:'email',providers:['email']}};
let active=user,notify=null;
window.__qaGlobalLogoutCount=0;
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>({data:{user:active},error:null}),
 signOut:async({scope})=>{
  if(scope==='global')window.__qaGlobalLogoutCount++;
  active=null;notify?.('SIGNED_OUT',null);return {error:null};
 },
 onAuthStateChange:callback=>{notify=callback;return {data:{subscription:{unsubscribe(){}}}};}
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=async()=>({synced:true});`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await page.locator('.ar7-delete-account summary').click();
 await expect(page.locator('#delete-password-row')).toBeVisible();
 await expect(page.locator('#delete-account-final')).toBeDisabled();
 await page.locator('#delete-account-password').fill('Private-Old-Password_2026!');
 await expect(page.locator('#delete-account-final')).toBeDisabled();
 await page.locator('#delete-account-confirmation').fill('SUPPRIMEE');
 await expect(page.locator('#delete-account-final')).toBeDisabled();
 await page.locator('#delete-account-confirmation').fill('SUPPRIMER');
 await expect(page.locator('#delete-account-final')).toBeEnabled();
 await page.evaluate(()=>{
  document.querySelector('#login-password').value='OldLoginSecret';
  document.querySelector('#signup-password').value='OldSignupSecret';
  document.querySelector('#new-password').value='OldRecoverySecret';
  document.querySelector('#username-input').value='OldNickname';
 });
 await page.locator('#logout').click();
 await expect.poll(()=>page.evaluate(()=>window.__qaGlobalLogoutCount)).toBe(1);
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await expect(page.locator('#user-email')).toBeEmpty();
 await expect(page.locator('.ar7-delete-account')).not.toHaveAttribute('open');
 for(const id of ['login-password','signup-password','new-password',
  'delete-account-password','delete-account-confirmation','username-input']){
  expect(await page.locator('#'+id).inputValue(),id).toBe('');
 }
 await expect(page.locator('#delete-account-final')).toBeDisabled();
});

test('Cloud portal clears previous account form values on direct SDK account switch',async({page})=>{
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const people={[a]:{id:a,email:'private-a@example.invalid',user_metadata:{aim_username:'PrivateA'}},
 [b]:{id:b,email:'private-b@example.invalid',user_metadata:{aim_username:'PrivateB'}}};
let current=people[a],notify=null;
window.__qaSwitchAccountDirectly=()=>{current=people[b];notify?.('SIGNED_IN',{user:current})};
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>({data:{user:current},error:null}),
 onAuthStateChange:callback=>{notify=callback;return {data:{subscription:{unsubscribe(){}}}};}
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=async()=>({synced:true});`
 }));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#user-email')).toHaveText('private-a@example.invalid');
 await page.locator('.ar7-delete-account summary').click();
 await page.locator('#delete-account-password').fill('OldAccountSecret!');
 await page.locator('#delete-account-confirmation').fill('SUPPRIMER');
 await page.evaluate(()=>window.__qaSwitchAccountDirectly());
 await expect(page.locator('#user-email')).toHaveText('private-b@example.invalid');
 await expect(page.locator('#delete-account-password')).toHaveValue('');
 await expect(page.locator('#delete-account-confirmation')).toHaveValue('');
 await expect(page.locator('.ar7-delete-account')).not.toHaveAttribute('open');
 await expect(page.locator('#dashboard-panel')).toBeVisible();
});


test('Offline private comparator verifies SHA-256 and computes the real RGB pixel differences',async({page})=>{
 await page.goto('/tests/private-visual-review-v3.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#home-compare')).toBeVisible();
 await expect(page.locator('#report')).toBeDisabled();
 const sourceHash=await page.evaluate(async()=>{
  const create=async(color)=>{
   const canvas=document.createElement('canvas');
   canvas.width=1672;canvas.height=941;
   const ctx=canvas.getContext('2d');
   ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);
   return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  };
  const original=await create('#101010'),candidate=await create('#131313');
  const bytes=await original.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const attach=(id,blob)=>{
   const transfer=new DataTransfer();
   transfer.items.add(new File([blob],id+'.png',{type:'image/png'}));
   document.getElementById(id).files=transfer.files;
  };
  attach('home-ref',original);attach('home-out',candidate);
  return hash;
 });
 // The immutable production hash must reject an unrelated synthetic image.
 await page.locator('#home-compare').click();
 await expect(page.locator('#home-status')).toContainText('SHA-256 de référence différent');
 await expect(page.locator('#home-save')).toBeDisabled();
 // Test-only substitution: validate the actual comparison algorithm using a
 // correctly signed synthetic reference without changing the repo manifest.
 await page.evaluate(hash=>{CONFIG.find(x=>x.id==='home').sha=hash},sourceHash);
 await page.locator('#home-compare').click();
 await expect(page.locator('#home-status')).toContainText('Empreinte SHA-256 originale vérifiée');
 await expect(page.locator('#home-status')).not.toHaveClass(/bad/);
 await expect(page.locator('#home-metrics')).toContainText('MAE RGB : 3');
 const metrics=await page.evaluate(()=>results.home);
 expect(metrics.reference_sha256).toBe(sourceHash);
 expect(metrics.rgb_mae_0_to_255).toBe(3);
 expect(metrics.different_pixel_percent).toBe(100);
 expect(Object.values(metrics.regional_rgb_mae).every(v=>v===3)).toBe(true);
 expect(metrics.visually_identical).toBe(false);
 await expect(page.locator('#report')).toBeDisabled(); // All four are mandatory.
 await page.locator('#home-mode').selectOption('diff');
 const pixels=await page.evaluate(()=>{
  const c=document.getElementById('home-canvas').getContext('2d');
  return [...c.getImageData(100,100,1,1).data];
 });
 expect(pixels).toEqual([12,12,12,255]); // Real abs difference ×4.
 const downloading=page.waitForEvent('download');
 await page.locator('#home-save').click();
 const exportFile=await downloading;
 expect(exportFile.suggestedFilename()).toBe('home-private-diff.png');
 // A different file selection invalidates any previous green report instantly.
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');
  canvas.width=1672;canvas.height=941;
  canvas.getContext('2d').fillStyle='#777777';
  canvas.getContext('2d').fillRect(0,0,1672,941);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  const transfer=new DataTransfer();
  transfer.items.add(new File([blob],'replaced.png',{type:'image/png'}));
  const input=document.getElementById('home-out');
  input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await expect(page.locator('#home-status')).toContainText('Fichiers modifiés');
 await expect(page.locator('#home-metrics')).toBeEmpty();
 await expect(page.locator('#home-save')).toBeDisabled();
 await expect(page.locator('#report')).toBeDisabled();
 expect(await page.evaluate(()=>results.home)).toBeUndefined();
});

test('Offline comparator rejects invalid PNG dimensions before producing metrics',async({page})=>{
 await page.goto('/tests/private-visual-review-v3.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');
  canvas.width=800;canvas.height=600;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  const digest=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  CONFIG[0].sha=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  for(const selector of ['home-ref','home-out']){
   const dt=new DataTransfer();
   dt.items.add(new File([blob],'wrong-size.png',{type:'image/png'}));
   document.getElementById(selector).files=dt.files;
  }
 });
 await page.locator('#home-compare').click();
 await expect(page.locator('#home-status')).toContainText('Dimensions incorrectes');
 await expect(page.locator('#home-save')).toBeDisabled();
 await expect(page.locator('#report')).toBeDisabled();
});


test('Offline comparator rejects a stale SHA result after the PNG is replaced mid-comparison',async({page})=>{
 await page.goto('/tests/private-visual-review-v3.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  const make=async(color)=>{
   const canvas=document.createElement('canvas');
   canvas.width=1672;canvas.height=941;
   const ctx=canvas.getContext('2d');
   ctx.fillStyle=color;ctx.fillRect(0,0,1672,941);
   return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  };
  const ref=await make('#101010');
  const old=await make('#131313'),next=await make('#202020');
  const subt=crypto.subtle;
  const native=subt.digest.bind(subt);
  const hash=await native('SHA-256',await ref.arrayBuffer());
  CONFIG[0].sha=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  window.__qaNextPicture=next;
  const put=(selector,blob)=>{
   const dt=new DataTransfer();
   dt.items.add(new File([blob],selector+'.png',{type:'image/png'}));
   const input=document.getElementById(selector);
   input.files=dt.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  put('home-ref',ref);put('home-out',old);
  let count=0;
  Object.defineProperty(subt,'digest',{configurable:true,value:async(...args)=>{
   if(++count===1){
    return await new Promise(resolve=>{
     window.__qaReleaseOldDigest=()=>native(...args).then(resolve);
    });
   }
   return native(...args);
  }});
  window.__qaReplacePicture=()=>put('home-out',window.__qaNextPicture);
 });
 await page.locator('#home-compare').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseOldDigest)).toBe('function');
 // The previous analysis has not finished; a user replaces its input image.
 await page.evaluate(()=>window.__qaReplacePicture());
 await expect(page.locator('#home-status')).toContainText('Fichiers modifiés');
 await expect(page.locator('#home-save')).toBeDisabled();
 // A fresh run must use the *new* candidate without awaiting the old one.
 await page.locator('#home-compare').click();
 await expect(page.locator('#home-metrics')).toContainText('MAE RGB : 16');
 expect(await page.evaluate(()=>results.home?.rgb_mae_0_to_255)).toBe(16);
 // The old SHA response now arrives, but it must not overwrite new results.
 await page.evaluate(()=>window.__qaReleaseOldDigest());
 await expect(page.locator('#home-metrics')).toContainText('MAE RGB : 16');
 await expect(page.locator('#home-status')).toContainText('Empreinte SHA-256 originale vérifiée');
 await expect(page.locator('#home-save')).toBeEnabled();
 expect(await page.evaluate(()=>results.home?.rgb_mae_0_to_255)).toBe(16);
});


test('Password reset confirmation survives a late USER_UPDATED identity callback',async({page})=>{
 await page.route('**/cloud-client-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`const current={id:'44444444-4444-4444-8444-444444444444',
 email:'recovery-ui@example.invalid',user_metadata:{}};
let verified=false,notify=null;
window.__qaRecoveryPasswordUpdates=0;
window.__qaRecoveryUserChecks=0;
window.__qaSendDelayedUserUpdated=()=>notify?.('USER_UPDATED',{user:current});
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>{
  ++window.__qaRecoveryUserChecks;
  return {data:{user:verified?current:null},error:null};
 },
 updateUser:async(input)=>{
  if(input.password!=='Aa1!bcde')throw Error('Unexpected password');
  verified=true;
  ++window.__qaRecoveryPasswordUpdates;
  return {data:{user:current},error:null};
 },
 onAuthStateChange:callback=>{
  notify=callback;
  queueMicrotask(()=>callback('PASSWORD_RECOVERY',{user:current}));
  return {data:{subscription:{unsubscribe(){}}}};
 }
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:`export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const deleteCloudProgress=async()=>true;
export const synchronize=async()=>({synced:true});`
 }));
 await page.route('https://api.pwnedpasswords.com/range/**',route=>
  route.fulfill({status:200,contentType:'text/plain',body:''}));
 await page.goto('/account.html?reset=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#new-password-form')).toBeVisible();
 await page.locator('#new-password').fill('Aa1!bcde');
 await page.locator('#new-password-form button[type="submit"]').click();
 await expect(page.locator('#account-status')).toContainText('Mot de passe mis à jour');
 await expect.poll(()=>page.evaluate(()=>window.__qaRecoveryPasswordUpdates)).toBe(1);
 await page.evaluate(()=>window.__qaSendDelayedUserUpdated());
 await expect.poll(()=>page.evaluate(()=>window.__qaRecoveryUserChecks)).toBeGreaterThan(1);
 await expect(page.locator('#user-email')).toHaveText('recovery-ui@example.invalid');
 await expect(page.locator('#username-panel')).toBeVisible();
 // A delayed Auth refresh must not falsely replace the completed recovery
 // with a generic nickname-onboarding status.
 await expect(page.locator('#account-status')).toContainText('Mot de passe mis à jour');
 await expect(page.locator('#account-status')).toContainText('Choisis ton pseudo');
});


test('Offline comparator exports a verified four-screen report only after all four analyses',async({page})=>{
 test.setTimeout(60000);
 await page.goto('/tests/private-visual-review-v3.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  const pixels=async(color)=>{
   const canvas=document.createElement('canvas');
   canvas.width=1672;canvas.height=941;
   const ctx=canvas.getContext('2d');
   ctx.fillStyle=color;ctx.fillRect(0,0,1672,941);
   return new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  };
  const ref=await pixels('#101010');
  const digest=await crypto.subtle.digest('SHA-256',await ref.arrayBuffer());
  const sha=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const pages=['home','routines','progress','account'];
  window.__qaCaptureHashes={};
  for(const [index,id] of pages.entries()){
   CONFIG.find(entry=>entry.id===id).sha=sha;
   const output=await pixels('#'+(20+index*4).toString(16).padStart(2,'0').repeat(3));
   const candidateHash=await crypto.subtle.digest('SHA-256',await output.arrayBuffer());
   window.__qaCaptureHashes[id]=Array.from(new Uint8Array(candidateHash),n=>n.toString(16).padStart(2,'0')).join('');
   for(const [suffix,blob] of [['ref',ref],['out',output]]){
    const picker=document.getElementById(id+'-'+suffix),transfer=new DataTransfer();
    transfer.items.add(new File([blob],id+'-'+suffix+'.png',{type:'image/png'}));
    picker.files=transfer.files;
    picker.dispatchEvent(new Event('change',{bubbles:true}));
   }
  }
 });
 const expected={home:4,routines:8,progress:12,account:16};
 await expect(page.locator('#report')).toBeDisabled();
 for(const [id,mae] of Object.entries(expected)){
  await page.locator('#'+id+'-compare').click();
  await expect(page.locator('#'+id+'-status')).toContainText('Empreinte SHA-256 originale vérifiée');
  await expect(page.locator('#'+id+'-metrics')).toContainText('MAE RGB : '+mae);
  expect(await page.evaluate(name=>results[name].rgb_mae_0_to_255,id)).toBe(mae);
  if(id!=='account')await expect(page.locator('#report')).toBeDisabled();
 }
 await expect(page.locator('#report')).toBeEnabled();
 const event=page.waitForEvent('download');
 await page.locator('#report').click();
 const result=await event;
 expect(result.suggestedFilename()).toBe('aimroutine-v3-private-diff-report.json');
 const {readFile}=await import('node:fs/promises');
 const report=JSON.parse(await readFile(await result.path(),'utf8'));
 expect(report.viewport).toEqual({width:1672,height:941});
 expect(report.scenes.map(x=>x.screen)).toEqual(['home','routines','progress','account']);
 expect(report.scenes.map(x=>x.rgb_mae_0_to_255)).toEqual([4,8,12,16]);
 expect(report.scenes.every(x=>x.reference_verified===true)).toBe(true);
 const expectedHashes=await page.evaluate(()=>window.__qaCaptureHashes);
 for(const scene of report.scenes){
  expect(scene.reference_sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(scene.capture_sha256,scene.screen).toBe(expectedHashes[scene.screen]);
  expect(scene.capture_file).toBe(scene.screen+'-out.png');
  expect(scene.reference_file).toBe(scene.screen+'-ref.png');
 }
 expect(new Set(report.scenes.map(x=>x.capture_sha256)).size).toBe(4);
 // Change any one file after the report: no obsolete JSON can be exported.
 await page.evaluate(()=>{
  const input=document.getElementById('progress-out');
  const dt=new DataTransfer();
  dt.items.add(new File(['invalid-png'],'changed.png',{type:'image/png'}));
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await expect(page.locator('#report')).toBeDisabled();
 expect(await page.evaluate(()=>results.progress)).toBeUndefined();
});


test('V3 four original desktop pages align their first content panels vertically',async({page})=>{
 const scenes=[
  // Baseline Home already matched the original rail and first-card positions.
  {url:'/index.html',hero:350,anchor:'.r17-home-wrap .r17-features',target:502},
  {url:'/training.html',hero:250,anchor:'.r17-training-wrap .r17-training-grid',target:320},
  {url:'/progress.html',hero:206,anchor:'.r17-progress-wrap .r17-chart-grid',target:338},
  {url:'/account.html',hero:246,anchor:'.r17-account-wrap .r17-account-profile',target:301}
 ];
 await page.setViewportSize({width:1672,height:941});
 for(const scene of scenes){
  await page.goto(scene.url,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>document.body.classList.contains('r20'))).toBe(true);
  await page.evaluate(()=>document.fonts.ready);
  const hero=page.locator('.r17-hero').first();
  await expect(hero).toBeVisible();
  await expect(page.locator(scene.anchor)).toBeVisible();
  const heroBox=await hero.boundingBox(),panelBox=await page.locator(scene.anchor).boundingBox();
  expect(heroBox.height,scene.url+' hero height').toBe(scene.hero);
  // Pixel registration is geometric only. Charts and account figures must
  // always remain genuine data, not the synthetic values in reference images.
  expect(Math.abs(panelBox.y-scene.target),scene.url+' first panel y').toBeLessThanOrEqual(15);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1675);
 }
 // Non-reference small devices must still render without horizontal overflow.
 await page.setViewportSize({width:390,height:850});
 for(const url of ['/index.html','/training.html','/progress.html','/account.html']){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),url).toBeLessThanOrEqual(393);
 }
});


test('Cloud deletion finishing after A-to-B switch cannot change B settings or claim B was deleted',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const a={id:'11111111-1111-4111-8111-111111111111',email:'account-a@example.invalid',user_metadata:{aim_username:'Alpha'}};
const b={id:'22222222-2222-4222-8222-222222222222',email:'account-b@example.invalid',user_metadata:{aim_username:'Bravo'}};
let current=a,callback=null;
window.__qaSetAccountB=()=>{current=b;callback?.('SIGNED_IN',{user:b})};
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>({data:{user:current},error:null}),
 onAuthStateChange:fn=>{callback=fn;return{data:{subscription:{unsubscribe(){}}}}}
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`window.__qaCloudPreferences=[];
window.__qaCloudDeleteUid=null;
export const isEnabled=()=>true;
export const setEnabled=(uid,value)=>window.__qaCloudPreferences.push({uid,value});
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=()=>({sessions:0,favorites:0});
export const synchronize=async()=>({synced:true,downloadedSessions:0,downloadedFavorites:0});
export const deleteCloudProgress=(client,uid)=>{
 window.__qaCloudDeleteUid=uid;
 return new Promise(resolve=>{window.__qaReleaseCloudDelete=()=>resolve(true)});
};`
 }));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#user-email')).toHaveText('account-a@example.invalid');
 await page.locator('#cloud-delete').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseCloudDelete)).toBe('function');
 expect(await page.evaluate(()=>window.__qaCloudDeleteUid))
  .toBe('11111111-1111-4111-8111-111111111111');
 await page.evaluate(()=>window.__qaSetAccountB());
 await expect(page.locator('#user-email')).toHaveText('account-b@example.invalid');
 await page.evaluate(()=>window.__qaReleaseCloudDelete());
 await expect(page.locator('#cloud-delete')).toBeEnabled();
 await expect(page.locator('#user-email')).toHaveText('account-b@example.invalid');
 await expect(page.locator('#account-status')).not.toContainText('Progression cloud supprimée');
 expect(await page.evaluate(()=>window.__qaCloudPreferences)).toEqual([]);
 expect(errors).toEqual([]);
});

test('Guest import started for A cannot display a completion banner on account B',async({page})=>{
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/cloud-client-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`const a={id:'11111111-1111-4111-8111-111111111111',email:'import-a@example.invalid',user_metadata:{aim_username:'Alpha'}};
const b={id:'22222222-2222-4222-8222-222222222222',email:'import-b@example.invalid',user_metadata:{aim_username:'Bravo'}};
let current=a,callback=null;
window.__qaSwitchB=()=>{current=b;callback?.('SIGNED_IN',{user:b})};
export const SITE_URL='https://aimroutine-tracker.github.io/';
export const supabase={auth:{
 getUser:async()=>({data:{user:current},error:null}),
 onAuthStateChange:fn=>{callback=fn;return{data:{subscription:{unsubscribe(){}}}}}
}};`
 }));
 await page.route('**/cloud-sync-v7.mjs*',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:`window.__qaImportedUid=null;
export const isEnabled=()=>true;
export const setEnabled=()=>{};
export const readUserLocal=()=>({store:{sessions:[],presets:[],weeklyGoal:3}});
export const importGuestIntoAccount=uid=>{window.__qaImportedUid=uid;return {sessions:1,favorites:0}};
export const deleteCloudProgress=async()=>true;
export const synchronize=(client,uid,options={})=>{
 if(options.guestImport)return new Promise(resolve=>{
  window.__qaReleaseGuestImport=()=>resolve({synced:true,downloadedSessions:1,downloadedFavorites:0});
 });
 return Promise.resolve({synced:true,downloadedSessions:0,downloadedFavorites:0});
};`
 }));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#user-email')).toHaveText('import-a@example.invalid');
 await page.locator('#cloud-import-guest').click();
 await expect.poll(()=>page.evaluate(()=>typeof window.__qaReleaseGuestImport)).toBe('function');
 expect(await page.evaluate(()=>window.__qaImportedUid))
  .toBe('11111111-1111-4111-8111-111111111111');
 await page.evaluate(()=>window.__qaSwitchB());
 await expect(page.locator('#user-email')).toHaveText('import-b@example.invalid');
 await page.evaluate(()=>window.__qaReleaseGuestImport());
 await expect(page.locator('#cloud-import-guest')).toBeEnabled();
 await expect(page.locator('#user-email')).toHaveText('import-b@example.invalid');
 await expect(page.locator('#account-status')).not.toContainText('Import réalisé');
 expect(errors).toEqual([]);
});
