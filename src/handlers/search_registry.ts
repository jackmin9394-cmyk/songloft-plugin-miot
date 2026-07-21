// MIoT 智能音箱插件 - 搜索源候选注册（插件间通信入口）
// 其他插件通过 songloft.comm.call('miot', 'register-search-provider', {...}) 把自己
// 登记为外部搜索源候选；miot 以宿主注入的可信 from 作为 entryPath 落盘。
// 注册表随后由 GET /search-providers 结合宿主插件列表返回，供配置页下拉选择。

/// <reference types="@songloft/plugin-sdk" />

import { ConfigManager } from '../config/manager';

export const DEFAULT_PROVIDER_SEARCH_PATH = '/api/search/topone';

const ENTRY_PATH_PATTERN = /^[a-z][a-z0-9-]*$/;
const SEARCH_PATH_PATTERN = /^\/[A-Za-z0-9._~/-]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const MAX_PROVIDER_NAME_LENGTH = 100;
const MAX_PROVIDER_SEARCH_PATH_LENGTH = 512;
const MAX_PROVIDER_ICON_LENGTH = 1024;

interface NormalizedProviderPayload {
  name: string;
  searchPath: string;
  icon?: string;
}

type PayloadValidationResult =
  | { ok: true; value: NormalizedProviderPayload }
  | { ok: false; error: string };

/** 与 Builder 当前 ENTRY_PATH_REGEX 保持一致。 */
export function isValidProviderEntryPath(value: string): boolean {
  return ENTRY_PATH_PATTERN.test(value);
}

/** 只接受 Provider 自身的内部绝对子路径，不接受完整 URL 或宿主路由前缀。 */
export function isValidProviderSearchPath(value: string): boolean {
  if (!value || value.length > MAX_PROVIDER_SEARCH_PATH_LENGTH) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('//') || value.includes('..')) return false;
  if (value.includes('?') || value.includes('#') || value.includes('\\')) return false;
  if (/\s/.test(value) || CONTROL_CHARACTER_PATTERN.test(value)) return false;
  if (value.toLowerCase().includes('/api/v1/jsplugin/')) return false;
  return SEARCH_PATH_PATTERN.test(value);
}

function normalizeProviderPayload(payload: unknown, entryPath: string): PayloadValidationResult {
  if (payload !== undefined && payload !== null
      && (typeof payload !== 'object' || Array.isArray(payload))) {
    return { ok: false, error: 'payload must be an object' };
  }

  const input = (payload || {}) as Record<string, unknown>;

  let name = entryPath;
  if (input.name !== undefined) {
    if (typeof input.name !== 'string') {
      return { ok: false, error: 'name must be a string' };
    }
    const trimmedName = input.name.trim();
    if (trimmedName.length > MAX_PROVIDER_NAME_LENGTH || CONTROL_CHARACTER_PATTERN.test(trimmedName)) {
      return { ok: false, error: 'name is invalid or too long' };
    }
    if (trimmedName) name = trimmedName;
  }

  let searchPath = DEFAULT_PROVIDER_SEARCH_PATH;
  if (input.searchPath !== undefined) {
    if (typeof input.searchPath !== 'string') {
      return { ok: false, error: 'searchPath must be a string' };
    }
    searchPath = input.searchPath.trim();
    if (!isValidProviderSearchPath(searchPath)) {
      return { ok: false, error: 'searchPath must be a valid provider-internal path' };
    }
  }

  let icon: string | undefined;
  if (input.icon !== undefined) {
    if (typeof input.icon !== 'string') {
      return { ok: false, error: 'icon must be a string' };
    }
    const trimmedIcon = input.icon.trim();
    if (trimmedIcon.length > MAX_PROVIDER_ICON_LENGTH || CONTROL_CHARACTER_PATTERN.test(trimmedIcon)) {
      return { ok: false, error: 'icon is invalid or too long' };
    }
    if (trimmedIcon) icon = trimmedIcon;
  }

  return { ok: true, value: { name, searchPath, icon } };
}

/**
 * 注册搜索源候选相关的 comm 处理器。
 * 在插件 onInit 中调用一次即可（handler 常驻）。
 */
export function registerSearchProviderComm(configManager: ConfigManager): void {
  // 其他插件注册自己为搜索源候选；身份只取宿主传入的 from，不读取 payload 身份字段。
  songloft.comm.onMessage('register-search-provider', async (payload: unknown, from: string) => {
    const entryPath = typeof from === 'string' ? from.trim() : '';
    if (!isValidProviderEntryPath(entryPath)) {
      return { ok: false, error: 'invalid caller identity' };
    }

    const validated = normalizeProviderPayload(payload, entryPath);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    try {
      await configManager.upsertSearchProvider({ entryPath, ...validated.value });
      songloft.log.info(`[search-registry] 已注册搜索源候选: ${entryPath} (${validated.value.name})`);
      return { ok: true };
    } catch (e) {
      songloft.log.warn(`[search-registry] 注册搜索源候选失败: ${entryPath}: ${String(e)}`);
      return { ok: false, error: 'failed to persist search provider' };
    }
  });

  // 提供方主动注销（可选；installed/active 校验也会过滤失效项）。
  songloft.comm.onMessage('unregister-search-provider', async (_payload: unknown, from: string) => {
    const entryPath = typeof from === 'string' ? from.trim() : '';
    if (!isValidProviderEntryPath(entryPath)) {
      return { ok: false, error: 'invalid caller identity' };
    }
    try {
      await configManager.removeSearchProvider(entryPath);
      songloft.log.info(`[search-registry] 已注销搜索源候选: ${entryPath}`);
      return { ok: true };
    } catch (e) {
      songloft.log.warn(`[search-registry] 注销搜索源候选失败: ${entryPath}: ${String(e)}`);
      return { ok: false, error: 'failed to remove search provider' };
    }
  });
}
