import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMediaProxyPlaybackURL,
  createMediaProxyPlaybackURL,
  MediaProxyError,
  mediaProxyFailureCode,
} from '../src/media_proxy/client';

const token = 'abcdefghijklmnopqrstuvwxyz012345';

test('builds speaker-facing URL from authenticated session response', () => {
  assert.equal(
    buildMediaProxyPlaybackURL('http://192.168.2.2:58091', {
      token,
      path: `/api/v1/media-proxy/${token}`,
    }),
    `http://192.168.2.2:58091/api/v1/media-proxy/${token}`,
  );
});

test('preserves Core base path without duplicating configured server path', () => {
  assert.equal(
    buildMediaProxyPlaybackURL('https://songloft.lan/prefix', {
      token,
      path: `/prefix/api/v1/media-proxy/${token}`,
    }),
    `https://songloft.lan/prefix/api/v1/media-proxy/${token}`,
  );
});

test('rejects loopback speaker hosts and malformed session paths', () => {
  assert.throws(
    () => buildMediaProxyPlaybackURL('http://127.0.0.1:58091', {
      token,
      path: `/api/v1/media-proxy/${token}`,
    }),
    (error: unknown) => error instanceof MediaProxyError
      && error.code === 'server_host_unavailable',
  );
  assert.throws(
    () => buildMediaProxyPlaybackURL('http://192.168.2.2:58091', {
      token,
      path: `/api/v1/media-proxy/../${token}`,
    }),
    (error: unknown) => error instanceof MediaProxyError
      && error.code === 'invalid_session_response',
  );
});

test('creates one authenticated session with bounded public fields', async () => {
  const calls: Array<{ method: string; path: string; body: unknown; timeoutMs?: number }> = [];
  const result = await createMediaProxyPlaybackURL(
    'https://cdn.example.test/audio.mp3?signature=private',
    { duration: 253.8, deviceId: 'device-1' },
    {
      getHostBaseUrl: () => 'http://192.168.2.2:58091',
      callHostAPI: async (method, path, body, options) => {
        calls.push({ method, path, body, timeoutMs: options.timeoutMs });
        return {
          token,
          path: `/api/v1/media-proxy/${token}`,
          expires_at: '2026-07-24T00:00:00Z',
          hard_expires_at: '2026-07-24T01:00:00Z',
        };
      },
    },
  );

  assert.equal(result, `http://192.168.2.2:58091/api/v1/media-proxy/${token}`);
  assert.deepEqual(calls, [{
    method: 'POST',
    path: '/api/v1/media-proxy/sessions',
    body: {
      url: 'https://cdn.example.test/audio.mp3?signature=private',
      duration: 253,
      device_id: 'device-1',
    },
    timeoutMs: 10000,
  }]);
});

test('maps host failures to a secret-safe stable code', async () => {
  await assert.rejects(
    createMediaProxyPlaybackURL(
      'https://cdn.example.test/audio.mp3',
      {},
      {
        getHostBaseUrl: () => 'http://songloft.lan:58091',
        callHostAPI: async () => {
          throw new Error('sensitive upstream response must not escape');
        },
      },
    ),
    (error: unknown) => error instanceof MediaProxyError
      && error.code === 'host_api_failed'
      && !error.message.includes('sensitive'),
  );
  assert.equal(mediaProxyFailureCode(new MediaProxyError('host_api_failed')), 'host_api_failed');
  assert.equal(mediaProxyFailureCode(new Error('unknown')), 'unexpected_error');
});
