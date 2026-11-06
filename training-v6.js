import {FOCUS,TOOLS,createRoutine} from './training-core-v5.mjs';
import {EXT_KEY,cleanExtension,cleanProfile,startProgram,programCalendar,scenarioOptions,scenarioMetrics,calendarGrid,achievements,toInterchange,parseInterchange} from './training-v6-core.mjs';
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e};
const dateStr=iso=>new Date(iso).toLocaleDateString(document.documentElement.lang==='en'?'en-GB':'fr-FR',{day:'numeric',month:'short'});
const getStore=()=>window.AIMWeb.getStore();
const percentile=n=>n===null?'—':Number(n).toFixed(1)+' %';
let extras;
function load(){
 try{extras=cleanExtension(JSON.parse(localStorage.getItem(EXT_KEY)||'null'))}catch{extras=cleanExtension(null)}
}
function save(next){
 try{localStorage.setItem(EXT_KEY,JSON.stringify(next));extras=next;return true}
 catch{alert('Le stockage local du navigateur est indisponible.');return false}
}
function showProfile(){
 const p=extras.profile;
 const mapping={'player-name':p.nickname,'player-avatar':p.avatar,'player-rank':p.rank,'player-tool':p.tool,'player-dpi':p.dpi??'','player-sens':p.sensitivity??'','player-mouse':p.mouse,'player-goal':p.goal};
 Object.entries(mapping).forEach(([key,value])=>$('#'+key).value=value);
 $('#program-tool').value=p.tool;
 updateProfilePreview();
}
function profileFromForm(){
 return cleanProfile({nickname:$('#player-name').value,avatar:$('#player-avatar').value,rank:$('#player-rank').value,tool:$('#player-tool').value,dpi:$('#player-dpi').value,sensitivity:$('#player-sens').value,mouse:$('#player-mouse').value,goal:$('#player-goal').value});
}
function updateProfilePreview(){
 const p=profileFromForm();
 $('#player-display-name').textContent=p.nickname||'Joueur';
 $('#player-avatar-preview').textContent={crosshair:'⌖',bolt:'ϟ',shield:'◈',star:'✦'}[p.avatar];
 $('#player-edpi').textContent=p.dpi&&p.sensitivity?'eDPI : '+(p.dpi*p.sensitivity).toFixed(1):'eDPI : à renseigner';
}
function setupProfile(){
 $('#player-form').addEventListener('input',updateProfilePreview);
 $('#player-form').addEventListener('change',updateProfilePreview);
 $('#player-form').addEventListener('submit',event=>{
  event.preventDefault();const draft=profileFromForm();
  if(($('#player-dpi').value&&!draft.dpi)||($('#player-sens').value&&!draft.sensitivity)){
   $('#profile-status').textContent='DPI ou sensibilité invalide.';return;
  }
  if(save({...extras,profile:draft})){
   $('#profile-status').textContent='Profil enregistré dans ce navigateur.';
   $('#program-tool').value=draft.tool;$('#rank').value=draft.rank;renderProgram();
  }
 });
 showProfile();
}
function renderProgram(){
 const overview=$('#program-overview'),list=$('#program-calendar');
 overview.replaceChildren();list.replaceChildren();
 const p=extras.program;$('#program-reset').hidden=!p;
 if(!p){overview.append(element('h3','Prêt à commencer ?'),element('p','Choisis 7, 14 ou 30 jours. Une journée de récupération est prévue chaque semaine.','muted'));return}
 const all=programCalendar(p,getStore().sessions),total=all.filter(d=>!d.rest).length,done=all.filter(d=>d.completed).length;
 const row=element('div',undefined,'ar6-program-summary');
 row.append(element('h3',p.days+' jours · '+p.tool),element('span',done+' / '+total+' séances terminées','ar5-pill'));
 overview.append(row,element('p','Début : '+dateStr(p.startedAt)+' · Seules les séances enregistrées du bon jour et de la bonne compétence comptent.','muted'));
 const bar=element('div',undefined,'ar5-meter'),progress=element('span');
 progress.style.width=total?(done/total*100)+'%':'0%';bar.append(progress);overview.append(bar);
 all.forEach(d=>{
  const card=element('article',undefined,'ar6-program-day'+(d.rest?' is-rest':'')+(d.completed?' is-complete':''));
  const head=element('div',undefined,'ar6-program-day-head');
  head.append(element('span','J'+String(d.index+1).padStart(2,'0')),element('span',dateStr(d.date+'T12:00:00')));
  card.append(head,element('strong',d.label),element('small',d.rest?'Récupération':d.minutes+' min · '+d.tool));
  if(d.completed)card.append(element('span','✓ Séance enregistrée','ar6-completed'));
  else if(!d.rest){
   const button=element('button','Préparer →','outline');button.type='button';
   button.addEventListener('click',()=>{
    const plan=createRoutine(p.rank,d.focus,d.tool,d.minutes,30);
    window.AIMWeb.setPlan(plan);
   });
   card.append(button);
  }list.append(card);
 });
}
function setupProgram(){
 $('#program-form').addEventListener('submit',e=>{
  e.preventDefault();
  if(extras.program&&!confirm('Remplacer le programme actuel ?'))return;
  if(save({...extras,program:startProgram(Number($('#program-length').value),extras.profile.rank,$('#program-tool').value)}))renderProgram();
 });
 $('#program-reset').addEventListener('click',()=>{
  if(extras.program&&confirm('Terminer ce programme ? Les résultats enregistrés sont conservés.')&&save({...extras,program:null}))renderProgram();
 });
 renderProgram();
}
function renderChallenges(){
 const target=$('#achievement-grid');target.replaceChildren();
 achievements(getStore().sessions).forEach((item,i)=>{
  const card=element('article',undefined,'ar6-achievement'+(item.done?' achieved':''));
  const info=element('div');
  info.append(element('strong',item.title),element('p',item.desc,'muted'));
  card.append(element('span',['✦','◆','⬡','⏱','◎'][i],'ar6-achievement-glyph'),info,
    element('span',item.done?'Débloqué':item.progress+' / '+item.target,'ar5-pill'));target.append(card);
 });
}
function updateScenarioChoices(){
 const node=$('#analysis-scenario'),previous=node.value;
 const options=scenarioOptions(getStore().sessions,$('#insight-focus').value,$('#insight-tool').value);
 node.replaceChildren();
 const all=element('option','Tous les scénarios (non comparables)');all.value='';node.append(all);
 options.forEach(o=>{const option=element('option',o.name+' ('+o.count+')');option.value=o.name;node.append(option)});
 if(options.some(o=>o.name===previous))node.value=previous;
}
function plot(scores){
 const container=$('#chart');container.replaceChildren();
 if(!$('#analysis-scenario').value||!$('#insight-tool').value){
  container.append(element('p','Sélectionne un logiciel et un scénario identique pour comparer la précision.','muted'));return}
 if(!scores.length){container.append(element('p','Aucun résultat comparable pour cette période.','muted'));return}
 const data=scores.slice(-25),ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 720 270');svg.setAttribute('role','img');svg.setAttribute('aria-label','Précision de '+data.length+' séances comparables');
 const shape=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([key,value])=>e.setAttribute(key,String(value)));return e};
 [0,25,50,75,100].forEach(v=>{
  const y=236-v*1.9;
  svg.append(shape('line',{x1:45,y1:y,x2:690,y2:y,stroke:'#385265'}));
  const text=shape('text',{x:5,y:y+4,fill:'#c0d0dc','font-size':12});text.textContent=v+'%';svg.append(text);
 });
 const points=data.map((s,i)=>[45+i*645/Math.max(data.length-1,1),236-s.accuracy*1.9]);
 if(points.length>1)svg.append(shape('polyline',{points:points.map(x=>x.join(',')).join(' '),fill:'none',stroke:'#ff586f','stroke-width':3,'stroke-linejoin':'round'}));
 data.forEach((s,i)=>{
  const dot=shape('circle',{cx:points[i][0],cy:points[i][1],r:5,fill:'#8bded3'});
  const title=shape('title');title.textContent=dateStr(s.date)+': '+percentile(s.accuracy);
  dot.append(title);svg.append(dot);
 });
 container.append(svg);
}
function renderAnalytics(){
 const sessions=getStore().sessions;
 const focus=$('#insight-focus').value,tool=$('#insight-tool').value,scenario=$('#analysis-scenario').value,range=Number($('#analysis-range').value);
 const metric=scenarioMetrics(sessions,{focus,tool,scenario,range});
 const summary=$('#scenario-summary');summary.replaceChildren();
 const props=[['Séances',metric.count],['Moyenne',percentile(metric.average)],['Record',percentile(metric.best)],['Évolution',metric.comparisonValid?(metric.change>0?'+':'')+metric.change.toFixed(1)+' points':'Non comparable']];
 props.forEach(([title,value])=>{const div=element('div',undefined,'ar6-stat-box');div.append(element('span',title),element('strong',value));summary.append(div)});
 $('#chart-count').textContent=metric.count+' valeur(s)';
 plot(metric.sessions);
 $('#insight-advice').textContent=metric.comparisonValid?
  'Évolution indicative pour un même logiciel et un même scénario. Conserve aussi une difficulté comparable.':
  'Choisis un logiciel et un scénario précis, avec au moins six résultats, pour obtenir une évolution comparable.';
 const calendar=$('#training-calendar');calendar.replaceChildren();
 calendarGrid(sessions).forEach(day=>{
  const cell=element('span',undefined,'ar6-cal-cell'+(day.count?' has-sessions':''));
  cell.title=day.date+' · '+day.count+' séance(s)';
  cell.setAttribute('role','img');cell.setAttribute('aria-label',cell.title);
  cell.dataset.count=String(Math.min(4,day.count));calendar.append(cell);
 });
 calendar.append(element('p','Une case = un jour. Colorée = entraînement enregistré.','muted'));
 const top=$('#scenario-records');top.replaceChildren();const records=new Map();
 sessions.forEach(s=>{
  if(s.accuracy===null||!s.scenario||s.tool==='Non précisé')return;
  const key=s.tool+' · '+s.scenario,old=records.get(key);
  if(!old||old.accuracy<s.accuracy)records.set(key,s);
 });
 const sorted=[...records].sort((a,b)=>b[1].accuracy-a[1].accuracy).slice(0,8);
 if(!sorted.length)top.append(element('p','Ajoute une précision avec un scénario nommé pour voir tes records.','muted'));
 sorted.forEach(([key,s])=>{
  const row=element('div',undefined,'ar6-record-row'),copy=element('div');
  copy.append(element('strong',key),element('small',dateStr(s.date)));
  row.append(copy,element('span',percentile(s.accuracy),'ar5-pill'));top.append(row);
 });
}
function setupAnalytics(){
 ['insight-focus','insight-tool'].forEach(key=>$('#'+key).addEventListener('change',()=>{updateScenarioChoices();renderAnalytics()}));
 ['analysis-range','analysis-scenario'].forEach(key=>$('#'+key).addEventListener('change',renderAnalytics));
 $('#tab-insights').addEventListener('click',()=>requestAnimationFrame(renderAnalytics));
 updateScenarioChoices();renderAnalytics();
}
function download(filename,body){
 const blob=new Blob([JSON.stringify(body,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function setupInterop(){
 const status=$('#portable-status');
 $('#export-portable').addEventListener('click',()=>{
  download('aimroutine-portable-'+new Date().toISOString().slice(0,10)+'.json',toInterchange(getStore(),extras));
  status.textContent='Export portable enregistré. L’import Windows n’est pas encore implémenté.';
 });
 $('#import-portable').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   if(file.size>3e6)throw Error('Fichier limité à 3 Mo.');
   const data=parseInterchange(JSON.parse(await file.text()));
   const added=window.AIMWeb.mergeData(data);
   if(confirm('Importer également le profil et le calendrier du fichier ?')){
    if(save(data.extension))showProfile();
   }
   renderAll();status.textContent=added+' nouvelle(s) séance(s) importée(s).';
  }catch(error){status.textContent='Import impossible : '+error.message}
  finally{e.target.value=''}
 });
}
function renderAll(){renderProgram();renderChallenges();updateScenarioChoices();renderAnalytics()}
function init(){
 load();setupProfile();setupProgram();setupAnalytics();setupInterop();renderChallenges();
 window.addEventListener('aim-store-updated',renderAll);
 $('#tab-program').addEventListener('click',renderProgram);
 $('#tab-challenges').addEventListener('click',renderChallenges);
}
if(window.AIMWeb)init();
else window.addEventListener('aim-v5-ready',init,{once:true});
})();
