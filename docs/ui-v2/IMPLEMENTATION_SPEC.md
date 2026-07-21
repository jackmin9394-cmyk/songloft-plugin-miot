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

第一阶段只调整 UI，不修改后端接口。

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

## 5. 在线来源选择

参考图：

```text
03-source-selector.png
```

要求：

- provider 名称动态读取
- 每个 provider 第一版最多展示一条 topone 结果
- 只显示真实字段
- 不固定显示 FLAC、MP3、320K、无损
- 不解析 provider 私有 source_data

## 6. 歌曲操作菜单

参考图：

```text
04-song-action-menu.png
```

基础操作复用现有能力。

下载入口只有同时满足以下条件时显示：

- Downloader 已安装
- Downloader 已启用
- 当前歌曲存在真实 Songloft song_id

## 7. Downloader

参考图：

```text
05-downloader-manager.png
06-download-confirm.png
```

MIoT 只负责检测、调用和跳转 Downloader。

下载接口：

```text
POST /api/v1/jsplugin/downloader/api/download
```

请求体：

```json
{
  "song_id": 123
}
```

MIoT 不实现下载队列、进度、速度、暂停、恢复和重试。

## 8. 能力筛选

参考图：

```text
07-capability-filter.png
```

基础筛选：

- 全部
- 本地

存在可用 provider 时才显示：

- 在线

## 9. 统一搜索

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

## 10. 设备状态

设备状态必须来自真实数据：

- 在线：已连接
- 离线：离线
- 连接过程：连接中
- 无法判断：已选择

不得因为设备被选中就显示“已连接”。

## 11. 播放状态

必须保留官方 2026.7.21 的：

- WebSocket 播放状态
- 自动切歌
- 歌词状态更新
- 下一首预缓存

播放模式只支持：

```text
order
loop
single
random
```

## 12. Voice Memory 保护

不得删除或重写：

- src/memory
- MemoryService
- memory resolver
- memory storage
- memory self-test
- voice_memory_enabled
- VoiceEngine 中的记忆调用顺序

## 13. 非目标

第一版不实现：

- 新音乐平台 API
- 统一多音质协议
- 新 Downloader comm action
- MIoT 内部下载线程
- MIoT 自建下载队列
- provider 私有 source_data 解析
- 新前端框架
- 全面重写现有页面
