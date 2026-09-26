/* Game archive detail and a shared, keyboard-accessible image viewer. */
(() => {
  const modal = document.getElementById('modal-game-detail');
  const panel = modal.querySelector('.modal');
  const content = document.getElementById('game-detail-content');
  let returnFocus = null;
  let galleryIndex = 0;
  let screenshots = [];
  let currentTitle = '';
  let viewerImages = [], viewerIndex = 0, viewerReturnFocus = null, viewerTitle = '';
  let savedOverflow = '';
  const viewer = document.getElementById('lightbox');
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', '图片浏览');
  viewer.setAttribute('aria-hidden', 'true');
  viewer.innerHTML = `<div class="image-viewer-bar"><span class="image-viewer-title"></span><button type="button" class="image-viewer-close" aria-label="关闭图片浏览">✕</button></div>
    <button type="button" class="image-viewer-prev" aria-label="上一张图片">←</button>
    <figure class="image-viewer-figure"><img id="lightbox-img" alt=""><p class="image-viewer-error" hidden>图片暂时无法加载，请切换其他图片。</p></figure>
    <button type="button" class="image-viewer-next" aria-label="下一张图片">→</button>
    <div class="image-viewer-footer"><span class="image-viewer-count" aria-live="polite"></span><span>← → 切换 · Esc 返回</span></div>`;
  const viewerImage = viewer.querySelector('img');
  viewer.querySelectorAll('button,.image-viewer-figure').forEach(el => el.addEventListener('click', e => e.stopPropagation()));
  viewer.querySelector('.image-viewer-close').onclick = closeImages;
  viewer.querySelector('.image-viewer-prev').onclick = () => moveViewer(-1);
  viewer.querySelector('.image-viewer-next').onclick = () => moveViewer(1);
  viewerImage.onload = () => {viewerImage.hidden = false; viewer.querySelector('.image-viewer-error').hidden = true;};
  viewerImage.onerror = () => {viewerImage.hidden = true; viewer.querySelector('.image-viewer-error').hidden = false;};

  function safeMedia(value) {
    if (typeof value !== 'string') return '';
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value) || /^blob:/i.test(value)) return value;
    return '';
  }
  function setImage(img, source, alt, fallback = PH) {
    img.alt = alt;
    img.onerror = () => {img.onerror = null; img.src = fallback;};
    img.src = safeMedia(source) || fallback;
  }
  function render(game) {
    stopGM();
    currentTitle = String(game.title || '未命名游戏');
    screenshots = Array.isArray(game.screenshots) ? game.screenshots.map(safeMedia).filter(Boolean) : [];
    galleryIndex = 0;
    const rating = Number(game.rating);
    const hasRating = rating > 0 && rating <= 5;
    const review = String(game.review || '').trim();
    content.innerHTML = `<header class="gd-hero">
      <img class="gd-backdrop" alt="">
      <div class="gd-identity"><button type="button" class="gd-poster-button" aria-label="放大游戏海报"><img class="gd-poster" alt=""></button>
        <div class="gd-heading"><span class="gd-eyebrow">GAMES / 我的游戏档案</span><h2 id="game-detail-title"></h2><div class="gd-tags"></div></div>
        <div class="gd-rating"><span class="gd-caption">我的评分</span><div class="gd-rating-number"></div><div class="gd-stars"></div></div>
      </div>
    </header>
    <div class="gd-body"><section class="gd-gallery" aria-label="游戏画面">
      <div class="gd-section-heading"><h3>游戏画面</h3><span class="gd-gallery-count" aria-live="polite"></span></div>
      <div class="gd-stage"><button type="button" class="gd-expand" aria-label="放大当前游戏截图"><img class="gd-main-image" alt=""><span class="gd-expand-hint">↗ 查看大图</span></button>
        <button type="button" class="gd-arrow gd-previous" aria-label="上一张截图">←</button><button type="button" class="gd-arrow gd-next" aria-label="下一张截图">→</button></div>
      <div class="gd-thumbnails" role="group" aria-label="选择截图"></div>
      <div class="gd-gallery-empty" hidden><span>暂无游戏截图</span><p>可以在编辑记录时添加，留住旅途中的画面。</p></div>
    </section>
    <section class="gd-journal" aria-labelledby="gd-journal-title"><div class="gd-section-heading"><h3 id="gd-journal-title">游玩手记</h3><span>PERSONAL NOTES</span></div>
      <div class="gd-review"></div><button type="button" class="gd-write-note" hidden>写下第一段感受 ↗</button>
      <div class="gd-music" hidden><span class="gd-caption">游戏音乐</span><audio controls preload="none"></audio></div>
    </section></div>
    <footer class="gd-footer"><span class="gd-added"></span><div class="gd-actions"><button type="button" class="gd-delete">删除记录</button><button type="button" class="gd-edit">编辑档案 ↗</button></div></footer>`;
    content.querySelector('h2').textContent = currentTitle;
    setImage(content.querySelector('.gd-backdrop'), screenshots[0] || game.cover, '');
    content.querySelector('.gd-hero').classList.toggle('gd-cover-only', !screenshots.length);
    setImage(content.querySelector('.gd-poster'), game.cover, `${currentTitle}海报`);
    content.querySelector('.gd-poster-button').onclick = () => openImages(game.cover || PH, 0, `${currentTitle} · 海报`);
    const platforms = Array.isArray(game.platforms) ? game.platforms : String(game.platforms || '').split('/');
    [game.releaseYear || '年份待补充', ...platforms].filter(Boolean).forEach(value => {
      const tag = document.createElement('span'); tag.textContent = String(value); content.querySelector('.gd-tags').append(tag);
    });
    content.querySelector('.gd-rating-number').textContent = hasRating ? String(rating) : '—';
    const denominator = document.createElement('small'); denominator.textContent = hasRating ? ' / 5' : ' 未评分';
    content.querySelector('.gd-rating-number').append(denominator);
    content.querySelector('.gd-stars').textContent = hasRating ? '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)) : '等待你的评价';
    content.querySelector('.gd-review').textContent = review || '还没有写下这段旅程的感受。';
    content.querySelector('.gd-review').classList.toggle('is-empty', !review);
    content.querySelector('.gd-write-note').hidden = Boolean(review);
    const edit = () => {closeAllModals(); editGame(game.id);};
    content.querySelector('.gd-edit').onclick = edit;
    content.querySelector('.gd-write-note').onclick = edit;
    content.querySelector('.gd-delete').onclick = () => deleteGame(game.id);
    const date = new Date(Number(game.createdAt));
    content.querySelector('.gd-added').textContent = Number(game.createdAt) > 0 && !Number.isNaN(date.getTime()) ? `收藏于 ${new Intl.DateTimeFormat('zh-CN', {year:'numeric',month:'long',day:'numeric'}).format(date)}` : '收藏中的一段旅程';
    if (safeMedia(game.music)) {
      const audio = content.querySelector('audio'); audio.src = safeMedia(game.music); audio.muted = window.oasisMuted === true;
      content.querySelector('.gd-music').hidden = false;
    }
    if (screenshots.length) {
      screenshots.forEach((src, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'gd-thumbnail'; button.setAttribute('aria-label', `查看第 ${index + 1} 张截图`);
        const image = document.createElement('img'); image.loading = 'lazy'; setImage(image, src, ''); button.append(image);
        button.onclick = () => selectScreenshot(index); content.querySelector('.gd-thumbnails').append(button);
      });
      content.querySelector('.gd-expand').onclick = () => openImages(screenshots, galleryIndex, currentTitle);
      content.querySelector('.gd-previous').onclick = () => selectScreenshot(galleryIndex - 1);
      content.querySelector('.gd-next').onclick = () => selectScreenshot(galleryIndex + 1);
      selectScreenshot(0);
    } else {
      content.querySelector('.gd-stage').hidden = true;
      content.querySelector('.gd-thumbnails').hidden = true;
      content.querySelector('.gd-gallery-empty').hidden = false;
      content.querySelector('.gd-gallery-count').textContent = '0 张';
    }
    content.querySelectorAll('.gd-arrow').forEach(button => {button.hidden = screenshots.length < 2;});
    panel.scrollTop = 0;
  }
  function selectScreenshot(index) {
    galleryIndex = (index + screenshots.length) % screenshots.length;
    setImage(content.querySelector('.gd-main-image'), screenshots[galleryIndex], `${currentTitle} · 第 ${galleryIndex + 1} 张截图`);
    content.querySelector('.gd-gallery-count').textContent = `${String(galleryIndex + 1).padStart(2,'0')} / ${String(screenshots.length).padStart(2,'0')}`;
    content.querySelectorAll('.gd-thumbnail').forEach((button,i) => button.setAttribute('aria-pressed',String(i === galleryIndex)));
  }
  function openImages(sources, index = 0, title = '图片浏览') {
    const images = (Array.isArray(sources) ? sources : [sources]).map(safeMedia).filter(Boolean);
    if (!images.length) return;
    viewerImages = images; viewerIndex = Math.min(Math.max(index,0),images.length - 1); viewerTitle = title;
    if (!viewer.classList.contains('show')) {viewerReturnFocus = document.activeElement; savedOverflow = document.body.style.overflow;}
    document.body.style.overflow = 'hidden';
    viewer.classList.add('show'); viewer.setAttribute('aria-hidden','false'); updateViewer();
    viewer.querySelector('.image-viewer-close').focus({preventScroll:true});
  }
  function updateViewer() {
    viewerImage.hidden = false; viewer.querySelector('.image-viewer-error').hidden = true;
    viewerImage.src = viewerImages[viewerIndex]; viewerImage.alt = `${viewerTitle} · 第 ${viewerIndex + 1} 张图片`;
    viewer.querySelector('.image-viewer-title').textContent = viewerTitle;
    viewer.querySelector('.image-viewer-count').textContent = `${viewerIndex + 1} / ${viewerImages.length}`;
    viewer.querySelectorAll('.image-viewer-prev,.image-viewer-next').forEach(button => {button.hidden = viewerImages.length < 2;});
  }
  function moveViewer(step) {viewerIndex = (viewerIndex + step + viewerImages.length) % viewerImages.length; updateViewer();}
  function closeImages() {
    if (!viewer.classList.contains('show')) return;
    viewer.classList.remove('show'); viewer.setAttribute('aria-hidden','true'); document.body.style.overflow = savedOverflow;
    if (viewerReturnFocus?.isConnected) viewerReturnFocus.focus({preventScroll:true});
  }
  function trapFocus(event, scope) {
    const focusable = Array.from(scope.querySelectorAll('button,a[href],input,textarea,select,audio[controls],[tabindex="0"]')).filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) {event.preventDefault(); last?.focus();}
    else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) {event.preventDefault(); first?.focus();}
  }
  document.addEventListener('keydown', event => {
    if (viewer.classList.contains('show')) {
      if (['Escape','ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Escape') closeImages(); else moveViewer(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.key === 'Tab') trapFocus(event,viewer);
    } else if (modal.classList.contains('show') && event.key === 'Tab') trapFocus(event,panel);
  }, true);
  document.addEventListener('oasis:modal-open', event => {
    if (event.detail !== 'game-detail') return;
    returnFocus = document.activeElement; modal.setAttribute('aria-hidden','false');
    panel.querySelector('.modal-close').focus({preventScroll:true});
  });
  document.addEventListener('oasis:modals-close', () => {
    const wasOpen = modal.getAttribute('aria-hidden') === 'false';
    modal.setAttribute('aria-hidden','true'); content.querySelectorAll('audio').forEach(audio => audio.pause());
    if (wasOpen && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
  });
  window.GameDetail = {render,openImages,closeImages};
})();
