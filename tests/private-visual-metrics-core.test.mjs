import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('./private-visual-review-v3.html',import.meta.url),'utf8');
const begin=html.indexOf('function measureDifference(');
const end=html.indexOf('\nfunction render(id){',begin);
assert.ok(begin>0&&end>begin,'Private comparator numeric function must be present');
const measure=runInNewContext(html.slice(begin,end)+'\nmeasureDifference',
 {REGIONS:[['top',0,2],['bottom',2,4]]});

function image(width,height){
 const p=new Uint8ClampedArray(width*height*4);
 for(let i=3;i<p.length;i+=4)p[i]=255;
 return p;
}
function changePixel(p,width,x,y,r,g,b){
 const i=(y*width+x)*4;
 p[i]=r;p[i+1]=g;p[i+2]=b;
}

test('private visual hotspot metrics are empty for identical image pixels',()=>{
 const a=image(8,4);
 const r=measure(a,a,8,4);
 assert.equal(r.rgb_mae_0_to_255,0);
 assert.equal(r.different_pixel_percent,0);
 assert.equal(r.visually_identical,true);
 assert.equal(r.priority_hotspots.length,0);
 assert.equal(r.regional_rgb_mae.top,0);
 assert.equal(r.regional_rgb_mae.bottom,0);
 assert.equal(r.hotspot_grid.columns,8);
 assert.equal(r.hotspot_grid.rows,4);
});

test('private visual hotspot reports the exact changed tile and RGB MAE',()=>{
 const original=image(8,4),candidate=image(8,4);
 changePixel(candidate,8,7,3,255,255,255);
 const r=measure(original,candidate,8,4);
 assert.equal(r.rgb_mae_0_to_255,7.9688);
 assert.equal(r.different_pixel_percent,3.125);
 assert.equal(r.regional_rgb_mae.top,0);
 assert.equal(r.regional_rgb_mae.bottom,15.9375);
 assert.equal(r.priority_hotspots[0].zone,'H4');
 assert.equal(r.priority_hotspots[0].rgb_mae_0_to_255,255);
 assert.equal(r.priority_hotspots.length,1,'Only the changed tile is relevant');
 assert.equal(r.priority_hotspots[0].x,7);
 assert.equal(r.priority_hotspots[0].y,3);
 assert.equal(r.priority_hotspots[0].width,1);
 assert.equal(r.priority_hotspots[0].height,1);
});

test('private visual hotspot sorts the most divergent region first',()=>{
 const original=image(8,4),candidate=image(8,4);
 changePixel(candidate,8,0,0,20,20,20);
 changePixel(candidate,8,7,3,160,160,160);
 const r=measure(original,candidate,8,4);
 assert.equal(r.priority_hotspots[0].zone,'H4');
 assert.equal(r.priority_hotspots[0].rgb_mae_0_to_255,160);
 assert.equal(r.priority_hotspots[1].zone,'A1');
 assert.equal(r.priority_hotspots[1].rgb_mae_0_to_255,20);
 assert.equal(r.priority_hotspots.length,2,'Unchanged tiles must not be highlighted');
});

test('private visual comparator rejects mismatched dimensions or pixel arrays',()=>{
 assert.throws(()=>measure(image(8,4),image(8,3),8,4));
 assert.throws(()=>measure(image(8,4),image(8,4),0,4));
 assert.throws(()=>measure(image(8,4),image(8,4),8,3.5));
});

test('private visual comparator keeps original hashes and local-only network policy',()=>{
 assert.match(html,/reference_sha256:sha,reference_verified:true/);
 assert.match(html,/sha!==entry\.sha/);
 assert.match(html,/capture_sha256:candidateSha/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/value="hotspots"/);
});
