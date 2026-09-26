// Run with Playwright available in NODE_PATH; optionally set BROWSER_EXECUTABLE.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('path');
const {createPreviewApp} = require('../docs/preview/server');

(async () => {
  const server = createPreviewApp().listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {})});
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors = []; page.on('pageerror',error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base+'/?detail=portal2#page-games',{waitUntil:'domcontentloaded'});
    const modal = page.locator('#modal-game-detail');
    await modal.locator('.gd-main-image').waitFor({state:'visible'});
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#game-detail-content img')).every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await modal.locator('.gd-thumbnail').count(),5);
    await modal.locator('.gd-next').click();
    assert.equal(await modal.locator('.gd-gallery-count').innerText(),'02 / 05');
    await modal.locator('.gd-thumbnail').nth(3).click();
    assert.match(await modal.locator('.gd-main-image').getAttribute('src'),/screenshot-4/);
    await modal.locator('.gd-expand').click();
    const viewer = page.locator('#lightbox');
    assert.equal(await viewer.getAttribute('aria-hidden'),'false');
    await page.keyboard.press('ArrowRight');
    assert.equal(await viewer.locator('.image-viewer-count').innerText(),'5 / 5');
    await page.keyboard.press('ArrowRight');
    assert.equal(await viewer.locator('.image-viewer-count').innerText(),'1 / 5');
    await page.keyboard.press('Escape');
    assert.equal(await viewer.getAttribute('aria-hidden'),'true');
    assert.equal(await modal.getAttribute('aria-hidden'),'false');
    assert.equal(await modal.locator('.gd-expand').evaluate(el => el === document.activeElement),true);
    await modal.locator('.modal-close').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await modal.locator('.gd-edit').evaluate(el => el === document.activeElement),true);
    await page.keyboard.press('Tab');
    assert.equal(await modal.locator('.modal-close').evaluate(el => el === document.activeElement),true);

    // Editing exercises the real edit form with the in-memory preview API.
    await modal.locator('.gd-edit').click();
    await page.locator('#form-add-game textarea[name=review]').fill('更新后的游玩手记\n\n保留海报与截图。');
    await page.locator('#form-add-game .submit-btn').click();
    await page.waitForFunction(() => !document.querySelector('#modal-add-game').classList.contains('show'));
    await page.locator('#played-grid .game-card').click();
    await page.waitForFunction(() => document.querySelector('.gd-review')?.textContent.startsWith('更新后的游玩手记'));
    assert.equal(await modal.locator('.gd-thumbnail').count(),5);
    const response = await page.request.get(base+'/api/store/games/portal2');
    const edited = await response.json();
    assert.equal(edited.screenshots.length,5);

    // Long text, portrait artwork and keyboard focus stay inside the dialog.
    await page.request.put(base+'/api/store/games',{data:{...edited,title:'很长的游戏标题 '.repeat(12),review:'长评内容与没有空格的文字'.repeat(180)}});
    await page.evaluate(() => showGameDetail('portal2'));
    for (const width of [390,320,768]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await modal.locator('.modal').evaluate(el => el.scrollWidth <= el.clientWidth),true);
      await modal.locator('.modal').evaluate(el => {el.scrollTop = el.scrollHeight;});
      assert.equal(await modal.locator('.modal-close').isVisible(),true);
      const close = await modal.locator('.modal-close').boundingBox();
      assert.ok(close.y >= 0 && close.y + close.height <= 844);
    }
    // Empty records retain an edit path and never show broken-image icons.
    await page.request.put(base+'/api/store/games',{data:{id:'empty',title:'<script>unsafe</script>',cover:'',screenshots:[],rating:0,review:''}});
    await page.evaluate(() => showGameDetail('empty'));
    assert.equal(await modal.locator('h2').innerText(),'<script>unsafe</script>');
    assert.equal(await modal.locator('.gd-gallery-empty').isVisible(),true);
    assert.equal(await modal.locator('.gd-write-note').isVisible(),true);
    assert.match(await modal.locator('.gd-rating-number').innerText(),/未评分/);
    await modal.locator('.gd-poster-button').click();
    assert.equal(await viewer.locator('.image-viewer-next').isVisible(),false);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    assert.equal(await modal.getAttribute('aria-hidden'),'true');
    assert.equal(await page.evaluate(() => document.body.style.overflow),'');
    // Existing callers from movie / wishlist details still open single images.
    await page.evaluate(() => openLB('/preview-assets/screenshot-1.jpg'));
    assert.equal(await viewer.getAttribute('aria-hidden'),'false');
    await viewer.locator('.image-viewer-close').click();
    assert.equal(await page.evaluate(() => document.body.style.overflow),'');

    // Render screenshots from the pristine fixture on a fresh server-independent record.
    await page.request.put(base+'/api/store/games',{data:{...edited,review:'最难忘的，是推开下一扇门时的好奇。\n\n蓝色与橙色的传送门让空间有了另一种解法。站在看似无路可走的房间里，换个角度，出口就藏在刚才忽略的地方。\n\n喜欢它把解谜、幽默和叙事放在同一段旅程中。每一次恍然大悟，都像是与关卡设计者完成了一次默契的对话。'}});
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(() => showGameDetail('portal2'));
    await page.screenshot({path:path.resolve('docs/preview/detail-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.resolve('docs/preview/detail-mobile.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS: real images, thumbnails, viewer navigation, layered Escape, focus loop, editing, long text, mobile, empty records, legacy image callers.');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
