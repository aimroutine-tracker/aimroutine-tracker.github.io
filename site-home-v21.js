(() => {
  const details = document.getElementById('home-details');
  if (!details) return;

  function revealDemoLink() {
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const target = document.getElementById(id);
    if (!target || !details.contains(target) || details.open) return;
    details.open = true;
    target.scrollIntoView({ block: 'start' });
  }

  window.addEventListener('hashchange', revealDemoLink);
  revealDemoLink();
})();
