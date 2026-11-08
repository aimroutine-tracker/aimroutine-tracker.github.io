(async function aimReferenceV21(){
  const {createRoutine,computeStats,TOOLS}=await import('./training-core-v5.mjs');
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const route=location.pathname.split('/').pop()||'index.html';
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lang=(fr,en)=>document.documentElement.lang==='en'?en:fr;
  const paths={home:'index.html',training:'training.html',account:'account.html',progress:'progress.html'};
  const shapes={
    target:'<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="5"/><path d="M24 2v9M24 37v9M2 24h9M37 24h9"/>',
    calendar:'<rect x="7" y="10" width="34" height="31" rx="3"/><path d="M16 4v12M32 4v12M7 20h34M15 28h5m9 0h5m-19 7h5"/>',
    cloud:'<path d="M12 36h24a10 10 0 0 0 1-20 14 14 0 0 0-26-2A11 11 0 0 0 12 36Z"/>',
    layers:'<path d="m24 6 19 11-19 10L5 17 24 6Zm-19 20 19 10 19-10M5 34l19 10 19-10"/>',
    bars:'<path d="M8 40V26h8v14M21 40V17h8v23M34 40V8h8v32"/>',
    arrow:'<path d="m6 35 13-13 9 6 14-17M33 11h9v9"/>',
    timer:'<circle cx="24" cy="26" r="17"/><path d="M24 9V3m-8 0h16M24 16v11l8 4"/>',
    trophy:'<path d="M13 8h22v12a11 11 0 0 1-22 0V8ZM13 12H6v5a10 10 0 0 0 9 9m20-14h7v5a10 10 0 0 1-9 9M24 32v10m-10 2h20"/>',
    check:'<path d="m7 24 12 12 22-24"/>',
    shield:'<path d="m24 3 17 8v13c0 12-8 18-17 22C15 42 7 36 7 24V11L24 3Zm-8 21 6 6 11-12"/>',
    flame:'<path d="M25 45C9 43 6 31 14 21c1 7 6 9 5 1 0-8 9-13 8-20 15 16 19 27 11 37-3 4-8 6-13 6Z"/>',
    user:'<circle cx="24" cy="13" r="9"/><path d="M8 44V38c0-9 8-14 16-14s16 5 16 14v6"/>',
    settings:'<circle cx="24" cy="24" r="7"/><path d="m24 3 4 7 7 1 3 6-4 7 2 6-6 5-7-2-6 4-6-3-1-7-6-3 2-7 6-2 2-7Z"/>'
  };
  const icon=(name,size=28)=>`<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name]||shapes.target}</svg>`;
  const panel=(cls,html)=>`<section class="a21-panel ${cls}">${html}</section>`;
  const head=(i,h,d='')=>`<div class="a21-card-head"><span class="a21-iconbox">${icon(i,29)}</span><div><h2>${h}</h2><p>${d}</p></div></div>`;
  const cta=(label,href,outline=false)=>`<a class="a21-cta${outline?' a21-cta-line':''}" href="${href}">${outline?icon('target',21):'<span>▶</span>'}<strong>${label}</strong><span>›</span></a>`;
  const hero=(over,a,b,desc,actions='',benefits='')=>`<section class="a21-hero"><div class="a21-hero-art"></div><div class="a21-hero-gradient"></div><div class="a21-hero-inner"><small class="a21-overline">PLATEFORME D’ENTRAÎNEMENT AIM　//　${over}</small><h1><em>${a}</em> <strong>${b}</strong></h1><p>${desc}</p>${actions?`<div class="a21-hero-actions">${actions}</div>`:''}${benefits}</div></section>`;
  const challenge=()=>panel('a21-challenge',`<div class="a21-overline">/// &nbsp; DÉFI AIM DU MOMENT</div><div class="a21-challenge-head"><span class="a21-iconbox">${icon('target',38)}</span><div><h2>Mini Défi : Précision 1 min</h2><p>Teste ton AIM sur un challenge court et intense.</p></div></div><div class="a21-chips"><span>${icon('timer',17)} 1 minute</span><span>${icon('target',17)} Cibles dynamiques</span><span>${icon('bars',17)} Score réel</span></div>${cta('Lancer le défi maintenant','index.html#aim-challenge')}`);
  function home(){
    const kpis=[['calendar','sessions','SÉANCES D’ENTRAÎNEMENT'],['target','accuracy','PRÉCISION MOYENNE'],['arrow','week','OBJECTIF HEBDOMADAIRE'],['cloud','cloud','SYNC CLOUD']];
    const cards=[['target','Améliore ton AIM','Des entraînements ciblés et efficaces pour développer précision, réactivité et régularité.','training.html'],['layers','Structure ta routine','Des routines prêtes à l’emploi et personnalisables, adaptées à ton niveau et tes objectifs.','training.html#panel-builder'],['bars','Suis ta progression','Des statistiques détaillées, des courbes d’évolution et des objectifs clairs pour mesurer tes progrès.','progress.html']];
    const paths=[['layers','Fondations','DÉBUTANT','Pose les bases : contrôle, précision et régularité.','iron','~10–15 min / jour'],['target','Progression','INTERMÉDIAIRE','Renforce ta précision, ta vitesse et ta constance en duel.','silver','~15–25 min / jour'],['trophy','Performance','COMPÉTITIF','Passe un cap : performance, régularité et haut niveau.','immortal','~20–30 min / jour']];
    return hero('TRACK · TRAIN · IMPROVE','Routine AIM','nouvelle génération','La plateforme conçue pour t’aider à améliorer ton AIM, structurer ta routine d’entraînement et suivre ta progression avec des statistiques claires, des défis stimulants et des parcours adaptés à ton niveau.',cta('Commencer','training.html')+cta('Découvrir le défi AIM','#aim-challenge',true))+
    `<div class="a21-content"><div class="a21-kpis">${kpis.map(([i,k,l])=>`<div class="a21-kpi">${icon(i,39)}<div><b data-a21-home="${k}">—</b><small>${l}</small></div></div>`).join('')}</div><div class="a21-feature-grid">${cards.map(([i,h,d,url])=>`<a class="a21-panel a21-feature" href="${url}"><span class="a21-iconbox">${icon(i,40)}</span><div><h2>${h}</h2><p>${d}</p></div><span class="a21-feature-art">${icon(i,94)}</span></a>`).join('')}</div><div class="a21-home-bottom"><div><div class="a21-overline">/// &nbsp; PARCOURS DE PROGRESSION</div><h2 class="a21-bottom-title">Choisis ton chemin de progression</h2><p class="a21-subtitle">Des parcours structurés pour tous les joueurs, du débutant au compétitif.</p><div class="a21-paths">${paths.map(([i,h,lev,d,key,dur],n)=>`<a class="a21-path a21-path-${n}" href="training.html?level=${key}#panel-builder"><div class="a21-path-top">${icon(i,31)}<div><h3>${h}</h3><strong>${lev}</strong></div></div><p>${d}</p><footer><span>${icon('timer',16)} ${dur}</span><span>${icon('bars',16)} ${[4,5,6][n]} semaines</span><i>›</i></footer></a>`).join('')}</div></div>${challenge()}</div></div>`;
  }
  const dayLabels=[['Précision','flick','Précision & Contrôle'],['Tracking','tracking','Tracking fluide'],['Micro-correction','micro','Micro-correction'],['Vitesse & Réaction','control','Vitesse & contrôle'],['Routine complète','flick','Consolidation']];
  function training(){
    const metrics=[['timer','Durée de session','Durée moyenne','duration'],['check','Séances terminées','Enregistrées sur ton compte','sessions'],['bars','Consistance','Jours actifs (30 jours)','consistency'],['target','Précision moyenne','Résultats déclarés','accuracy'],['calendar','Objectif hebdo','Séances cette semaine','goal']];
    const lev=[['iron','Débutant','Bases, contrôle et régularité','layers'],['silver','Intermédiaire','Stabilité, précision et vitesse','target'],['immortal','Compétitif','Performance, constance et pression','trophy']];
    return hero('TRAIN　//　ROUTINES','Tes routines','d’entraînement','Des routines structurées et progressives pour améliorer ton AIM, ta précision, ton tracking et ta régularité. Choisis ton niveau, suis un plan quotidien et progresse avec des exercices ciblés et mesurables.',cta('Explorer les routines','#a21-plan')+cta('Créer une routine personnalisée','#panel-builder',true))+
    `<div class="a21-content a21-train-content"><div class="a21-training-grid"><aside class="a21-train-left">${panel('a21-summary',head('target','Mon entraînement','Vue globale de ta routine et de tes progrès.')+`<div class="a21-statrows">${metrics.map(([i,h,d,k])=>`<div class="a21-statrow">${icon(i,30)}<div><strong>${h}</strong><small>${d}</small></div><b data-a21-train="${k}">—</b></div>`).join('')}</div><div class="a21-meter"><span data-a21-meter></span></div>`)}${panel('a21-level-progress',head('layers','Niveau & progression','Ton niveau de routine actuel.')+`<strong class="a21-rankbadge" data-a21-rank>INTERMÉDIAIRE</strong><p>Un niveau d'entraînement, pas ton rang Riot.</p>`)}</aside><div class="a21-train-center"><div class="a21-levels" role="group" aria-label="Niveau">${lev.map(([id,h,d,i])=>`<button type="button" data-a21-level="${id}" aria-pressed="${id==='silver'}">${icon(i,32)}<span><strong>${h}</strong><small>${d}</small></span></button>`).join('')}</div>${panel('a21-plan',`<header class="a21-plan-head">${head('layers','Plan d’entraînement — <span data-a21-levelname>Intermédiaire</span>','Routine équilibrée (5 jours) pour renforcer ton AIM.')}<span>${icon('timer',18)} 5 jours / semaine · <b data-a21-minutes>~25 min / jour</b></span></header><div class="a21-days" role="group" aria-label="Jour">${dayLabels.map(([name],i)=>`<button type="button" data-a21-day="${i}" aria-pressed="${i===0}"><b>Jour ${i+1}</b><small>${name}</small></button>`).join('')}</div><div class="a21-plan-body"><div class="a21-day-detail"><strong data-a21-daylabel>Jour 1</strong><h3 data-a21-daytitle>Précision & Contrôle</h3><p>Renforce ta précision, ta stabilité et ton placement de crosshair.</p><div class="a21-day-target">${icon('target',91)}</div><footer>${icon('timer',17)} ~<span data-a21-daymins>25</span> min &nbsp; ${icon('bars',17)} <span data-a21-excount>3</span> exercices</footer></div><div class="a21-exercises" data-a21-exercises></div></div>`)}</div><aside class="a21-train-right">${panel('a21-train-stats',head('bars','Statistiques d’entraînement','Évolution des performances (7 derniers jours).')+`<div class="a21-charttabs" role="group">${['Précision','Tracking','Réaction','Régularité'].map((n,i)=>`<button type="button" data-a21-chart="${['accuracy','tracking','reaction','regularity'][i]}" aria-pressed="${i===0}">${n}</button>`).join('')}</div><div class="a21-livechart" data-a21-livechart></div><div class="a21-chartfooter"><span>Derniers résultats enregistrés</span><b data-a21-chartavg>—</b></div>`)}${challenge()}</aside></div>${panel('a21-week',`${head('calendar','Ta semaine d’entraînement','Aperçu de ta routine sur 5 jours.')}<div class="a21-weekdays">${dayLabels.map(([name],i)=>`<button type="button" data-a21-weekday="${i}"><b>${['Lun','Mar','Mer','Jeu','Ven'][i]}</b><small>Jour ${i+1} – ${name}</small><i data-a21-tick="${i}">○</i></button>`).join('')}</div><div class="a21-weekcounter"><b>Progression hebdo</b><strong data-a21-weeklabel>— / 5 jours</strong><div class="a21-meter"><span data-a21-weekbar></span></div></div>`)}</div>`;
  }
  function account(){
    const benefits=`<div class="a21-benefits">${[['cloud','Progression partagée','Sur tous tes appareils'],['layers','Paramètres unifiés','Une expérience cohérente'],['shield','Données protégées','Accès privé et sauvegarde']].map(([i,a,b])=>`<span>${icon(i,28)}<b>${a}</b><small>${b}</small></span>`).join('')}</div>`;
    return hero('COMPTE　/　SYNCHRONISATION CLOUD','Ton profil','cloud','Gère ton compte, synchronise ta progression dans le cloud et personnalise ton expérience AimRoutine Tracker sur tous tes appareils.','',benefits)+`<div class="a21-content a21-account-content">${panel('a21-profile',`<span class="a21-avatar"><img src="aimroutine-brand-a-v2.svg?v=1" alt="" width="56" height="56"></span><div class="a21-identity"><h2 data-a21-username>Ton compte AIM</h2><p data-a21-email>Connecte-toi pour accéder à ton profil.</p></div><div class="a21-profile-number"><small>SÉANCES</small><b data-a21-count>—</b></div><div class="a21-profile-number"><small>ROUTINES</small><b data-a21-routines>—</b></div><div class="a21-profile-cloud">${icon('cloud',49)}<span><b data-a21-cloudstatus>Connexion nécessaire</b><small>Synchronisation automatique du compte</small></span><a href="#a21-cloud">Détails ↗</a></div>`)}<div class="a21-account-grid"><div class="a21-auth-column">${panel('a21-login',head('user','Connexion','Connecte-toi à ton compte AimRoutine Tracker.')+'<div data-a21-auth></div>')}${panel('a21-signup',head('user','Créer un compte','Nouveau sur AimRoutine Tracker ? Rejoins la communauté.')+`<div class="a21-benefitlist"><span>✓ &nbsp; Sauvegarde automatique de ta progression</span><span>✓ &nbsp; Accède à tes routines sur tous tes appareils</span><span>✓ &nbsp; Personnalise ton expérience et tes préférences</span></div><button type="button" class="a21-cta a21-create-account" data-a21-signup>Créer un compte gratuitement &nbsp; ›</button>`)}</div><div class="a21-account-right">${panel('a21-cloud-card',`<div class="a21-cloud-header">${head('cloud','Synchronisation cloud','Garde tes routines, tes résultats et tes paramètres à jour sur tes appareils.')}<a href="privacy.html">Comment fonctionne le cloud ?</a></div><div class="a21-cloud-grid"><div class="a21-cloud-state">${icon('cloud',67)}<div><h3 data-a21-cloudtitle>Connexion nécessaire</h3><p data-a21-cloudtext>Connecte-toi pour synchroniser automatiquement tes données.</p><small>✓ &nbsp; Aucune synchronisation manuelle</small></div></div><div class="a21-device-list"><h3>${icon('layers',22)} Appareils synchronisés</h3><p>La liste des appareils n’est pas disponible. Aucun appareil fictif n’est affiché.</p><a href="privacy.html">Données privées et sécurisées ↗</a></div></div>`)}${panel('a21-prefs',head('settings','Préférences du compte','Personnalise l’interface et ton expérience d’entraînement.')+`<div class="a21-pref-grid"><div class="a21-pref">${icon('target',27)}<h3>Langue / Language</h3><p>Choisis la langue de l’interface.</p><select data-a21-language aria-label="Langue"><option value="fr">🇫🇷 Français (FR)</option><option value="en">🇬🇧 English (EN)</option></select></div><div class="a21-pref">${icon('shield',27)}<h3>Sécurité & confidentialité</h3><p>Gère les paramètres de ton compte en toute sécurité.</p><a href="#auth-panel">Gérer mon compte ↗</a></div><div class="a21-pref">${icon('target',27)}<h3>Préférences d’entraînement</h3><p>Adapte tes objectifs, ton niveau et tes routines.</p><a href="training.html#panel-profile">Ouvrir mes paramètres ↗</a></div></div>`)}</div></div></div>`;
  }
  function progress(){
    const kpis=[['target','accuracy','PRÉCISION MOYENNE'],['layers','streak','SÉRIE EN COURS'],['timer','minutes','MINUTES D’ENTRAÎNEMENT'],['calendar','sessions','SÉANCES TERMINÉES']];
    const graph=(i,h,d,k)=>panel('a21-chart',head(i,h,d)+`<div class="a21-nativechart" data-a21-chartnative="${k}"></div>`);
    return hero('ANALYTICS　//　SUIVI DE PROGRESSION','Suivi de','progression','Analyse tes performances, mesure tes progrès et optimise ta routine d’entraînement avec des statistiques détaillées, des tendances claires et des objectifs personnalisés.',cta('Mettre à jour mes données','training.html#panel-insights')+cta('Gérer mes objectifs','training.html#panel-dashboard',true))+`<div class="a21-content a21-progress-content"><div class="a21-kpis a21-progress-kpis">${kpis.map(([i,k,l])=>`<div class="a21-kpi">${icon(i,41)}<span><b data-a21-progress="${k}">—</b><small>${l}</small></span></div>`).join('')}</div><div class="a21-period-row"><span>Statistiques issues de tes séances réellement enregistrées</span><select data-a21-period aria-label="Période"><option value="7">7 jours</option><option value="30" selected>30 jours</option><option value="90">90 jours</option><option value="0">Tout</option></select></div><div class="a21-analytics-grid">${graph('arrow','Progression de la précision','Évolution de la précision moyenne dans le temps.','line')}${graph('bars','Séances par semaine','Nombre de séances réalisées.','bars')}${graph('target','Résumé des performances','Répartition de tes entraînements par compétence.','distribution')}</div><div class="a21-analytics-mid">${panel('a21-best',head('trophy','Meilleures performances (Personal Bests)','Tes résultats enregistrés par métrique.')+`<div class="a21-records"><span>Précision <b data-a21-record="best">—</b></span><span>Séances (7 j) <b data-a21-record="week">—</b></span><span>Série <b data-a21-record="current">—</b></span></div>`)}${panel('a21-streak',head('flame','Séries d’entraînement','Ta régularité et ton engagement.')+`<strong data-a21-record="streak">—</strong><small>jours consécutifs</small>`)}${panel('a21-currentpath',head('layers','Parcours d’entraînement actuel','Ton objectif de la semaine.')+`<strong data-a21-goal>—</strong><div class="a21-meter"><span data-a21-progressbar></span></div><a href="training.html#panel-program">Gérer le parcours ↗</a>`)}</div><div class="a21-analytics-bottom">${panel('a21-monthly',head('target','Objectifs de progression','Objectifs calculés avec tes vraies séances.')+`<div class="a21-goals"><div><b>Précision moyenne</b><strong data-a21-goalaccuracy>—</strong></div><div><b>Temps enregistré</b><strong data-a21-goalminutes>—</strong></div><div><b>Séances terminées</b><strong data-a21-goalsessions>—</strong></div></div>`)}${panel('a21-next',`<div class="a21-overline">/// &nbsp; PROCHAINE ÉTAPE — OBJECTIF CONSEILLÉ</div><h3>Améliorer ta précision</h3><p>Rejoue un même scénario dans des conditions comparables pour suivre tes progrès.</p>${cta('Lancer une routine ciblée','training.html#panel-builder')}`)}</div><p class="a21-legal-note">Données personnelles enregistrées : aucune statistique, temps de réaction, rang ou liste d’appareils n’est inventé.</p></div>`;
  }
  function boot(){
    const old=$('.r17-screen');if(!old)return;
    const html=route==='index.html'?home():route==='training.html'?training():route==='account.html'?account():route==='progress.html'?progress():null;
    if(!html)return;
    const ui=document.createElement('div');ui.id='aim-reference';ui.className='a21 a21-'+route.replace('.html','');ui.innerHTML=html;
    const anchor=route==='progress.html'?$(`main.v14-progress-main`):old;
    anchor.parentNode.insertBefore(ui,anchor);
    document.body.classList.add('a21-live');
    if(route==='index.html')homeLive(ui);
    if(route==='training.html')trainingLive(ui);
    if(route==='account.html')accountLive(ui);
    if(route==='progress.html')progressLive(ui);
  }
  function homeLive(ui){
    const parent=$('.r17-stats');
    const update=()=>{for(const k of ['sessions','accuracy','week','cloud']){const src=$(`[data-v15-stat="${k}"]`,parent||document),dest=$(`[data-a21-home="${k}"]`,ui);if(dest)dest.textContent=src?.textContent?.trim()||'—';}};
    if(parent)new MutationObserver(update).observe(parent,{subtree:true,childList:true,characterData:true});
    update();
    const challengeAnchor=$('#aim-challenge');
    $$('a[href="#aim-challenge"]',ui).forEach(a=>a.addEventListener('click',event=>{if(!challengeAnchor)return;event.preventDefault();challengeAnchor.scrollIntoView({behavior:'smooth',block:'start'});}));
  }
  function trainingLive(ui){
    const days=[['flick','Précision & Contrôle'],['tracking','Tracking fluide'],['micro','Micro-correction'],['control','Vitesse & contrôle'],['flick','Routine complète']];
    const levels={iron:['Débutant',15],silver:['Intermédiaire',25],immortal:['Compétitif',35]};
    let rank=new URLSearchParams(location.search).get('level');if(!Object.hasOwn(levels,rank))rank='silver';
    let day=0,chart='accuracy';
    const dateKey=s=>new Date(s).toLocaleDateString('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit'});
    function plan(){
      const [name,min]=levels[rank];
      $$('[data-a21-level]',ui).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.a21Level===rank)));
      $$('[data-a21-day]',ui).forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.a21Day)===day)));
      $('[data-a21-rank]',ui).textContent=name.toUpperCase();
      $('[data-a21-levelname]',ui).textContent=name;
      $('[data-a21-daylabel]',ui).textContent='Jour '+(day+1);
      $('[data-a21-daytitle]',ui).textContent=days[day][1];
      $('[data-a21-minutes]',ui).textContent='~'+min+' min / jour';
      $('[data-a21-daymins]',ui).textContent=min;
      const tool=TOOLS.includes($('.r19-tool-select')?.value)?$('.r19-tool-select').value:'VALORANT';
      const exercise=createRoutine(rank,days[day][0],tool,min,30).exercises;
      $('[data-a21-excount]',ui).textContent=exercise.length;
      $('[data-a21-exercises]',ui).innerHTML=exercise.map((ex,i)=>`<div class="a21-exercise"><span class="a21-exicon">${icon(['flame','target','bars'][i],25)}</span><div><b>${E(ex.name)}</b><small>${E(ex.tip)}</small></div><span class="a21-extime">${icon('timer',17)} ${ex.minutes} min</span><button type="button" data-a21-run>▶ Lancer</button></div>`).join('');
    }
    function startBuilder(){
      $(`[data-r17-level="${rank}"]`)?.click();$(`[data-r17-day="${day}"]`)?.click();
      const real=$('.r19-tool-btn[data-r19-panel="builder"]')||$('[data-r17-create]');
      if(real){real.click();return;}
      location.assign('training.html#panel-builder');
    }
    function chartPaint(sessions){
      const host=$('[data-a21-livechart]',ui),label=$('[data-a21-chartavg]',ui),seven=Date.now()-7*86400000;
      const sample=sessions.filter(x=>Date.parse(x.date)>=seven&&Date.parse(x.date)<=Date.now()).sort((a,b)=>a.date.localeCompare(b.date));
      if(chart==='reaction'){host.innerHTML='<div class="a21-no-data">Réaction non mesurée par les séances actuelles.</div>';label.textContent='—';return;}
      if(chart==='regularity'){
        const counts=Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()-6+i);return sample.filter(s=>dateKey(s.date)===dateKey(date)).length});
        const m=Math.max(1,...counts);
        host.innerHTML=`<svg viewBox="0 0 310 150" role="img" aria-label="Séances sur 7 jours">${counts.map((v,i)=>`<rect x="${16+i*43}" y="${130-100*v/m}" width="25" height="${100*v/m}" fill="#37e3dd"/><text x="${28+i*43}" y="147" font-size="10" fill="#c1d4de">${i+1}</text>`).join('')}</svg>`;
        label.textContent=counts.filter(Boolean).length+' / 7 j';return;
      }
      const s=sample.filter(x=>x.accuracy!==null&&(chart!=='tracking'||x.focus==='tracking')).slice(-18);
      if(!s.length){host.innerHTML='<div class="a21-no-data">Aucune précision enregistrée pour cette période.</div>';label.textContent='—';return;}
      label.textContent=(s.reduce((a,b)=>a+b.accuracy,0)/s.length).toFixed(1).replace('.',',')+' %';
      const xy=s.map((v,i)=>[(i/(Math.max(1,s.length-1))*277)+16,130-v.accuracy*1.1]);
      const points=xy.map(x=>x.join(',')).join(' ');
      host.innerHTML=`<svg viewBox="0 0 310 150" role="img" aria-label="Précision issue des séances"><defs><linearGradient id="a21-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ff5b69" stop-opacity=".55"/><stop offset="1" stop-color="#ff5b69" stop-opacity="0"/></linearGradient></defs>${[22,52,82,112].map(y=>`<path d="M15 ${y}H296" stroke="#435a69" opacity=".55"/>`).join('')}<polygon points="16,131 ${points} ${xy.at(-1)[0]},131" fill="url(#a21-fill)"/><polyline points="${points}" fill="none" stroke="#ff6476" stroke-width="2.8"/>${xy.map(x=>`<circle cx="${x[0]}" cy="${x[1]}" r="3.5" fill="#ff6476" stroke="#ffb8c2"/>`).join('')}</svg>`;
    }
    function update(){
      const store=window.AIMWeb?.getStore?.(),sessions=store?.sessions||[],s=computeStats(sessions,store?.weeklyGoal||3);
      const days30=new Set(sessions.filter(x=>Date.now()-Date.parse(x.date)<30*86400000).map(x=>dateKey(x.date))).size;
      const map={duration:s.count?Math.round(s.minutes/s.count)+' min':'—',sessions:s.count,consistency:days30+' j',accuracy:s.avg===null?'—':s.avg.toFixed(1).replace('.',',')+' %',goal:s.week+' / '+s.goal};
      Object.entries(map).forEach(([k,v])=>{$(`[data-a21-train="${k}"]`,ui).textContent=String(v)});
      $('[data-a21-meter]',ui).style.width=Math.min(100,s.week/s.goal*100)+'%';
      const mon=new Date();mon.setHours(0,0,0,0);mon.setDate(mon.getDate()-(mon.getDay()+6)%7);
      let count=0;
      $$('[data-a21-weekday]',ui).forEach((b,i)=>{const date=new Date(mon);date.setDate(mon.getDate()+i);const yes=sessions.some(x=>dateKey(x.date)===dateKey(date));if(yes)count++;b.classList.toggle('a21-complete',yes);$(`[data-a21-tick="${i}"]`,b).textContent=yes?'✓':'○';});
      $('[data-a21-weeklabel]',ui).textContent=count+' / 5 jours';$('[data-a21-weekbar]',ui).style.width=count*20+'%';
      chartPaint(sessions);
    }
    ui.addEventListener('click',e=>{
      const lv=e.target.closest('[data-a21-level]'),d=e.target.closest('[data-a21-day],[data-a21-weekday]'),tab=e.target.closest('[data-a21-chart]');
      if(lv){rank=lv.dataset.a21Level;plan();return;}
      if(d){day=Number(d.dataset.a21Day??d.dataset.a21Weekday);plan();return;}
      if(tab){chart=tab.dataset.a21Chart;$$('[data-a21-chart]',ui).forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));update();return;}
      if(e.target.closest('[data-a21-run]'))startBuilder();
    });
    ['aim-v5-ready','aim-store-updated','aim-cloud-data-changed','aim-sync-applied'].forEach(e=>window.addEventListener(e,update));
    $('.r19-tool-select')?.addEventListener('change',plan);
    if(!window.__aimCloudUserId){const note=$('.a21-summary .a21-card-head p',ui);if(note)note.textContent='Mode aperçu : aucune progression n’est sauvegardée sans compte.';}
    plan();update();
    $('a[href="#panel-builder"]',ui)?.addEventListener('click',e=>{e.preventDefault();startBuilder()});
  }
  function accountLive(ui){
    const auth=$('#auth-panel'),dash=$('#dashboard-panel'),username=$('#username-panel'),target=$('[data-a21-auth]',ui);
    const google=$('#google-login-wrap'),login=$('#login-form');if(google&&login)google.before(login);
    if(auth)target.append(auth);if(username)target.append(username);if(dash)target.append(dash);
    $('[data-a21-signup]',ui)?.addEventListener('click',()=>{const b=$('#show-signup')||$('#signup-link');if(b)b.click();else{const form=$('#signup-form');if(form)form.hidden=false;}$('#signup-form')?.scrollIntoView({block:'nearest',behavior:'smooth'});});
    const select=$('[data-a21-language]',ui);if(select){select.value=document.documentElement.lang==='en'?'en':'fr';select.addEventListener('change',()=>{if(select.value!==document.documentElement.lang)$('[data-switch-lang]')?.click()});}
    function update(){
      const signed=dash&&!dash.hidden;
      $('[data-a21-username]',ui).textContent=signed?($('#user-username')?.textContent?.trim()||'Compte connecté'):'Ton compte AIM';
      $('[data-a21-email]',ui).textContent=signed?($('#user-email')?.textContent?.trim()||'—'):'Connecte-toi pour accéder à ton profil.';
      $('[data-a21-count]',ui).textContent=signed?($('#cloud-sessions-count')?.textContent?.trim()||'—'):'—';
      $('[data-a21-routines]',ui).textContent=signed?($('#cloud-routines-count')?.textContent?.trim()||'—'):'—';
      $('[data-a21-cloudstatus]',ui).textContent=signed?'Sync Cloud : automatique':'Connexion nécessaire';
      $('[data-a21-cloudtitle]',ui).textContent=signed?'Synchronisation automatique':'Connexion nécessaire';
      $('[data-a21-cloudtext]',ui).textContent=signed?'Tes données se synchronisent automatiquement après chaque modification.':'Connecte-toi pour synchroniser automatiquement tes données.';
    }
    if(dash)new MutationObserver(update).observe(dash,{attributes:true,subtree:true,childList:true,characterData:true});update();
  }
  function progressLive(ui){
    for(const [from,to] of [['#v14-p-line','line'],['#v14-p-bars','bars'],['#v14-p-distribution','distribution']]){const native=$(from),host=$(`[data-a21-chartnative="${to}"]`,ui);if(native&&host)host.append(native);}
    const period=$('[data-a21-period]',ui),original=$('#v14-progress-range');
    if(period&&original){period.value=original.value;period.addEventListener('change',()=>{original.value=period.value;original.dispatchEvent(new Event('change',{bubbles:true}));read()});}
    const map={accuracy:'#v14-p-average',streak:'#v14-p-streak',minutes:'#v14-p-minutes',sessions:'#v14-p-sessions'};
    function read(){
      Object.entries(map).forEach(([k,q])=>{const dest=$(`[data-a21-progress="${k}"]`,ui);if(dest)dest.textContent=$(q)?.textContent?.trim()||'—';});
      for(const [k,q] of [['best','#v14-p-best'],['week','#v14-p-week'],['current','#v14-p-streak-detail'],['streak','#v14-p-streak-detail']]){const x=$(`[data-a21-record="${k}"]`,ui);if(x)x.textContent=$(q)?.textContent?.trim()||'—';}
      $('[data-a21-goal]',ui).textContent=$('#v14-p-goal')?.textContent?.trim()||'—';
      $('[data-a21-progressbar]',ui).style.width=$('#v14-p-goalbar')?.style.width||'0%';
      $('[data-a21-goalaccuracy]',ui).textContent=$('#v14-p-average')?.textContent?.trim()||'—';
      $('[data-a21-goalminutes]',ui).textContent=$('#v14-p-minutes')?.textContent?.trim()||'—';
      $('[data-a21-goalsessions]',ui).textContent=$('#v14-p-sessions')?.textContent?.trim()||'—';
    }
    ['#v14-p-average','#v14-p-goal','#v14-p-sessions','#v14-p-minutes'].forEach(q=>{const x=$(q);if(x)new MutationObserver(read).observe(x,{childList:true,subtree:true,characterData:true})});
    window.addEventListener('focus',read);read();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();