import { jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest, Router } from '@songloft/plugin-sdk';
import type { IndexingManager } from '../indexing/manager';
import type { SearchService } from '../search/service';

const MAX_SEARCH_QUERY_LENGTH = 200;

export function registerSearchHandlers(
  router: Router,
  indexingManager: IndexingManager,
  searchService: SearchService,
): void {
  router.get('/search', async (req: HTTPRequest) => {
    try {
      const params = parseQuery(req.query);
      const query = (params.query || '').trim();
      if (query.length > MAX_SEARCH_QUERY_LENGTH) {
        return jsonResponse({ success: false, error: 'search query is too long' }, 400);
      }
      if (!query) {
        return jsonResponse({
          success: true,
          data: {
            query: '',
            songs: [],
            playlists: [],
            artists: [],
            albums: [],
            online: [],
          },
        });
      }

      const ready = await indexingManager.waitForReady(5000);
      if (!ready) {
        return jsonResponse({ success: false, error: '本地音乐索引尚未就绪，请稍后重试' }, 503);
      }

      const playlistId = params.playlist_id ? Number(params.playlist_id) : undefined;
      const data = await searchService.search(query, {
        preferredPlaylistId: playlistId && Number.isFinite(playlistId) ? playlistId : undefined,
        includeOnline: params.include_online === '1' || params.include_online === 'true',
      });
      return jsonResponse({ success: true, data });
    } catch (error: any) {
      return jsonResponse({ success: false, error: error?.message || String(error) }, 500);
    }
  });
}
