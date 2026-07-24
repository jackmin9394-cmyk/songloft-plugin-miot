import { normalizeEntityText } from './query_normalizer';
import type { MemoryRecord } from './types';

export interface LocalPreferenceCandidate {
  id: number;
  title: string;
  artist: string;
}

export interface LocalPreferenceSong extends LocalPreferenceCandidate {
  type: string;
  url: string;
  duration?: number;
  cover_url?: string;
}

/**
 * 只在标题精确一致、且歌手条件无歧义时选取真实 local 歌曲。
 * 保持后端索引顺序，不进行新的模糊排序或 Provider 解释。
 */
export async function selectPreferredLocalSong(
  record: Pick<MemoryRecord, 'songName' | 'artist'>,
  candidates: LocalPreferenceCandidate[],
  loadSong: (id: number) => Promise<LocalPreferenceSong | null>,
): Promise<LocalPreferenceSong | null> {
  const title = normalizeEntityText(record.songName || '');
  const artist = normalizeEntityText(record.artist || '');
  if (!title) return null;

  const exact = candidates.filter(candidate => (
    normalizeEntityText(candidate.title) === title
    && (!artist || normalizeEntityText(candidate.artist) === artist)
  )).slice(0, 10);
  if (!artist) {
    const artists = new Set(exact.map(candidate => normalizeEntityText(candidate.artist)));
    if (artists.size > 1) return null;
  }

  for (const candidate of exact) {
    const song = await loadSong(candidate.id);
    if (song?.type === 'local' && !!song.url) return song;
  }
  return null;
}
