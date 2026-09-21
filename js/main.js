// Shared site behaviour: mobile nav toggle + active link highlighting.
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
    // Close the mobile menu after a link is tapped.
    links.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  // Highlight the current page in the nav.
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Footer year.
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Top video banner: mute/unmute toggle (video autoplays muted by default
  // so browsers allow autoplay; this button lets the visitor turn sound on).
  const heroVideo = document.querySelector('.video-hero-media');
  const muteBtn = document.querySelector('.video-hero-mute');
  if (heroVideo && muteBtn) {
    const iconMuted = muteBtn.querySelector('.icon-muted');
    const iconUnmuted = muteBtn.querySelector('.icon-unmuted');
    muteBtn.addEventListener('click', () => {
      heroVideo.muted = !heroVideo.muted;
      const isMuted = heroVideo.muted;
      iconMuted.hidden = !isMuted;
      iconUnmuted.hidden = isMuted;
      muteBtn.setAttribute('aria-label', isMuted ? '開啟聲音' : '靜音');
    });
  }

  // --- Shared carousel engine (v26) ---
  // Powers both the B "feature" carousel and the C "collectibles"
  // carousel (see css/style.css's "Carousel engine" comment for the
  // matching CSS). Each .carousel-wrap[data-carousel] gets:
  //  - a true seamless infinite loop: the real slides are flanked by a
  //    full cloned copy on each side, so sliding past the last (or
  //    before the first) real slide keeps showing content; once the
  //    CSS transition finishes we silently (no-transition) jump the
  //    track back to the equivalent position within the real slides,
  //    so the illusion never runs out of clones to show.
  //  - autoplay (data-autoplay="<ms>" on the wrap) that pauses on
  //    hover/focus/touch-drag and can be toggled off with the
  //    play/pause button; prefers-reduced-motion starts paused.
  //  - progress-bar style dots (one per REAL slide) — click one to jump
  //    straight there; the active dot's fill sweeps over the autoplay
  //    interval so visitors can see when the next auto-advance lands.
  //  - left/right arrow buttons + pointer-drag (mouse/touch) swipe,
  //    since the track is a JS-transformed <div>, not a native
  //    overflow-x scroller, so there's no built-in swipe any more.
  function initCarousel(wrap) {
    const viewport = wrap.querySelector('.carousel-viewport');
    const track = wrap.querySelector('.carousel-track');
    if (!viewport || !track) return;
    const realSlides = Array.from(track.children);
    const realCount = realSlides.length;
    if (realCount < 2) return;

    // Clone a full copy of every real slide onto each side. Simplest
    // rule that's guaranteed to cover every breakpoint's --slides-visible
    // without having to read CSS custom properties in JS: even showing
    // every real slide at once, a full extra copy on each side is
    // always enough to keep the loop illusion going.
    const cloneCount = realCount;
    const originalFirst = track.firstChild;
    realSlides.slice(-cloneCount).forEach((n) => {
      const clone = n.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('inert', '');
      track.insertBefore(clone, originalFirst);
    });
    realSlides.slice(0, cloneCount).forEach((n) => {
      const clone = n.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('inert', '');
      track.appendChild(clone);
    });

    let index = cloneCount; // track-index currently at the viewport's left edge
    const autoplayMs = parseInt(wrap.getAttribute('data-autoplay'), 10) || 5000;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let userPaused = reducedMotion;
    let hoverPaused = false;
    let dragging = false;
    let dragStartX = 0;
    let dragBaseOffset = 0;
    let timer = null;

    function slideStep() {
      const first = track.children[0];
      if (!first) return 0;
      const cs = getComputedStyle(track);
      const gap = parseFloat(cs.columnGap || cs.gap || '0') || 0;
      return first.getBoundingClientRect().width + gap;
    }
    function applyTransform(withTransition) {
      if (!withTransition) track.classList.add('no-transition');
      track.style.transform = `translateX(${-index * slideStep()}px)`;
      if (!withTransition) {
        void track.offsetHeight; // force reflow before re-enabling transitions
        requestAnimationFrame(() => track.classList.remove('no-transition'));
      }
    }
    function realIndex() { return ((index - cloneCount) % realCount + realCount) % realCount; }
    function isPlaying() { return !userPaused && !hoverPaused && !dragging; }

    function updateDots() {
      const dots = wrap.querySelectorAll('.carousel-dot');
      if (!dots.length) return;
      const active = realIndex();
      const playing = isPlaying();
      dots.forEach((dot) => dot.classList.remove('is-animating'));
      void wrap.offsetWidth; // force reflow so the fill animation restarts cleanly
      dots.forEach((dot, i) => {
        const isActive = i === active;
        dot.classList.toggle('is-active', isActive);
        if (isActive && playing) dot.classList.add('is-animating');
      });
    }
    function stopAutoplay() { if (timer) { clearTimeout(timer); timer = null; } }
    function scheduleAutoplay() {
      stopAutoplay();
      if (!isPlaying()) return;
      timer = setTimeout(() => { goTo(index + 1); refresh(); }, autoplayMs);
    }
    function refresh() {
      wrap.classList.toggle('is-paused', userPaused || hoverPaused);
      updateDots();
      scheduleAutoplay();
    }
    function goTo(newIndex, withTransition) {
      index = newIndex;
      applyTransform(withTransition !== false);
    }
    function next() { goTo(index + 1); refresh(); }
    function prev() { goTo(index - 1); refresh(); }
    function goToReal(i) { goTo(cloneCount + i); refresh(); }

    // Once a slide-to-slide transition finishes, silently snap the track
    // back into the real-slide range if we've drifted into a clone zone
    // — the clone at that position mirrors the real slide exactly, so
    // this jump is invisible to the visitor.
    track.addEventListener('transitionend', (e) => {
      if (e.target !== track || e.propertyName !== 'transform') return;
      if (index >= cloneCount + realCount) goTo(index - realCount, false);
      else if (index < cloneCount) goTo(index + realCount, false);
    });

    // Arrows.
    const prevBtn = wrap.querySelector('.carousel-arrow-prev');
    const nextBtn = wrap.querySelector('.carousel-arrow-next');
    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    // Dots — one per REAL slide (clones don't get one).
    const dotsWrap = wrap.querySelector('.carousel-dots');
    if (dotsWrap) {
      for (let i = 0; i < realCount; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';
        dot.innerHTML = '<span class="carousel-dot-fill"></span>';
        dot.addEventListener('click', () => goToReal(i));
        dotsWrap.appendChild(dot);
      }
    }
    function relabelDots() {
      const lang = (window.OFC_I18N_CURRENT) || 'zh';
      // Note: I18N is declared with `const` in js/i18n.js, so — unlike a
      // `var` or function declaration — it never becomes a property of
      // `window`. It's still reachable as a bare identifier here because
      // both files are classic (non-module) scripts sharing one global
      // scope, just not via `window.I18N`.
      const dict = (typeof I18N !== 'undefined' && I18N[lang]) || {};
      const tpl = dict['common.carousel.goTo'] || 'Go to slide {n}';
      wrap.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        dot.setAttribute('aria-label', tpl.replace('{n}', i + 1));
      });
    }

    // Play/pause toggle — an explicit visitor override, separate from
    // the transient hover/focus pause below (leaving hover shouldn't
    // silently resume autoplay after the visitor has paused it on purpose).
    const playPauseBtn = wrap.querySelector('.carousel-playpause');
    function updatePlayPauseUI() {
      if (!playPauseBtn) return;
      const iconPause = playPauseBtn.querySelector('.icon-pause');
      const iconPlay = playPauseBtn.querySelector('.icon-play');
      const lang = (window.OFC_I18N_CURRENT) || 'zh';
      const dict = (typeof I18N !== 'undefined' && I18N[lang]) || {};
      if (iconPause) iconPause.hidden = userPaused;
      if (iconPlay) iconPlay.hidden = !userPaused;
      playPauseBtn.setAttribute('aria-label', (userPaused ? dict['common.carousel.play'] : dict['common.carousel.pause']) || 'Play/pause');
    }
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        userPaused = !userPaused;
        updatePlayPauseUI();
        refresh();
      });
    }
    document.addEventListener('ofc:langchange', () => { relabelDots(); updatePlayPauseUI(); });

    // Pause on hover/focus (mouse & keyboard users); resumes on
    // leave unless the visitor explicitly paused via the button above.
    wrap.addEventListener('mouseenter', () => { hoverPaused = true; refresh(); });
    wrap.addEventListener('mouseleave', () => { hoverPaused = false; refresh(); });
    wrap.addEventListener('focusin', () => { hoverPaused = true; refresh(); });
    wrap.addEventListener('focusout', () => { hoverPaused = false; refresh(); });

    // Pointer-drag swipe (mouse + touch) — the track is a JS-transformed
    // element now, not a native scroller, so this replaces the swipe
    // that overflow-x used to give us for free.
    track.addEventListener('pointerdown', (e) => {
      dragging = true;
      dragStartX = e.clientX;
      dragBaseOffset = -index * slideStep();
      track.classList.add('is-dragging');
      stopAutoplay();
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* unsupported, ignore */ }
    });
    track.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      track.style.transform = `translateX(${dragBaseOffset + (e.clientX - dragStartX)}px)`;
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      const delta = e.clientX - dragStartX;
      const threshold = Math.max(40, slideStep() * 0.15);
      if (delta > threshold) prev();
      else if (delta < -threshold) next();
      else { goTo(index); refresh(); }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // Left/right arrow keys when the track has keyboard focus.
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    });

    // --slides-visible changes at breakpoints, which changes the slide's
    // pixel width — recompute and snap (no transition) on resize.
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => applyTransform(false), 120);
    });

    applyTransform(false);
    relabelDots();
    updatePlayPauseUI();
    refresh();
  }

  document.querySelectorAll('.carousel-wrap[data-carousel]').forEach(initCarousel);
});
