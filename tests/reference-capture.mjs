import {chromium} from 'playwright';
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const path='visual-comparisons';
for(const kind of ['before','after','side-by-side'])await mkdir(path+'/'+kind,{recursive:true});
const targets=[['accueil','index.html'],['routines','training.html'],['compte-cloud','account.html'],['progression','progress.html']];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const references=JSON.parse(await readFile(new URL('./reference-grid-v21.json',import.meta.url),'utf8'));
const referenceMetrics={};
const calculateError=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return Number((sum/a.length).toFixed(2));};
const result={viewport:{width:1672,height:941},screens:[]};
for(const [name,uri] of targets){
 const files=[];
 for(const [kind,port] of [['before',8766],['after',8765]]){
  const page=await browser.newPage({viewport:{width:1672,height:941},deviceScaleFactor:1,locale:'fr-FR',reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:'+port+'/'+uri,{waitUntil:'domcontentloaded'});
  try{await page.waitForSelector(kind==='after'?'#aim-reference':'.r17-screen',{timeout:20000})}catch(e){errors.push(String(e))}
  await page.waitForTimeout(1400);
  const layout=await page.evaluate(()=>{const els=['.a21-hero','.a21-hero h1','.a21-hero h1 em','.a21-hero h1 strong','.a21-hero p','.a21-benefits','.a21-content'];return Object.fromEntries(els.map(s=>{const e=document.querySelector('#aim-reference '+s);if(!e)return[s,null];const r=e.getBoundingClientRect(),st=getComputedStyle(e);return[s,{text:e.textContent.trim().slice(0,70),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),font:st.fontSize,color:st.color,display:st.display,visibility:st.visibility}]}))});
  console.log('V21_LAYOUT_'+kind+'_'+name+'='+JSON.stringify(layout));
  await page.screenshot({path:path+'/'+kind+'/'+name+'.png',fullPage:false,animations:'disabled'});
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  result.screens.push({kind,name,url:uri,scrollWidth:width,visibleReference:await page.locator('#aim-reference').count(),errors});
  await page.close();
  files.push(path+'/'+kind+'/'+name+'.png');
 }
 const referenceRGB=Buffer.from(references[name],'base64');
 const beforeRGB=await sharp(files[0]).resize(16,9,{fit:'fill',kernel:'lanczos3'}).removeAlpha().raw().toBuffer();
 const afterRGB=await sharp(files[1]).resize(16,9,{fit:'fill',kernel:'lanczos3'}).removeAlpha().raw().toBuffer();
 referenceMetrics[name]={beforeMAE:calculateError(beforeRGB,referenceRGB),afterMAE:calculateError(afterRGB,referenceRGB)};
 console.log('V21_REFERENCE_COMPARISON_'+name+'='+JSON.stringify(referenceMetrics[name]));
 const left=await readFile(files[0]),right=await readFile(files[1]);
 await sharp({create:{width:3344,height:941,channels:4,background:'#08121b'}})
  .composite([{input:left,left:0,top:0},{input:right,left:1672,top:0}]).png()
  .toFile(path+'/side-by-side/'+name+'.png');
 const preview=await sharp(right).resize({width:600}).webp({quality:55}).toBuffer();
 console.log('V21_PREVIEW_'+name+'='+preview.toString('base64'));
}
await browser.close();
result.referenceComparison={method:'RGB mean absolute error over 16×9 downsampled original screenshots; approximate only, NOT pixel-perfect',metrics:referenceMetrics};
await writeFile(path+'/report.json',JSON.stringify(result,null,2));
console.log('Four full-resolution before/after comparisons captured. Official source mockups are not in this GitHub checkout: do not assert pixel equivalence.');
