# MIoT V2 UI 实施规范

## 1. 开发目标

在保留现有 MIoT 架构和功能的基础上，升级智能音箱插件的移动端界面。

继续使用：

- HTML
- CSS
- 原生 JavaScript
- TypeScript
- Songloft Plugin SDK

不得引入 React、Vue、Flutter 或其他前端框架。

## 2. 视觉规范

- Android 竖屏优先
- Songloft 原生浅色风格
- 白色和浅灰背景
- 蓝紫色作为强调色
- 轻量圆角和克制阴影
- 紧凑列表
- 使用真实业务数据

## 3. 基础主界面

参考图：

```text
01-base-main.png
```

包含：

- 当前设备胶囊
- 设置和刷新按钮
- 当前歌单选择器
- 统一搜索框
- 歌曲列表
- 当前播放状态
- 底部迷你播放器

阶段 1 只实现本参考图的基础布局，保持 Android 竖屏浅色 UI，复用真实设备、歌单和歌曲数据，并保留现有 DOM ID、事件绑定、设备切换、歌单切换和播放器状态能力。不得借此实现新的统一搜索、在线搜索或后端能力。

## 4. 歌单选择器

参考图：

```text
02-playlist-selector.png
```

要求：

- 复用现有歌单数据
- 支持搜索歌单
- 显示歌单名称和歌曲数量
- 当前歌单高亮并显示对勾
- 切换后刷新歌曲列表

阶段 1 只实现该参考图的基础布局。歌单数据、搜索和切换必须复用现有真实能力，不得用模拟数据替代。

## 5. 阶段 1 文件边界

阶段 1 代码文件白名单：

- `static/index.html`
- `static/css/style.css`
- `static/js/app.js`，仅确有必要时最小修改
- `static/js/device.js`，仅确有必要时最小修改
- `static/js/playlist.js`，仅确有必要时最小修改

阶段 1 禁止：

- 修改 `src/**`
- 修改后端接口
- 修改 `VoiceEngine`
- 修改 `src/memory/**`
- 修改 `src/voicecmd/**`
- 修改 `src/player/**`
- 修改 `package.json`
- 修改 `package-lock.json`
- 修改 `plugin.json`
- 接入 Downloader
- 接入在线搜索 UI
- 实现统一搜索
- 删除、修改、迁移或隐藏 `single-once`
- 修改 WebSocket 业务逻辑
- 修改自动切歌
- 修改下一首预缓存
- 修改歌词逻辑
- 实现设备四态模型
- 修改白名单之外的任何文件

## 6. 在线来源选择

本节属于后续阶段，不是阶段 1 当前实施范围。

参考图：

```text
03-source-selector.png
```

要求：

- provider 名称动态读取
- `search-providers` 使用 `{ "providers": [] }` 真实外层，不使用通用 `success/data` 包装
- `installed` 与 `active` 作为真实能力显示依据
- MIoT 自身不提供 `POST /api/search/topone`，MIoT 是 provider topone 协议的调用方
- `/api/search/topone` 是 provider 默认应实现的子路径，不得描述成 MIoT 内部 Router
- 当前 MIoT 仓库不能确认每个 provider 已经实际部署该路由
- 每个 provider 当前返回一个 `data` 对象，不是候选数组
- 只显示真实字段
- 不固定显示 FLAC、MP3、320K、无损
- 不解析 provider 私有 source_data

## 7. 歌曲操作菜单

本节属于后续阶段，不是阶段 1 当前实施范围。

参考图：

```text
04-song-action-menu.png
```

基础操作复用现有能力。

下载入口只有同时满足以下条件时显示：

- Downloader 已安装
- Downloader 已启用
- 当前歌曲存在真实 Songloft song_id

## 8. 候选 Downloader 设计

本节属于后续阶段，不是阶段 1 当前实施范围。Downloader 阶段在外部仓库审计前保持阻塞。

参考图：

```text
05-downloader-manager.png
06-download-confirm.png
```

以下内容仅为候选外部 Downloader 合同，当前 MIoT 仓库无法独立验证。实施前必须审计 Downloader 仓库，确认 `entryPath`、内部路由、外部完整路径、认证、请求、响应、错误码、`installed` / `active` 检测和页面跳转。

候选外部完整路径：

```text
POST /api/v1/jsplugin/downloader/api/download
```

候选请求体：

```json
{
  "song_id": 123
}
```

MIoT 不实现下载队列、进度、速度、暂停、恢复和重试。

验证完成前不得把候选合同写入 MIoT 正式代码。不得假设 `songloft.comm.call('downloader', ...)`，不得虚构 Downloader action。

## 9. 能力筛选

本节属于后续阶段，不是阶段 1 当前实施范围。

参考图：

```text
07-capability-filter.png
```

基础筛选：

- 全部
- 本地

存在可用 provider 时才显示：

- 在线

## 10. 统一搜索

本节属于后续阶段，不是阶段 1 当前实施范围。

参考图：

```text
08-unified-search.png
```

搜索类型：

- 歌曲
- 歌单
- 歌手
- 专辑
- 在线

本地和在线结果互不覆盖。单个 provider 失败不得影响其他结果。

## 11. 设备状态

设备状态必须来自真实数据：

- 只有 `presence === 'online'` 时才可以显示“已连接”
- 设备被选择不等于设备已连接
- 非 `online` 值不得解释为已连接
- 无法可靠判断时可以显示“已选择”

当前代码不能可靠表达“连接中”。阶段 1 只能复用当前真实状态能力，不得伪造连接状态。四态设备语义必须放入后续独立阶段。

## 12. 播放状态

必须保留官方 2026.7.21 的：

- WebSocket 播放状态
- 自动切歌
- 歌词状态更新
- 下一首预缓存

当前运行时真实存在：

```text
order
loop
single
random
single-once
```

`single-once` 是当前遗留运行时模式。MIoT V2 的目标核心模式仍为 `order`、`loop`、`single`、`random`。

阶段 1 禁止删除、修改、迁移或隐藏 `single-once`。后续必须通过独立阶段决定保留、迁移或移除，并兼容旧设备配置和定时任务中的存储值。不得再声称当前运行时只有四种模式。

## 13. Voice Memory 保护

不得删除或重写：

- src/memory
- MemoryService
- memory resolver
- memory storage
- memory self-test
- voice_memory_enabled
- VoiceEngine 中的记忆调用顺序

## 14. 阶段 1 非目标

阶段 1 不实现：

- 新音乐平台 API
- 统一多音质协议
- 新 Downloader comm action
- MIoT 内部下载线程
- MIoT 自建下载队列
- provider 私有 source_data 解析
- 新前端框架
- 全面重写现有页面

此外，阶段 1 不实施在线来源选择、能力筛选、统一搜索、Downloader、设备四态或设置重组。这些内容必须按后续独立阶段验收。

## 15. 后续独立问题

代码审计已发现以下问题，本次只记录，不修复；阶段 1 不得顺便修复。每项以后必须单独审计、修改和回归：

1. `static/js/app.js` 中 Tracely `PLUGIN_VERSION` 仍为 `2026.6.9`。
2. `auth.js` 验证码请求字段与后端不一致。
3. `auth.js` 二次验证请求字段与后端不一致。
4. `muteBtn` 可能重复绑定 `toggleMute()`。
5. schedule action 验证器与 Executor 支持范围不一致。
