const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── 上传目录 ───
const UPLOAD_DIR = path.join(__dirname, 'uploads');
['covers', 'screenshots', 'music'].forEach(d => {
  fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 7 }
});

// ─── 数据库 ───
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URI
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_store (
      store_name VARCHAR(50) NOT NULL,
      item_id VARCHAR(200) NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY(store_name, item_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT
    )
  `);
}

// ─── 认证 ───
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// 从环境变量读取账号: USER1=用户名:密码  USER2=用户名:密码
const USERS = [];
['USER1', 'USER2'].forEach(k => {
  const v = process.env[k];
  if (v && v.includes(':')) {
    const [username, ...rest] = v.split(':');
    USERS.push({ username, password: rest.join(':') });
  }
});
if (!USERS.length) {
  USERS.push({ username: 'admin', password: 'admin123' });
  console.warn('⚠ 未配置账号，使用默认: admin / admin123');
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── API 路由 ───

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: '用户名或密码错误' });
  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

// 验证 token
app.get('/api/verify', auth, (req, res) => {
  res.json({ ok: true, username: req.user.username });
});

// 获取 store 中所有数据
app.get('/api/store/:name', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM data_store WHERE store_name=$1', [req.params.name]
    );
    res.json(rows.map(r => r.data));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 获取单条
app.get('/api/store/:name/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM data_store WHERE store_name=$1 AND item_id=$2',
      [req.params.name, req.params.id]
    );
    res.json(rows[0]?.data || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 写入/更新
app.put('/api/store/:name', auth, async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.id) return res.status(400).json({ error: 'Missing id' });
    await pool.query(
      `INSERT INTO data_store(store_name,item_id,data,updated_at) VALUES($1,$2,$3,NOW())
       ON CONFLICT(store_name,item_id) DO UPDATE SET data=$3, updated_at=NOW()`,
      [req.params.name, String(data.id), JSON.stringify(data)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 删除单条
app.delete('/api/store/:name/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM data_store WHERE store_name=$1 AND item_id=$2',
      [req.params.name, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 清空 store
app.delete('/api/store/:name', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM data_store WHERE store_name=$1', [req.params.name]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 设置读写
app.get('/api/settings/:key', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM app_settings WHERE key=$1', [req.params.key]);
    res.json({ value: rows[0]?.value || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings/:key', auth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO app_settings(key,value) VALUES($1,$2)
       ON CONFLICT(key) DO UPDATE SET value=$2`,
      [req.params.key, req.body.value || '']
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── IGDB 代理 ───
let igdbAccessToken = null;
let igdbTokenExpiry = 0;

async function getIGDBToken() {
  if (igdbAccessToken && Date.now() < igdbTokenExpiry - 60000) {
    return igdbAccessToken;
  }
  const cidRow = await pool.query("SELECT value FROM app_settings WHERE key='igdb_client_id'");
  const secRow = await pool.query("SELECT value FROM app_settings WHERE key='igdb_client_secret'");
  const clientId = cidRow.rows[0]?.value;
  const clientSecret = secRow.rows[0]?.value;
  if (!clientId || !clientSecret) throw new Error('未配置 IGDB 凭据');
  const resp = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!resp.ok) throw new Error('获取 IGDB token 失败');
  const data = await resp.json();
  igdbAccessToken = data.access_token;
  igdbTokenExpiry = Date.now() + data.expires_in * 1000;
  return igdbAccessToken;
}

async function igdbFetch(endpoint, body, retried) {
  const token = await getIGDBToken();
  const cidRow = await pool.query("SELECT value FROM app_settings WHERE key='igdb_client_id'");
  const clientId = cidRow.rows[0]?.value;
  const resp = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body
  });
  if (resp.status === 401 && !retried) {
    igdbAccessToken = null;
    igdbTokenExpiry = 0;
    return igdbFetch(endpoint, body, true);
  }
  if (!resp.ok) throw new Error(`IGDB 请求失败: ${resp.status}`);
  return resp.json();
}

app.post('/api/igdb/search', auth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: '缺少搜索关键词' });
    const body = `search "${query.replace(/"/g, '\\"')}"; fields name,cover.image_id,first_release_date,platforms.name; limit 15;`;
    const data = await igdbFetch('games', body);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/igdb/game/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '无效 ID' });
    const body = `fields name,cover.image_id,first_release_date,platforms.name,genres.name,involved_companies.company.name,involved_companies.developer; where id = ${id};`;
    const data = await igdbFetch('games', body);
    res.json(data[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── 文件上传 ───

// 上传封面（文件上传或 URL 下载）
app.post('/api/upload/cover', auth, upload.single('cover'), async (req, res) => {
  try {
    const gameId = req.body.gameId || req.query.gameId;
    if (!gameId) return res.status(400).json({ error: '缺少 gameId' });
    const outPath = path.join(UPLOAD_DIR, 'covers', `${gameId}_cover.webp`);

    if (req.file) {
      await sharp(req.file.buffer).resize(600, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 }).toFile(outPath);
    } else if (req.body.url) {
      const imgUrl = req.body.url.replace('/t_cover_big/', '/t_720p/');
      const resp = await fetch(imgUrl);
      if (!resp.ok) throw new Error('下载封面失败');
      const buf = Buffer.from(await resp.arrayBuffer());
      await sharp(buf).resize(600, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 }).toFile(outPath);
    } else {
      return res.status(400).json({ error: '需要文件或 URL' });
    }
    res.json({ path: `/uploads/covers/${gameId}_cover.webp` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 上传截图
app.post('/api/upload/screenshots', auth, upload.array('screenshots', 6), async (req, res) => {
  try {
    const gameId = req.body.gameId || req.query.gameId;
    if (!gameId) return res.status(400).json({ error: '缺少 gameId' });
    const paths = [];
    for (let i = 0; i < req.files.length; i++) {
      const outPath = path.join(UPLOAD_DIR, 'screenshots', `${gameId}_${i}.webp`);
      await sharp(req.files[i].buffer).resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 }).toFile(outPath);
      paths.push(`/uploads/screenshots/${gameId}_${i}.webp`);
    }
    res.json({ paths });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 上传音乐
app.post('/api/upload/music', auth, upload.single('music'), async (req, res) => {
  try {
    const gameId = req.body.gameId || req.query.gameId;
    if (!gameId || !req.file) return res.status(400).json({ error: '缺少 gameId 或文件' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.mp3';
    const outPath = path.join(UPLOAD_DIR, 'music', `${gameId}${ext}`);
    fs.writeFileSync(outPath, req.file.buffer);
    res.json({ path: `/uploads/music/${gameId}${ext}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 删除游戏关联文件
app.delete('/api/upload/:gameId', auth, (req, res) => {
  try {
    const gid = req.params.gameId;
    ['covers', 'screenshots', 'music'].forEach(sub => {
      const dir = path.join(UPLOAD_DIR, sub);
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).filter(f => f.startsWith(gid)).forEach(f => {
          fs.unlinkSync(path.join(dir, f));
        });
      }
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 数据迁移（base64 → 文件）
app.post('/api/migrate', auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT item_id, data FROM data_store WHERE store_name='games'");
    let migrated = 0;
    for (const row of rows) {
      const g = row.data;
      let changed = false;

      // 迁移封面
      if (g.cover && g.cover.startsWith('https://images.igdb.com/')) {
        try {
          const imgUrl = g.cover.replace('/t_cover_big/', '/t_720p/');
          const resp = await fetch(imgUrl);
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            const outPath = path.join(UPLOAD_DIR, 'covers', `${g.id}_cover.webp`);
            await sharp(buf).resize(600, 800, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 85 }).toFile(outPath);
            g.cover = `/uploads/covers/${g.id}_cover.webp`;
            changed = true;
          }
        } catch (e) { console.error(`迁移封面失败 ${g.id}:`, e.message); }
      }

      // 迁移截图
      if (g.screenshots?.length) {
        const newScreenshots = [];
        for (let i = 0; i < g.screenshots.length; i++) {
          const s = g.screenshots[i];
          if (s.startsWith('data:')) {
            try {
              const base64Data = s.split(',')[1];
              const buf = Buffer.from(base64Data, 'base64');
              const outPath = path.join(UPLOAD_DIR, 'screenshots', `${g.id}_${i}.webp`);
              await sharp(buf).resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 }).toFile(outPath);
              newScreenshots.push(`/uploads/screenshots/${g.id}_${i}.webp`);
              changed = true;
            } catch (e) { newScreenshots.push(s); }
          } else {
            newScreenshots.push(s);
          }
        }
        g.screenshots = newScreenshots;
      }

      // 迁移音乐
      if (g.music && g.music.startsWith('data:')) {
        try {
          const mimeMatch = g.music.match(/^data:(audio\/\w+);/);
          const ext = mimeMatch ? ({ 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/mp3': '.mp3' }[mimeMatch[1]] || '.mp3') : '.mp3';
          const base64Data = g.music.split(',')[1];
          const buf = Buffer.from(base64Data, 'base64');
          const outPath = path.join(UPLOAD_DIR, 'music', `${g.id}${ext}`);
          fs.writeFileSync(outPath, buf);
          g.music = `/uploads/music/${g.id}${ext}`;
          changed = true;
        } catch (e) { console.error(`迁移音乐失败 ${g.id}:`, e.message); }
      }

      if (changed) {
        await pool.query(
          `UPDATE data_store SET data=$1, updated_at=NOW() WHERE store_name='games' AND item_id=$2`,
          [JSON.stringify(g), row.item_id]
        );
        migrated++;
      }
    }
    res.json({ ok: true, total: rows.length, migrated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── 启动 ───
const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🏝 绿洲服务器已启动: ${PORT}`);
    console.log(`📋 已配置账号: ${USERS.map(u => u.username).join(', ')}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});