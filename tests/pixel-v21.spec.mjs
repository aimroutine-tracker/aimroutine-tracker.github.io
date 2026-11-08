import {test,expect} from '@playwright/test';

// All production backend engines remain enabled; visual V21 is opt-in on this
// validation branch. Never use real accounts or artificially populate metrics.
const routes=['index','training','account','progress'];

test('Four reference pages display true interactive DOM instead of a screenshot overlay',async({page})=>{
 for(const route of routes){
  await page.goto(`/${route}.html?ar21=preview`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#ar21-app')).toBeVisible();
  await expect(page.locator('.ar21-header .ar21-brand')).toBeVisible();
  await expect(page.locator('.ar21-hero h1')).toBeVisible();
  await expect(page.locator('.ar21-hero-image')).toHaveCSS('background-image',/\.webp/);
  await expect(page.locator('#ar21-app img[src$="aimroutine-brand-a-v2.svg"]')).toHaveCount(1);
 }
});

test('Routine day and difficulty controls update the real four-exercise plan',async({page})=>{
 await page.goto('/training.html?ar21=preview',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-exercises .ar21-exercise')).toHaveCount(4);
 await page.locator('[data-ar-day="2"]').click();
 await expect(page.locator('#ar21-day-title')).toContainText('Micro-correction');
 await page.locator('[data-ar-rank="immortal"]').click();
 await expect(page.locator('#ar21-plan-name')).toContainText('Compétitif');
 await page.locator('.ar21-exercise button').first().click();
 await expect(page.locator('#ar21-native-dialog')).toBeVisible();
 await expect(page.locator('#builder-form')).toBeVisible();
 await expect(page.locator('#routine-output')).toBeVisible();
 const plan=await page.evaluate(()=>window.AIMWeb?.getPlan());
 expect(plan?.exercises?.length).toBe(4);
 await page.locator('[data-ar-native-close]').click();
 await expect(page.locator('#ar21-native-dialog')).toBeHidden();
});

test('Account visual is connected to actual signup and sign-in controls',async({page})=>{
 await page.goto('/account.html?ar21=preview',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-native-auth #auth-panel')).toBeVisible();
 await expect(page.locator('#login-form')).toBeVisible();
 await page.locator('#ar21-open-signup').click();
 await expect(page.locator('#signup-form')).toBeVisible();
 await expect(page.locator('#signup-username')).toBeVisible();
 await expect(page.locator('#google-signin')).toBeVisible();
 await expect(page.locator('#ar21-sync-state')).toHaveText('Connexion requise');
});

test('Progress period drives native analytics; unsupported reaction data is never fabricated',async({page})=>{
 await page.goto('/progress.html?ar21=preview',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-kpi-reaction')).toHaveText('—');
 await page.locator('#ar21-period').selectOption('7');
 await expect(page.locator('#v14-progress-range')).toHaveValue('7');
 await expect(page.locator('#ar21-precision-chart svg')).toBeVisible();
 await expect(page.locator('#ar21-week-bars svg')).toBeVisible();
});

test('Guests cannot save training results; Cloud buttons are not required',async({page})=>{
 await page.goto('/training.html?ar21=preview',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar-account-required')).toBeAttached();
 await expect.poll(()=>page.evaluate(()=>typeof window.AIMWeb?.mergeData),{timeout:15000}).toBe('function');
 const result=await page.evaluate(()=>{
  let denied=false;
  try{window.AIMWeb.mergeData({sessions:[{id:'preview-guest-test',date:new Date().toISOString(),rank:'silver',focus:'flick',minutes:10,accuracy:75,feeling:'good',notes:'',tool:'VALORANT',scenario:'Stand de tir'}],presets:[],weeklyGoal:3})}catch{denied=true}
  return {denied,store:localStorage.getItem('aimroutine_web_training_v2')};
 });
 expect(result).toEqual({denied:true,store:null});
});

// Reproducible before/after captures for each reference, without touching live
// user data or changing the public production site.
test('Capture all four reference comparisons at their exact desktop resolution',async({browser,baseURL,browserName})=>{
 test.skip(browserName!=='chromium','Reference pixel comparison is standardized on Chromium');
 const {mkdirSync}=await import('node:fs');
 mkdirSync('visual-out',{recursive:true});
 const context=await browser.newContext({viewport:{width:1672,height:941},deviceScaleFactor:1,locale:'fr-FR',serviceWorkers:'block'});
 const page=await context.newPage();
 for(const route of routes){
  const file=route==='index'?'index.html':route+'.html';
  await page.goto(`${baseURL}/${file}`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`visual-out/${route}_before.png`});
  await page.goto(`${baseURL}/${file}?ar21=preview`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#ar21-app')).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`visual-out/${route}_after.png`});
 }
 await context.close();
});


test('Preview navigation stays within the four rebuilt screens',async({page})=>{
 await page.goto('/index.html?ar21=preview',{waitUntil:'domcontentloaded'});
 await page.locator('.ar21-nav a').filter({hasText:'Routines'}).click();
 await expect(page).toHaveURL(/training\.html\?ar21=preview/);
 await expect(page.locator('#ar21-app.ar21-training')).toBeVisible();
 await page.locator('.ar21-nav a').filter({hasText:'Suivi de progression'}).click();
 await expect(page).toHaveURL(/progress\.html\?ar21=preview/);
 await expect(page.locator('#ar21-app.ar21-progress')).toBeVisible();
});

test('Account rebuild preserves real sign-in, mandatory username and dashboard states',async({page})=>{
 await page.goto('/account.html?ar21=preview',{waitUntil:'domcontentloaded'});
 for(const id of ['auth-panel','username-panel','dashboard-panel'])
  await expect(page.locator('#ar21-native-auth #'+id)).toBeAttached();
 await expect(page.locator('#auth-panel')).toBeVisible();
 await expect(page.locator('#dashboard-panel')).toBeHidden();
 await page.evaluate(()=>{
  document.getElementById('auth-panel').hidden=true;
  document.getElementById('dashboard-panel').hidden=false;
 });
 await expect(page.locator('#auth-panel')).toBeHidden();
 await expect(page.locator('#dashboard-panel')).toBeVisible();
 await expect(page.locator('#ar21-sync-state')).toHaveText('Automatique');
});
