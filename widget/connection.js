'use strict';
// Shared by the desktop renderer and its compatibility web shell.
(function (root) {
  function retryDelay(failures, retryAfter = 0) {
    return Math.min(120000, Math.max(6000 * 2 ** Math.min(failures, 5), retryAfter * 1000));
  }
  async function requestJson(url, options = {}, fetcher = fetch, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, { ...options, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryAfter = Number(response.headers?.get('Retry-After') || data.retryAfter) || 0;
        const message = response.status >= 500 ? '伙伴空间暂时无法连接，会自动重试' : data.error || `请求失败 (${response.status})`;
        throw Object.assign(new Error(message), { status: response.status, code: data.code, retryAfter });
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('连接超时，会自动重试；未提交内容仍保留'), { code: 'TIMEOUT' });
      if (error instanceof TypeError) throw Object.assign(new Error('网络暂不可用，请检查连接后重试'), { code: 'OFFLINE' });
      throw error;
    } finally { clearTimeout(timer); }
  }
  const api = { requestJson, retryDelay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CompanionConnection = api;
})(typeof window !== 'undefined' ? window : globalThis);
