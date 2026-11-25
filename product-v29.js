(() => {
  'use strict';

  const gallery = document.querySelector('.product311-gallery');
  const dialog = document.querySelector('.product311-dialog');
  if (!gallery || !dialog) return;

  const tabs = [...gallery.querySelectorAll('[data-shot]')];
  const dialogImage = dialog.querySelector('img');
  const close = dialog.querySelector('button');
  let opener;

  function select(tab, focus = false) {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    }
    if (focus) tab.focus();
  }

  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      let next;
      switch (event.key) {
        case 'ArrowRight': next = (index + 1) % tabs.length; break;
        case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
        case 'Home': next = 0; break;
        case 'End': next = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      select(tabs[next], true);
    });
  }

  for (const button of gallery.querySelectorAll('[data-enlarge]')) {
    button.addEventListener('click', () => {
      const source = button.querySelector('img');
      if (!source) return;
      opener = button;
      dialogImage.src = source.currentSrc || source.src;
      dialogImage.alt = source.alt;
      dialog.showModal();
    });
  }

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const { left, right, top, bottom } = dialog.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    opener?.focus({ preventScroll: true });
    opener = undefined;
  });

  function translateLabels() {
    const french = document.documentElement.lang === 'fr';
    for (const node of document.querySelectorAll('[data-label-fr]')) {
      node.setAttribute('aria-label', french ? node.dataset.labelFr : node.dataset.labelEn);
    }
    for (const image of document.querySelectorAll('img[data-alt-fr]')) {
      image.alt = french ? image.dataset.altFr : image.dataset.altEn;
    }
    if (opener) dialogImage.alt = opener.querySelector('img').alt;
  }

  translateLabels();
  new MutationObserver(translateLabels).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
