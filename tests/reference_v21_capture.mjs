import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const folder=process.env.ARTIFACT_DIR||'reference-v21-output';
fs.mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const pageMap=[['index','home'],['training','routines'],['account','account'],['progress','progress']];
let report={captured_at:new Date().toISOString(),pages:{}};
for(const [pageName,reference] of pageMap){
 for(const [version,port] of [['before','8766'],['after','8765']]){
  const page=await browser.newPage({viewport:{width:1672,height:941},deviceScaleFactor:1,locale:'fr-FR',reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/${pageName}.html`,{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForTimeout(2700);
  await page.screenshot({path:path.join(folder,`${reference}-${version}.png`),fullPage:false,animations:'disabled'});
  report.pages[reference]??={};
  report.pages[reference][version]={errors,visibleHero:await page.locator('.a21-hero').isVisible().catch(()=>false),title:await page.title(),viewport:[1672,941]};
  await page.close();
 }
}
fs.writeFileSync(path.join(folder,'capture-log.json'),JSON.stringify(report,null,2));
await browser.close();