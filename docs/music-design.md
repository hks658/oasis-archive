# 音乐收藏室 · 本地试用版

音乐是独立的收藏分类，使用现有 `/api/store/music` 保存音乐档案。每条档案包含名称、艺术家、年份、形式、分类、评分、手记、封面、曲目、外部收听链接和可选的游戏／电影关联。上传通过已登录的 `/api/music/upload` 完成，保存到 `uploads/music-library`。

支持专辑／单曲、分类筛选、艺术家与名称搜索、评分排序、编辑与删除、曲目重命名与移除。底部播放器提供播放暂停、前后切歌、进度、音量、单曲循环、队列。筛选不会修改队列；关闭或退出登录会停止播放。播放期间游戏悬停音乐不抢占声音。其他详情音频主动播放时，音乐收藏室暂停。

运行 `node docs/preview/server.js`，访问 `http://127.0.0.1:4174/#page-music`。如果该端口已有旧预览，可设置 `PREVIEW_PORT=4175` 启动新实例。预览数据保存在进程内存，重启会恢复样例；上传文件放在系统临时目录。生产入口不会加载演示收藏。

## 视觉素材

- 生成方式：内置 image_gen 工具，2026-09-27。
- 保存路径：`public/media/music/night-ocean.png`。
- 用途：音乐主视觉和默认封面；黑胶、唱片套、文字叠加由 CSS 与 HTML 绘制。
- 原始提示词：

> Use case: stylized-concept. Create one cinematic wide 3:2 artwork for the existing OASIS dark music listening room website. A tranquil alien ocean at midnight with a huge softly glowing amber eclipsed sun on the horizon, tiny stars and luminous warm reflections, distant mountain silhouettes, faint atmospheric grain, sophisticated photographic analogue album-sleeve art, warm ochre and burnt orange fading into deep plum and almost black. Quiet, premium, contemplative; lots of dark atmospheric negative space at left for website typography, luminous sun and ocean reflection predominantly at right. No people, no objects in foreground, absolutely no text or letters, no logos, no watermarks, no UI mockup. Asset will be used as a wide website feature background and a square-cropped album-like artwork.

第二张样例使用项目已有城市海报。第三张沿用游戏详情样例的 Valve 海报（来源见 `docs/preview/portal2/sources.json`）；试听不是游戏官方原声，详情已明确标注。

试听为四段 28 秒的程序合成氛围片段，未使用第三方录音；曲目和专辑名称均为演示设定。所有试听 WAV 放在 `docs/preview/music`，不进入生产镜像。
