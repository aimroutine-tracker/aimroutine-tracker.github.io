import {test,expect} from '@playwright/test';
test.beforeEach(async ({page})=>{
 await page.route('https://cmsassets.rgpub.io/**',route=>route.abort());
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
test('Offline training works after initial install',async ({page,context,browserName})=>{
 test.skip(browserName!=='chromium','Offline service worker tested on Chromium; other engines checked for rendering');
 await page.evaluate(async()=>{if(!('serviceWorker'in navigator))throw Error('No service workers');await navigator.serviceWorker.ready});
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#tab-dashboard')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>Boolean(window.AIMWeb))).toBe(true);
 await context.setOffline(false);
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

test('Google OAuth beta button is enabled but public email signup stays gated',async({page})=>{
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#google-login-wrap')).toBeVisible();
 await expect(page.locator('#google-signin')).toBeEnabled();
 await page.locator('#signup-mode').click();
 await expect(page.locator('#signup-submit')).toBeDisabled();
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
 }
 expect(jsErrors).toEqual([]);
});

test('Privacy and account pages describe the real Google self-deletion path',async({page})=>{
 await page.goto('/privacy.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('main')).toContainText('SUPPRIMER');
 await expect(page.locator('main')).toContainText('Supabase');
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#delete-account-confirmation')).toHaveAttribute('pattern','SUPPRIMER');
 await expect(page.locator('#google-delete-reauth')).toHaveCount(0);
 await expect(page.locator('#signup-submit')).toBeDisabled();
});
