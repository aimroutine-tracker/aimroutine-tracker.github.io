/* Verify the five home CSS bundles against their 26 ordered source sheets.
   Use fresh documents so a live stylesheet swap cannot change paint state. */
import {chromium} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
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

const linkPattern=/<link rel="stylesheet" href="(site-home-bundle-v1-[1-5]\.css)\?v=1">/g;
const html=await readFile('index.html','utf8');
const linkedBundles=[...html.matchAll(linkPattern)].map(match=>match[1]);
if(JSON.stringify(linkedBundles)!==JSON.stringify(bundles))throw Error('Expected five ordered home bundles');
const sourceLinks=sources.map(name=>'<link rel="stylesheet" href="'+name+'">').join('\n');
let inserted=false;
const sourceHtml=html.replace(linkPattern,()=>{
 if(inserted)return '';
 inserted=true;
 return sourceLinks;
});
const url='http://127.0.0.1:8765/index.html';
const output='visual-results/css-parity';
await mkdir(output,{recursive:true});

async function capture(browser,width,height,kind,body){
 const context=await browser.newContext({
  viewport:{width,height},deviceScaleFactor:1,
  locale:'fr-FR',colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block'
 });
 try{
  const page=await context.newPage();
  await page.route(url,route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body}));
  await page.clock.setFixedTime(new Date('2026-11-14T12:00:00.000Z'));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForFunction(()=>document.body?.classList.contains('r20'),null,{timeout:30000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.addStyleTag({content:
   '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}'});
  const snapshot=await page.evaluate(()=>{
   const selectors=['.site31-header','.r17-screen','.r17-hero',
    '.r17-hero h1','.r17-hero-desc','.r17-hero-actions','.v5-hero',
    '.r17-features','.r17-home-bottom','.r17-path','.r17-path p',
    '.r17-path-foot','.r17-challenge','.ar9-path-grid','#aim-challenge','.site31-footer'];
   const names=['display','position','color','backgroundColor','borderColor','borderRadius',
    'fontSize','fontFamily','fontWeight','lineHeight','letterSpacing','opacity',
    'transform','visibility','padding','margin','gridTemplateColumns','gridTemplateRows',
    'boxShadow','backgroundImage','overflow','maxWidth'];
   return Object.fromEntries(selectors.map(selector=>{
    const node=document.querySelector(selector);
    if(!node)return [selector,null];
    const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
    return [selector,{
     rect:[rect.x,rect.y,rect.width,rect.height].map(v=>+v.toFixed(3)),
     css:Object.fromEntries(names.map(prop=>[prop,style[prop]]))
    }];
   }));
  });
  const png=await page.screenshot({path:output+'/home-'+width+'-'+kind+'.png',animations:'disabled'});
  return {snapshot,hash:createHash('sha256').update(png).digest('hex').slice(0,12)};
 } finally {
  await context.close();
 }
}

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [width,height] of [[1672,941],[390,844]]){
  const bundled=await capture(browser,width,height,'bundled',html);
  const original=await capture(browser,width,height,'original',sourceHtml);
  if(JSON.stringify(bundled.snapshot)!==JSON.stringify(original.snapshot)){
   const changed=Object.keys(bundled.snapshot).filter(selector=>
    JSON.stringify(bundled.snapshot[selector])!==JSON.stringify(original.snapshot[selector]));
   throw Error('Home CSS geometry/computed-style mismatch at '+width+'x'+height+
    ': '+changed.map(selector=>JSON.stringify({selector,bundled:bundled.snapshot[selector],
     original:original.snapshot[selector]})).join(', ').slice(0,4000));
  }
  console.log('PASS: home '+width+'x'+height+' computed styles and layout coordinates match. PNGs: '+
   bundled.hash+' / '+original.hash+' (pixel audit runs next)');
 }
} finally {
 await browser.close();
}
