# MIoT V2 开发路线图

## 1. 项目名称

Songloft MIoT V2

## 2. 项目目标

在不推翻现有 MIoT 插件架构、不破坏现有稳定功能的前提下，将 MIoT 插件升级为 Songloft 内的智能音箱控制与音乐能力调度中心。

本次升级包含：

- MIoT 主界面 UI 升级
- 当前设备状态展示与设备切换
- 当前歌单快速切换
- 本地统一搜索
- 在线搜索源聚合
- 在线搜索结果来源选择
- Downloader 独立下载任务调度
- 迷你播放器与播放模式优化
- MIoT 设置页面重新分组
- 保留并兼容 Voice Memory
- 保留语音口令、定时任务及现有设备播放逻辑

## 3. 总体原则

### 3.1 保留现有技术栈

MIoT 前端继续使用：

- HTML
- CSS
- 原生 JavaScript

后端继续使用：

- TypeScript
- Songloft Plugin SDK
- Songloft Plugin Builder

本项目不得为了 UI 改造引入：

- React
- Vue
- Flutter
- 新的前端框架
- 独立 Web 应用
- 与当前插件不兼容的构建系统

### 3.2 不重写核心架构

本次开发优先复用现有代码，不重写：

- MIoT 设备协议实现
- 账号登录和 Token 管理
- VoiceEngine
- PlaylistManager
- 播放核心
- Voice Memory
- 定时任务
- 外部搜索现有语音流程
- Songloft 插件基础结构

### 3.3 MIoT 只负责能力调度

MIoT 负责：

- UI 展示
- 当前设备选择
- 设备状态展示
- 当前歌单选择
- 本地内容搜索
- 在线搜索入口
- 搜索结果聚合
- 播放请求调度
- 下载任务移交
- 扩展能力状态展示

MIoT 不负责：

- 实现具体在线音乐平台接口
- 解析在线平台私有数据
- 保存在线平台账号或 Cookie
- 自己下载歌曲文件
- 自己维护下载线程
- 自己管理下载队列
- 自己写入下载文件或歌曲元数据
- 在代码中写死具体音乐平台名称

## 4. 已确认与待验证的接口原则

项目统一采用以下原则：

> UI 为能力抽象展示；MIoT 仓库内只复用已经确认的 search-provider 注册与调用协议。Downloader 保留为候选外部合同，完成外部仓库审计前不得实施，不另造未经确认的接口名称。

### 4.1 MIoT 插件标识

```text
entryPath: miot
```

### 4.2 搜索源注册接口

```text
register-search-provider
```

### 4.3 搜索源注销接口

```text
unregister-search-provider
```

### 4.4 搜索源列表接口

```text
GET /api/v1/jsplugin/miot/search-providers
```

真实响应外层为：

```json
{
  "providers": []
}
```

该接口不使用通用 `success/data` 外层包装。provider 名称和状态必须动态读取；`installed` 与 `active` 是真实能力显示依据。

### 4.5 provider topone 调用协议

```text
POST /api/search/topone
```

MIoT 自身不提供该路由，MIoT 是 provider topone 协议的调用方。`/api/search/topone` 是 provider 默认应实现的子路径。当前 MIoT 仓库只能确认调用协议，不能确认每个 provider 已经实际部署对应路由，也不得把该 provider 外部路由描述成 MIoT 内部 Router。

请求体遵循当前 topone 规范：

```json
{
  "keyword": "搜索关键词",
  "hint": {
    "title": "可选",
    "artist": "可选",
    "duration": 0
  },
  "quality": "可选"
}
```

每个 provider 当前返回一个 `data` 对象，不是候选数组。该对象可能包含：

- title
- artist
- album
- duration
- cover_url
- url
- plugin_entry_path
- source_data
- dedup_key
- lyric
- lyric_source

第一版不得假设接口已经统一支持：

- 多版本结果
- 固定音质字段
- 固定格式字段
- versionCount
- 下载地址列表
- 提供方私有字段

MIoT 不得解析 provider 的私有 source_data。

### 4.6 Downloader 候选插件标识

```text
entryPath: downloader
```

该 `entryPath` 只是供后续外部仓库审计的候选值，当前 MIoT 仓库无法独立验证。

### 4.7 候选外部 Downloader 单曲下载合同

```text
POST /api/v1/jsplugin/downloader/api/download
```

候选请求体：

```json
{
  "song_id": 123
}
```

实施前必须审计 Downloader 仓库，确认 `entryPath`、内部路由、外部完整路径、认证、请求、响应、错误码、`installed` / `active` 检测和页面跳转。验证完成前不得把该候选合同写入 MIoT 正式代码，Downloader 阶段保持阻塞。

验证通过并确认采用该合同后的候选调用流程：

```text
在线搜索结果
→ 导入 Songloft
→ 获取真实 remote song_id
→ 检测 Downloader 已安装且 active
→ 把 song_id 交给 Downloader
```

MIoT 不得向 Downloader 发送未经确认的：

- 下载 URL
- provider 私有数据
- quality
- format
- path
- metadata
- 自定义 DownloadRequest
- 虚构的 downloader comm action

## 5. UI 视觉体系

新版 UI 统一采用：

- Songloft 原生浅色视觉体系
- Android 竖屏构图
- 少量蓝紫色强调色
- 低饱和背景
- 紧凑列表
- 清晰信息层级
- 轻量圆角
- 细分隔线
- 轻微阴影或无阴影

避免：

- 大面积渐变
- 厚重阴影
- 过度卡片化
- 赛博朋克风格
- 与 Songloft 主应用不一致的视觉语言

## 6. 主界面结构

### 6.1 顶部设备区域

删除原来的大标题：

```text
MIoT 智能音箱
```

顶部左侧改为设备胶囊：

```text
Xiaomi Sound Pro  ● 已连接  ▼（仅 presence === 'online'）
```

顶部右侧保留：

- 设置
- 刷新

只有 `presence === 'online'` 时才可以显示“已连接”。设备被选择不等于设备已连接，非 `online` 值不得解释为已连接。当前代码不能可靠表达“连接中”；阶段 1 只能复用当前真实状态能力，不得伪造连接状态。四态设备语义放入后续独立阶段。

### 6.2 当前歌单选择器

删除单独的“当前歌单”文字标签。

使用紧凑选择器：

```text
♪ 2003-叶惠美（11）  ▼
```

点击展开后显示：

- 歌单搜索框
- 歌单列表
- 当前歌单高亮
- 当前歌单对勾
- 歌曲数量

### 6.3 统一搜索框

搜索框占位文字：

```text
搜索歌曲、歌单、歌手、专辑…
```

本地搜索支持：

- 歌曲
- 歌单
- 歌手
- 专辑

检测到 active 在线搜索源后，动态增加：

- 在线

### 6.4 类型筛选

统一搜索筛选项：

- 全部
- 歌曲
- 歌单
- 歌手
- 专辑
- 在线

没有 active 在线搜索源时隐藏“在线”。

### 6.5 紧凑歌曲列表

建议歌曲行高度：

```text
72–80dp
```

普通歌曲项包含：

- 封面
- 序号
- 歌名
- 歌手
- 时长
- 更多菜单

正在播放项包含：

- 左侧蓝紫色细状态线
- 波形图标替代序号
- 极淡蓝紫色背景
- 蓝紫色歌曲名称
- 明确但克制的播放状态

### 6.6 底部迷你播放器

迷你播放器保留：

- 当前歌曲封面
- 歌名
- 歌手
- 播放模式
- 上一首
- 播放或暂停
- 下一首
- 音量
- 播放进度条

当前运行时真实存在五种播放模式：

- order：顺序播放
- loop：列表循环
- single：单曲循环
- random：随机播放
- single-once：遗留运行时模式

MIoT V2 的目标核心模式仍为 `order`、`loop`、`single`、`random`。阶段 1 禁止删除、修改、迁移或隐藏 `single-once`。后续必须通过独立阶段决定保留、迁移或移除，并兼容旧设备配置和定时任务中的存储值。

## 7. 动态能力显示规则

### 7.1 仅安装 MIoT

显示：

- 设备控制
- 当前歌单
- 本地歌曲
- 本地歌单
- 本地歌手
- 本地专辑
- 本地搜索
- 播放器
- 设置页面

隐藏：

- 在线筛选
- 在线搜索结果
- 在线来源选择
- 下载到本地
- 下载管理器快捷入口

### 7.2 MIoT 加在线搜索源

额外显示：

- 在线筛选
- 在线搜索结果
- 动态 provider 名称
- 来源选择
- 在线播放入口

没有 Downloader 时不显示下载入口。

### 7.3 MIoT 加 Downloader

本节属于 Downloader 外部合同审计通过后的目标能力。审计完成前不实施。

工具箱可以显示：

- Downloader 已安装
- Downloader active 状态

没有在线候选和真实 song_id 时，不显示无意义的在线下载入口。

### 7.4 MIoT 加在线搜索源和 Downloader

本节属于 Downloader 外部合同审计通过后的目标能力。审计完成前不实施。

显示完整能力：

- 本地统一搜索
- 在线搜索
- 来源选择
- 在线播放
- 在线歌曲导入 Songloft
- 获取 remote song_id
- 下载到本地
- 打开下载管理器

## 8. 在线搜索规则

在线搜索后续必须复用已经确认的注册与调用协议：

```text
register-search-provider
/api/search/topone
```

要求：

- provider 名称动态读取
- 不写死具体音乐平台名称
- 不解析 source_data 私有结构
- 单个 provider 失败不影响其他 provider
- 在线搜索失败不影响本地搜索
- 本地结果始终保留
- 没有 active provider 时隐藏在线功能
- 对每个 provider 设置独立超时
- UI 搜索不得破坏语音外部搜索原有行为

当前 topone 第一版每个 provider 只保证一条最匹配候选。

MIoT 自身不提供 `/api/search/topone`；它调用 provider 默认应实现的该子路径。当前仓库不能确认每个 provider 已实际部署该路由。每个 provider 当前返回一个 `data` 对象，不是候选数组。

因此第一版 UI 应使用：

```text
选择来源
```

不得虚构：

```text
选择音质版本
多个格式版本
FLAC/MP3 固定列表
```

## 9. 候选 Downloader 调度规则

本节是外部合同验证后的候选设计，不是当前 MIoT 仓库已确认的可实施接口。Downloader 阶段在外部仓库审计前保持阻塞。

审计必须确认：

- `entryPath`
- 内部路由
- 外部完整路径
- 认证方式
- 请求与响应
- 错误码
- `installed` / `active` 检测
- 下载管理页面跳转

验证完成前不得把候选合同写入 MIoT 正式代码，不得假设 `songloft.comm.call('downloader', ...)`，不得虚构 Downloader action。

验证通过后的候选下载流程：

```text
用户选中在线结果
→ MIoT 导入 Songloft
→ Songloft 返回 remote song_id
→ MIoT 检查 Downloader 状态
→ 用户点击“下载到本地”
→ MIoT POST song_id
→ Downloader 独立处理下载
```

成功提示：

```text
已交给 Songloft 下载管理器处理
```

MIoT 不显示自己正在执行文件下载。

Downloader 未安装或未 active 时：

- 默认隐藏下载按钮
- 工具箱显示相应状态
- 不影响在线播放和本地播放

## 10. 设置页面结构

一级分类固定为：

1. 设备与连接
2. 播放与显示
3. 语音交互
4. 定时与自动化
5. 工具箱

### 10.1 设备与连接

包含：

- 服务器地址
- 账号管理
- 设备管理
- 当前设备
- 默认设备
- 设备状态刷新
- 已有登录方式
- 已有 Token 配置

### 10.2 播放与显示

包含：

- 音频格式
- 播放模式
- 迷你播放器显示
- 歌曲列表密度
- 封面显示
- 触屏歌词
- 指示灯
- 已有播放配置

### 10.3 语音交互

包含：

- 对话监听
- 语音口令
- AI 口令分析
- Voice Memory
- 外部搜索
- 现有口令测试
- 现有记忆管理

### 10.4 定时与自动化

包含：

- 定时播放
- 定时停止
- 定时调节音量
- 定时播放歌单
- 播放模式定时任务
- 节假日相关规则

### 10.5 工具箱

包含：

- 已发现搜索源数量
- 搜索源 installed 状态
- 搜索源 active 状态
- Downloader installed 状态
- Downloader active 状态
- 接口检测
- 能力刷新
- 日志与诊断
- 缓存相关工具

不得创建尚不存在的功能按钮并假装可用。

## 11. Voice Memory 保护要求

本次开发不得破坏：

- MemoryService
- storage adapter
- entity resolver
- query normalizer
- play_song 记忆命中
- 记忆写入
- 记忆最大数量
- 记忆淘汰
- 记忆统计
- 记忆管理页面
- 记忆自测
- voice_memory_enabled 配置
- 现有回滚开关或兼容逻辑

每个开发阶段完成后都必须执行 Voice Memory 回归检查。

## 12. 开发阶段

### 阶段 0：代码审计与文档

- 审计当前仓库
- 确认现有接口
- 建立接口契约
- 建立测试矩阵
- 确认与 upstream/main 的差异
- 不修改业务代码

### 阶段 1：基础 UI 骨架

- 实现 `01-base-main.png` 的基础布局
- 实现 `02-playlist-selector.png` 的基础布局
- 保持 Android 竖屏浅色 UI
- 复用真实设备、歌单和歌曲数据
- 保留现有 DOM ID 和事件绑定
- 保留现有设备切换、歌单切换和播放器状态能力

本阶段代码文件白名单：

- `static/index.html`
- `static/css/style.css`
- `static/js/app.js`，仅确有必要时最小修改
- `static/js/device.js`，仅确有必要时最小修改
- `static/js/playlist.js`，仅确有必要时最小修改

本阶段禁止修改白名单之外的任何文件，禁止修改 `src/**`、后端接口、VoiceEngine、Voice Memory、WebSocket 业务逻辑、自动切歌、下一首预缓存、歌词逻辑、`package.json`、`package-lock.json` 和 `plugin.json`；禁止接入在线搜索 UI、统一搜索和 Downloader；禁止删除、修改、迁移或隐藏 `single-once`；禁止实现设备四态模型。

### 阶段 2：设备状态和设备选择

- 使用真实设备状态
- 设备列表
- 当前设备高亮
- 离线显示
- 刷新或重连行为
- 不虚构连接状态
- 独立审计四态设备语义及可靠状态来源
- 未确认可靠来源前不显示“连接中”

### 阶段 3：本地统一搜索

- 本地歌曲搜索
- 本地歌单搜索
- 本地歌手搜索
- 本地专辑搜索
- 类型筛选
- 搜索结果分组
- 搜索输入防抖

### 阶段 4：在线搜索源接入

- 查询 search-provider
- 检测 installed 和 active
- 动态显示在线能力
- 聚合 provider 结果
- 独立超时
- 错误隔离
- 保留语音搜索兼容性

### 阶段 5：来源选择

- 动态 provider 名称
- provider 中立结果展示
- 当前来源选择
- 在线播放
- 不虚构音质和格式字段

### 阶段 6：Downloader 调度

本阶段在 Downloader 外部仓库审计完成前保持阻塞。

- 导入远程歌曲
- 获取 remote song_id
- 验证 Downloader `entryPath`、路由、认证、请求、响应和错误码
- 验证 Downloader installed/active 检测与页面跳转
- 显示下载入口
- 仅在验证通过后调用确认的 HTTP 接口
- 显示任务移交成功提示

### 阶段 7：播放器优化

- 播放模式选择
- 保持五种当前运行时播放值可兼容
- 上一首
- 播放暂停
- 下一首
- 音量
- 进度条

### 阶段 7A：single-once 独立兼容决策

- 确认保留、迁移或移除策略
- 目标核心模式仍为 `order`、`loop`、`single`、`random`
- 兼容旧设备配置中的 `single-once` 存储值
- 兼容定时任务中的 `single-once` 存储值
- 未完成独立审计与迁移方案前不得删除、修改、迁移或隐藏 `single-once`

### 阶段 8：设置页面整理

- 五个一级分类
- 保留全部现有配置字段
- 增加扩展能力状态
- 不迁移或重命名现有存储键

### 阶段 9：回归测试与发布

- 构建
- validate
- 本地测试
- NAS 测试
- Voice Memory 回归
- 定时任务回归
- 构建正式 ZIP
- 保留可用回滚 ZIP

## 13. 每个阶段的强制流程

每个阶段都必须：

1. 先分析现有代码
2. 输出修改计划
3. 等待确认后修改
4. 不执行破坏性 Git 命令
5. 不重写无关代码
6. 不删除现有功能
7. 显示修改文件列表
8. 显示 diff 摘要
9. 运行：

```bash
npm run build
```

10. 运行：

```bash
npm run validate
```

11. 手工测试本阶段功能
12. 执行 Voice Memory 回归检查
13. 通过后建立独立 Git 提交
14. 失败时停止进入下一阶段

## 14. Git 安全规则

禁止执行：

```text
git reset --hard
git clean -fd
git push --force
```

未经确认不得执行：

- 大范围文件删除
- 存储键迁移
- 版本历史重写
- 强制覆盖 upstream
- 对 main 分支直接开发

开发分支：

```text
feature/miot-v2
```

开发前备份分支：

```text
backup/before-miot-v2-20260721
```

开发前备份标签：

```text
backup-miot-v2-start-20260721
```

## 15. 禁止事项

禁止：

- 一次性完成全部功能
- 引入新的前端框架
- 重写整个插件
- 删除 Voice Memory
- 删除定时任务
- 删除账号登录功能
- 写死具体在线平台名称
- 虚构插件接口
- 虚构 Downloader action
- MIoT 自己下载文件
- 解析 provider 私有 source_data
- 用概念图模拟数据代替正式业务数据
- 未经过构建和测试就上传正式环境
- 把所有改动放在一个巨大提交中

## 16. 第一版验收标准

MIoT V2 第一版完成时必须满足：

本节是全部后续阶段完成后的总体验收，不是阶段 1 当前必过项。阶段 1 只按其基础布局和既有功能回归范围验收。

- 新版 UI 与确认的视觉方向一致
- 原有设备控制正常
- 原有账号登录正常
- 原有歌单播放正常
- 原有本地歌曲搜索正常
- 本地统一搜索正常
- 无在线 provider 时 UI 自动降级
- 有在线 provider 时动态显示在线能力
- provider 名称不写死
- provider 错误不影响本地搜索
- Downloader 外部合同已完成独立仓库审计
- Downloader 未安装时下载入口隐藏（仅在合同验证后的阶段）
- Downloader active 后使用真实 song_id（仅在合同验证后的阶段）
- MIoT 不执行文件下载
- 五种当前运行时播放值保持兼容
- V2 四种目标核心模式正常
- Voice Memory 正常
- 语音口令正常
- 定时任务正常
- npm run build 成功
- npm run validate 成功
- 能生成 dist/miot.jsplugin.zip
- 可以使用备份 ZIP 快速回滚

## 17. 当前基线

开发分支：

```text
feature/miot-v2
```

开发前备份分支：

```text
backup/before-miot-v2-20260721
```

开发前备份标签：

```text
backup-miot-v2-start-20260721
```

开发前插件备份：

```text
/Users/yoga/SongloftBackups/miot-before-v2-20260721.jsplugin.zip
```

开发前状态：

- npm run build：通过
- npm run validate：通过
- Git 工作区：干净
- Voice Memory：已包含在当前基线
- UI V2：尚未开始修改

## 18. 后续独立问题

代码审计已发现以下问题，本次只记录，不修复；阶段 1 不得顺便修复。每项以后必须单独审计、修改和回归：

1. `static/js/app.js` 中 Tracely `PLUGIN_VERSION` 仍为 `2026.6.9`。
2. `auth.js` 验证码请求字段与后端不一致。
3. `auth.js` 二次验证请求字段与后端不一致。
4. `muteBtn` 可能重复绑定 `toggleMute()`。
5. schedule action 验证器与 Executor 支持范围不一致。

## 19. 最终结论

本项目坚持：

> UI 为能力抽象展示；复用 MIoT 已确认的 search-provider 注册与调用协议。Downloader 候选外部合同必须先完成外部仓库审计，验证前不得写入正式代码，不另造未经确认的接口名称。
