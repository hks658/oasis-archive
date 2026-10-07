/* Self-contained trial: original cards retain their detail and editing handlers. */
(() => {
  const section = document.getElementById('page-movies');
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const switcher = document.createElement('div');
  switcher.className = 'cinema-view-controls';
  switcher.innerHTML = '<button type="button" aria-pressed="true">电影长廊</button><button type="button" aria-pressed="false">海报网格</button><small>在海报上滚动或左右滑动 · 点击查看电影</small>';
  section.querySelector('.tab-controls').before(switcher);
  const modes = switcher.querySelectorAll('button');
  const refreshers = [];
  const startWithReel = !matchMedia('(max-width:760px), (pointer:coarse)').matches;
  section.classList.toggle('cinema-reel',startWithReel);
  modes.forEach((button,index) => button.setAttribute('aria-pressed',String(startWithReel ? index===0 : index===1)));
  modes.forEach((button,index) => button.addEventListener('click', () => {
    section.classList.toggle('cinema-reel',index === 0);
    modes.forEach((item,i) => item.setAttribute('aria-pressed',String(i === index)));
    refreshers.forEach(refresh => refresh());
  }));
  section.querySelectorAll('.card-grid').forEach(grid => {
    const controls = document.createElement('div');
    controls.className = 'reel-controls';
    controls.innerHTML = '<button type="button" aria-label="上一部电影">←</button><span class="reel-position"></span><button type="button" aria-label="下一部电影">→</button>';
    grid.after(controls);
    const [previous,next] = controls.querySelectorAll('button');
    const position = controls.querySelector('span');
    const cards = () => Array.from(grid.children).filter(card => card.matches('.movie-card') && !card.hidden);
    let selected = 0, frame = 0;
    function refresh() {
      frame = 0;
      if (!section.classList.contains('cinema-reel') || !grid.clientWidth) return;
      const items = cards();
      const bounds = grid.getBoundingClientRect();
      let distance = Infinity;
      selected = 0;
      items.forEach((card,i) => {
        const rect = card.getBoundingClientRect();
        const delta = Math.abs(rect.left + rect.width/2 - bounds.left - bounds.width/2);
        if (delta < distance) { distance = delta; selected = i; }
      });
      items.forEach((card,i) => card.classList.toggle('reel-current',i === selected));
      position.textContent = items.length ? `${String(selected+1).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}` : '00 / 00';
      previous.disabled = !items.length || selected === 0;
      next.disabled = !items.length || selected === items.length-1;
      controls.hidden = items.length === 0;
    }
    function queue() { if (!frame) frame = requestAnimationFrame(refresh); }
    function move(step) {
      const items = cards();
      const card = items[Math.max(0,Math.min(items.length-1,selected+step))];
      if (!card) return;
      const rect = card.getBoundingClientRect(), bounds = grid.getBoundingClientRect();
      grid.scrollBy({left:rect.left+rect.width/2-bounds.left-bounds.width/2,behavior:reduce.matches?'instant':'smooth'});
    }
    previous.addEventListener('click',()=>move(-1));
    next.addEventListener('click',()=>move(1));
    grid.addEventListener('scroll',queue,{passive:true});
    let wheelFrame = 0, wheelTarget = 0;
    function advanceWheel() {
      if (!section.classList.contains('cinema-reel') || !grid.clientWidth) {wheelFrame=0;return;}
      wheelTarget=Math.min(wheelTarget,Math.max(0,grid.scrollWidth-grid.clientWidth));
      const remaining = wheelTarget-grid.scrollLeft;
      if (reduce.matches || Math.abs(remaining) < .5) {
        grid.scrollLeft = wheelTarget; wheelFrame = 0; return;
      }
      grid.scrollLeft += Math.sign(remaining) * Math.max(1,Math.abs(remaining) * .24);
      wheelFrame = requestAnimationFrame(advanceWheel);
    }
    // Only consume vertical wheel movement over the gallery, and release it at either end.
    grid.addEventListener('wheel',event => {
      if (!section.classList.contains('cinema-reel') || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = grid.scrollWidth-grid.clientWidth;
      if (max <= 1 || (event.deltaY < 0 && grid.scrollLeft <= 1) || (event.deltaY > 0 && grid.scrollLeft >= max-1)) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? grid.clientWidth : 1);
      if (!wheelFrame) wheelTarget = grid.scrollLeft;
      wheelTarget = Math.max(0,Math.min(max,wheelTarget+delta));
      if (!wheelFrame) wheelFrame = requestAnimationFrame(advanceWheel);
    },{passive:false});
    new MutationObserver(queue).observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
    new ResizeObserver(queue).observe(grid);
    refreshers.push(queue);
    queue();
  });
})();
