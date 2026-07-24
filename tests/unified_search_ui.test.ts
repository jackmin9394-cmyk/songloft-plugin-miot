import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUnifiedSearchPath,
  filterUnifiedSearchData,
} from '../static/js/search.js';

const results = {
  songs: [{ id: 1, title: 'Local' }],
  playlists: [{ id: 2, name: 'Playlist' }],
  artists: [{ name: 'Artist' }],
  albums: [{ name: 'Album' }],
  online: [{
    group_id: 'group-1',
    title: 'Online',
    versions: [
      { candidate_id: 'a', source_id: 'provider-a', source_name: 'Provider A' },
      { candidate_id: 'b', source_id: 'provider-b', source_name: 'Provider B' },
    ],
  }],
};

test('builds the SearchService request without exposing provider details', () => {
  const path = buildUnifiedSearchPath('Song & Artist', '42', true);
  const url = new URL(path, 'https://local.invalid');
  assert.equal(url.pathname, '/search');
  assert.equal(url.searchParams.get('query'), 'Song & Artist');
  assert.equal(url.searchParams.get('playlist_id'), '42');
  assert.equal(url.searchParams.get('include_online'), '1');
  assert.equal(url.searchParams.has('provider_url'), false);
});

test('local scope preserves backend local ordering and hides online groups', () => {
  const filtered = filterUnifiedSearchData(results, {
    scope: 'local',
    type: 'all',
    source: 'all',
  });
  assert.equal(filtered.songs, results.songs);
  assert.equal(filtered.playlists, results.playlists);
  assert.deepEqual(filtered.online, []);
});

test('online source filtering preserves backend grouping and exact candidate identity', () => {
  const filtered = filterUnifiedSearchData(results, {
    scope: 'online',
    type: 'online',
    source: 'provider-b',
  });
  assert.deepEqual(filtered.songs, []);
  assert.equal(filtered.online.length, 1);
  assert.equal(filtered.online[0].versions.length, 1);
  assert.equal(filtered.online[0].versions[0].candidate_id, 'b');
  assert.equal(results.online[0].versions.length, 2);
});

test('type filter does not re-sort or re-group local results', () => {
  const filtered = filterUnifiedSearchData(results, {
    scope: 'all',
    type: 'playlists',
    source: 'all',
  });
  assert.equal(filtered.playlists, results.playlists);
  assert.deepEqual(filtered.songs, []);
  assert.deepEqual(filtered.online, []);
});
