/// <reference types="@songloft/plugin-sdk" />

import { callHostAPI, getHostBaseUrl } from '../utils/http';

const MEDIA_PROXY_SESSION_PATH = '/api/v1/media-proxy/sessions';
const MEDIA_PROXY_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;

export type MediaProxyFailureCode =
  | 'invalid_upstream_url'
  | 'server_host_unavailable'
  | 'host_api_failed'
  | 'invalid_session_response';

export class MediaProxyError extends Error {
  readonly code: MediaProxyFailureCode;

  constructor(code: MediaProxyFailureCode) {
    super(code);
    this.name = 'MediaProxyError';
    this.code = code;
  }
}

interface MediaProxySessionResponse {
  token?: unknown;
  path?: unknown;
  expires_at?: unknown;
  hard_expires_at?: unknown;
}

interface MediaProxyClientDependencies {
  callHostAPI: typeof callHostAPI;
  getHostBaseUrl: typeof getHostBaseUrl;
}

export interface CreateMediaProxyPlaybackOptions {
  duration?: number;
  deviceId?: string;
}

const defaultDependencies: MediaProxyClientDependencies = {
  callHostAPI,
  getHostBaseUrl,
};

function isHTTPURL(value: string): boolean {
  return /^https?:\/\/[^/?#]+(?:[/?#]|$)/i.test(value);
}

function speakerOrigin(serverHost: string): string {
  const value = serverHost.trim();
  const match = /^(https?):\/\/([^/?#]+)(?:[/?#]|$)/i.exec(value);
  if (!match || match[2].includes('@')) {
    throw new MediaProxyError('server_host_unavailable');
  }

  const authority = match[2];
  let hostname = authority;
  if (hostname.startsWith('[')) {
    const bracket = hostname.indexOf(']');
    if (bracket < 0) throw new MediaProxyError('server_host_unavailable');
    hostname = hostname.slice(1, bracket);
  } else {
    hostname = hostname.split(':')[0];
  }
  hostname = hostname.toLowerCase();
  if (
    !hostname
    || hostname === 'localhost'
    || hostname === '::'
    || hostname === '::1'
    || hostname === '0.0.0.0'
    || hostname.startsWith('127.')
  ) {
    throw new MediaProxyError('server_host_unavailable');
  }

  return `${match[1].toLowerCase()}://${authority}`;
}

function validSessionPath(path: string, token: string): boolean {
  if (
    !path.startsWith('/')
    || path.includes('?')
    || path.includes('#')
    || path.includes('\\')
    || path.includes('//')
  ) {
    return false;
  }
  const segments = path.split('/');
  if (segments.some(segment => segment === '.' || segment === '..')) {
    return false;
  }
  return path.endsWith(`/api/v1/media-proxy/${token}`);
}

export function buildMediaProxyPlaybackURL(
  serverHost: string,
  response: MediaProxySessionResponse,
): string {
  const token = typeof response.token === 'string' ? response.token : '';
  const path = typeof response.path === 'string' ? response.path : '';
  if (!MEDIA_PROXY_TOKEN_RE.test(token) || !validSessionPath(path, token)) {
    throw new MediaProxyError('invalid_session_response');
  }
  return speakerOrigin(serverHost) + path;
}

export async function createMediaProxyPlaybackURL(
  upstreamURL: string,
  options: CreateMediaProxyPlaybackOptions = {},
  dependencies: MediaProxyClientDependencies = defaultDependencies,
): Promise<string> {
  const upstream = upstreamURL.trim();
  if (!isHTTPURL(upstream)) {
    throw new MediaProxyError('invalid_upstream_url');
  }

  const serverHost = dependencies.getHostBaseUrl();
  // Validate before creating a token. A loopback/empty server_host cannot be
  // reached by the speaker and would otherwise leave an unused session.
  speakerOrigin(serverHost);

  const body: {
    url: string;
    duration?: number;
    device_id?: string;
  } = { url: upstream };
  if (Number.isFinite(options.duration) && Number(options.duration) >= 0) {
    body.duration = Math.floor(Number(options.duration));
  }
  if (options.deviceId) {
    body.device_id = options.deviceId;
  }

  let response: MediaProxySessionResponse;
  try {
    response = await dependencies.callHostAPI<MediaProxySessionResponse>(
      'POST',
      MEDIA_PROXY_SESSION_PATH,
      body,
      { timeoutMs: 10000 },
    );
  } catch {
    // Do not propagate host response bodies or the upstream URL into logs.
    throw new MediaProxyError('host_api_failed');
  }

  return buildMediaProxyPlaybackURL(serverHost, response);
}

export function mediaProxyFailureCode(error: unknown): MediaProxyFailureCode | 'unexpected_error' {
  return error instanceof MediaProxyError ? error.code : 'unexpected_error';
}
