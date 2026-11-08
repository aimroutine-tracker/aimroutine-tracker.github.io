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
   const runtimeErrors=[];
   page.on('pageerror',err=>{const message=String(err.message||err);errors.push(message);runtimeErrors.push(message)});
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
     referenceIconCount:document.querySelectorAll('.r17-screen .ar-v3-symbol').length,
     header:measure('.site31-header'),
     hero:measure('.r17-screen .r17-hero'),
     heroContent:measure('.r17-screen .r17-hero-content'),
     heroHeadline:measure('.r17-screen .r17-hero h1'),
     heroDescription:measure('.r17-screen .r17-hero-desc'),
     heroActions:measure('.r17-screen .r17-hero-actions'),
     previewNotice:measure('#ar-account-required'),
     homeStats:measure('.r17-home-wrap .r17-stats'),
     homeFeatures:measure('.r17-home-wrap .r17-features'),
     homeBottom:measure('.r17-home-wrap .r17-home-bottom'),
     homePaths:measure('.r17-home-wrap .r17-home-paths'),
     homePathGrid:measure('.r17-home-wrap .r17-path-grid'),
     homePathCard:measure('.r17-home-wrap .r17-path'),
     homeChallenge:measure('.r17-home-wrap .r17-challenge'),
     trainGrid:measure('.r17-training-wrap .r17-training-grid'),
     trainPlan:measure('.r17-training-wrap .r17-training-plan'),
     trainLeft:measure('.r17-training-wrap .r17-train-left'),
     trainSummary:measure('.r17-training-wrap .r17-train-summary'),
     trainLevelNote:measure('.r17-training-wrap .r17-level-note'),
     trainCenter:measure('.r17-training-wrap .r17-train-center'),
     trainRight:measure('.r17-training-wrap .r17-train-right'),
     trainChallenge:measure('.r17-training-wrap .r17-side-challenge'),
     trainTools:measure('.r17-training-wrap .r19-workspace-toolbar'),
     trainWeek:measure('.r17-training-wrap .r17-weekline'),
     progressKpis:measure('.r17-progress-wrap .r17-progress-kpis'),
     progressCharts:measure('.r17-progress-wrap .r17-chart-grid'),
     accountBenefits:measure('.r17-account-wrap .r17-account-benefits'),
     accountProfile:measure('.r17-account-wrap .r17-account-profile'),
     navCurrent:[...document.querySelectorAll('.site31-links [aria-current="page"]')].map(a=>a.textContent.trim()),
     navDetails:[...document.querySelectorAll('.site31-links a')].map(a=>({href:a.getAttribute('href'),classes:a.className,active:a.getAttribute('aria-current'),bg:getComputedStyle(a).backgroundImage,color:getComputedStyle(a).backgroundColor,selector:a.outerHTML.slice(0,230)})),
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
    uncaughtRuntimeErrors:runtimeErrors.slice(0,12),
    viewport:{width,height}
   };
   if(phase==='after'){
    if(!info.hero || !info.screen || !info.header || (response?.status()!==200)){
     failed=true;check.failure='Required app structure or page response missing';
    }
    if(info.documentWidth>width+3){failed=true;check.failure='Horizontal overflow';}
    if(Math.abs((info.hero?.height??0)-item.heroHeight)>2){
      failed=true;check.failure='Hero height outside visual tolerance';
    }
    if(runtimeErrors.length){
      failed=true;check.failure='Uncaught JavaScript runtime error';
    }
    if(item.id!=='progress' && info.referenceIconCount===0){
      failed=true;check.failure='Expected inline SVG icons were not rendered';
    }
   }
   results.push(check);
   await context.close();
  }
 }
 // Inspect responsive screens without changing any browser data or session.
 for(const mobileWidth of [390,768,1024]){
  for(const item of pages){
   const context=await browser.newContext({
    viewport:{width:mobileWidth,height:850},deviceScaleFactor:1,
    locale:'fr-FR',colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block'
   });
   try{
    const page=await context.newPage();
    const fatal=[];
    page.on('pageerror',e=>fatal.push(String(e.message||e)));
    const response=await page.goto('http://127.0.0.1:8766/'+item.filename,{waitUntil:'domcontentloaded',timeout:35000});
    await page.waitForFunction(()=>document.body?.classList.contains('r20'),null,{timeout:30000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(350);
    const geom=await page.evaluate(()=>({
     docWidth:document.documentElement.scrollWidth,
     headerPresent:Boolean(document.querySelector('.site31-header')),
     screenPresent:Boolean(document.querySelector('.r17-screen')),
     burgerPresent:Boolean(document.querySelector('.site31-mobile-toggle,.site31-menu-toggle,[aria-label*="menu"]')),
    }));
    await page.screenshot({path:join(out,item.id+'-'+mobileWidth+'.png'),animations:'disabled',fullPage:false});
    const check={name:item.id,phase:'responsive-'+mobileWidth,httpStatus:response?.status()??null,geometry:geom,uncaughtRuntimeErrors:fatal};
    if(geom.docWidth>mobileWidth+3||!geom.headerPresent||!geom.screenPresent||fatal.length||response?.status()!==200){
     failed=true;check.failure='Responsive overflow, missing app structure, HTTP failure or runtime error';
    }
    results.push(check);
   }finally{await context.close();}
  }
 }
}finally{await browser.close();}
await writeFile(join(out,'measurements.json'),JSON.stringify(results,null,2));
for(const x of results)console.log(x.name,x.phase,'hero',JSON.stringify(x.geometry.hero),'content',JSON.stringify(x.geometry.heroContent),'headline',JSON.stringify(x.geometry.heroHeadline),'description',JSON.stringify(x.geometry.heroDescription),'actions',JSON.stringify(x.geometry.heroActions),'notice',JSON.stringify(x.geometry.previewNotice),'layout',JSON.stringify({homeStats:x.geometry.homeStats,homeFeatures:x.geometry.homeFeatures,homeBottom:x.geometry.homeBottom,homePaths:x.geometry.homePaths,homePathGrid:x.geometry.homePathGrid,homePathCard:x.geometry.homePathCard,homeChallenge:x.geometry.homeChallenge,trainGrid:x.geometry.trainGrid,trainPlan:x.geometry.trainPlan,trainLeft:x.geometry.trainLeft,trainSummary:x.geometry.trainSummary,trainLevelNote:x.geometry.trainLevelNote,trainCenter:x.geometry.trainCenter,trainRight:x.geometry.trainRight,trainChallenge:x.geometry.trainChallenge,trainTools:x.geometry.trainTools,trainWeek:x.geometry.trainWeek,progressKpis:x.geometry.progressKpis,progressCharts:x.geometry.progressCharts,accountBenefits:x.geometry.accountBenefits,accountProfile:x.geometry.accountProfile,navCurrent:x.geometry.navCurrent,navDetails:x.geometry.navDetails}),'width',x.geometry.documentWidth,'JS errors',x.javascriptErrors?.slice(0,5)||[]);
if(failed){console.error('V3 visual evidence validation failed: see measurements.json');process.exitCode=1;}
