import { jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest, Router } from '@songloft/plugin-sdk';
import type { IndexingManager } from '../indexing/manager';
import type { SearchService } from '../search/service';

const MAX_SEARCH_QUERY_LENGTH = 200;

function parseBody(req: HTTPRequest): Record<string, unknown> {
  if (!req.body) return {};
  try {
    const text = typeof req.body === 'string'
      ? req.body
      : String.fromCharCode(...Array.from(req.body as Uint8Array));
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

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
            online_status: 'not_requested',
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

  router.post('/search/play', async (req: HTTPRequest) => {
    try {
      const body = parseBody(req);
      const candidateId = typeof body.candidate_id === 'string' ? body.candidate_id.trim() : '';
      const accountId = typeof body.account_id === 'string' ? body.account_id.trim() : '';
      const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : '';
      if (!candidateId || !accountId || !deviceId) {
        return jsonResponse({ success: false, error: 'candidate_id, account_id and device_id are required' }, 400);
      }
      const played = await searchService.playOnline(candidateId, accountId, deviceId);
      return played
        ? jsonResponse({ success: true, data: { played: true } })
        : jsonResponse({ success: false, error: 'search candidate expired or playback failed' }, 409);
    } catch (error: any) {
      return jsonResponse({ success: false, error: error?.message || String(error) }, 500);
    }
  });

  router.get('/search/capabilities', async () => jsonResponse({
    success: true,
    data: { downloader_available: await searchService.downloaderAvailable() },
  }));

  router.post('/search/download', async (req: HTTPRequest) => {
    const body = parseBody(req);
    const candidateId = typeof body.candidate_id === 'string' ? body.candidate_id.trim() : '';
    if (!candidateId) {
      return jsonResponse({ success: false, error: 'candidate_id is required' }, 400);
    }
    const task = await searchService.downloadOnline(candidateId);
    return task
      ? jsonResponse({ success: true, data: task }, 202)
      : jsonResponse({ success: false, error: 'downloader unavailable or candidate expired' }, 409);
  });
}
