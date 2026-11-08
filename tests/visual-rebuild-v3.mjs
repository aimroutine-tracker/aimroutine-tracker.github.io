/* Non-destructive visual evidence runner.
   Captures BOTH deployed-main source code and candidate code locally at 1672x941.
   If exact owner's screenshots are checked into tests/visual-references/*.png,
   downstream compare script also measures fidelity against those references.
   Never use fake sessions, logins, or fabricated metrics. */
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const pages = [
 {id:'home',filename:'index.html',heroHeight:350},
 {id:'routines',filename:'training.html',heroHeight:244},
 {id:'progress',filename:'progress.html',heroHeight:204},
 {id:'account',filename:'account.html',heroHeight:242}
];
const width=1672,height=941;
const out='visual-results';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
let failed=false;
try{
 for(const item of pages){
  for(const [phase,port] of [['before',8765],['after',8766]]){
   const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,
    locale:'fr-FR',colorScheme:'dark',reducedMotion:'reduce',
    serviceWorkers:'block'
   });
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(String(err.message||err)));
   page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
   const url='http://127.0.0.1:'+port+'/'+item.filename;
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForFunction(()=>document.body?.classList.contains('r20'),null,{timeout:30000});
   await page.evaluate(async()=>{await document.fonts.ready;});
   // Wait for actual engines to render. No counters or data are artificially set.
   await page.waitForTimeout(1400);
   await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}'});
   const info=await page.evaluate(()=>{
    const measure=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};};
    return {
     documentWidth:document.documentElement.scrollWidth,
     header:measure('.site31-header'),
     hero:measure('.r17-screen .r17-hero'),
     heroContent:measure('.r17-screen .r17-hero-content'),
     heroHeadline:measure('.r17-screen .r17-hero h1'),
     heroDescription:measure('.r17-screen .r17-hero-desc'),
     heroActions:measure('.r17-screen .r17-hero-actions'),
     previewNotice:measure('#ar-account-required'),
     screen:measure('.r17-screen'),
     title:document.querySelector('.r17-screen .r17-hero h1')?.innerText||'',
     realSessionCount:document.querySelector('[data-v15-stat="sessions"]')?.innerText||null,
    };
   });
   await page.screenshot({path:join(out,item.id+'-'+phase+'.png'),fullPage:false,animations:'disabled'});
   const check={
    name:item.id,phase,httpStatus:response?.status()??null,expectedHeroHeight:item.heroHeight,
    screenshot:join(out,item.id+'-'+phase+'.png'),geometry:info,
    javascriptErrors:errors.slice(0,12),
    viewport:{width,height}
   };
   if(phase==='after'){
    if(!info.hero || !info.screen || !info.header || (response?.status()!==200)){
     failed=true;check.failure='Required app structure or page response missing';
    }
    if(info.documentWidth>width+3){failed=true;check.failure='Horizontal overflow';}
   }
   results.push(check);
   await context.close();
  }
 }
}finally{await browser.close();}
await writeFile(join(out,'measurements.json'),JSON.stringify(results,null,2));
for(const x of results)console.log(x.name,x.phase,'hero',JSON.stringify(x.geometry.hero),'content',JSON.stringify(x.geometry.heroContent),'headline',JSON.stringify(x.geometry.heroHeadline),'description',JSON.stringify(x.geometry.heroDescription),'actions',JSON.stringify(x.geometry.heroActions),'notice',JSON.stringify(x.geometry.previewNotice),'width',x.geometry.documentWidth,'JS errors',x.javascriptErrors.length);
if(failed)process.exitCode=1;
