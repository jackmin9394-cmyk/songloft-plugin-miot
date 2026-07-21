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
- Downloader 调用
- 扩展能力状态展示

MIoT 不负责：

- 实现具体音乐平台 API
- 在核心代码中写死音乐平台名称
- 解析 provider 私有 `source_data`
- 自己下载音乐文件
- 自己维护下载队列
- 虚构未经确认的接口或字段

## 已确认的搜索接口

搜索源注册：

```text
register-search-provider
```

搜索源注销：

```text
unregister-search-provider
```

搜索提供方接口：

```text
POST /api/search/topone
```

搜索源名称必须动态读取。

不得把 `topone` 当成通用多版本、多音质接口。

不得虚构：

- FLAC
- MP3
- 320K
- 无损
- 文件大小
- 版本数量

## 已确认的 Downloader 接口

使用：

```text
POST /api/v1/jsplugin/downloader/api/download
```

请求体：

```json
{
  "song_id": 123
}
```

必须使用 Songloft 返回的真实 `song_id`。

禁止创建或使用未经确认的 Downloader action，例如：

- `create-download`
- `enqueue-download`
- `download-song`
- `start-download`

禁止使用未经确认的：

```text
songloft.comm.call('downloader', ...)
```

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
