/* Albums are collection records. One shared audio element owns the listening queue. */
(() => {
  const section = document.getElementById('page-music');
  const grid = section.querySelector('.music-grid');
  const audio = document.getElementById('library-audio');
  const player = document.getElementById('music-player');
  const detail = document.getElementById('modal-music-detail');
  const editor = document.getElementById('modal-music-edit');
  const form = document.getElementById('music-form');
  const queuePanel = document.getElementById('music-queue');
  const fallback = '/media/music/night-ocean.png';
  const categories = {original:'独立音乐',game:'游戏原声',movie:'电影配乐'};
  let albums = [], queue = [], current = -1, repeat = false, editing = null, retainedTracks = [], relatedItems = [];
  let loadVersion = 0, playVersion = 0, lastFocus = null, activeDetailId = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function media(value) {return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value) || /^data:image\//.test(value)) ? value : '';}
  function external(value) {try {const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : '';} catch {return '';}}
  const artwork = album => esc(media(album.cover) || fallback);
  const time = seconds => Number.isFinite(seconds) && seconds >= 0 ? `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}` : '0:00';
  const currentTrack = () => queue[current];
  function normalized(album) {
    return {...album,tracks:Array.isArray(album.tracks) ? album.tracks.filter(t => t && typeof t === 'object') : []};
  }
  async function load() {
    const version = ++loadVersion;
    section.querySelector('.music-status').textContent = '正在整理唱片…';
    try {
      const records = await dbA('music');
      if (version !== loadVersion) return;
      albums = records.map(normalized).sort((a,b) => (b.createdAt || 0)-(a.createdAt || 0));
      section.querySelector('.music-status').textContent = ''; render();
    } catch {
      section.querySelector('.music-status').textContent = '音乐收藏加载失败，请重试。';
      section.querySelector('.music-retry').hidden = false;
    }
  }
  function render() {
    section.querySelector('.music-retry').hidden = true;
    const query = section.querySelector('.music-search').value.trim().toLocaleLowerCase();
    const type = section.querySelector('.music-type').value;
    const category = section.querySelector('.music-category').value;
    const sort = section.querySelector('.music-sort').value;
    const items = albums.filter(a => `${a.title} ${a.artist}`.toLocaleLowerCase().includes(query) && (!type || a.type === type) && (!category || a.category === category));
    if (sort === 'title') items.sort((a,b) => String(a.title).localeCompare(String(b.title),'zh-CN',{numeric:true}));
    if (sort === 'rating') items.sort((a,b) => (Number(b.rating)||0)-(Number(a.rating)||0));
    section.querySelector('.music-count').textContent = `${items.length} / ${albums.length} 张唱片`;
    section.querySelector('.music-total').textContent = `${String(albums.length).padStart(2,'0')} RECORDS`;
    grid.innerHTML = items.map((a,i) => `<article class="record-card"><div class="record-art"><button class="record-open" type="button" data-open="${esc(a.id)}" aria-label="查看 ${esc(a.title)}"><img loading="lazy" src="${artwork(a)}" alt="${esc(a.title)}封面"></button><span class="record-kind">${esc(a.type === 'single' ? 'SINGLE' : 'ALBUM')}</span><button class="record-play" type="button" data-album-play="${esc(a.id)}" aria-label="播放 ${esc(a.title)}" ${a.tracks.some(t=>media(t.src)) ? '' : 'disabled'}>▶</button></div><div class="record-meta"><span class="record-number">${String(i+1).padStart(2,'0')}</span><div><button type="button" class="record-title" data-open="${esc(a.id)}">${esc(a.title)}</button><p>${esc(a.artist || '未知艺术家')}</p></div><span class="record-rating">${Number(a.rating)>0 ? '★ '+Number(a.rating) : '—'}</span></div><div class="record-foot"><span>${esc(categories[a.category] || '独立音乐')}</span><span>${esc(a.year || '年份待补充')} · ${a.tracks.length} 首</span></div></article>`).join('');
    const empty = section.querySelector('.music-empty');
    empty.hidden = items.length > 0;
    empty.textContent = albums.length ? '没有找到符合条件的唱片，试试其他关键词或分类。' : '收藏一张唱片，让喜欢的旋律有个归处。点击「添加音乐」开始。';
    if(albums.length && !query && !type && !category){const add=document.createElement('button');add.type='button';add.className='record-add-card';add.innerHTML='<span>＋</span><strong>下一张，留给你。</strong><small>收藏专辑、单曲与原声</small>';add.onclick=()=>openEditor();grid.append(add);}
    grid.querySelectorAll('[data-open]').forEach(button => button.onclick = () => openDetail(button.dataset.open));
    grid.querySelectorAll('[data-album-play]').forEach(button => button.onclick = () => playAlbum(button.dataset.albumPlay));
    grid.querySelectorAll('img').forEach(image => image.onerror = () => {image.onerror = null; image.src = fallback;});
    section.querySelector('.music-listen').disabled = !albums.some(a => a.tracks.some(t => media(t.src)));
  }
  function openDetail(id) {
    const album = albums.find(a => a.id === id); if (!album) return;
    activeDetailId = id;
    const out = external(album.listenUrl);
    detail.querySelector('.music-detail-content').innerHTML = `<div class="music-detail-head"><div class="music-detail-sleeve"><img src="${artwork(album)}" alt="${esc(album.title)}封面"></div><div><span class="music-eyebrow">${esc(categories[album.category] || '独立音乐')} / ${album.type === 'single' ? 'SINGLE' : 'ALBUM'}</span><h2 id="music-detail-title">${esc(album.title)}</h2><p class="music-artist">${esc(album.artist || '未知艺术家')}</p><p class="music-detail-meta">${esc(album.year || '年份待补充')} · ${album.tracks.length} 首曲目${Number(album.rating)>0 ? ' · ★ '+Number(album.rating) : ''}</p><div class="music-detail-actions"><button type="button" class="music-primary" data-play ${album.tracks.some(t=>media(t.src)) ? '' : 'disabled'}>▶ 播放专辑</button>${out ? `<a class="music-external" href="${esc(out)}" target="_blank" rel="noopener noreferrer">外部收听 ↗</a>` : ''}</div></div></div>
      <div class="music-detail-body"><div class="music-tracks"><div class="music-small-heading">曲目列表 <span>TRACKLIST</span></div>${album.tracks.length ? album.tracks.map((t,i) => `<button type="button" class="music-track" data-track="${i}" ${media(t.src) ? '' : 'disabled'}><span class="track-number">${String(i+1).padStart(2,'0')}</span><span>${esc(t.title || '未命名曲目')}</span><span>${media(t.src) ? (t.duration ? time(t.duration) : '▶') : '暂无音频'}</span></button>`).join('') : '<p class="music-muted">这张唱片还没有音频，可编辑档案添加。</p>'}</div><aside class="music-notes"><div class="music-small-heading">收藏手记</div><p>${esc(album.review || '写下这首旋律让你想起的故事。')}</p>${album.related?.id ? '<button class="music-related" type="button">查看关联作品 ↗</button>' : ''}${album.demo ? '<small>本地演示唱片 · 程序合成试听</small>' : ''}</aside></div><div class="music-detail-bottom"><button type="button" class="music-delete">删除收藏</button><button type="button" class="music-secondary music-edit-record">编辑档案 ↗</button></div>`;
    detail.querySelector('[data-play]').onclick = () => playAlbum(id);
    detail.querySelectorAll('[data-track]').forEach(button => button.onclick = () => playAlbum(id,Number(button.dataset.track)));
    detail.querySelector('.music-edit-record').onclick = () => openEditor(album);
    detail.querySelector('.music-delete').onclick = async () => {
      if (!confirm(`删除「${album.title}」的音乐收藏？`)) return;
      try {
        await saveRequest(`/api/store/music/${encodeURIComponent(id)}`,'DELETE');
        if (currentTrack()?.albumId === id) stop();
        else {const active = currentTrack(); queue = queue.filter(t=>t.albumId!==id); current = active ? queue.findIndex(t=>t.key===active.key) : -1; renderQueue();}
        closeAllModals(); await load(); showToast('音乐收藏已删除');
      } catch(error) {showToast(error.message,'error');}
    };
    const related = detail.querySelector('.music-related');
    if (related) related.onclick = () => {closeAllModals(); if(album.related.kind==='games')showGameDetail(album.related.id);else if(album.related.kind==='movies')showMovieDetail(album.related.id);};
    const cover = detail.querySelector('img'); cover.onerror = () => {cover.onerror=null;cover.src=fallback;};
    closeAllModals(); openModal('music-detail'); syncPlaying();
  }
  function flatten(collection) {
    return collection.flatMap(album => album.tracks.map((track,index) => ({...track,key:album.id+':'+(track.id || index),albumId:album.id,albumTitle:album.title,artist:album.artist,cover:media(album.cover)||fallback})).filter(t => media(t.src)));
  }
  function playAlbum(id, index = 0) {
    const album = albums.find(a=>a.id===id); if(!album)return;
    const selected = album.tracks[index];
    queue = flatten([album]);
    const target = selected ? queue.findIndex(t=>t.key===id+':'+(selected.id || index)) : 0;
    if(!queue.length) return showToast('先为这张唱片添加音频','error');
    start(Math.max(0,target));
  }
  async function start(index) {
    if (!queue.length) return;
    const version = ++playVersion;
    current = (index+queue.length)%queue.length;
    stopGM(); document.querySelectorAll('audio').forEach(a => {if(a!==audio)a.pause();});
    const track = currentTrack();
    audio.src = media(track.src); audio.muted = window.oasisMuted === true;
    player.hidden = false; document.body.classList.add('has-music-player');
    player.querySelector('.player-cover').src = track.cover;
    player.querySelector('.player-title').textContent = track.title || '未命名曲目';
    player.querySelector('.player-artist').textContent = track.artist || '未知艺术家';
    player.querySelector('.player-message').textContent = '正在载入…';
    player.querySelector('.player-time').textContent = '0:00'; player.querySelector('.player-duration').textContent = '0:00';
    player.querySelector('.player-seek').value=0;player.querySelector('.player-seek').disabled=true;
    renderQueue(); syncPlaying();
    try {await audio.play(); if(version===playVersion)player.querySelector('.player-message').textContent='';}
    catch(error) {if(version===playVersion && error.name!=='AbortError')player.querySelector('.player-message').textContent='无法播放，请重试或切换曲目';}
  }
  async function toggle() {
    if(!currentTrack())return;
    if(!audio.paused)audio.pause();
    else try {await audio.play(); player.querySelector('.player-message').textContent='';} catch {player.querySelector('.player-message').textContent='无法播放，请重试或切换曲目';}
  }
  function stop() {
    ++playVersion;audio.pause();audio.removeAttribute('src');audio.load();queue=[];current=-1;
    player.hidden=true;queuePanel.hidden=true;document.body.classList.remove('has-music-player');syncPlaying();
  }
  function syncPlaying() {
    const playing = !audio.paused && current >= 0;
    player.querySelector('.player-toggle').textContent = playing ? 'Ⅱ' : '▶';
    player.querySelector('.player-toggle').setAttribute('aria-label',playing ? '暂停音乐' : '播放音乐');
    player.classList.toggle('is-playing',playing);
    section.classList.toggle('music-is-playing',playing);
    detail.querySelectorAll('[data-track]').forEach(button => {
      const album=albums.find(a=>a.id===activeDetailId), t=album?.tracks[Number(button.dataset.track)];
      const selected = currentTrack()?.key === activeDetailId+':'+(t?.id || Number(button.dataset.track));
      button.classList.toggle('is-current',selected); button.setAttribute('aria-current',String(selected));
    });
    queuePanel.querySelectorAll('[data-queue-index]').forEach(button=>button.setAttribute('aria-current',String(Number(button.dataset.queueIndex)===current)));
  }
  function renderQueue() {
    queuePanel.querySelector('.queue-list').innerHTML = queue.map((t,i)=>`<button type="button" data-queue-index="${i}" aria-current="${i===current}"><span>${String(i+1).padStart(2,'0')}</span><span>${esc(t.title)}<small>${esc(t.artist)}</small></span><span>▶</span></button>`).join('');
    queuePanel.querySelector('.queue-count').textContent = `${queue.length} 首`;
    queuePanel.querySelectorAll('[data-queue-index]').forEach(button=>button.onclick=()=>start(Number(button.dataset.queueIndex)));
  }
  function renderRetained() {
    form.querySelector('.music-existing-tracks').replaceChildren();
    retainedTracks.forEach((track,index)=>{
      const row=document.createElement('div');row.className='music-existing-track';
      const input=document.createElement('input'); input.value=track.title || ''; input.required=true; input.maxLength=160;input.setAttribute('aria-label',`第 ${index+1} 首曲名`);input.oninput=()=>{track.title=input.value;};
      const button=document.createElement('button');button.type='button';button.textContent='移除';button.onclick=()=>{retainedTracks.splice(index,1);renderRetained();};row.append(input,button);form.querySelector('.music-existing-tracks').append(row);
    });
  }
  async function openEditor(album = null) {
    editing = album; retainedTracks = (album?.tracks || []).map(t=>({...t}));
    form.reset(); form.querySelector('.music-form-error').textContent='';
    editor.querySelector('h2').textContent = album ? '编辑音乐档案' : '收藏新的旋律';
    for(const key of ['title','artist','year','review','listenUrl'])form.elements[key].value=album?.[key] || '';
    form.elements.type.value=album?.type || 'album';form.elements.category.value=album?.category || 'original';form.elements.rating.value=album?.rating || '0';
    form.querySelector('.music-file-summary').textContent='可一次选择多首音频，每个文件不超过 30 MB。';
    form.querySelector('.music-edit-cover').src=media(album?.cover)||fallback;
    renderRetained();closeAllModals();openModal('music-edit');
    const relation = form.elements.related; relation.replaceChildren(new Option('不关联作品',''));
    try {
      const [games,movies]=await Promise.all([dbA('games'),dbA('movies')]);
      if(!editor.classList.contains('show') || editing!==album)return;
      relatedItems=[...games.map(g=>({kind:'games',id:g.id,title:g.title})),...movies.map(m=>({kind:'movies',id:m.id,title:m.title}))];
      relatedItems.forEach((item,index)=>relation.add(new Option(`${item.kind==='games'?'游戏':'电影'} · ${item.title}`,String(index))));
      if(album?.related){const index=relatedItems.findIndex(r=>r.kind===album.related.kind && r.id===album.related.id); if(index>=0)relation.value=String(index);}
    } catch {form.querySelector('.music-form-error').textContent='关联作品加载失败，其他信息仍可编辑。';}
  }
  async function saveRequest(url,method,body) {
    const response=await fetch(url,{method,headers:authHeaders(),...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok)throw new Error(response.status===401?'登录已过期，请重新登录':'保存失败，请稍后重试');
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault(); const button=form.querySelector('[type=submit]'), error=form.querySelector('.music-form-error');error.textContent='';
    const files=Array.from(form.elements.tracks.files), cover=form.elements.cover.files[0];
    if(files.length+retainedTracks.length>20){error.textContent='每张专辑最多 20 首曲目。';return;}
    if([...files,...(cover?[cover]:[])].some(f=>f.size>30*1024*1024)){error.textContent='每个文件不能超过 30 MB。';return;}
    if(!form.elements.title.value.trim() || !form.elements.artist.value.trim()){error.textContent='请填写名称和艺术家。';return;}
    button.disabled=true;button.textContent='正在保存…';
    try {
      let uploaded={tracks:[],cover:null};
      if(files.length || cover){
        const data=new FormData();if(cover)data.append('cover',cover);files.forEach(file=>data.append('tracks',file));
        const response=await fetch('/api/music/upload',{method:'POST',headers:{Authorization:`Bearer ${authToken}`},body:data});
        uploaded=await response.json();if(!response.ok)throw new Error(uploaded.error || '文件上传失败');
      }
      const record={...editing,id:editing?.id || gid(),title:form.elements.title.value.trim(),artist:form.elements.artist.value.trim(),type:form.elements.type.value,category:form.elements.category.value,year:form.elements.year.value,rating:Number(form.elements.rating.value),review:form.elements.review.value.trim(),listenUrl:form.elements.listenUrl.value.trim(),cover:uploaded.cover || editing?.cover || '',tracks:[...retainedTracks,...uploaded.tracks.map((t,i)=>({...t,title:files[i].name.replace(/\.[^.]+$/,'')}))],related:form.elements.related.value!=='' ? relatedItems[Number(form.elements.related.value)] : null,createdAt:editing?.createdAt || Date.now()};
      await saveRequest('/api/store/music','PUT',record);
      // Refresh queued metadata after editing, keeping the playing track if it still exists.
      if(queue.some(t=>t.albumId===record.id)) {
        const old=currentTrack();const fresh=flatten([record]);queue=queue.filter(t=>t.albumId!==record.id).concat(fresh);
        current=old ? queue.findIndex(t=>t.key===old.key) : -1;
        if(current<0)stop();else {renderQueue();player.querySelector('.player-title').textContent=currentTrack().title;player.querySelector('.player-artist').textContent=currentTrack().artist;player.querySelector('.player-cover').src=currentTrack().cover;}
      }
      closeAllModals();await load();openDetail(record.id);showToast('音乐档案已保存');
    } catch(reason){error.textContent=reason.message;}
    finally{button.disabled=false;button.textContent='保存音乐档案';}
  });
  let coverPreview='';
  form.elements.cover.onchange=()=>{if(coverPreview)URL.revokeObjectURL(coverPreview);const file=form.elements.cover.files[0];coverPreview=file?URL.createObjectURL(file):'';form.querySelector('.music-edit-cover').src=coverPreview || media(editing?.cover)||fallback;};
  form.elements.tracks.onchange=()=>{form.querySelector('.music-file-summary').textContent=Array.from(form.elements.tracks.files).map(f=>f.name).join(' · ') || '可一次选择多首音频，每个文件不超过 30 MB。';};
  section.querySelector('.music-add').onclick=()=>openEditor();
  section.querySelector('.music-retry').onclick=load;
  section.querySelector('.music-search').oninput=render;
  section.querySelectorAll('.music-type,.music-category,.music-sort').forEach(select=>select.onchange=render);
  section.querySelector('.music-listen').onclick=()=>{queue=flatten(albums);if(queue.length)start(0);};
  player.querySelector('.player-toggle').onclick=toggle;
  player.querySelector('.player-prev').onclick=()=>{if(audio.currentTime>3)audio.currentTime=0;else start(current-1);};
  player.querySelector('.player-next').onclick=()=>start(current+1);
  player.querySelector('.player-repeat').onclick=event=>{repeat=!repeat;event.currentTarget.setAttribute('aria-pressed',String(repeat));};
  player.querySelector('.player-queue').onclick=event=>{queuePanel.hidden=!queuePanel.hidden;event.currentTarget.setAttribute('aria-expanded',String(!queuePanel.hidden));};
  queuePanel.querySelector('.queue-close').onclick=()=>{queuePanel.hidden=true;player.querySelector('.player-queue').setAttribute('aria-expanded','false');};
  player.querySelector('.player-close').onclick=stop;
  player.querySelector('.player-now').onclick=()=>{if(currentTrack())openDetail(currentTrack().albumId);};
  player.querySelector('.player-volume').oninput=event=>{audio.volume=Number(event.target.value);};audio.volume=.65;
  player.querySelector('.player-seek').oninput=event=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(event.target.value)*audio.duration/1000;};
  const updateProgress=()=>{
    const duration=audio.duration; const seek=player.querySelector('.player-seek'); seek.disabled=!Number.isFinite(duration)||duration<=0;
    seek.value=seek.disabled?0:audio.currentTime/duration*1000;
    player.querySelector('.player-time').textContent=time(audio.currentTime);player.querySelector('.player-duration').textContent=time(duration);
  };
  audio.addEventListener('timeupdate',updateProgress);audio.addEventListener('loadedmetadata',updateProgress);
  audio.addEventListener('play',()=>{syncPlaying();player.querySelector('.player-message').textContent='';});audio.addEventListener('pause',syncPlaying);
  audio.addEventListener('error',()=>{if(currentTrack())player.querySelector('.player-message').textContent='音频不可用，可以切换其他曲目';syncPlaying();});
  audio.addEventListener('ended',()=>{if(repeat)start(current);else if(current<queue.length-1)start(current+1);else syncPlaying();});
  document.addEventListener('play',event=>{if(event.target===audio){stopGM();document.querySelectorAll('audio').forEach(a=>{if(a!==audio)a.pause();});}else if(event.target instanceof HTMLAudioElement)audio.pause();},true);
  document.addEventListener('oasis:data-loaded',load);
  document.addEventListener('oasis:logout',()=>{++loadVersion;stop();albums=[];render();});
  document.addEventListener('oasis:modal-open',event=>{
    if(!['music-detail','music-edit'].includes(event.detail))return;
    const target=event.detail==='music-detail'?detail:editor;lastFocus=document.activeElement;
    target.querySelector('.modal').scrollTop=0;target.querySelector('.modal-close').focus({preventScroll:true});
  });
  document.addEventListener('oasis:modals-close',()=>{if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;});
  document.addEventListener('keydown',event=>{
    const target=[detail,editor].find(el=>el.classList.contains('show'));
    if(!target || event.key!=='Tab')return;
    const elements=Array.from(target.querySelectorAll('button,a[href],input,select,textarea')).filter(el=>!el.disabled && el.getClientRects().length);
    const first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  });
  if(authToken)load();
  window.MusicLibrary={load,stop,isPlaying:()=>!audio.paused,openDetail};
})();
