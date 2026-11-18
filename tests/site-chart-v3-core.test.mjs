import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAccuracyPlot} from '../site-chart-v3.mjs';

class Element {
 constructor(tag){
  this.tag=tag;
  this.attributes={};
  this.children=[];
 }
 setAttribute(name,value){this.attributes[name]=value}
 replaceChildren(){this.children=[]}
 append(...nodes){this.children.push(...nodes)}
 prepend(node){this.children.unshift(node)}
}

function plot(t,sessions,options={}){
 const previous=globalThis.document;
 globalThis.document={createElement:tag=>new Element(tag),createElementNS:(_namespace,tag)=>new Element(tag)};
 t.after(()=>{globalThis.document=previous});
 const root=new Element('div');
 renderAccuracyPlot(root,sessions,{locale:'fr-FR',emptyMessage:'Aucune précision.',...options});
 return root;
}

test('accuracy charts position sessions by elapsed time and announce their recorded scores',t=>{
 const root=plot(t,[
  {date:'2026-11-09T08:00:00Z',accuracy:81},
  {date:'2026-11-06T08:00:00Z',accuracy:72},
  {date:'2026-11-06T09:00:00Z',accuracy:75}
 ]);
 const [svg,caption,description]=root.children;
 const points=svg.children.filter(node=>node.tag==='circle');
 const [start,middle,end]=points.map(point=>Number(point.attributes.cx));
 assert.equal(points.length,3);
 assert.ok(Math.abs((middle-start)/(end-start)-1/72)<1e-10);
 assert.equal(caption.textContent,'3 résultats saisis');
 assert.match(description.textContent,/72 %.*75 %.*81 %/);
 assert.equal(svg.attributes['aria-hidden'],'true');
});

test('a progress chart without valid data renders an empty scale and no score markers',t=>{
 const root=plot(t,[{date:'bad date',accuracy:83},{date:'2026-11-06T08:00:00Z',accuracy:null}]);
 const [svg,message]=root.children;
 assert.equal(svg.tag,'svg');
 assert.equal(svg.children.filter(node=>node.tag==='circle'||node.tag==='polygon').length,0);
 assert.equal(message.textContent,'Aucune précision.');
});

test('equal timestamps do not create an infinite scale or a false time span',t=>{
 const root=plot(t,[{date:'2026-11-06T08:00:00Z',accuracy:0},{date:'2026-11-06T08:00:00Z',accuracy:100}],{compact:true});
 const svg=root.children[0];
 const points=svg.children.filter(node=>node.tag==='circle');
 assert.equal(points.length,2);
 assert.equal(points[0].attributes.cx,points[1].attributes.cx);
 assert.ok(points.every(node=>Number.isFinite(Number(node.attributes.cy))));
 assert.equal(svg.children.filter(node=>node.tag==='polygon').length,0);
});
