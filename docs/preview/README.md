# 游戏详情本地预览

在项目根目录运行 `node docs/preview/server.js`，打开 <http://127.0.0.1:4174/?detail=portal2#page-games>。

无需数据库或 API 密钥。示例记录仅保存在预览进程内存中；可以修改评分、手记及删除记录，重启即可恢复。上传、外部搜索与设置保存不在此预览中模拟。生产入口仍为 `node server.js`，不会自动加载示例数据。

《传送门 2》的封面及五张截图来自 [Valve 的 Steam 商店页面](https://store.steampowered.com/app/620/Portal_2/)，仅用于本地页面调试，版权归各自权利人所有。原始素材 URL 见 [sources.json](portal2/sources.json)。个人评分、收藏日期和手记为演示内容。

`public/game-detail.js` 和 `public/game-detail.css` 实现真实详情页；预览数据与图片放在本目录，生产容器已排除 `docs`。
