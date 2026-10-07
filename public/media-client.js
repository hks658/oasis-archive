/* Use the site's image gateway for new and previously saved remote artwork. */
window.OasisMedia = (() => {
  const image = value => typeof value === 'string' ? value
    .replace(/^https?:\/\/image\.tmdb\.org\/t\/p\//, '/api/media/tmdb/')
    .replace(/^https?:\/\/images\.igdb\.com\/igdb\/image\/upload\//, '/api/media/igdb/') : value;
  function records(value) {
    if (Array.isArray(value)) return value.map(records);
    if (!value || typeof value !== 'object') return value;
    const result = {...value};
    for (const key of ['cover','poster']) if (result[key]) result[key] = image(result[key]);
    for (const key of ['screenshots','stills']) if (Array.isArray(result[key])) result[key] = result[key].map(image);
    return result;
  }
  const games = new Map();
  async function enrichGame(game) {
    if (!games.has(game.igdbId)) {
      const request = fetch(`/api/igdb/game/${game.igdbId}`, {method:'POST',headers:authHeaders(),signal:AbortSignal.timeout(15000)})
        .then(async response => {if (!response.ok) throw new Error('IGDB'); return response.json();})
        .catch(error => {games.delete(game.igdbId); throw error;});
      if (games.size >= 100) games.delete(games.keys().next().value);
      games.set(game.igdbId,request);
    }
    const details = await games.get(game.igdbId);
    return {...game,
      cover:game.cover || (details?.cover?.image_id ? `/api/media/igdb/t_cover_big/${details.cover.image_id}.jpg` : null),
      screenshots:game.screenshots?.length ? game.screenshots : (details?.screenshots || []).slice(0,6).map(item => `/api/media/igdb/t_screenshot_big/${item.image_id}.jpg`)
    };
  }
  // Capture errors from dynamically rendered cards as well as detail images.
  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || (img.src.startsWith('data:') || img.getAttribute('src') === '/media/image-unavailable.svg')) return;
    if (img.onerror) return; // Detail viewers keep their own error and loading state.
    img.alt = img.alt || '图片暂时无法加载';
    img.title = '图片暂时无法加载，请稍后重试';
    img.src = '/media/image-unavailable.svg';
  }, true);
  return {image,records,enrichGame};
})();
function tmdbFetch(endpoint) {
  return fetch(`/api/tmdb/${endpoint}`, {headers:authHeaders(),signal:AbortSignal.timeout(15000)})
    .then(async response => {
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || '电影服务请求失败'); }
      return response;
    });
}
