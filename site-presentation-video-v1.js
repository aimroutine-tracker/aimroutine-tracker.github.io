(() => {
  const video = document.querySelector('[data-presentation-video]');
  const download = document.querySelector('[data-presentation-download]');
  if (!video || !download) return;

  const media = {
    fr: {
      video: 'aimroutine-3122-presentation.mp4?v=4',
      poster: 'aimroutine-3122-poster.webp?v=2',
      captions: 'aimroutine-3122-captions-fr.vtt?v=4',
      label: 'Français'
    },
    en: {
      video: 'aimroutine-3122-presentation-en.mp4',
      poster: 'aimroutine-3122-poster-en.webp',
      captions: 'aimroutine-3122-captions-en.vtt',
      label: 'English'
    }
  };

  const source = document.createElement('source');
  source.type = 'video/mp4';
  let captions;
  let currentLanguage;
  let savedPlayback;

  function syncLanguage() {
    const language = document.documentElement.lang === 'en' ? 'en' : 'fr';
    if (language === currentLanguage) return;

    if (currentLanguage && !savedPlayback) {
      savedPlayback = {
        position: video.currentTime,
        playing: !video.paused && !video.ended,
        speed: video.playbackRate,
        captionsMode: captions.track.mode
      };
    }
    currentLanguage = language;

    const selected = media[language];
    source.src = selected.video;
    captions = document.createElement('track');
    captions.kind = 'captions';
    captions.src = selected.captions;
    captions.srclang = language;
    captions.label = selected.label;

    download.href = selected.video;
    video.poster = selected.poster;
    video.replaceChildren(source, captions);
    video.load();
  }

  video.addEventListener('loadedmetadata', () => {
    if (!savedPlayback || video.currentSrc !== source.src) return;
    const { position, playing, speed, captionsMode } = savedPlayback;
    savedPlayback = undefined;

    video.currentTime = Math.min(position, video.duration);
    video.playbackRate = speed;
    captions.track.mode = captionsMode;
    if (playing && video.currentTime < video.duration) {
      video.play().catch(() => {
        // Keep the native play control available if the browser requires another click.
      });
    }
  });

  syncLanguage();
  new MutationObserver(syncLanguage).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang']
  });
})();
