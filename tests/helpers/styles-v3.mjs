/* Resolve CSS cascade order across direct links and checked lossless V3 bundles.
   Unlike substring-based HTML tests, this verifies which CSS files truly load. */
import {readFileSync} from 'node:fs';
const root=name=>readFileSync(new URL('../../'+name,import.meta.url),'utf8');

export function stylesheetOrder(page){
 const html=root(page);
 const links=[...html.matchAll(/<link\s+rel=["']stylesheet["']\s+href=["']([^"']+)["']/g)]
  .map(x=>x[1].split('?')[0]);
 const expanded=[];
 for(const link of links){
  if(/^site-home-bundle-v1-[1-5]\.css$/.test(link)){
   const css=root(link);
   const originals=[...css.matchAll(/\/\* BEGIN ([^*]+?) \*\//g)].map(x=>x[1]);
   if(!originals.length)throw Error('Missing source CSS provenance in '+link);
   expanded.push(...originals);
  }else expanded.push(link);
 }
 return expanded;
}

export function stylesheetIndex(page,source){
 const sheets=stylesheetOrder(page);
 const index=sheets.indexOf(source);
 if(index<0)throw Error(page+' does not load stylesheet '+source);
 if(sheets.lastIndexOf(source)!==index){
  throw Error(page+' duplicates stylesheet '+source);
 }
 return index;
}
