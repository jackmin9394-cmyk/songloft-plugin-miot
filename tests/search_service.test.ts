import assert from 'node:assert/strict';
import test from 'node:test';

import { SearchService } from '../src/search/service';
import { OnlineSearcher } from '../src/voicecmd/online_searcher';

const logs: string[] = [];
const originalFetch = globalThis.fetch;
(globalThis as any).songloft = {
  log: {
    info() {},
    warn(message: string) {
      logs.push(message);
    },
    error() {},
  },
};

function localResults(query: string) {
  return {
    query,
    songs: [{ id: 1, title: 'Local', artist: '', album: '', duration: 1, cover_url: '', playlist_id: 1, playlist_name: 'P', song_index: 0 }],
    playlists: [],
    artists: [],
    albums: [],
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  logs.length = 0;
});

test('returns an empty stable schema without invoking dependencies', async () => {
  const indexing = { searchLocal: async () => assert.fail('must not search') };
  const online = { searchAll: async () => assert.fail('must not search') };
  const service = new SearchService(indexing as any, online as any);

  assert.deepEqual(await service.search('  '), {
    query: '',
    songs: [],
    playlists: [],
    artists: [],
    albums: [],
    online: [],
  });
});

test('local-only search never contacts providers', async () => {
  let onlineCalls = 0;
  const indexing = { searchLocal: async (query: string) => localResults(query) };
  const online = {
    searchAll: async () => {
      onlineCalls += 1;
      return [];
    },
  };
  const service = new SearchService(indexing as any, online as any);

  const result = await service.search('Local');
  assert.equal(result.songs[0].title, 'Local');
  assert.deepEqual(result.online, []);
  assert.equal(onlineCalls, 0);
});

test('merges provider-neutral online hits without changing local results', async () => {
  const indexing = { searchLocal: async (query: string) => localResults(query) };
  const online = {
    searchAll: async () => [{
      source_id: 'provider-a',
      source_name: 'Provider A',
      result: { title: 'Online', artist: 'Artist', url: 'https://example.test/audio' },
    }],
  };
  const service = new SearchService(indexing as any, online as any);

  const result = await service.search('Song', { includeOnline: true, preferredPlaylistId: 7 });
  assert.equal(result.songs[0].title, 'Local');
  assert.equal(result.online[0].source_id, 'provider-a');
  assert.equal(result.online[0].result.title, 'Online');
});

test('provider failure is isolated and does not erase local results', async () => {
  const indexing = { searchLocal: async (query: string) => localResults(query) };
  const online = {
    searchAll: async () => {
      throw new TypeError('private provider detail');
    },
  };
  const service = new SearchService(indexing as any, online as any);

  const result = await service.search('Song', { includeOnline: true });
  assert.equal(result.songs.length, 1);
  assert.deepEqual(result.online, []);
  assert.deepEqual(logs, ['[SearchService] online aggregation failed name=TypeError']);
});

test('online aggregation keeps configured source order and isolates a miss', async () => {
  (globalThis as any).songloft.plugin = {
    getToken: async () => 'plugin-token',
  };
  const sources = [
    { id: 'a', name: 'A', url: 'https://a.example.test/search', enabled: true },
    { id: 'b', name: 'B', url: 'https://b.example.test/search', enabled: true },
  ];
  const configManager = {
    getConfig: async () => ({
      external_search_enabled: true,
      external_search_sources: sources,
      external_search_timeout: 1,
    }),
  };
  globalThis.fetch = async (input) => {
    const hit = String(input).startsWith('https://a.');
    return new Response(JSON.stringify(hit
      ? { code: 0, msg: 'ok', data: { title: 'Online A', artist: 'Artist' } }
      : { code: 1, msg: 'not found', data: null }), { status: 200 });
  };

  const searcher = new OnlineSearcher(configManager as any);
  const hits = await searcher.searchAll('private query', null);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].source_id, 'a');
  assert.equal(hits[0].source_name, 'A');
  assert.equal(hits[0].result.title, 'Online A');
  assert.equal(logs.join('\n').includes('private query'), false);
});
