/* Presentation layer: no changes to API or stored collection records. */
(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  try { window.oasisMuted = localStorage.getItem('oasis_muted') === 'true'; }
  catch { window.oasisMuted = false; }
  function applyMute() {
    const muted = window.oasisMuted;
    document.getElementById('sound-toggle').setAttribute('aria-pressed', String(muted));
    document.getElementById('sound-toggle').setAttribute('aria-label', muted ? '开启所有音乐' : '静音所有音乐');
    document.getElementById('sound-label').textContent = muted ? '已静音' : '声音开启';
    document.querySelectorAll('audio,video').forEach(media => { media.muted = media.dataset.silent === 'true' || muted; });
    if (cA) cA.muted = muted;
    if (fadingAudio) fadingAudio.muted = muted;
  }
  window.toggleGlobalMute = () => {
    window.oasisMuted = !window.oasisMuted;
    try { localStorage.setItem('oasis_muted', String(window.oasisMuted)); } catch {}
    applyMute();
  };
  applyMute();
  // Detail audio players are created dynamically; mute them before playback.
  document.addEventListener('play', event => {
    if (event.target instanceof HTMLMediaElement) event.target.muted = event.target.dataset.silent === 'true' || window.oasisMuted;
  }, true);
  new MutationObserver(records => {
    if (records.some(record => Array.from(record.addedNodes).some(node => node.nodeType === 1 && (node.matches('audio,video') || node.querySelector('audio,video'))))) applyMute();
  }).observe(document.body, {childList:true,subtree:true});

  const compactDevice = matchMedia('(max-width:760px), (pointer:coarse)');
  let scrollQueued = false, lastSection = -1;
  function syncSection() {
    scrollQueued = false;
    let index = 0;
    fpS.forEach((section, i) => { if (section.getBoundingClientRect().top <= innerHeight * .4) index = i; });
    if(index === lastSection)return;
    lastSection = index;
    cP = index;
    fpS.forEach((section, i) => section.classList.toggle('active', i === index));
    upNL(); upPI();
    if (index !== 1 && cA) stopGM();
  }
  addEventListener('scroll', () => {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(syncSection); }
  }, {passive:true});
  syncSection();
  document.querySelectorAll('.nav-logo,.nav-link,.hero-actions a').forEach(link => {
    link.tabIndex = 0; link.setAttribute('role','button');
    link.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); link.click(); }
    });
  });

  const feature = document.getElementById('hero-feature');
  const emptyFeature = feature.innerHTML;
  let featureKey = '';
  function refreshFeature() {
    const candidates = ['played-grid','watched-grid'].map(id => Array.from(document.getElementById(id).children).sort((a,b) => (b.archiveRecord?.createdAt || 0) - (a.archiveRecord?.createdAt || 0))[0]).filter(Boolean);
    // Keep the home recommendation independent of archive sorting and filtering.
    const card = candidates[candidates.length - 1];
    if (!card) { feature.innerHTML = emptyFeature; featureKey = ''; return; }
    const sourceImage = card.querySelector('img');
    const title = card.querySelector('.game-card-title')?.textContent || '';
    const key = title + sourceImage?.getAttribute('src') + card.querySelector('.game-card-rating,.tomato-rating')?.innerHTML;
    if (key === featureKey) return;
    featureKey = key;
    feature.replaceChildren();
    const img = document.createElement('img');
    img.className = 'feature-art'; img.src = sourceImage.src; img.alt = ''; img.onerror = () => { img.style.display = 'none'; };
    const content = document.createElement('div'); content.className = 'feature-content';
    const label = document.createElement('span'); label.className = 'feature-label'; label.textContent = card.classList.contains('movie-card') ? 'RECENTLY ADDED / CINEMA' : 'RECENTLY ADDED / GAMES';
    const heading = document.createElement('h2'); heading.textContent = title;
    const note = document.createElement('p');
    const rating = card.querySelector('.game-card-rating');
    note.textContent = rating ? `${'★'.repeat(rating.querySelectorAll('.star.filled').length)}${'☆'.repeat(5-rating.querySelectorAll('.star.filled').length)} · 我的评分` : card.querySelector('.tomato-rating')?.textContent.trim() || '收藏中的一段新记忆';
    const open = document.createElement('button'); open.className = 'feature-open'; open.textContent = '打开这段记忆 ↗'; open.onclick = () => card.click();
    content.append(label, heading, note, open); feature.append(img, content);
  }
  [['played-grid','games'],['wishlist-grid','wishlist'],['watched-grid','movies']].forEach(([id,kind]) => {
    ArchiveFilters.mount(document.getElementById(id),kind,refreshFeature);
  });
  refreshFeature();
  // Load only the selected rendition; preserve the poster if autoplay is blocked.
  const heroVideo = document.getElementById('hero-video');
  const motionToggle = document.getElementById('hero-motion-toggle');
  let motionEnabled = !compactDevice.matches && !reducedMotion.matches && !navigator.connection?.saveData;
  let heroVisible = false;
  const updateMotionLabel = () => {
    motionToggle.textContent = heroVideo.paused ? '播放背景' : '暂停背景';
    motionToggle.setAttribute('aria-label', heroVideo.paused ? '播放背景视频' : '暂停背景视频');
  };
  function syncHeroVideo() {
    if (!motionEnabled || !heroVisible || document.hidden || document.body.classList.contains('is-locked')) {
      heroVideo.pause(); return;
    }
    if (!heroVideo.getAttribute('src')) {
      heroVideo.src = matchMedia('(max-width:760px)').matches ? '/media/neon-city-1080p.mp4' : '/media/neon-city-1440p.mp4';
    }
    heroVideo.muted = true;
    heroVideo.play().catch(updateMotionLabel);
  }
  heroVideo.addEventListener('playing', updateMotionLabel);
  heroVideo.addEventListener('pause', updateMotionLabel);
  heroVideo.addEventListener('error', updateMotionLabel);
  motionToggle.addEventListener('click', () => {
    motionEnabled = heroVideo.paused;
    syncHeroVideo();
  });
  new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting; syncHeroVideo();
  }, {threshold:0.05}).observe(document.getElementById('page-hero'));
  document.addEventListener('visibilitychange', syncHeroVideo);
  new MutationObserver(syncHeroVideo).observe(document.body, {attributes:true,attributeFilter:['class']});
  reducedMotion.addEventListener('change', () => { motionEnabled = !compactDevice.matches && !reducedMotion.matches && !navigator.connection?.saveData; syncHeroVideo(); });
  // One-time section reveals avoid replaying animations during ordinary browsing.
  if (!compactDevice.matches && !reducedMotion.matches && 'IntersectionObserver' in window) {
    const reveals = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.animate([{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});
      reveals.unobserve(entry.target);
    }),{threshold:.12});
    document.querySelectorAll('.section-title,.hero-feature').forEach(element => {
      if (!element.closest('#page-games')) reveals.observe(element);
    });
  }
  // Each archive element assembles once when it reaches the viewport, including late API results.
  if (!compactDevice.matches && !reducedMotion.matches && 'IntersectionObserver' in window) {
    const games = document.getElementById('page-games');
    const seen = new WeakSet();
    const running = new Set();
    const compact = matchMedia('(max-width:760px)');
    function show(element, animate = true) {
      arrivals.unobserve(element);
      element.classList.remove('assembly-pending');
      if (!animate || reducedMotion.matches) return;
      const card = element.matches('.game-card,.wishlist-card');
      const animation = element.animate([
        {opacity:0,transform:`translateY(${compact.matches ? 14 : card ? 30 : 18}px) scale(${card ? '.97' : '1'})`},
        {opacity:1,transform:'translateY(0) scale(1)'}
      ], {duration:compact.matches ? 360 : 480,delay:Number(element.dataset.assemblyDelay),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});
      running.add(animation);
      animation.onfinish = animation.oncancel = () => running.delete(animation);
    }
    const arrivals = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) show(entry.target); });
    }, {threshold:0,rootMargin:'0px 0px -32px 0px'});
    function register() {
      games.querySelectorAll('.section-label,.section-title,.section-desc,.tab-controls,.add-btn-container,.archive-toolbar,.game-card,.wishlist-card').forEach(element => {
        if (seen.has(element) || reducedMotion.matches) return;
        seen.add(element);
        const card = element.matches('.game-card,.wishlist-card');
        const index = card ? Array.from(element.parentElement.children).indexOf(element) : 0;
        element.dataset.assemblyDelay = card ? 140 + (index % (compact.matches ? 2 : 4)) * 55 : element.matches('.section-label,.section-title') ? 0 : 80;
        element.classList.add('assembly-pending');
        arrivals.observe(element);
      });
    }
    register();
    const additions = new MutationObserver(register);
    additions.observe(games, {childList:true,subtree:true});
    games.addEventListener('focusin', event => {
      const pending = event.target.closest('.assembly-pending');
      if (pending) show(pending, false);
    });
    reducedMotion.addEventListener('change', () => {
      if (!reducedMotion.matches) return;
      arrivals.disconnect(); additions.disconnect();
      games.querySelectorAll('.assembly-pending').forEach(element => element.classList.remove('assembly-pending'));
      running.forEach(animation => animation.cancel());
    });
  }
})();
