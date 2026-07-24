import { getHostAPIBaseUrl } from '../utils/http';

const ENTRY_PATH = 'downloader';
const API_BASE = `/api/v1/jsplugin/${ENTRY_PATH}/api`;

export class DownloaderClient {
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.request('/capabilities', 'GET');
      return response?.success === true && response?.data?.protocol === '1';
    } catch {
      return false;
    }
  }

  async enqueue(songId: number): Promise<{ task_id: string } | null> {
    if (!Number.isSafeInteger(songId) || songId <= 0) return null;
    try {
      const response = await this.request('/download', 'POST', { song_id: songId });
      const taskId = response?.data?.task?.id;
      return response?.success === true && typeof taskId === 'string'
        ? { task_id: taskId }
        : null;
    } catch {
      return null;
    }
  }

  private async request(path: string, method: 'GET' | 'POST', body?: unknown): Promise<any> {
    const token = await songloft.plugin.getToken();
    const base = await getHostAPIBaseUrl();
    const response = await fetch(base + API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error('DOWNLOADER_UNAVAILABLE');
    return JSON.parse(await response.text());
  }
}
