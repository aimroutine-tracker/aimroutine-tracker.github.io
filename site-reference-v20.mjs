/* AimRoutine V20 — owner reference interaction polish. Visuals are backed by real data. */
import {computeStats} from './training-core-v5.mjs';
const $=(q,root=document)=>root.querySelector(q);
const $$=(q,root=document)=>[...root.querySelectorAll(q)];
const isEn=()=>document.documentElement.lang==='en';
const words=(fr,en)=>isEn()?en:fr;
const p=location.pathname.split('/').pop()||'index.html';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dateKey=d=>new Date(d).toLocaleDateString('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit'});

/* Live FR/EN support for V3-created labels. Never re-run a form or
   re-create authentication controls when the user changes language. */
function bindV3Locale(node,fr,en){
 if(!node)return;
 node.dataset.r20Fr=fr;
 node.dataset.r20En=en;
 node.textContent=words(fr,en);
}
function refreshV3Locale(){
 document.querySelectorAll('[data-r20-fr][data-r20-en]').forEach(node=>{
  const expected=isEn()?node.dataset.r20En:node.dataset.r20Fr;
  if(node.textContent!==expected)node.textContent=expected;
 });
 window.dispatchEvent(new Event('aim-v3-locale-changed'));
}
function watchV3Locale(){
 new MutationObserver(refreshV3Locale).observe(document.documentElement,{
  attributes:true,attributeFilter:['lang']
 });
}

/* V3 / pass 31 — keep the shared header truthful on every non-account page.
   Never infer sign-in from a cached UID; only a server-validated Supabase user
   can activate the Cloud indicator. No writes, routines or Riot calls here.
   Lazy-load after the page is ready to preserve the reference first paint. */
function installVerifiedCloudHeader(){
 if(p==='account.html')return; // Account already has its own real auth observer.
 const cloud=$('.r18-cloud'),signin=$('.r18-signin'),register=$('.r18-register');
 if(!cloud||!signin||!register)return;
 let connected=false,applied=false,request=0;
 const render=value=>{
  const next=value===true;
  if(!applied&&!next)return; // Keep exact guest markup and reference appearance.
  applied=true;connected=next;
  cloud.classList.toggle('r18-connected',next);
  cloud.title=next?words('Compte connecté · sauvegarde cloud disponible',
   'Account connected · cloud backup available'):
   words('Connexion requise pour la sauvegarde cloud',
   'Sign in to use cloud backup');
  cloud.href=next?'account.html#dashboard-panel':'account.html#auth-panel';
  signin.href=next?'account.html#dashboard-panel':'account.html#auth-panel';
  bindV3Locale(signin,next?'Mon compte':'Se connecter',next?'My account':'Sign in');
  register.hidden=next;
 };
 const tokenKey='sb-lmzswtzboobpokumxzhy-auth-token';
 const hasToken=()=>{
  try{return Boolean(localStorage.getItem(tokenKey))}
  catch{return true} // Private browsing restrictions: still verify through Supabase.
 };
 let loading=false,subscribed=false,verifyCurrent=null;
 const start=async()=>{
  if(subscribed||loading||!hasToken())return;
  loading=true;
  try{
   const {supabase:{auth}}=await import('./cloud-client-v7.mjs');
   const verify=async()=>{
    const ticket=++request;
    try{
     const {data,error}=await auth.getUser();
     if(ticket===request)render(Boolean(!error&&data?.user?.id));
    }catch{if(ticket===request)render(false)}
   };
   verifyCurrent=verify;
   auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){
     ++request;render(false);
    }else if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
     // Supabase requires auth methods outside its synchronous callback.
     setTimeout(()=>void verify(),0);
    }
   });
   subscribed=true;
   window.addEventListener('online',()=>void verify());
   window.addEventListener('focus',()=>void verify());
   window.addEventListener('aim-v3-locale-changed',()=>{
    if(applied)render(connected);
   });
   await verify();
  }catch{
   // Blocked CDN/offline must never be interpreted as a verified login.
  }finally{loading=false}
 };
 // A sign-in made in another tab propagates through browser storage events.
 window.addEventListener('storage',event=>{
  // A storage.clear() in another tab sends a null key, not the token key.
  if(event.key!==null&&event.key!==tokenKey)return;
  if(!event.newValue){++request;render(false)}
  else if(verifyCurrent)void verifyCurrent();
  else void start();
 });
 window.addEventListener('focus',()=>void start());
 if(document.readyState==='complete')void start();
 else window.addEventListener('load',()=>void start(),{once:true});
}

function init(){
 // The shared locale control exists independently of the dynamically built screen.
 relocateV3LanguageSwitch();
 installVerifiedCloudHeader();
 const screen=$('.r17-screen');if(!screen)return;
 document.body.classList.add('r20');
 const art=$('.r17-hero-art',screen);
 if(art)art.setAttribute('aria-hidden','true');
 if(p==='index.html')home(screen);
 if(p==='training.html')routines(screen);
 if(p==='account.html')account(screen);
 if(p==='progress.html')progress(screen);
 if(p==='progress.html')installV3ProgressComposition(screen);
 installV3Icons(screen);
 watchV3Locale();
}
function home(screen){
 const feature=$$('.r17-feature',screen);
 const art=[
  '<svg viewBox="0 0 90 90" width="86" height="86" aria-hidden="true"><circle cx="45" cy="45" r="31" fill="none" stroke="#37e3dd" stroke-opacity=".72"/><path d="M45 0V90M0 45H90" stroke="#ff6076" stroke-width="1.4" stroke-opacity=".9"/><circle cx="45" cy="45" r="3" fill="#ff6076"/></svg>',
  '<svg viewBox="0 0 100 100" width="94" height="92" aria-hidden="true"><path d="m10 40 40-20 40 20-40 20Z" stroke="#37e3dd" fill="none" stroke-width="2"/><path d="m10 54 40-20 40 20-40 20Z" stroke="#ff5b69" fill="none" stroke-width="2"/><path d="m10 68 40-20 40 20-40 20Z" stroke="#37e3dd" fill="none" stroke-width="2"/></svg>',
  '<svg viewBox="0 0 94 76" width="93" height="80" aria-hidden="true"><path d="M10 70V59h12v11m8 0V49h12v21m8 0V37h12v33m8 0V23h12v47" fill="#37e3dd" fill-opacity=".42"/><path d="m6 49 24-11 20-5 29-19m-11 0h11v11" stroke="#37e3dd" stroke-width="3" fill="none"/></svg>'
 ];
 feature.forEach((el,i)=>{const t=$('.r17-feature-art',el);if(t)t.innerHTML=art[i]||''});
 const challenge=$('.r17-challenge h3',screen);bindV3Locale(challenge,'Mini Défi : Précision 1 min','Mini challenge: 1-minute accuracy');
 const target=$('.r17-challenge-target',screen);if(target)target.textContent='◎';
 const chip=$('.r17-challenge .r17-chipbar span:first-child',screen);if(chip)chip.textContent=words('◷ 1 minute','◷ 1 minute');
 const link=$('.r17-challenge .r17-button',screen);
 if(link)link.addEventListener('click',event=>{ // Existing on-page AIM demo is a real interactive minigame.
  const demo=$('#aim-challenge');if(!demo)return;
  event.preventDefault();demo.scrollIntoView({behavior:'smooth',block:'start'});
 });
}
function routines(screen){
 const title=$('.r17-training-grid .r17-train-left .r17-panel-title h2',screen);bindV3Locale(title,'Mon entraînement','My training');
 const sidebar=$$('.r17-train-left .r17-metric',screen);
 const labels=[['Durée moyenne','Average session duration'],['Séances terminées','Completed sessions'],['Précision moyenne','Average accuracy'],['Jours consécutifs','Current streak'],['Objectif hebdo','Weekly goal']];
 sidebar.forEach((el,i)=>{const span=$('span',el);if(span&&labels[i])bindV3Locale(span,...labels[i]);});
 const stats=()=>window.AIMWeb?.getStore?.();
 const update=()=>{
  const store=stats();if(!store)return;
  const sessions=Array.isArray(store.sessions)?store.sessions:[];
  const s=computeStats(sessions,store.weeklyGoal||3);
  const avgDuration=s.count?(s.minutes/s.count):null;
  const dur=$('[data-r17-minutes]',screen);if(dur)dur.textContent=avgDuration===null?'—':Math.round(avgDuration)+' min';
  const list=$$('.r17-weekday',screen);
  const today=new Date();
  const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const dayIndex=start.getDay();
  start.setDate(start.getDate()-((dayIndex+6)%7));
  let done=0;
  for(const [i,el] of list.entries()){
   const day=new Date(start);day.setDate(start.getDate()+i);
   const key=dateKey(day);
   const has=sessions.some(x=>dateKey(x.date)===key);
   el.classList.toggle('r20-complete',has);
   if(has)done++;
   el.setAttribute('title',has?words('Séance enregistrée','Recorded session'):words('Aucune séance enregistrée','No recorded session'));
  }
  const weekly=$('[data-r17-week]',screen);if(weekly)weekly.textContent=done+' / 5';
  const bar=$('[data-r17-week-meter]',screen);if(bar)bar.style.width=(done/5*100)+'%';
  renderGraph(sessions,screen);
 };
 const chartHost=$('[data-r17-chart]',screen);
 if(chartHost){
  const root=chartHost.parentElement;
  const tabs=document.createElement('div');
  tabs.className='ar20-tabbar';tabs.setAttribute('role','group');tabs.setAttribute('aria-label',words('Mesure affichée','Displayed metric'));
  const options=[['accuracy','Précision','Accuracy'],['tracking','Tracking','Tracking'],['reaction','Réaction','Reaction'],['consistency','Régularité','Consistency']];
  tabs.innerHTML=options.map(([key,fr,en],i)=>'<button type="button" data-ar20-chart="'+key+'" aria-pressed="'+(i===0)+'"><span class="fr">'+fr+'</span><span class="en">'+en+'</span></button>').join('');
  root.insertBefore(tabs,chartHost);
  tabs.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;
   $$('button',tabs).forEach(x=>x.setAttribute('aria-pressed',String(x===button)));
   renderGraph(stats()?.sessions||[],screen);
  });
 }
 function renderGraph(sessions,screen){
  if(!chartHost)return;
  const type=$('[data-ar20-chart][aria-pressed=true]',screen)?.dataset.ar20Chart||'accuracy';
  const sevenDays=sessions.filter(x=>Date.now()-Date.parse(x.date)<7*86400000&&Date.now()-Date.parse(x.date)>=0);
  const scores=sevenDays.filter(x=>Number.isFinite(x.accuracy)).sort((a,b)=>a.date.localeCompare(b.date));
  if(type==='reaction'){
   chartHost.innerHTML='<div class="ar20-empty">'+words('Temps de réaction non mesuré par les séances actuelles.','Reaction time is not measured by current sessions.')+'</div>';
   return;
  }
  if(type==='consistency'){
   const counts=Array(7).fill(0);for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-6+i);counts[i]=sevenDays.filter(s=>dateKey(s.date)===dateKey(d)).length}
   chartHost.innerHTML=bars(counts);
   return;
  }
  const relevant=type==='tracking'?scores.filter(x=>x.focus==='tracking'):scores;
  if(!relevant.length){chartHost.innerHTML='<div class="ar20-empty">'+words('Enregistre des résultats pour afficher ta courbe.','Record sessions to display your trend.')+'</div>';return}
  const pts=relevant.slice(-16);
  const width=330,height=150,x=i=>22+(pts.length===1?145:(i/(pts.length-1))*284),y=v=>135-(v/100)*113;
  const points=pts.map((v,i)=>x(i)+','+y(v.accuracy)).join(' ');
  const fill=pts.map((v,i)=>(i?'L':'M')+x(i)+' '+y(v.accuracy)).join(' ')+'L'+x(pts.length-1)+' 135 L'+x(0)+' 135Z';
  const gr=['25','50','75','100'].map(t=>'<line x1="20" y1="'+y(+t)+'" x2="313" y2="'+y(+t)+'" stroke="#4e7180" stroke-opacity=".35"/>').join('');
  chartHost.innerHTML='<svg class="ar20-graph" viewBox="0 0 330 150" aria-label="'+words('Précision des séances enregistrées','Recorded session accuracy')+'" role="img"><defs><linearGradient id="ar20-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ff5b69" stop-opacity=".42"/><stop offset="1" stop-color="#ff5b69" stop-opacity="0"/></linearGradient></defs>'+gr+'<path d="'+fill+'" fill="url(#ar20-fill)"/><polyline points="'+points+'" fill="none" stroke="#ff6475" stroke-width="2.5"/>'+pts.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v.accuracy)+'" r="3.2" fill="#ff6778" stroke="#ffbdc7" stroke-width="1"/>').join('')+'</svg>';
 }
 function bars(counts){
  const max=Math.max(1,...counts);
  return '<svg class="ar20-graph" viewBox="0 0 330 150" role="img" aria-label="'+words('Séances des sept derniers jours','Sessions over last seven days')+'">'+counts.map((n,i)=>{const h=n/max*100;return '<rect x="'+(28+i*42)+'" y="'+(130-h)+'" width="25" height="'+h+'" rx="3" fill="'+(n?'#37e3dd':'#315064')+'"/><text x="'+(40+i*42)+'" y="145" font-size="10" fill="#b0cbdb" text-anchor="middle">'+(i+1)+'</text>'}).join('')+'</svg>';
 }
 const output=$('.r17-chart-caption strong',screen);
 if(output){const f=()=>{const ss=stats();if(!ss)return;const vals=ss.sessions.filter(s=>Number.isFinite(s.accuracy));output.textContent=vals.length?(vals.reduce((n,x)=>n+x.accuracy,0)/vals.length).toFixed(1)+' %':'—'};f();window.addEventListener('aim-store-updated',f)}
 window.addEventListener('aim-v5-ready',update);
 window.addEventListener('aim-store-updated',update);
 window.addEventListener('aim-cloud-data-changed',update);
 window.addEventListener('aim-sync-applied',update);
 window.addEventListener('aim-v3-locale-changed',()=>{
  const tabbar=$('.ar20-tabbar',screen);
  if(tabbar)tabbar.setAttribute('aria-label',words('Mesure affichée','Displayed metric'));
  update();
 });
 update();
}
function account(screen){
 // Reuse the real Supabase auth panel and its existing login/signup handlers.
 // Change only the visible heading composition to match the supplied Cloud PNG.
 const authRoot=$('#auth-panel',screen)||document.querySelector('#auth-panel');
 if(authRoot&&!$('.r17-auth-reference-heading',authRoot)){
  const heading=$('#ar7-auth-title',authRoot);
  const subtitle=$('.ar7-eyebrow',authRoot);
  if(heading&&subtitle){
   const wrap=document.createElement('div');wrap.className='r17-auth-reference-heading';
   const glyph=document.createElement('span');glyph.className='r17-auth-reference-icon';
   glyph.setAttribute('aria-hidden','true');
   glyph.innerHTML='<svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="9" r="5"/><path d="M4 29v-3c0-6 5-11 12-11 2 0 4 .5 5.5 1.6"/><path d="M25 19v10M20 24h10"/></svg>';
   const copy=document.createElement('div');copy.className='r17-auth-reference-copy';
   authRoot.insertBefore(wrap,heading);wrap.append(glyph,copy);copy.append(heading,subtitle);
   const signupMode=$('#signup-mode',authRoot);
   const refresh=()=>{
    const onSignup=signupMode?.getAttribute('aria-pressed')==='true';
    bindV3Locale(heading,onSignup?'Créer un compte':'Connexion',onSignup?'Create an account':'Sign in');
    bindV3Locale(subtitle,onSignup?'Rejoins AimRoutine Tracker gratuitement.':'Connecte-toi à ton compte AimRoutine Tracker.',
     onSignup?'Join AimRoutine Tracker for free.':'Sign in to your AimRoutine Tracker account.');
   };
   if(signupMode)new MutationObserver(refresh).observe(signupMode,{attributes:true,attributeFilter:['aria-pressed']});
   refresh();
  }
 }
 const benefit=$('.r17-account-benefits',screen);
 if(benefit){
  // Reuse the same visible elements on a FR/EN switch: never recreate
  // the profile or any auth control, and never reset entered form values.
  const descriptions=[
   ['☁','Progression partagée','Shared progress','Sur tous tes appareils','Across your devices'],
   ['▱','Paramètres unifiés','Unified settings','Une expérience cohérente','Consistent experience'],
   ['⬡','Données protégées','Protected data','Privées et sauvegardées','Private and backed up']
  ];
  $$('.r17-account-benefits>span',screen).forEach((it,i)=>{
   const entry=descriptions[i];if(!entry)return;
   it.replaceChildren(document.createTextNode(entry[0]+' '));
   const copy=document.createElement('span');copy.className='r17-benefit-copy';
   const headline=document.createElement('strong');
   const detail=document.createElement('small');
   bindV3Locale(headline,entry[1],entry[2]);
   bindV3Locale(detail,entry[3],entry[4]);
   copy.append(headline,detail);it.append(copy);
  });
 }
 const devices=$('.r17-cloud-devices',screen);
 if(devices)bindV3Locale($('p',devices),
  'La liste des appareils n’est pas disponible dans ton compte : aucun appareil fictif n’est affiché.',
  'Device history is unavailable: no fictional devices are displayed.');
 // The guest CTA opens the REAL Supabase registration UI. It does not create
 // a duplicate account form, touch a password, or write to local storage.
 const loginPanel=$('#auth-panel');
 const authArea=$('.r17-account-auth',screen);
 let registrationCard=$('.r17-guest-registration',screen);
 if(authArea&&loginPanel&&!registrationCard){
  registrationCard=document.createElement('section');
  registrationCard.className='r17-guest-registration r17-panel';
  registrationCard.setAttribute('aria-labelledby','r17-guest-registration-heading');
  registrationCard.innerHTML=
   '<div class="r17-guest-registration-heading"><span class="r17-icon" aria-hidden="true">✓</span><div><h2 id="r17-guest-registration-heading"></h2><p></p></div></div>'+
   '<ul><li></li><li></li><li></li></ul>'+
   '<button type="button" class="r17-guest-signup-button"><span class="r17-guest-signup-label"></span> <span aria-hidden="true">›</span></button>';
  bindV3Locale($('#r17-guest-registration-heading',registrationCard),'Créer un compte','Create an account');
  bindV3Locale($('.r17-guest-registration-heading p',registrationCard),
   'Rejoins AimRoutine Tracker gratuitement.','Join AimRoutine Tracker for free.');
  const items=$$('li',registrationCard);
  bindV3Locale(items[0],'Sauvegarde et synchronise ta progression','Save and sync your progress');
  bindV3Locale(items[1],'Accède à tes routines et tes statistiques','Access your routines and statistics');
  bindV3Locale(items[2],'Personnalise ton espace d’entraînement','Customize your training workspace');
  bindV3Locale($('.r17-guest-signup-label',registrationCard),
   'Créer un compte gratuitement','Create a free account');
  loginPanel.after(registrationCard);
  $('.r17-guest-signup-button',registrationCard)?.addEventListener('click',()=>{
   $('#signup-mode')?.click();
   $('#auth-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
   $('#signup-username')?.focus({preventScroll:true});
  });
 }
 const dashboard=$('#dashboard-panel');
 if(dashboard){
  const show=()=>{
   const active=!dashboard.hidden;
   if(registrationCard)registrationCard.hidden=active;
   const username=$('[data-r17-username]',screen);
   if(username){
    if(active){
     // This node may display the authenticated pseudonym: NEVER overwrite it
     // on subsequent language changes.
     delete username.dataset.r20Fr;
     delete username.dataset.r20En;
    }else{
     bindV3Locale(username,'Connecte-toi à ton profil','Sign in to your profile');
    }
   }
   const sync=$('[data-r17-sync-copy]',screen);
   if(active){
    bindV3Locale(sync,
     'Compte connecté. Consulte l’état réel de la synchronisation dans ton tableau de bord.',
     'Account connected. Check the actual synchronization status in your dashboard.');
   }else{
    bindV3Locale(sync,
     'Connecte-toi pour synchroniser automatiquement tes données.',
     'Sign in to synchronize your data automatically.');
   }
   const label=$('[data-r17-cloud-label]',screen);
   if(active)bindV3Locale(label,'Compte connecté','Account connected');
   else bindV3Locale(label,'Cloud non connecté','Cloud not signed in');
  };
  new MutationObserver(show).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
  show();
 }
}
function progress(screen){
 const source=$('#v14-source-status');
 const panel=$('#v14-p-skills-panel');
 if(panel){
  bindV3Locale($('.v14-panel-head h2',panel),'Résumé de tes entraînements','Your training summary');
  bindV3Locale($('.v14-panel-head small',panel),
   'Répartition des séances par compétence (données réelles)','Real distribution of sessions by skill');
 }
 const btn=$('.v14-progress-toolbar',screen);
 if(btn){
  const label=document.createElement('span');
  label.className='ar20-progress-period';
  bindV3Locale(label,'Mes résultats personnels','My real personal results');
  btn.append(label);
 }
 bindV3Locale($('.v14-data-footnote',screen),
  'Toutes les mesures proviennent de séances enregistrées sur ton compte. La précision moyenne de scénarios différents ne constitue pas un classement VALORANT. Les temps de réaction ne sont pas mesurés par le suivi actuel.',
  'Figures use real recorded account sessions. Accuracy across different scenarios is not a VALORANT rank; reaction time is not measured yet.');
 const notice=document.createElement('section');
 notice.className='ar20-progress-advanced';
 notice.innerHTML='<div><strong></strong><div class="ar20-profile-note"></div></div><a href="training.html#panel-builder"></a>';
 bindV3Locale($('strong',notice),'Prochaine étape — un résultat comparable','Next step — a comparable result');
 bindV3Locale($('.ar20-profile-note',notice),
  'Rejoue le même scénario et enregistre sa précision pour suivre ta tendance.',
  'Repeat the same scenario and log accuracy to track your trend.');
 bindV3Locale($('a',notice),'▶ Lancer une routine ciblée','▶ Start a focused routine');
 const secondary=$('.r17-secondary-grid',screen);if(secondary)secondary.after(notice);
 const oldCharts=$$('#v14-p-line-panel svg,#v14-p-bars-panel svg');
 oldCharts.forEach(svg=>{svg.style.filter='drop-shadow(0 0 3px rgba(55,227,221,.25))'});
 if(source){
  new MutationObserver(()=>{
   const guest=source.textContent.includes('Connecte-toi')||source.textContent.includes('Sign in');
   screen.classList.toggle('ar20-guest',guest);
  }).observe(source,{childList:true,subtree:true});
 }
}

/* V3: replace platform-dependent text glyphs with a deterministic local SVG
   set. No remote icon CDN, no new library, no new user data. */
/* Reference nav does not include the EN pill. Relocate the EXISTING
   language control to the shared footer; retain its original listeners,
   keyboard access and English/French settings. Do not duplicate it. */
function relocateV3LanguageSwitch(){
 const switcher=document.querySelector('.site31-header [data-switch-lang]');
 const footer=document.querySelector('.site31-footer-inner')||document.querySelector('footer');
 if(!switcher||!footer||footer.querySelector('.ar-v3-language-footer'))return;
 const holder=document.createElement('div');
 holder.className='ar-v3-language-footer';
 const label=document.createElement('span');
 label.textContent='FR / EN';
 label.setAttribute('aria-hidden','true');
 holder.append(label,switcher);
 const meta=footer.querySelector('.site31-footer-meta');
 if(meta)meta.before(holder);else footer.append(holder);
}

function installV3Icons(screen){
 const form=part=>'<svg class="ar-v3-symbol" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">'+part+'</svg>';
 const paths={
  '⌖':'<circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3.1"/><path d="M16 1v7M16 24v7M1 16h7M24 16h7"/>',
  '◎':'<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="4"/><path d="M16 0v5M16 27v5M0 16h5M27 16h5"/>',
  '▱':'<path d="M16 2 29 9 16 16 3 9 16 2Z"/><path d="m3 15 13 7 13-7M3 21l13 8 13-8"/>',
  '▥':'<path d="M4 25V17h5v8M13 25V10h5v15M22 25V4h5v21"/><path d="M3 28h26"/>',
  '▦':'<rect x="3" y="5" width="26" height="25" rx="2"/><path d="M3 12h26M10 2v6M22 2v6M9 18h3m4 0h3m4 0h1m-15 6h3m4 0h3"/>',
  '◷':'<circle cx="16" cy="17" r="12"/><path d="M16 9v9l6 4M12 1h8"/>',
  '✓':'<circle cx="16" cy="16" r="12"/><path d="m9 16 5 5 10-11"/>',
  '☁':'<path d="M9 25h15a6 6 0 0 0 0-12 9 9 0 0 0-17-1 7 7 0 0 0 2 13Z"/>',
  '⚙':'<path d="M13 2h6l1 4 3 1 4-2 4 6-3 3v4l3 3-4 6-4-2-3 1-1 4h-6l-1-4-3-1-4 2-4-6 3-3v-4l-3-3 4-6 4 2 3-1 1-4Z"/><circle cx="16" cy="16" r="5"/>',
  '⚑':'<path d="M6 29V3m0 2c6-4 11 4 21 0v15c-10 4-15-4-21 0"/>',
  '◇':'<path d="m16 3 13 8-13 8-13-8 13-8Zm-13 15 13 8 13-8M3 24l13 7 13-7"/>',
  '♛':'<path d="M6 24 4 9l8 6 4-11 4 11 8-6-2 15H6Zm0 5h20"/>',
  '♕':'<path d="M4 9 12 15 16 4l4 11 8-6-2 16H6L4 9Zm2 20h20"/>',
  '⬡':'<path d="M16 2 28 7v11c0 6-5 10-12 13C9 28 4 24 4 18V7L16 2Z"/><path d="m10 16 5 5 8-10"/>',
  '⌄⌄':'<path d="m3 5 13 9L29 5M3 12l13 9 13-9M3 19l13 9 13-9"/>',
  '♨':'<path d="M14 3c0 6-6 8-6 15a8 8 0 0 0 16 0c0-4-2-7-5-10 0 5-4 7-5 10-2-4-1-8 0-15Z"/>',
  '↗':'<path d="M4 25 13 16l5 4 10-13M20 7h8v8"/>',
  '▥▥':'<path d="M5 24v-7m6 7V12m6 12V8m6 16V4" stroke-width="3.5"/>'
 };
 const selectors='.r17-icon,.r17-stat-icon,.r17-level-symbol,.r17-reticle,.r17-challenge-target,.r17-path > span:first-child,.r17-progress-wrap .v14-glyph,.r17-account-wrap .r17-profile-cloud>span,.r17-account-wrap .r17-cloud-status>span';
 const update=()=>{
  for(const el of $$(selectors,screen)){
   if(el.querySelector('svg'))continue;
   const key=el.textContent.trim();
   const shape=paths[key];
   if(!shape)continue;
   el.replaceChildren();
   el.insertAdjacentHTML('afterbegin',form(shape));
  }
 };
 update();
 // Preserve both FR and EN account-benefit labels while replacing only their
 // decorative Unicode glyphs. This never changes account state or Cloud data.
 for(const label of $$('.r17-account-benefits>span',screen)){
  if(label.querySelector('svg'))continue;
  const first=label.firstChild;
  if(!first||first.nodeType!==3)continue;
  const glyph=(first.nodeValue||'').trim().charAt(0);
  if(!paths[glyph])continue;
  first.nodeValue=(first.nodeValue||'').replace(/^\s*[^\s]+\s*/,'');
  label.insertAdjacentHTML('afterbegin',form(paths[glyph]));
 }
 // The real training builder rerenders its preview after a level/day change.
 screen.addEventListener('click',event=>{
  if(event.target.closest('[data-r17-level],[data-r17-day]'))queueMicrotask(update);
 });
}


/* V3 source-aligned Progress page. Move existing live panels rather than create
   a second statistics engine: all values remain from the real session store.
   No sample values, artificial reaction times, or simulated sessions. */
function installV3ProgressComposition(screen){
 const secondary=$('.r17-secondary-grid',screen);
 const records=$('#v14-p-records',secondary);
 const goal=$('#v14-p-goals',secondary);
 const next=$('#v14-p-next',secondary);
 if(!secondary||!records||!goal||!next||$('.r17-progress-bottom',screen))return;
 const panel=(className,headFr,headEn,subFr,subEn,icon)=>{
  const node=document.createElement('section');
  node.className='v14-panel '+className;
  const head=document.createElement('div');head.className='v14-panel-head';
  head.innerHTML='<span class="v14-glyph" aria-hidden="true">'+icon+'</span><div><h2></h2><small></small></div>';
  bindV3Locale($('h2',head),headFr,headEn);
  bindV3Locale($('small',head),subFr,subEn);
  node.append(head);return node;
 };
 const streak=panel('r17-progress-streak','Séries d’entraînement','Training streaks',
  'Des valeurs enregistrées, sans estimation','Only recorded values, no estimates','♨');
 const statrow=document.createElement('div');statrow.className='r17-progress-streak-stats';
 const data=[
  ['Série en cours','Current streak','#v14-p-streak-detail'],
  ['Séances (7 jours)','Sessions (7 days)','#v14-p-week']
 ];
 for(const [fr,en,selector] of data){
  const tile=document.createElement('div');tile.className='r17-progress-live-metric';
  const number=document.createElement('strong');number.textContent='—';
  const caption=document.createElement('small');bindV3Locale(caption,fr,en);
  tile.append(number,caption);statrow.append(tile);
  const source=$(selector,screen);
  if(source){
   const sync=()=>{number.textContent=source.textContent?.trim()||'—';};
   new MutationObserver(sync).observe(source,{childList:true,subtree:true,characterData:true});
   sync();
  }
 }
 streak.append(statrow);
 const journey=panel('r17-progress-journey','Ton parcours d’entraînement','Your training path',
  'Programme et routines enregistrées','Saved program and routines','▱');
 const journeyContents=document.createElement('div');journeyContents.className='r17-progress-journey-body';
 journeyContents.innerHTML='<div><strong></strong><p></p></div><a href="training.html#panel-program"></a>';
 bindV3Locale($('strong',journeyContents),'Retrouve ton programme','Find your program');
 bindV3Locale($('p',journeyContents),'Consulte ton parcours et reprends tes exercices.','Review your path and resume your exercises.');
 bindV3Locale($('a',journeyContents),'Voir mes programmes ↗','View my programs ↗');
 journey.append(journeyContents);
 secondary.append(streak,journey);
 // Keep the existing real weekly goal DOM, including its interactions.
 const lower=document.createElement('div');lower.className='r17-progress-bottom';
 const goals=document.createElement('section');goals.className='v14-panel r17-progress-goals-overview';
 const head=document.createElement('div');head.className='r17-progress-bottom-head';
 head.innerHTML='<div><h2></h2><small></small></div><a href="training.html#panel-dashboard"></a>';
 bindV3Locale($('h2',head),'Objectifs et indicateurs','Goals and indicators');
 bindV3Locale($('small',head),'Ton suivi basé sur les séances réellement enregistrées.','Tracking based on your actual recorded sessions.');
 bindV3Locale($('a',head),'Gérer mes objectifs ↗','Manage goals ↗');
 goals.append(head);
 const tiles=document.createElement('div');tiles.className='r17-progress-goal-tiles';
 for(const [titleFr,titleEn,sourceSelector,descFr,descEn] of [
  ['Précision moyenne','Average accuracy','#v14-p-average','Précision déclarée','Reported accuracy'],
  ['Séances terminées','Completed sessions','#v14-p-sessions','Données réelles','Actual data']
 ]){
  const tile=document.createElement('div');tile.className='r17-progress-goal-tile';
  const title=document.createElement('strong');bindV3Locale(title,titleFr,titleEn);
  const value=document.createElement('span');value.className='r17-progress-goal-value';value.textContent='—';
  const detail=document.createElement('small');bindV3Locale(detail,descFr,descEn);
  tile.append(title,value,detail);tiles.append(tile);
  const source=$(sourceSelector,screen);
  if(source){
   const sync=()=>{value.textContent=source.textContent?.trim()||'—';};
   new MutationObserver(sync).observe(source,{childList:true,subtree:true,characterData:true});
   sync();
  }
 }
 goal.classList.add('r17-progress-goal-tile','r17-progress-existing-goal');
 tiles.append(goal);goals.append(tiles);
 lower.append(goals,next);
 secondary.after(lower);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
