(() => {
  const details = document.getElementById('home-details');
  if (!details) return;

  function revealDemoLink(hash) {
    let id;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (!target || !details.contains(target)) return;
    let opened = false;
    for (let section = target.parentElement; section; section = section.parentElement) {
      if (section.matches('details') && !section.open) {
        section.open = true;
        opened = true;
      }
      if (section === details) break;
    }
    if (opened) target.scrollIntoView({ block: 'start' });
  }

  window.addEventListener('hashchange', () => revealDemoLink(location.hash));
  // A repeated click on the current hash doesn't fire hashchange.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href*="#"]');
    if (link?.origin === location.origin && link.pathname === location.pathname && link.hash === location.hash) {
      revealDemoLink(link.hash);
    }
  });
  revealDemoLink(location.hash);
})();
