# MIoT V2 当前接口契约

## 1. 文档目的

本文档记录 MIoT V2 第一版开发中已经确认存在、可以直接复用的接口、字段和调用方式。

本项目必须遵循：

> UI 为能力抽象展示；底层第一版复用 MIoT 已有 search-provider 注册机制和 Downloader 现有 song_id 下载接口，不另造未经确认的接口名称。

本文档是 MIoT V2 开发的接口基准。

任何 Codex 开发任务在修改搜索、在线音源、下载功能之前，都必须先读取本文档。

---

## 2. 接口使用原则

### 2.1 允许复用

允许直接复用：

- MIoT 现有 HTTP 路由
- MIoT 现有配置字段
- MIoT 现有 `songloft.comm` 搜索源注册机制
- MIoT 现有 `/api/search/topone` 规范
- Songloft 现有远程歌曲导入流程
- Downloader 现有 `song_id` 下载接口

### 2.2 禁止事项

禁止：

- 自行虚构新的插件通信 action
- 自行虚构新的 Downloader action
- 在没有真实字段时显示固定音质
- 在没有真实字段时显示固定格式
- 在没有真实数据时显示版本数量
- 直接解析 provider 私有 `source_data`
- 在 MIoT 中写死具体音乐平台名称
- 让 MIoT 自己下载文件
- 让 MIoT 自己维护下载队列
- 直接把 provider 私有数据交给 Downloader

---

## 3. MIoT 插件身份

### 3.1 插件名称

```text
智能音箱
```

### 3.2 插件 entryPath

```text
miot
```

其他插件通过插件间通信调用 MIoT 时，目标插件名称使用：

```text
miot
```

示例：

```ts
await songloft.comm.call(
  'miot',
  'register-search-provider',
  payload,
);
```

---

## 4. 插件间通信权限

使用 `songloft.comm` 的插件需要在自己的 `plugin.json` 中声明：

```text
inter-plugin
```

常用方法包括：

```ts
songloft.comm.call(targetPlugin, action, payload);
```

```ts
songloft.comm.send(targetPlugin, action, payload);
```

```ts
songloft.comm.onMessage(action, handler);
```

第一版 MIoT V2 只复用已经存在并确认的 action。

不得自行创建未经确认的 action 名称。

---

## 5. 搜索源注册机制

### 5.1 注册 action

```text
register-search-provider
```

搜索源插件在初始化时，可以向 MIoT 注册自己。

示例：

```ts
await songloft.comm.call('miot', 'register-search-provider', {
  name: '搜索源显示名称',
  searchPath: '/api/search/topone',
  icon: '',
});
```

### 5.2 注册 payload

允许字段：

```ts
{
  name?: string;
  searchPath?: string;
  icon?: string;
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 在 MIoT 中显示的搜索源名称 |
| `searchPath` | string | 搜索接口路径，默认 `/api/search/topone` |
| `icon` | string | 可选图标 |

### 5.3 不允许传 entryPath

注册 payload 不需要、也不应该传：

```text
entryPath
```

MIoT 使用宿主注入的可信调用方身份 `from`，确定提供方插件的真实 `entryPath`。

不得允许插件通过 payload 伪造其他插件身份。

### 5.4 幂等行为

`register-search-provider` 应当是幂等的。

同一个插件可以在每次初始化时重复注册。

MIoT 应按真实 `entryPath` 更新或覆盖原注册信息。

---

## 6. 搜索源注销机制

### 6.1 注销 action

```text
unregister-search-provider
```

示例：

```ts
await songloft.comm.call(
  'miot',
  'unregister-search-provider',
  {},
);
```

注销时同样以宿主注入的真实调用方身份为准。

通常可以在搜索源插件的 `onDeinit` 中调用。

---

## 7. 搜索源列表接口

### 7.1 完整接口地址

```text
GET /api/v1/jsplugin/miot/search-providers
```

### 7.2 插件内部相对路由

```text
GET /search-providers
```

### 7.3 预期返回字段

每个搜索源候选可能包含：

```ts
{
  id: string;
  name: string;
  url: string;
  installed: boolean;
  active: boolean;
  icon?: string;
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `id` | 搜索源或插件标识 |
| `name` | UI 显示名称 |
| `url` | 实际搜索接口地址 |
| `installed` | 提供方插件是否安装 |
| `active` | 提供方插件是否启用 |
| `icon` | 可选图标 |

### 7.4 UI 显示规则

只有满足以下条件的 provider，才应作为可用在线能力展示：

```text
installed = true
active = true
```

没有可用 provider 时：

- 隐藏“在线”筛选
- 隐藏在线搜索区
- 隐藏来源选择
- 不显示在线错误占位

---

## 8. 搜索提供方接口

### 8.1 接口路径

```text
POST /api/search/topone
```

这是搜索源插件需要实现的标准搜索路由。

### 8.2 请求头

通常使用：

```http
Content-Type: application/json
Authorization: Bearer <plugin-token>
```

具体认证方式继续复用现有 MIoT 实现。

### 8.3 请求体

```json
{
  "keyword": "第一天 孙燕姿",
  "hint": {
    "title": "第一天",
    "artist": "孙燕姿",
    "duration": 253
  },
  "quality": "320k"
}
```

TypeScript 结构：

```ts
interface SearchOneRequest {
  keyword: string;
  hint?: {
    title?: string;
    artist?: string;
    duration?: number;
  };
  quality?: string;
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `keyword` | 是 | 搜索关键词 |
| `hint` | 否 | 可选歌曲提示 |
| `quality` | 否 | 可选偏好，不代表响应一定返回对应音质 |

不得根据请求中的 `quality` 推断响应一定具有：

- 固定音质
- 固定格式
- 固定码率
- 无损资源

---

## 9. topone 成功响应

### 9.1 响应结构

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "title": "第一天",
    "artist": "孙燕姿",
    "album": "完美的一天",
    "duration": 253,
    "cover_url": "https://example.com/cover.jpg",
    "url": "https://example.com/audio",
    "plugin_entry_path": "provider-entry-path",
    "source_data": {},
    "dedup_key": "provider:123",
    "lyric": "",
    "lyric_source": ""
  }
}
```

### 9.2 data 可用字段

```ts
interface OnlineSearchResult {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  cover_url?: string;
  url?: string;
  plugin_entry_path?: string;
  source_data?: string | Record<string, unknown>;
  dedup_key?: string;
  lyric?: string;
  lyric_source?: string;
}
```

### 9.3 必填字段

第一版 UI 可以可靠依赖：

```text
title
artist
```

### 9.4 可选字段

存在时才显示：

```text
album
duration
cover_url
lyric
```

不存在时必须隐藏对应 UI，不得填充模拟数据。

---

## 10. topone 失败响应

搜索未命中或失败时：

```json
{
  "code": 1,
  "msg": "not found",
  "data": null
}
```

判断规则：

```text
code != 0
```

或：

```text
data = null
```

都视为该 provider 未命中。

单个 provider 失败时：

- 不影响本地搜索
- 不影响其他 provider
- 不导致整个搜索页面报错
- 不清空已有本地结果

---

## 11. topone 超时规则

当前默认搜索超时建议为：

```text
6 秒
```

每个 provider 必须独立处理：

- 请求超时
- 网络错误
- 非 JSON 响应
- 非 200 状态
- `code != 0`
- `data = null`

UI 聚合搜索不得因为某一个 provider 失败而阻塞所有结果。

---

## 12. Provider 中立原则

MIoT 不得在核心代码中写死：

```text
网易云音乐
QQ音乐
酷狗音乐
酷我音乐
咪咕音乐
```

UI 显示的提供方名称必须来自：

```text
provider.name
```

或者注册信息中已经存在的动态名称。

内部已知 fallback provider 继续保留现有兼容逻辑，但新版 UI 不以具体平台作为架构依赖。

---

## 13. source_data 处理规则

`source_data` 是 provider 私有、不透明的数据。

MIoT 可以：

- 原样保存
- 在导入远程歌曲时原样传递
- 在需要时序列化为字符串

MIoT 不可以：

- 解析 provider 私有字段
- 根据私有字段判断平台
- 根据私有字段推断音质
- 根据私有字段生成下载 URL
- 根据私有字段向 Downloader 发送自定义请求

原则：

```text
MIoT 只传递，不解释。
```

---

## 14. 远程歌曲导入 Songloft

在线结果在需要持久播放或下载时，必须先导入 Songloft。

远程歌曲导入后，Songloft 会分配真实歌曲 ID：

```text
song_id
```

导入后的歌曲可能包含：

```ts
{
  id: number;
  type: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  cover_url: string;
  plugin_entry_path: string;
  source_data: string;
  dedup_key: string;
}
```

下载功能不得使用临时 UI 编号或 provider 原始编号。

必须使用 Songloft 返回的真实：

```text
id
```

作为 Downloader 请求中的：

```text
song_id
```

---

## 15. 不入库直接播放

MIoT 现有外部搜索支持“不入库直接播放”模式。

该模式只适用于：

```text
url 是有效 http 或 https 直链
```

这种情况下可以直接把 URL 推送给音箱播放。

解析型 provider 如果没有直接 URL，则必须回退到导入 Songloft。

注意：

```text
不入库直接播放的歌曲无法直接获得 Songloft song_id。
```

因此在不入库模式下：

- 可以在线播放
- 默认不显示“下载到本地”
- 需要下载时，应先明确导入 Songloft
- 获取真实 song_id 后再调用 Downloader

---

## 16. Downloader 插件身份

### 16.1 插件名称

```text
歌曲下载
```

### 16.2 插件 entryPath

```text
downloader
```

---

## 17. Downloader 当前权限限制

Downloader 当前第一版未确认存在：

```text
inter-plugin
```

也未确认存在：

```ts
songloft.comm.onMessage(...)
```

因此 MIoT V2 第一版不得使用：

```ts
songloft.comm.call('downloader', ...)
```

不得自行创建：

```text
create-download
enqueue-download
start-download
download-song
```

等未经确认的 action。

第一版必须使用现有 HTTP API。

---

## 18. Downloader 单曲下载接口

### 18.1 接口地址

```text
POST /api/v1/jsplugin/downloader/api/download
```

### 18.2 请求头

```http
Content-Type: application/json
Authorization: Bearer <plugin-token>
```

认证方式继续复用 Songloft 当前插件 HTTP 调用方式。

### 18.3 请求体

```json
{
  "song_id": 123
}
```

TypeScript 建议结构：

```ts
interface DownloaderRequest {
  song_id: number;
}
```

### 18.4 请求前置条件

显示“下载到本地”之前必须同时满足：

```text
song_id 是有效正整数
downloader 已安装
downloader active
```

任意条件不满足时，不调用下载接口。

---

## 19. Downloader 调用流程

完整调用顺序：

```text
用户搜索在线歌曲
→ provider 返回候选
→ 用户选择来源
→ MIoT 导入远程歌曲
→ Songloft 返回真实歌曲 id
→ MIoT 检测 downloader installed/active
→ 用户点击下载到本地
→ MIoT POST { song_id }
→ Downloader 接管任务
```

成功提示：

```text
已交给 Songloft 下载管理器处理
```

失败时应区分：

- Downloader 未安装
- Downloader 未启用
- 缺少有效 song_id
- 导入 Songloft 失败
- Downloader 请求失败
- 网络错误
- HTTP 返回异常

---

## 20. MIoT 与 Downloader 的职责边界

### MIoT 负责

- 展示下载入口
- 检查 Downloader 状态
- 获取真实 song_id
- 调用现有 HTTP 接口
- 显示成功或失败提示
- 提供“打开下载管理器”入口

### Downloader 负责

- 创建实际下载任务
- 获取或解析音频资源
- 文件下载
- 音频转换
- 嵌入元数据
- 文件路径生成
- 下载进度
- 下载结果
- 下载失败处理

MIoT 不维护 Downloader 的任务状态副本。

---

## 21. 下载确认 UI 字段规则

下载确认界面只显示当前真实存在的数据。

可以显示：

- 歌曲名称
- 歌手
- 专辑
- provider 名称
- 时长
- Songloft song_id

存在可靠数据时才显示：

- 封面
- 其他描述

第一版不得默认显示：

- FLAC
- MP3
- 320K
- 无损
- 文件大小
- 保存目录
- 下载速度
- 剩余时间

除非 Downloader 或正式接口已经真实返回这些字段。

---

## 22. 下载管理器页面规则

Downloader 管理页面属于独立 Downloader 插件。

MIoT 可以：

- 提供跳转入口
- 显示是否已安装
- 显示是否 active

MIoT 第一版不得重新实现：

- 下载列表
- 下载速度
- 暂停
- 恢复
- 重试
- 下载队列
- 已完成列表

除非这些能力由 Downloader 当前真实页面提供。

---

## 23. 播放模式接口

当前真实播放模式：

```text
order
random
single
loop
```

UI 映射：

| 内部值 | 中文名称 |
|---|---|
| `order` | 顺序播放 |
| `loop` | 列表循环 |
| `single` | 单曲循环 |
| `random` | 随机播放 |

第一版不得自行增加第五种模式。

如需增加“播放一次后停止”，必须作为独立业务功能开发，不能只增加一个 UI 图标。

---

## 24. 设备数据规则

设备信息继续复用现有数据结构。

可能包含：

```ts
{
  device_id: string;
  device_name: string;
  model: string;
  hardware: string;
  alias: string;
  managed: boolean;
  volume: number;
  play_mode: string;
  playlist_id: number;
  current_song_index: number;
}
```

原始设备数据可能包含：

```ts
{
  deviceID: string;
  name: string;
  miotDID: string;
  model: string;
  hardware: string;
  alias: string;
  presence: string;
}
```

不得因为：

```text
设备已被选择
```

就直接显示：

```text
已连接
```

必须先确认 `presence` 或现有状态逻辑的真实含义。

无法可靠判断时显示：

```text
已选择
```

---

## 25. Voice Memory 保护契约

MIoT V2 不得修改或破坏：

- `MemoryService`
- `storage_adapter`
- `memory_resolver`
- `query_normalizer`
- `entity_index`
- `memory self-test`
- `voice_memory_enabled`
- 记忆查询
- 成功记录
- 失败记录
- 记忆淘汰
- 记忆统计
- 记忆管理页面

搜索和 UI 改造不得改变 Voice Memory 的原有调用顺序。

---

## 26. 兼容性要求

所有新增功能必须满足：

- 没有 provider 时 MIoT 可独立工作
- provider 未安装时不报错
- provider 未 active 时不报错
- Downloader 未安装时不报错
- Downloader 未 active 时不报错
- 在线搜索失败时本地搜索正常
- 下载失败时在线播放正常
- 新 UI 不影响语音命令
- 新 UI 不影响定时任务
- 新 UI 不影响账号登录
- 新 UI 不影响本地播放

---

## 27. 接口变更流程

任何需要新增接口的功能，必须执行：

1. 先检查当前仓库是否已有对应接口。
2. 记录当前实际接口。
3. 输出新增接口的必要性。
4. 说明为什么现有接口无法复用。
5. 等待人工确认。
6. 再修改接口契约。
7. 最后实施代码。

未经确认不得直接开发新的接口名称。

---

## 28. 当前确认清单

当前已经确认：

```text
MIoT entryPath:
miot
```

```text
搜索源注册:
register-search-provider
```

```text
搜索源注销:
unregister-search-provider
```

```text
搜索源列表:
GET /api/v1/jsplugin/miot/search-providers
```

```text
搜索提供方接口:
POST /api/search/topone
```

```text
Downloader entryPath:
downloader
```

```text
单曲下载:
POST /api/v1/jsplugin/downloader/api/download
```

```json
{
  "song_id": 123
}
```

---

## 29. 当前未确认、不得直接使用

以下名称仅是概念，不是当前已确认接口：

```text
PluginCapabilities
UnifiedSearchItem
SongVariant
DownloadRequest
createDownload
enqueueDownload
resolvePlayback
create-download
enqueue-download
download-song
```

除非后续正式开发并更新本文档，否则不得在代码中把它们当成 Songloft 现有接口。

---

## 30. 最终约束

MIoT V2 第一版必须坚持：

> 搜索使用现有 search-provider 和 topone 规范。

> 下载使用 Downloader 现有 song_id HTTP 接口。

> Provider 私有数据保持不透明。

> UI 不展示不存在的接口字段。

> MIoT 只负责编排，不负责具体音源和文件下载。
