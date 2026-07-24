import type { IndexingManager, LocalSearchResults } from '../indexing/manager';
import type { OnlineSearchHit } from '../voicecmd/online_searcher';
import { OnlineSearcher } from '../voicecmd/online_searcher';

export interface UnifiedSearchResults extends LocalSearchResults {
  online: OnlineSearchHit[];
}

/**
 * 统一搜索编排层。只组合既有本地索引与已确认的 provider topone 合同；
 * provider 失败被 OnlineSearcher 隔离，不影响本地结果。
 */
export class SearchService {
  constructor(
    private readonly indexingManager: IndexingManager,
    private readonly onlineSearcher: OnlineSearcher,
  ) {}

  async search(
    query: string,
    options: { preferredPlaylistId?: number; includeOnline?: boolean } = {},
  ): Promise<UnifiedSearchResults> {
    const normalizedQuery = (query || '').trim();
    if (!normalizedQuery) {
      return {
        query: '',
        songs: [],
        playlists: [],
        artists: [],
        albums: [],
        online: [],
      };
    }

    const localTask = this.indexingManager.searchLocal(
      normalizedQuery,
      options.preferredPlaylistId,
    );
    const onlineTask = options.includeOnline
      ? this.onlineSearcher.searchAll(normalizedQuery, null).catch(error => {
          const name = error && typeof error === 'object' && 'name' in error
            ? String((error as { name?: unknown }).name || 'Error')
            : 'Error';
          songloft.log.warn('[SearchService] online aggregation failed name=' + name);
          return [];
        })
      : Promise.resolve([]);

    const [local, online] = await Promise.all([localTask, onlineTask]);
    return { ...local, online };
  }
}
