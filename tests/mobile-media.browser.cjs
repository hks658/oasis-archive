const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {createPreviewApp} = require('../docs/preview/server');
(async () => {
  const server=createPreviewApp().listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
    const page=await browser.newPage({viewport:{width:320,height:740},isMobile:true,hasTouch:true});
    const errors=[],videos=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.url().endsWith('.mp4'))videos.push(r.url());});
    await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#hero-video').getAttribute('src'),null);
    assert.equal(await page.locator('#page-movies').evaluate(el=>el.classList.contains('cinema-reel')),false);
    for(const width of [320,390,760]) {
      await page.setViewportSize({width,height:844});
      assert.equal(await page.evaluate(width=>document.documentElement.scrollWidth<=width && innerWidth<=width,width),true,`page overflow at ${width}`);
      const nav=await page.locator('nav').boundingBox();
      for(const link of await page.locator('.nav-links a').all()) {
        const rect=await link.boundingBox();
        assert.ok(rect.x>=0 && rect.x+rect.width<=width && rect.y>=nav.y && rect.y+rect.height<=nav.y+nav.height,JSON.stringify({width,nav,rect,text:await link.innerText()}));
      }
      await page.evaluate(()=>openSettings());
      assert.equal(await page.locator('#modal-settings .modal').evaluate(el=>el.scrollWidth<=el.clientWidth),true,`settings overflow at ${width}`);
      await page.evaluate(()=>closeAllModals());
    }
    await page.route('**/api/tmdb/search/movie?**',route=>route.fulfill({json:{results:[{id:7,title:'测试电影',poster_path:'/poster.jpg',release_date:'2026-01-01',vote_average:8}]}}));
    const movieResponse=await page.evaluate(async()=>{const r=await tmdbFetch('search/movie?query=test');return r.json();});
    assert.equal(movieResponse.results[0].id,7);
    await page.route('**/api/igdb/game/42',route=>route.fulfill({json:{cover:{image_id:'cover'},screenshots:[{image_id:'screen'}]}}));
    const enriched=await page.evaluate(()=>OasisMedia.enrichGame({igdbId:42,cover:null,screenshots:[]}));
    assert.equal(enriched.screenshots[0],'/api/media/igdb/t_screenshot_big/screen.jpg');
    const retained=await page.evaluate(()=>OasisMedia.enrichGame({igdbId:42,cover:'/custom.jpg',screenshots:['/custom-screen.jpg']}));
    assert.equal(retained.cover,'/custom.jpg');assert.deepEqual(retained.screenshots,['/custom-screen.jpg']);
    const old=await page.evaluate(()=>OasisMedia.records({poster:'https://image.tmdb.org/t/p/w500/a.jpg'}));
    assert.equal(old.poster,'/api/media/tmdb/w500/a.jpg');
    await page.evaluate(()=>{const img=new Image();img.id='broken-test';img.src='/missing-image.jpg';document.body.append(img);});
    await page.waitForFunction(()=>document.querySelector('#broken-test').getAttribute('src')==='/media/image-unavailable.svg' && document.querySelector('#broken-test').naturalWidth>0);
    await page.locator('#broken-test').evaluate(el=>el.remove());
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>document.getElementById('page-games').scrollIntoView({behavior:'instant'}));
    await page.screenshot({path:'docs/preview/mobile-performance.png',fullPage:false});
    assert.deepEqual(videos,[]);assert.deepEqual(errors,[]);
    console.log('Mobile layout, media fallback, legacy artwork, IGDB enrichment and no automatic video: passed');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
