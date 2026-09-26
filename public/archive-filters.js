/* Collection filtering uses saved records; it never changes the collection itself. */
(function(root) {
  const defaults = () => ({query:'', year:'', platform:'', rating:'', notes:'', sort:'newest'});
  const collator = new Intl.Collator('zh-CN', {numeric:true, sensitivity:'base'});
  function normalize(record, kind) {
    const year = String(record.releaseYear || record.year || '');
    const rating = Number(kind === 'movies' ? record.userRating : record.rating);
    const platforms = Array.isArray(record.platforms) ? record.platforms : String(record.platforms || '').split('/');
    return {
      title:String(record.title || ''),
      year:/^\d{4}$/.test(year) ? Number(year) : null,
      rating:kind !== 'wishlist' && rating > 0 && rating <= 5 ? rating : null,
      platforms:[...new Set(platforms.map(p => String(p).trim()).filter(Boolean))],
      notes:String(record.review || record.reason || '').trim(),
      createdAt:Number(record.createdAt) || 0
    };
  }
  function matches(item, state) {
    return item.title.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase()) &&
      (!state.year || (state.year === 'unknown' ? item.year === null : item.year === Number(state.year))) &&
      (!state.platform || (state.platform === 'unknown' ? !item.platforms.length : item.platforms.includes(state.platform))) &&
      (!state.rating || (state.rating === 'unrated' ? item.rating === null : item.rating !== null && item.rating >= Number(state.rating))) &&
      (!state.notes || Boolean(item.notes) === (state.notes === 'yes'));
  }
  function compare(a, b, sort) {
    const number = (key, direction) => {
      if (a[key] === null || b[key] === null) return a[key] === b[key] ? 0 : a[key] === null ? 1 : -1;
      return (a[key] - b[key]) * direction;
    };
    let result = 0;
    if (sort === 'title') result = collator.compare(a.title, b.title);
    else if (sort === 'year-desc' || sort === 'year-asc') result = number('year', sort === 'year-desc' ? -1 : 1);
    else if (sort === 'rating-desc' || sort === 'rating-asc') result = number('rating', sort === 'rating-desc' ? -1 : 1);
    else result = number('createdAt', sort === 'oldest' ? 1 : -1);
    return result || b.createdAt - a.createdAt || collator.compare(a.title, b.title);
  }
  function mount(grid, kind, onUpdate) {
    const state = defaults();
    const toolbar = document.createElement('div');
    toolbar.className = 'archive-toolbar archive-advanced';
    const input = document.createElement('input');
    input.className = 'archive-search'; input.type = 'search';
    input.placeholder = kind === 'movies' ? '搜索收藏的电影…' : '搜索收藏的游戏…';
    input.setAttribute('aria-label', input.placeholder);
    const fields = document.createElement('div'); fields.className = 'archive-filter-fields';
    const controls = {};
    function select(key, title, choices) {
      const label = document.createElement('label'); label.className = 'archive-filter-label';
      const caption = document.createElement('span'); caption.textContent = title;
      const control = document.createElement('select'); control.className = 'archive-select';
      control.dataset.filter = key;
      label.append(caption, control); fields.append(label); controls[key] = control;
      setOptions(control, choices);
      control.addEventListener('change', () => {state[key] = control.value; apply(true);});
    }
    function setOptions(control, choices) {
      const signature = JSON.stringify(choices);
      if (control.dataset.options === signature) return;
      const previous = control.value;
      control.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
      if (choices.some(([value]) => value === previous)) control.value = previous;
      control.dataset.options = signature;
    }
    select('year', kind === 'movies' ? '上映年份' : '发行年份', [['','全部年份']]);
    if (kind !== 'movies') select('platform', '游戏平台', [['','全部平台']]);
    if (kind !== 'wishlist') select('rating', '我的评分', [['','全部评分'],['5','5 星'],['4','4 星及以上'],['3','3 星及以上'],['2','2 星及以上'],['1','1 星及以上'],['unrated','尚未个人评分']]);
    select('notes', kind === 'wishlist' ? '期待理由' : kind === 'movies' ? '影评' : '游戏评测', [['','不限'],['yes','已填写'],['no','未填写']]);
    select('sort', '排序方式', [['newest','最近添加'],['oldest','最早添加'],['year-desc','年份：新 → 旧'],['year-asc','年份：旧 → 新'],...(kind === 'wishlist' ? [] : [['rating-desc','我的评分：高 → 低'],['rating-asc','我的评分：低 → 高']]),['title','名称顺序']]);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'archive-reset'; reset.textContent = '重置筛选与排序';
    const count = document.createElement('span'); count.className = 'archive-count'; count.setAttribute('aria-live','polite'); count.setAttribute('role','status');
    toolbar.append(input, count, fields, reset); grid.before(toolbar);
    const noResults = document.createElement('p'); noResults.className = 'archive-no-results'; noResults.textContent = '没有符合条件的作品，试试调整条件或重置筛选。'; noResults.hidden = true; grid.after(noResults);
    const observer = new MutationObserver(() => apply(false));
    function apply(userAction) {
      observer.disconnect();
      const entries = Array.from(grid.children).map(card => ({card, item:normalize(card.archiveRecord || {}, kind)}));
      const years = [...new Set(entries.map(e => e.item.year).filter(v => v !== null))].sort((a,b) => b-a);
      setOptions(controls.year, [['','全部年份'], ...years.map(y => [String(y),String(y)]), ['unknown','年份未知']]);
      if (controls.platform) {
        const platforms = [...new Set(entries.flatMap(e => e.item.platforms))].sort(collator.compare);
        setOptions(controls.platform, [['','全部平台'],...platforms.map(p => [p,p]),['unknown','平台未知']]);
      }
      Object.keys(controls).forEach(key => {state[key] = controls[key].value;});
      entries.sort((a,b) => compare(a.item,b.item,state.sort));
      let visible = 0;
      entries.forEach(({card,item},index) => {
        card.hidden = !matches(item,state);
        card.classList.toggle('archive-featured', !card.hidden && visible === 0);
        if (!card.hidden) visible++;
        if (grid.children[index] !== card) grid.insertBefore(card,grid.children[index] || null);
      });
      const unit = kind === 'movies' ? '部电影' : '款游戏';
      count.textContent = `${visible} / ${entries.length} ${unit}`;
      noResults.hidden = visible > 0 || entries.length === 0;
      reset.disabled = Object.keys(state).every(key => state[key] === defaults()[key]);
      if (userAction) grid.scrollLeft = 0;
      observer.observe(grid,{childList:true});
      if (onUpdate) onUpdate();
    }
    input.addEventListener('input', () => {state.query = input.value; apply(true);});
    reset.addEventListener('click', () => {
      Object.assign(state,defaults()); input.value = '';
      Object.keys(controls).forEach(key => {controls[key].value = state[key];});
      apply(true);
    });
    apply(false);
  }
  const api = {defaults,normalize,matches,compare,mount};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ArchiveFilters = api;
})(typeof window !== 'undefined' ? window : globalThis);
