/* Shared accuracy plot for stored training sessions. No demonstration values. */
function svgNode(name, attributes, value){
 const node=document.createElementNS('http://www.w3.org/2000/svg',name);
 for(const [key,attribute] of Object.entries(attributes))node.setAttribute(key,String(attribute));
 if(value!==undefined)node.textContent=value;
 return node;
}

function accuracyAxis(scores){
 if(!scores.length)return {min:0,max:100,step:25};
 const lowest=Math.min(...scores),highest=Math.max(...scores);
 const spread=highest-lowest;
 const step=spread<=15?5:spread<=40?10:25;
 const min=Math.max(0,Math.floor((lowest-2)/step)*step);
 const max=Math.min(100,Math.ceil((highest+2)/step)*step);
 return {min,max,step};
}

export function renderAccuracyPlot(root,sessions,{locale,emptyMessage,compact=false}){
 const points=sessions.map(session=>({time:Date.parse(session.date),score:session.accuracy}))
  .filter(({time,score})=>Number.isFinite(time)&&Number.isFinite(score)&&score>=0&&score<=100)
  .sort((a,b)=>a.time-b.time);
 root.replaceChildren();
 if(!points.length){
  const message=document.createElement('p');
  message.className=compact?'ar20-empty':'v14-chart-empty';
  message.textContent=emptyMessage;
  root.append(message);
  if(compact)return;
 }
 const width=compact?370:600,height=compact?150:198;
 const left=40,right=width-15,bottom=height-25;
 const top=!compact&&points.length?23:11;
 const first=points[0]?.time,last=points.at(-1)?.time;
 const span=last-first;
 // Duplicate timestamps intentionally share the same X coordinate.
 const x=time=>span?left+(time-first)/span*(right-left):(left+right)/2;
 const {min,max,step}=accuracyAxis(points.map(point=>point.score));
 const y=score=>bottom-(score-min)/(max-min)*(bottom-top);
 const svg=svgNode('svg',{class:'v3-accuracy-chart',viewBox:`0 0 ${width} ${height}`,'aria-hidden':'true',focusable:'false'});
 for(let tick=min;tick<=max;tick+=step){
  const level=y(tick);
  svg.append(svgNode('line',{x1:left,x2:right,y1:level,y2:level,stroke:'#38586a','stroke-opacity':'.56'}),
   svgNode('text',{x:left-6,y:level+4,'text-anchor':'end','font-size':12,fill:'#b7cbd6'},tick+' %'));
 }
 svg.append(svgNode('line',{x1:left,x2:left,y1:top,y2:bottom,stroke:'#607d8b'}));
 root.prepend(svg);
 if(!points.length)return;

 const color=compact?'#ff7387':'#5ce4dc';
 const gradientId=compact?'v3-routines-accuracy-fill':'v3-progress-accuracy-fill';
 const gradient=svgNode('linearGradient',{id:gradientId,x1:'0%',y1:'0%',x2:'0%',y2:'100%'});
 gradient.append(svgNode('stop',{offset:'0%','stop-color':color,'stop-opacity':'.36'}),
  svgNode('stop',{offset:'100%','stop-color':color,'stop-opacity':'.04'}));
 const defs=svgNode('defs',{});defs.append(gradient);svg.append(defs);
 const coordinates=points.map(({time,score})=>`${x(time)},${y(score)}`).join(' ');
 if(span)svg.append(svgNode('polygon',{points:`${left},${bottom} ${coordinates} ${right},${bottom}`,fill:`url(#${gradientId})`}));
 if(points.length>1)svg.append(svgNode('polyline',{points:coordinates,fill:'none',stroke:color,'stroke-width':2.3,'stroke-linejoin':'round'}));
 for(const {time,score} of points){
  svg.append(svgNode('circle',{class:'v3-accuracy-point',cx:x(time),cy:y(score),r:3.2,fill:color,stroke:'#e0f7fb','stroke-width':.7}));
 }

 const sameDay=new Date(first).toDateString()===new Date(last).toDateString();
 const timeLabel=new Intl.DateTimeFormat(locale,sameDay&&span?{hour:'2-digit',minute:'2-digit'}:{day:'numeric',month:'short'});
 const ticks=span?[first,last]:[first];
 for(const time of ticks){
  svg.append(svgNode('text',{x:x(time),y:height-7,'text-anchor':!span?'middle':time===first?'start':'end','font-size':12,fill:'#b7cbd6'},timeLabel.format(time)));
 }
 const english=locale==='en-GB';
 const number=new Intl.NumberFormat(locale,{maximumFractionDigits:1});
 if(!compact){
  const caption=document.createElement('small');
  caption.className='v14-chart-caption';
  caption.textContent=number.format(points.length)+' '+(english?'reported scores':'résultats saisis');
  root.append(caption);
 }
 const dateLabel=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const description=document.createElement('p');
 description.className='r17-visually-hidden';
 description.textContent=(english?'Recorded accuracy: ':'Précision enregistrée : ')+
  points.map(({time,score})=>dateLabel.format(time)+' : '+number.format(score)+' %').join(' ; ');
 root.append(description);
}
