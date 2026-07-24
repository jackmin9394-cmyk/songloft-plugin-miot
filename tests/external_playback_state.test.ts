import assert from 'node:assert/strict';
import test from 'node:test';

import { PlaylistManager } from '../src/player/manager';

(globalThis as any).songloft = {
  log: {
    info() {},
    warn() {},
    error() {},
  },
};

function createManager() {
  const deviceCalls: string[] = [];
  const minaService = {
    pausePlay: async () => {
      deviceCalls.push('pause');
      return true;
    },
    resumePlay: async () => {
      deviceCalls.push('resume');
      return true;
    },
    stopPlay: async () => {
      deviceCalls.push('stop');
      return true;
    },
  };
  const manager = new PlaylistManager(
    'account-1',
    'device-1',
    minaService as any,
    {} as any,
  );
  return { manager, deviceCalls };
}

test('external playback is visible without retaining its URL', () => {
  const { manager } = createManager();
  manager.beginExternalPlayback({
    title: 'Remote song',
    artist: 'Remote artist',
    duration: 240,
  });

  assert.deepEqual(manager.getStatus().current_song, {
    id: 0,
    title: 'Remote song',
    artist: 'Remote artist',
    cover_url: undefined,
    lyric_url: undefined,
  });
  assert.equal(manager.getStatus().playback_source, 'external');
  assert.equal(manager.getStatus().state, 'playing');
  assert.equal(manager.getStatus().playlist_id, 0);
  assert.equal(manager.getStatus().current_index, -1);
  assert.equal(JSON.stringify(manager.getStatus()).includes('http'), false);
});

test('external playback supports pause, resume and stop through device controls', async () => {
  const { manager, deviceCalls } = createManager();
  manager.beginExternalPlayback({ title: 'Remote song', duration: 120 });

  await manager.pause();
  assert.equal(manager.getStatus().state, 'paused');
  assert.equal(manager.getStatus().playback_source, 'external');

  assert.equal(await manager.resumePlayback(), true);
  assert.equal(manager.getStatus().state, 'playing');
  assert.equal(manager.getStatus().playback_source, 'external');

  await manager.stop();
  assert.equal(manager.getStatus().state, 'stopped');
  assert.equal(manager.getStatus().playback_source, 'playlist');
  assert.deepEqual(deviceCalls, ['pause', 'resume', 'stop']);
});

test('preparing a local playback clears stale external metadata', () => {
  const { manager } = createManager();
  manager.beginExternalPlayback({ title: 'Remote song' });
  manager.prepareForNewPlayback();

  const status = manager.getStatus();
  assert.equal(status.state, 'idle');
  assert.equal(status.playback_source, 'playlist');
  assert.equal(status.current_song, undefined);
});
