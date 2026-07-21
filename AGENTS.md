# AGENTS.md

## 项目说明

本项目是 Songloft MIoT V2 智能音箱插件。

当前开发分支：

```text
feature/miot-v2
```

当前基础版本：

```text
2026.7.21
```

## 修改代码前必须阅读

开始任何开发任务前，必须阅读：

- `docs/MIOT_V2_ROADMAP.md`
- `docs/MIOT_V2_API_CONTRACT.md`
- `docs/MIOT_V2_TEST_MATRIX.md`
- `docs/ui-v2/IMPLEMENTATION_SPEC.md`
- `docs/ui-v2/reference-local/` 下的 8 张参考图

## 当前技术栈

必须继续使用：

- HTML
- CSS
- 原生 JavaScript
- TypeScript
- Songloft Plugin SDK
- Songloft Plugin Builder

禁止引入：

- React
- Vue
- Flutter
- 新的前端框架
- 独立 Web 应用
- 新构建系统

## 架构原则

MIoT 是能力编排层。

MIoT 可以负责：

- 页面展示
- 设备选择
- 歌单选择
- 本地搜索
- 在线搜索聚合
- 播放请求调度
- 外部能力调度（仅在外部合同完成验证后）
- 扩展能力状态展示

MIoT 不负责：

- 实现具体音乐平台 API
- 在核心代码中写死音乐平台名称
- 解析 provider 私有 `source_data`
- 自己下载音乐文件
- 自己维护下载队列
- 虚构未经确认的接口或字段

## 已确认的搜索调用协议

搜索源注册：

```text
register-search-provider
```

搜索源注销：

```text
unregister-search-provider
```

搜索源列表接口：

```text
GET /api/v1/jsplugin/miot/search-providers
```

真实响应外层为：

```json
{
  "providers": []
}
```

该接口不使用通用 `success/data` 外层包装。provider 名称和状态必须动态读取；只有 `installed = true` 且 `active = true` 时，才可显示对应在线能力。

provider 默认应实现的搜索子路径：

```text
POST /api/search/topone
```

MIoT 自身不提供 `POST /api/search/topone`，MIoT 是 provider topone 协议的调用方。当前 MIoT 仓库只能确认调用协议，不能确认每个 provider 已经实际部署该路由。不得把 provider 外部路由描述成 MIoT 内部 Router。

每个 provider 当前返回一个 `data` 对象，不是候选数组。

搜索源名称必须动态读取。

不得把 `topone` 当成通用多版本、多音质接口。

不得虚构：

- FLAC
- MP3
- 320K
- 无损
- 文件大小
- 版本数量

## 候选外部 Downloader 合同

供后续外部仓库审计的候选完整路径：

```text
POST /api/v1/jsplugin/downloader/api/download
```

候选请求体：

```json
{
  "song_id": 123
}
```

该合同无法由当前 MIoT 仓库独立验证。实施前必须审计 Downloader 仓库，并确认：

- `entryPath`
- 内部路由
- 外部完整路径
- 认证方式
- 请求结构
- 响应结构
- 错误码
- `installed` / `active` 检测
- 下载管理页面跳转

验证完成前不得把候选合同写入 MIoT 正式代码，Downloader 开发阶段保持阻塞。验证通过后如采用该候选合同，必须使用 Songloft 返回的真实 `song_id`。

禁止创建或使用未经确认的 Downloader action，例如：

- `create-download`
- `enqueue-download`
- `download-song`
- `start-download`

禁止使用未经确认的：

```text
songloft.comm.call('downloader', ...)
```

不得假设 Downloader 存在插件间通信能力。

## Voice Memory 保护

不得删除、重写或破坏：

- `src/memory`
- `MemoryService`
- `storage_adapter`
- `memory_resolver`
- `query_normalizer`
- `entity_index`
- `memory self-test`
- `voice_memory_enabled`
- VoiceEngine 中的记忆调用顺序

UI 开发不得改变：

```text
固定控制命令
→ Voice Memory
→ 规则匹配
→ AI 兜底
```

## 官方 2026.7.21 功能保护

不得破坏：

- WebSocket 播放状态
- WebSocket 对话记录
- 自动切歌
- 外部歌曲完整歌单续播
- 歌词状态更新
- 下一首预缓存
- `force_mp3` 预热逻辑
- 定时任务起始位置
- 跟随上次播放模式

## 播放模式兼容保护

当前运行时真实存在以下五种播放模式：

```text
order
loop
single
random
single-once
```

`single-once` 是当前遗留运行时模式。MIoT V2 的目标核心模式仍为 `order`、`loop`、`single`、`random`。

阶段 1 禁止删除、修改、迁移或隐藏 `single-once`。后续必须通过独立阶段决定保留、迁移或移除，并兼容旧设备配置和定时任务中的既有存储值。不得再声称当前运行时只有四种模式。

## UI 开发规则

必须：

- 使用真实业务数据
- 保持 Android 竖屏适配
- 保持 Songloft 浅色风格
- 隐藏不可用能力
- 保留现有 DOM 事件绑定
- 保留现有元素 ID，除非同步修正全部引用
- 优先进行最小修改

不得：

- 把参考图模拟数据写进正式代码
- 全面重写页面
- 删除现有功能后重新实现
- 为视觉效果修改无关后端逻辑
- 伪造设备“已连接”状态

只有 `presence === 'online'` 时才可以显示“已连接”。设备被选择不等于设备已连接，任何非 `online` 值都不得解释为已连接。当前代码不能可靠表达“连接中”；阶段 1 只能复用当前真实状态能力，不得伪造连接状态。四态设备语义必须放入后续独立阶段。

## 每个任务的工作流程

每个开发阶段必须依次执行：

1. 阅读现有代码。
2. 解释当前实现。
3. 输出文件级修改计划。
4. 等待人工确认。
5. 只修改确认范围。
6. 执行 `git diff --check`。
7. 执行 `npm run build`。
8. 执行 `npm run validate`。
9. 报告修改文件。
10. 报告 diff 摘要。
11. 报告测试结果。
12. 报告未解决风险。

未经明确要求，不得自动提交 Git。

## Git 安全规则

禁止执行：

```text
git reset --hard
git clean -fd
git push --force
git checkout -- .
git restore .
```

不得删除分支、标签或备份文件。

不得覆盖未提交的用户修改。

## 修改范围控制

任务只涉及 UI 时，不得修改：

- `package.json`
- `package-lock.json`
- `plugin.json`
- `src/memory`
- `src/voicecmd`
- `src/player`
- 后端接口

确有必要修改时，必须先说明原因并等待确认。

## 阶段 1 边界

阶段 1 只允许实现：

- `01-base-main.png` 的基础布局
- `02-playlist-selector.png` 的基础布局
- Android 竖屏浅色 UI
- 复用真实设备、歌单和歌曲数据
- 保留现有 DOM ID 和事件绑定
- 保留现有设备切换、歌单切换和播放器状态能力

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

## 后续独立问题

代码审计已发现以下问题，本次只记录，不修复；阶段 1 不得顺便修复。每项以后必须单独审计、修改和回归：

1. `static/js/app.js` 中 Tracely `PLUGIN_VERSION` 仍为 `2026.6.9`。
2. `auth.js` 验证码请求字段与后端不一致。
3. `auth.js` 二次验证请求字段与后端不一致。
4. `muteBtn` 可能重复绑定 `toggleMute()`。
5. schedule action 验证器与 Executor 支持范围不一致。

## 完成标准

代码任务结束时必须报告：

- 修改了哪些文件
- 每个文件修改了什么
- 是否修改接口
- 是否修改配置字段
- 是否影响 Voice Memory
- 是否影响 WebSocket
- `npm run build` 结果
- `npm run validate` 结果
- 尚未完成的内容
