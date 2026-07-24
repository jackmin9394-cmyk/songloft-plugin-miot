import assert from 'node:assert/strict';
import test from 'node:test';

import { selectPreferredLocalSong } from '../src/memory/local_preference';

test('prefers an exact local song over an earlier remote candidate', async () => {
  const songs = new Map([
    [1, { id: 1, type: 'remote', url: 'https://remote.invalid', title: '晴天', artist: '周杰伦' }],
    [2, { id: 2, type: 'local', url: '/api/v1/songs/2/play', title: '晴天', artist: '周杰伦' }],
  ]);
  const selected = await selectPreferredLocalSong(
    { songName: '晴天', artist: '周杰伦' },
    [
      { id: 1, title: '晴天', artist: '周杰伦' },
      { id: 2, title: '晴天', artist: '周杰伦' },
    ],
    async id => songs.get(id) || null,
  );
  assert.equal(selected?.id, 2);
});

test('does not replace a remembered song with an ambiguous title-only match', async () => {
  const selected = await selectPreferredLocalSong(
    { songName: '后来' },
    [
      { id: 1, title: '后来', artist: '刘若英' },
      { id: 2, title: '后来', artist: '其他歌手' },
    ],
    async id => ({ id, type: 'local', url: `/songs/${id}`, title: '后来', artist: '' }),
  );
  assert.equal(selected, null);
});

test('does not accept fuzzy or remote-only alternatives', async () => {
  const fuzzy = await selectPreferredLocalSong(
    { songName: '晴天', artist: '周杰伦' },
    [{ id: 1, title: '青天', artist: '周杰伦' }],
    async id => ({ id, type: 'local', url: `/songs/${id}`, title: '青天', artist: '周杰伦' }),
  );
  const remote = await selectPreferredLocalSong(
    { songName: '晴天', artist: '周杰伦' },
    [{ id: 2, title: '晴天', artist: '周杰伦' }],
    async id => ({ id, type: 'remote', url: 'https://remote.invalid', title: '晴天', artist: '周杰伦' }),
  );
  assert.equal(fuzzy, null);
  assert.equal(remote, null);
});
