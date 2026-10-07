// Fixed upstreams only: never accept arbitrary URLs or follow redirects.
const express = require('express');

module.exports = function mediaAPI({auth, getTmdbKey, fetchImpl = fetch}) {
  const router = express.Router();
  const cache = new Map();
  let cacheBytes = 0;
  const pending = new Map();
  let active = 0;
  const waiting = [];
  async function withSlot(task) {
    if (active >= 6) await new Promise(resolve => waiting.push(resolve));
    else active++;
    try { return await task(); }
    finally { if (waiting.length) waiting.shift()(); else active--; }
  }
  router.get('/tmdb/*', auth, async (req, res) => {
    const endpoint = req.params[0];
    if (!/^(search\/movie|movie\/(now_playing|upcoming|[1-9]\d*\/images))$/.test(endpoint)) {
      return res.status(400).json({error:'不支持的电影接口'});
    }
    try {
      const key = await getTmdbKey();
      if (!key) return res.status(503).json({error:'请先配置 TMDB API Key'});
      const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
      url.searchParams.set('api_key', key);
      for (const name of ['query','language','region','page']) {
        if (typeof req.query[name] === 'string') url.searchParams.set(name, req.query[name]);
      }
      const response = await fetchImpl(url, {signal:AbortSignal.timeout(12000), redirect:'error'});
      if (!response.ok) return res.status(response.status).json({error:`电影服务请求失败 (${response.status})`});
      res.set('Cache-Control','no-store').json(await response.json());
    } catch { res.status(502).json({error:'电影服务暂时无法连接，请稍后重试'}); }
  });
  router.get('/media/:provider/*', async (req, res) => {
    const {provider} = req.params, file = req.params[0];
    let url;
    if (provider === 'tmdb' && /^(w200|w300|w500|w780|w1280|original)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(file)) {
      url = `https://image.tmdb.org/t/p/${file}`;
    } else if (provider === 'igdb' && /^t_(cover_small|cover_big|720p|screenshot_med|screenshot_big)\/[A-Za-z0-9_-]+\.jpg$/.test(file)) {
      url = `https://images.igdb.com/igdb/image/upload/${file}`;
    } else return res.status(400).json({error:'无效图片地址'});
    try {
      let item = cache.get(url);
      if (item && item.expires <= Date.now()) { cache.delete(url); cacheBytes -= item.body.length; item = null; }
      if (!item) {
        if (!pending.has(url)) {
          if (pending.size >= 120) return res.status(503).set('Retry-After','2').end();
          const download = withSlot(async () => {
            const response = await fetchImpl(url, {signal:AbortSignal.timeout(12000),redirect:'error'});
            if (!response.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('image');
            const chunks = []; let size = 0;
            for await (const chunk of response.body) {
              size += chunk.length;
              if (size > 8 * 1024 * 1024) throw new Error('size');
              chunks.push(chunk);
            }
            const result = {body:Buffer.concat(chunks),type:response.headers.get('content-type'),expires:Date.now()+3600000};
            while (cacheBytes + size > 32 * 1024 * 1024 || cache.size >= 200) {
              const oldest = cache.keys().next().value;
              cacheBytes -= cache.get(oldest).body.length; cache.delete(oldest);
            }
            cache.set(url,result); cacheBytes += size;
            return result;
          }).finally(() => pending.delete(url));
          pending.set(url,download);
        }
        item = await pending.get(url);
      }
      res.set({'Content-Type':item.type,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}).send(item.body);
    } catch { res.status(502).set('Cache-Control','no-store').json({error:'图片加载失败，请稍后重试'}); }
  });
  return router;
};
