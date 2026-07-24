import type { IndexingManager, LocalSearchResults } from '../indexing/manager';
import type { OnlineSearchHit } from '../voicecmd/online_searcher';
import { OnlineSearcher } from '../voicecmd/online_searcher';
import type { MinaService } from '../service/service';
import type { PlaylistManagerMap } from '../player/manager';
import type { DownloaderClient } from '../downloader/client';

const CANDIDATE_TTL_MS = 2 * 60 * 1000;
const MAX_CACHED_CANDIDATES = 100;

export interface OnlineSearchVersion {
  candidate_id: string;
  source_id: string;
  source_name: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_url: string;
}

export interface OnlineSearchGroup {
  group_id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover_url: string;
  versions: OnlineSearchVersion[];
}

export interface UnifiedSearchResults extends LocalSearchResults {
  online: OnlineSearchGroup[];
  online_status: 'not_requested' | 'available' | 'partial' | 'no_result' | 'failed';
}

interface PlaybackDependencies {
  minaService: MinaService;
  playlistManagerMap: PlaylistManagerMap;
  downloaderClient?: DownloaderClient;
}

interface CachedCandidate {
  hit: OnlineSearchHit;
  expiresAt: number;
}

/**
 * 统一搜索编排层。只组合既有本地索引与已确认的 provider topone 合同；
 * provider 失败被 OnlineSearcher 隔离，不影响本地结果。
 */
export class SearchService {
  private readonly candidates = new Map<string, CachedCandidate>();
  private candidateSequence = 0;

  constructor(
    private readonly indexingManager: IndexingManager,
    private readonly onlineSearcher: OnlineSearcher,
    private readonly playback?: PlaybackDependencies,
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
        online_status: 'not_requested',
      };
    }

    const localTask = this.indexingManager.searchLocal(
      normalizedQuery,
      options.preferredPlaylistId,
    );
    const onlineTask = options.includeOnline
      ? this.onlineSearcher.searchAllDetailed(normalizedQuery, null).catch(error => {
          const name = error && typeof error === 'object' && 'name' in error
            ? String((error as { name?: unknown }).name || 'Error')
            : 'Error';
          songloft.log.warn('[SearchService] online aggregation failed name=' + name);
          return { hits: [], status: 'failed' as const };
        })
      : Promise.resolve({ hits: [], status: 'not_requested' as const });

    const [local, onlineAggregate] = await Promise.all([localTask, onlineTask]);
    const online = this.groupOnlineHits(onlineAggregate.hits);
    return {
      ...local,
      online,
      online_status: onlineAggregate.status,
    };
  }

  async playOnline(
    candidateId: string,
    accountId: string,
    deviceId: string,
  ): Promise<boolean> {
    this.pruneCandidates();
    const cached = this.candidates.get(candidateId);
    if (!cached || cached.expiresAt <= Date.now() || !this.playback) {
      return false;
    }
    const manager = await this.playback.playlistManagerMap.getOrCreate(accountId, deviceId);
    return await this.onlineSearcher.playSearchResult(
      cached.hit.result,
      accountId,
      deviceId,
      this.playback.minaService,
      this.indexingManager,
      manager,
    );
  }

  async downloaderAvailable(): Promise<boolean> {
    return this.playback?.downloaderClient
      ? await this.playback.downloaderClient.isAvailable()
      : false;
  }

  async downloadOnline(candidateId: string): Promise<{ task_id: string; song_id: number } | null> {
    this.pruneCandidates();
    const cached = this.candidates.get(candidateId);
    const downloader = this.playback?.downloaderClient;
    if (!cached || cached.expiresAt <= Date.now() || !downloader) return null;
    if (!(await downloader.isAvailable())) return null;
    const imported = await this.onlineSearcher.importSearchResult(cached.hit.result);
    if (!imported) return null;
    this.indexingManager.addImportedSong({
      id: imported.id,
      title: cached.hit.result.title,
      artist: cached.hit.result.artist,
      album: cached.hit.result.album,
    });
    const task = await downloader.enqueue(imported.id);
    return task ? { task_id: task.task_id, song_id: imported.id } : null;
  }

  private groupOnlineHits(hits: OnlineSearchHit[]): OnlineSearchGroup[] {
    this.pruneCandidates();
    const groups = new Map<string, OnlineSearchGroup>();
    for (const hit of hits) {
      const result = hit.result;
      const groupKey = this.normalizedGroupKey(result.title, result.artist);
      let group = groups.get(groupKey);
      if (!group) {
        group = {
          group_id: `online-group-${groups.size + 1}`,
          title: result.title || '',
          artist: result.artist || '',
          album: result.album || '',
          duration: Math.max(0, Math.floor(result.duration || 0)),
          cover_url: result.cover_url || '',
          versions: [],
        };
        groups.set(groupKey, group);
      }
      const candidateId = this.cacheCandidate(hit);
      group.versions.push({
        candidate_id: candidateId,
        source_id: hit.source_id,
        source_name: hit.source_name,
        title: result.title || '',
        artist: result.artist || '',
        album: result.album || '',
        duration: Math.max(0, Math.floor(result.duration || 0)),
        cover_url: result.cover_url || '',
      });
    }
    return Array.from(groups.values());
  }

  private normalizedGroupKey(title: string, artist: string): string {
    return `${title || ''}\u0000${artist || ''}`
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cacheCandidate(hit: OnlineSearchHit): string {
    this.candidateSequence += 1;
    const id = `candidate-${Date.now().toString(36)}-${this.candidateSequence.toString(36)}`;
    this.candidates.set(id, { hit, expiresAt: Date.now() + CANDIDATE_TTL_MS });
    this.pruneCandidates();
    return id;
  }

  private pruneCandidates(): void {
    const now = Date.now();
    for (const [id, candidate] of this.candidates) {
      if (candidate.expiresAt <= now) this.candidates.delete(id);
    }
    while (this.candidates.size > MAX_CACHED_CANDIDATES) {
      const oldest = this.candidates.keys().next().value;
      if (typeof oldest !== 'string') break;
      this.candidates.delete(oldest);
    }
  }
}
