import {test,expect} from '@playwright/test';

/* Integration checks for the four genuinely reconstructed pages.
   Native training and auth suites run separately in browser.spec.mjs. */
test.beforeEach(async({page})=>{
 await page.route('https://cmsassets.rgpub.io/**',route=>route.abort());
 await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>route.fulfill({
   status:200,contentType:'application/javascript',
   body:"window.turnstile={render(element,options){element.dataset.rendered='yes';options.callback('test-captcha-token');return 42},reset(){}}"
 }));
});

test('V21 accueil reproduit la navigation et ouvre le vrai mini-défi',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-root .a21-hero h1')).toContainText('Routine AIM');
 await expect(page.locator('.a21-brand img')).toHaveAttribute('src','aimroutine-brand-a-v2.svg');
 await expect(page.locator('[data-a21-home="sessions"]')).not.toContainText('12 846');
 await expect(page.locator('.a21-community-preview')).toBeAttached();
 await page.locator('#ar21-root a[href="#aim-challenge"]').first().click();
 await expect(page.locator('dialog.a21-modal')).toBeVisible();
 await expect(page.locator('dialog.a21-modal #aim-challenge')).toBeVisible();
 await page.locator('dialog.a21-modal .a21-close').click();
 await expect(page.locator('dialog.a21-modal')).not.toBeVisible();
 expect(errors).toEqual([]);
});

test('V21 routines sélectionne niveau et jour et ouvre le véritable créateur',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('/training.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-root .a21-training')).toBeVisible();
 await expect(page.locator('[data-a21-level]')).toHaveCount(3);
 await page.locator('[data-a21-level="immortal"]').click();
 await expect(page.locator('[data-a21-level-label]')).toContainText('COMPÉTITIF');
 await page.locator('[data-a21-day="2"]').click();
 await expect(page.locator('[data-a21-focus]')).toContainText('Micro-correction');
 await expect(page.locator('.a21-exercise button').first()).toBeVisible();
 await page.locator('.a21-exercise button').first().click();
 await expect(page.locator('dialog.a21-modal')).toBeVisible();
 await expect(page.locator('dialog.a21-modal #builder-form')).toBeVisible();
 await expect(page.locator('#rank')).toHaveValue('immortal');
 await page.locator('dialog.a21-modal .a21-close').click();
 await expect(page.locator('dialog.a21-modal')).not.toBeVisible();
 expect(errors).toEqual([]);
});

test('V21 Cloud réutilise la connexion, Google, CAPTCHA et le formulaire de pseudo',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('/account.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-root .a21-account')).toBeVisible();
 await expect(page.locator('#login-email')).toBeVisible();
 await expect(page.locator('#login-password')).toBeVisible();
 await expect(page.locator('#google-signin')).toBeVisible();
 await expect(page.locator('#captcha-login')).toBeAttached();
 await expect(page.locator('[data-a21-cloud-label]')).toContainText('Non connecté');
 await page.locator('#a21-signup-button').click();
 await expect(page.locator('#signup-form')).toBeVisible();
 await expect(page.locator('#signup-username')).toHaveAttribute('required','');
 expect(errors).toEqual([]);
});

test('V21 filtres statistiques alimentés par le suivi original et non par des données fictives',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.goto('/progress.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-root .a21-progress')).toBeVisible();
 await expect(page.locator('[data-a21-mirror="v14-p-sessions"]')).not.toContainText('128');
 await expect(page.locator('#a21-chart-line')).toBeAttached();
 await page.locator('select[data-a21-progress-range]').selectOption('7');
 await expect(page.locator('#v14-progress-range')).toHaveValue('7');
 expect(errors).toEqual([]);
});

test('V21 navigation mobile et absence de débordement horizontal',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/index.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.a21-menu')).toBeVisible();
 await page.locator('.a21-menu').click();
 await expect(page.locator('.a21-navlinks')).toBeVisible();
 const sizes=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
 expect(sizes.scroll).toBeLessThanOrEqual(sizes.viewport+2);
});

test('V21 inscription depuis navigation active les vrais contrôles Supabase',async({page})=>{
 await page.goto('/account.html?mode=signup#auth-panel',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#ar21-root .a21-account')).toBeVisible();
 await expect(page.locator('#signup-form')).toBeVisible();
 await expect(page.locator('#signup-password')).toHaveAttribute('minlength','8');
});
