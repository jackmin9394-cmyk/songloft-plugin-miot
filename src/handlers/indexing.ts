// MIoT 智能音箱插件 - 索引管理 Handler
// 翻译自 Go 源码: plugins/songloft-plugin-xiaomi/handlers/indexing_handler.go

import { jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { Router, HTTPRequest } from '@songloft/plugin-sdk';
import { IndexingManager } from '../indexing/manager';

/**
 * 注册索引管理相关路由
 * GET  /indexing/status  → 获取索引状态
 * GET  /indexing/search  → 本地统一搜索
 * POST /indexing/refresh → 刷新索引
 */
export function registerIndexingHandlers(
  router: Router,
  indexingManager: IndexingManager,
): void {

  // GET /indexing/status - 获取索引状态
  router.get('/indexing/status', async (req: HTTPRequest) => {
    try {
      const status = indexingManager.getStatus();
      return jsonResponse({ success: true, data: status });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });

  // GET /indexing/search - 只读搜索当前 Songloft 本地索引
  router.get('/indexing/search', async (req: HTTPRequest) => {
    try {
      const query = parseQuery(req.query);
      const keyword = (query.query || '').trim();
      const preferredPlaylistId = query.playlist_id ? Number(query.playlist_id) : undefined;

      if (!keyword) {
        return jsonResponse({
          success: true,
          data: { query: '', songs: [], playlists: [], artists: [], albums: [] },
        });
      }

      const ready = await indexingManager.waitForReady(5000);
      if (!ready) {
        return jsonResponse({ success: false, error: '本地音乐索引尚未就绪，请稍后重试' }, 503);
      }

      const results = await indexingManager.searchLocal(
        keyword,
        preferredPlaylistId && Number.isFinite(preferredPlaylistId) ? preferredPlaylistId : undefined,
      );
      return jsonResponse({ success: true, data: results });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) }, 500);
    }
  });

  // POST /indexing/refresh - 刷新索引
  router.post('/indexing/refresh', async (req: HTTPRequest) => {
    try {
      // 后台异步刷新，立即返回响应
      indexingManager.refresh().catch(e => {
        // 错误已在内部处理，这里只防止 unhandled rejection
      });
      return jsonResponse({ success: true, data: { message: 'index refresh started' } });
    } catch (e: any) {
      return jsonResponse({ success: false, error: e.message || String(e) });
    }
  });
}
