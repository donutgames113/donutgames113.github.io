(function () {
  const selector = document.getElementById('theme-selector');
  if (!selector) return;

  const storedTheme = localStorage.getItem('theme') || 'dark';
  const normalizedTheme = storedTheme === 'hutchinson' ? 'mediterranean' : storedTheme;
  document.documentElement.setAttribute('data-theme', normalizedTheme);
  selector.value = normalizedTheme;

  const reduceMotion = localStorage.getItem('reduceMotion') === 'true';
  const density = localStorage.getItem('density') || 'comfortable';
  const contrast = localStorage.getItem('contrast') || 'normal';
  document.documentElement.setAttribute('data-reduce-motion', reduceMotion ? 'true' : 'false');
  document.documentElement.setAttribute('data-density', density);
  document.documentElement.setAttribute('data-contrast', contrast);

  selector.addEventListener('change', () => {
    const value = selector.value;
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
  });

  const reduceMotionToggle = document.getElementById('setting-reduce-motion');
  const compactToggle = document.getElementById('setting-compact');
  const contrastToggle = document.getElementById('setting-contrast');
  const resetButton = document.getElementById('settings-reset');

  if (reduceMotionToggle) {
    reduceMotionToggle.checked = reduceMotion;
    reduceMotionToggle.addEventListener('change', () => {
      const enabled = reduceMotionToggle.checked;
      document.documentElement.setAttribute('data-reduce-motion', enabled ? 'true' : 'false');
      localStorage.setItem('reduceMotion', enabled ? 'true' : 'false');
    });
  }

  if (compactToggle) {
    compactToggle.checked = density === 'compact';
    compactToggle.addEventListener('change', () => {
      const value = compactToggle.checked ? 'compact' : 'comfortable';
      document.documentElement.setAttribute('data-density', value);
      localStorage.setItem('density', value);
    });
  }

  if (contrastToggle) {
    contrastToggle.checked = contrast === 'high';
    contrastToggle.addEventListener('change', () => {
      const value = contrastToggle.checked ? 'high' : 'normal';
      document.documentElement.setAttribute('data-contrast', value);
      localStorage.setItem('contrast', value);
    });
  }


  if (resetButton) {
    resetButton.addEventListener('click', () => {
      localStorage.removeItem('theme');
      localStorage.removeItem('reduceMotion');
      localStorage.removeItem('density');
      localStorage.removeItem('contrast');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.setAttribute('data-reduce-motion', 'false');
      document.documentElement.setAttribute('data-density', 'comfortable');
      document.documentElement.setAttribute('data-contrast', 'normal');
      selector.value = 'dark';
      if (reduceMotionToggle) reduceMotionToggle.checked = false;
      if (compactToggle) compactToggle.checked = false;
      if (contrastToggle) contrastToggle.checked = false;
    });
  }

  const settingsButton = document.getElementById('settings-button');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = settingsModal ? settingsModal.querySelector('.settings-close') : null;

  const openSettings = () => {
    if (!settingsModal) return;
    settingsModal.classList.add('open');
    settingsModal.setAttribute('aria-hidden', 'false');
  };

  const closeSettings = () => {
    if (!settingsModal) return;
    settingsModal.classList.remove('open');
    settingsModal.setAttribute('aria-hidden', 'true');
  };

  if (settingsButton && settingsModal) {
    settingsButton.addEventListener('click', openSettings);
    settingsModal.addEventListener('click', (event) => {
      if (event.target === settingsModal) closeSettings();
    });
  }

  if (settingsClose) {
    settingsClose.addEventListener('click', closeSettings);
  }

  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  const overlayImage = document.createElement('img');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.setAttribute('aria-label', 'Close preview');
  overlay.appendChild(overlayImage);
  overlay.appendChild(closeButton);
  document.body.appendChild(overlay);

  const openLightbox = (src, alt) => {
    if (!src) return;
    overlayImage.src = src;
    overlayImage.alt = alt || 'Preview image';
    overlay.classList.add('active');
  };

  const closeLightbox = () => {
    overlay.classList.remove('active');
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target === closeButton) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
      closeSettings();
    }
  });

  const clickableImages = document.querySelectorAll(
    '.bento-grid img, .image-grid img, .grid-gallery img, .carousel-track img'
  );

  clickableImages.forEach((image) => {
    image.style.cursor = 'zoom-in';
    image.addEventListener('click', () => {
      openLightbox(image.currentSrc || image.src, image.alt);
    });
  });
})();

