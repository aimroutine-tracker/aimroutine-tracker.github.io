/* AimRoutine V3 — lossless visual proof for home CSS bundling.
   Never uses fake profile stats. Static homepage is loaded once, then only the
   stylesheet links are swapped. Exact above-fold PNG bytes must remain equal. */
import {chromium} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const bundles=Array.from({length:5},(_,i)=>'site-home-bundle-v1-'+(i+1)+'.css');
const sources=[];
for(const file of bundles){
 const css=await readFile(file,'utf8');
 const names=[...css.matchAll(/\/\* BEGIN ([^*]+?) \*\//g)].map(x=>x[1]);
 if(!names.length)throw Error('No source names in '+file);
 sources.push(...names);
}
if(sources.length!==26)throw Error('Incorrect source count '+sources.length);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [width,height] of [[1672,941],[390,844]]){
  const context=await browser.newContext({
   viewport:{width,height},deviceScaleFactor:1,
   locale:'fr-FR',colorScheme:'dark',reducedMotion:'reduce',
   serviceWorkers:'block'
  });
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8765/index.html',
   {waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>document.body?.classList.contains('r20'),
   null,{timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.addStyleTag({content:
   '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}'});
  // Freeze time-dependent UI once the site initialized.
  await page.clock.pauseAt(new Date('2026-11-14T12:00:00.000Z'));
  const output='visual-results/css-parity';
  await mkdir(output,{recursive:true});
  const withBundles=await page.screenshot({
   path:output+'/home-'+width+'-bundled.png',animations:'disabled'
  });
  const modified=await page.evaluate(async originalSources=>{
   const active=[...document.querySelectorAll('link[rel="stylesheet"]')]
    .filter(n=>/^site-home-bundle-v1-[1-5]\.css/.test(n.getAttribute('href')||''));
   if(active.length!==5)throw Error('Expected five active home bundles');
   const first=active[0];
   const loaded=originalSources.map(name=>new Promise((resolve,reject)=>{
    const link=document.createElement('link');
    link.rel='stylesheet';link.href=name;
    link.onload=resolve;
    link.onerror=()=>reject(Error('Stylesheet failed to load: '+name));
    first.parentNode.insertBefore(link,first);
   }));
   await Promise.all(loaded);
   active.forEach(link=>link.remove());
   return originalSources.length;
  },sources);
  if(modified!==26)throw Error('Could not restore 26 CSS sources');
  await page.evaluate(()=>document.fonts.ready);
  const original=await page.screenshot({
   path:output+'/home-'+width+'-original.png',animations:'disabled'
  });
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(!withBundles.equals(original)){
   throw Error('Home CSS changed viewport pixels at '+width+'x'+height+
    '; bundled SHA256 '+hash(withBundles)+
    ' original SHA256 '+hash(original)+
    ' (see screenshots in visual-results/css-parity)');
  }
  console.log('PASS: home '+width+'x'+height+
   ' original 26 stylesheets and 5 lossless bundles render pixel-identically.');
  await context.close();
 }
} finally {
 await browser.close();
}
