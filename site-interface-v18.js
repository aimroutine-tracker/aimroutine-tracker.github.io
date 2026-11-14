/* AimRoutine Tracker V18 — one navigable, working interface for the website.
   Presentation-only surfaces never fabricate player sessions or Cloud devices.
   Account, sync, training and analytics stay powered by the original engines. */
(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const tr = (fr,en) => '<span class="fr">'+fr+'</span><span class="en">'+en+'</span>';
  const route = location.pathname.split('/').pop() || 'index.html';
  const fr = () => document.documentElement.lang !== 'en';
  const tx = (a,b) => fr() ? a : b;

  function navigation() {
    const nav = $('.site31-nav'), links = $('.site31-links',nav || document);
    const controls = $('.site31-controls',nav || document);
    if (!nav || !links || !controls) return;
    document.body.classList.add('r18');
    const menu = [
      ['index.html',tr('Accueil','Home')],
      ['training.html',tr('Routines','Routines')],
      ['index.html#aim-challenge',tr('Défis AIM','AIM challenges')],
      ['progress.html',tr('Suivi de progression','Progress')],
      ['index.html#community',tr('Communauté','Community')]
    ];
    const active = route === 'index.html' ? 'index.html' : route;
    const make = (href,label) => '<a class="r18-navlink" href="'+href+'"'+
      (href === active ? ' aria-current="page"' : '')+'>'+label+'</a>';
    links.innerHTML = menu.map(item => make(item[0],item[1])).join('');
    $$('.v15-header-actions,.r17-nav-actions',nav).forEach(node => node.remove());
    const actions = document.createElement('div');
    actions.className = 'r18-actions r17-nav-actions';
    actions.innerHTML =
      '<a class="r18-cloud" href="account.html#dashboard-panel" title="'+tx('Compte et sauvegarde cloud','Account and cloud backup')+'">'+
      '<span class="r18-cloud-icon" aria-hidden="true">☁</span> Sync Cloud <span class="r18-cloud-indicator" aria-hidden="true"></span></a>'+
      '<a class="r18-signin" href="account.html#auth-panel">'+tr('Se connecter','Sign in')+'</a>'+
      '<a class="r18-register" href="account.html?mode=signup#auth-panel">'+tr('Créer un compte','Create account')+'</a>';
    if (route === 'account.html') {
      const current=document.createElement('a');
      current.className='r18-account-link';
      current.href='account.html#dashboard-panel';
      current.setAttribute('aria-current','page');
      current.innerHTML=tr('Mon compte','My account');
      const login=$('.r18-signin',actions);
      if(login)login.before(current);else actions.append(current);
    }
    controls.before(actions);
    const mobile = $('.site31-mobile-links');
    if (mobile) {
      mobile.innerHTML = menu.map(item => make(item[0],item[1])).join('')+
        make('account.html',tr('Compte / Cloud','Account / Cloud'))+
        '<hr class="r18-menu-rule">'+
        make('product.html',tr('Logiciel Windows','Windows software'))+
        make('releases.html',tr('Versions','Releases'))+
        make('updates.html',tr('Actualités du projet','Project updates'))+
        make('privacy.html',tr('Confidentialité','Privacy'));
    }
    const cloud = $('.r18-cloud',actions), signIn = $('.r18-signin',actions), register = $('.r18-register',actions);
    const dashboard = $('#dashboard-panel');
    if (route === 'account.html' && dashboard) {
      const syncState = () => {
        const signedIn = !dashboard.hidden;
        cloud.classList.toggle('r18-connected',signedIn);
        signIn.innerHTML = signedIn ? tr('Mon compte','My account') : tr('Se connecter','Sign in');
        signIn.href = signedIn ? 'account.html#dashboard-panel' : 'account.html#auth-panel';
        register.hidden = signedIn;
      };
      new MutationObserver(syncState).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
      syncState();
    }
  }

  function trainingDeepLinks() {
    if (route !== 'training.html') return;
    const tabs = new Set(['dashboard','builder','program','insights','challenges','coach','profile','data']);
    function jumpToTab() {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id.startsWith('panel-')) return;
      const suffix = id.slice(6);
      if (!tabs.has(suffix)) return;
      const tab = document.getElementById('tab-'+suffix);
      if (tab) tab.click();
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({block:'start',behavior:'auto'});
    }
    window.addEventListener('hashchange',jumpToTab);
    window.addEventListener('aim-v5-ready',jumpToTab,{once:true});
    window.addEventListener('load',jumpToTab,{once:true});
    if (window.AIMWeb) jumpToTab();
    installTrainingDrawer();
  }

  function installTrainingDrawer() {
    const panel = $('#panel-builder');
    if (!panel || !$('.r17-training-wrap')) return;
    const parent = panel.parentNode;
    const anchor = document.createComment('AimRoutine builder home');
    parent.insertBefore(anchor,panel);
    const dialog = document.createElement('dialog');
    dialog.className = 'r18-training-dialog';
    dialog.setAttribute('aria-label',tx('Séance AimRoutine','AimRoutine training session'));
    dialog.innerHTML =
      '<div class="r18-dialog-frame">'+
        '<div class="r18-dialog-head">'+
          '<div><small>/// AIMROUTINE TRACKER · LIVE WORKSPACE</small><h2>'+tr('Ta séance, dans ton interface','Your session, in your workspace')+'</h2>'+
          '<p>'+tr('Ces commandes utilisent tes vraies routines et enregistrent uniquement les résultats que tu saisis.','These controls use your real routines and only save results you enter.')+'</p></div>'+
          '<button type="button" class="r18-dialog-close" aria-label="'+tx('Fermer la séance','Close session')+'">✕</button>'+
        '</div><div class="r18-dialog-content"></div></div>';
    parent.insertBefore(dialog,panel);
    const dock = $('.r18-dialog-content',dialog);
    let closing = false;
    function restore() {
      if (closing) return;
      closing = true;
      if (anchor.parentNode && panel.parentNode !== anchor.parentNode) anchor.after(panel);
      else if(anchor.parentNode) anchor.after(panel);
      closing = false;
    }
    dialog.addEventListener('close',restore);
    $('.r18-dialog-close',dialog).addEventListener('click',() => dialog.close());
    dialog.addEventListener('click',event => {if (event.target === dialog) dialog.close();});
    function open() {
      const tab = $('#tab-builder');
      if (tab) tab.click();
      dock.append(panel);
      panel.hidden = false;
      if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
      else dialog.setAttribute('open','');
      dialog.scrollTop = 0;
    }
    // The v17 card first prepares the plan with the live builder. Then the same
    // actual builder, timer and session-entry form appear inside the designed UI.
    $$('[data-r17-create]').forEach(button => {
      button.addEventListener('click',() => queueMicrotask(open));
    });
    $$('a[href="#panel-builder"]',$('.r17-training-wrap')).forEach(link => {
      link.addEventListener('click',event => {event.preventDefault();open();});
    });
    document.addEventListener('keydown',event => {
      if(event.key === 'Escape' && dialog.open && typeof dialog.close === 'function') dialog.close();
    });
  }

  function fixHomeCards() {
    if(route !== 'index.html') return;
    const stats = $('.r17-home-wrap .r17-stats');
    if (stats) stats.setAttribute('aria-label',tx('Mes données enregistrées','My recorded statistics'));
    const cloud = $('.r17-stats [data-v15-stat="cloud"]');
    if(cloud) cloud.title=tx('Statut du service, pas une connexion garantie','Service status, not guaranteed sign-in');
  }

  function init() {
    navigation();
    trainingDeepLinks();
    fixHomeCards();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
