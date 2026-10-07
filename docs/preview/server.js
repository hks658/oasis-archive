// Local-only UI preview. Collections live in memory and reset on restart.
const express = require('express');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const assets = '/preview-assets/';
function createPreviewApp() {
  const app = express();
  app.use(express.json());
  const data = {
    games: [{
      id:'portal2', title:'传送门 2 · Portal 2', releaseYear:'2011', platforms:['PC', 'Mac', 'Linux'],
      cover:assets+'cover.jpg', screenshots:Array.from({length:5}, (_,i) => assets+`screenshot-${i+1}.jpg`),
      rating:5, createdAt:new Date('2026-09-26T10:00:00+08:00').getTime(),
      review:'最难忘的，是推开下一扇门时的好奇。\n\n蓝色与橙色的传送门让空间有了另一种解法。站在看似无路可走的房间里，换个角度，出口就藏在刚才忽略的地方。\n\n喜欢它把解谜、幽默和叙事放在同一段旅程中。每一次恍然大悟，都像是与关卡设计者完成了一次默契的对话。'
    }],
    music:[
      {id:'after-hours',title:'夜航 · After Hours',artist:'OASIS / 合成试听',year:'2026',type:'album',category:'original',rating:5,cover:'/media/music/night-ocean.png',review:'献给那些不急着结束的夜晚。\n\n两段缓慢流动的和弦，把忙碌的一天留在岸边。',demo:true,createdAt:3,tracks:[{id:'amber',title:'Amber Tide / 琥珀潮汐',src:'/music-demo/demo-1.wav',duration:28},{id:'after',title:'After Hours / 夜航',src:'/music-demo/demo-2.wav',duration:28}]},
      {id:'neon',title:'霓虹来信',artist:'OASIS / 合成试听',year:'2026',type:'single',category:'original',rating:4,cover:'/media/neon-city-poster.jpg',review:'穿过城市的灯光，把脚步交给节拍。此曲为本地演示的程序合成音频。',demo:true,createdAt:2,tracks:[{id:'blue',title:'Blue Distance / 蓝色远方',src:'/music-demo/demo-3.wav',duration:28}]},
      {id:'test-chamber',title:'测试室习作',artist:'OASIS / 合成试听',year:'2026',type:'single',category:'game',rating:4,cover:'/preview-assets/cover.jpg',related:{kind:'games',id:'portal2'},review:'用于演示音乐与游戏档案的关联。试听为程序合成片段，并非《传送门 2》的官方原声。',demo:true,createdAt:1,tracks:[{id:'orbit',title:'Quiet Orbit / 安静轨道',src:'/music-demo/demo-4.wav',duration:28}]}
    ], wishlist:[], movies:[], top10:[], upcoming_ratings:[]
  };
  app.get('/api/verify', (req,res) => res.json({ok:true,username:'本地预览'}));
  app.get('/api/settings/:key', (req,res) => res.json({value:''}));
  app.get('/api/store/:name', (req,res) => res.json(data[req.params.name] || []));
  app.get('/api/store/:name/:id', (req,res) => res.json((data[req.params.name] || []).find(item => item.id === req.params.id) || null));
  app.put('/api/store/:name', (req,res) => {
    const items = data[req.params.name];
    if (!items || !req.body.id) return res.status(400).json({error:'无效的预览记录'});
    const index = items.findIndex(item => item.id === req.body.id);
    if (index < 0) items.push(req.body); else items[index] = req.body;
    res.json({ok:true});
  });
  app.delete('/api/store/:name/:id', (req,res) => {
    if (data[req.params.name]) data[req.params.name] = data[req.params.name].filter(item => item.id !== req.params.id);
    res.json({ok:true});
  });
  const uploadDirectory = fs.mkdtempSync(path.join(require('os').tmpdir(),'oasis-music-preview-'));
  app.use('/api/music/upload',require('../../music-upload')(uploadDirectory,'/music-uploads'));
  app.use('/music-uploads',express.static(uploadDirectory));
  app.use('/music-demo',express.static(path.join(__dirname,'music')));
  app.use('/api', (req,res) => res.status(400).json({error:'本地预览未连接外部服务'}));
  app.use('/preview-assets', express.static(path.join(__dirname,'portal2')));
  app.get('/', (req,res) => {
    let html = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
    html = html.replace('<head>', '<head><script>localStorage.setItem("oasis_token","preview-only")</script>');
    const banner = '<aside style="position:fixed;bottom:4px;left:50%;transform:translateX(-50%);z-index:900;padding:6px 12px;border:1px solid #ffffff25;border-radius:6px;background:#141622ed;color:#bcc8d6;font:11px sans-serif;white-space:nowrap">本地样例 · 评分与手记为演示内容</aside>';
    const autoOpen = req.query.detail === 'portal2' ? '<script>showGameDetail("portal2")</script>' : '';
    html = html.replace('</body>', banner + autoOpen + '</body>');
    res.type('html').send(html);
  });
  app.use(express.static(path.join(root,'public')));
  return app;
}
if (require.main === module) {
  const port = Number(process.env.PREVIEW_PORT) || 4174;
  createPreviewApp().listen(port,'127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/?detail=portal2#page-games`));
}
module.exports = {createPreviewApp};
