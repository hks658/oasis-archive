const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mediaAPI = require('../media-api');

test('media gateway validates paths, caches images, handles failures and protects TMDB', async () => {
  const calls = [];
  const app = express();
  app.use('/api', mediaAPI({
    auth:(req,res,next) => req.headers.authorization === 'Bearer test' ? next() : res.sendStatus(401),
    getTmdbKey:async () => 'server-key',
    fetchImpl:async (url, options) => {
      calls.push({url:String(url),options});
      if (String(url).includes('broken')) throw new Error('offline');
      if (String(url).includes('notimage')) return new Response('html',{headers:{'content-type':'text/html'}});
      if (String(url).includes('api.themoviedb.org')) return Response.json({results:[{id:1}]});
      return new Response(Buffer.from('test-image'),{headers:{'content-type':'image/jpeg'}});
    }
  }));
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    for (const endpoint of ['/media/other/w500/a.jpg','/media/tmdb/w500/http://localhost.jpg','/media/igdb/t_unknown/a.jpg']) {
      assert.equal((await fetch(base+endpoint)).status,400);
    }
    assert.equal(calls.length,0);
    for (let i=0;i<2;i++) {
      const response=await fetch(base+'/media/tmdb/w500/a.jpg');
      assert.equal(response.status,200); assert.equal(await response.text(),'test-image');
      assert.match(response.headers.get('cache-control'),/max-age/);
    }
    assert.equal(calls.length,1);
    assert.equal(calls[0].options.redirect,'error');
    assert.equal((await fetch(base+'/media/tmdb/w500/broken.jpg')).status,502);
    assert.equal((await fetch(base+'/media/tmdb/w500/notimage.jpg')).status,502);
    assert.equal((await fetch(base+'/tmdb/search/movie')).status,401);
    const headers={Authorization:'Bearer test'};
    assert.equal((await fetch(base+'/tmdb/account',{headers})).status,400);
    const response=await fetch(base+'/tmdb/search/movie?query=test&api_key=untrusted&region=CN',{headers});
    assert.equal(response.status,200);
    const upstream=new URL(calls.at(-1).url);
    assert.equal(upstream.searchParams.get('api_key'),'server-key');
    assert.equal(upstream.searchParams.get('query'),'test');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
