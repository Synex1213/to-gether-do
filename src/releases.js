'use strict';
const FALLBACK = Object.freeze({ version:'2.2.0', size:122894298, url:'https://github.com/Synex1213/to-gether-do/releases/download/v2.2.0/couple-connect-setup-2.2.0.exe', page:'https://github.com/Synex1213/to-gether-do/releases/latest' });
function createReleaseResolver(fetchRelease = global.fetch, now = Date.now) {
  let cached, validUntil = 0, pending;
  return async function latestRelease() {
    if (cached && now() < validUntil) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetchRelease('https://api.github.com/repos/Synex1213/to-gether-do/releases/latest', { headers:{ Accept:'application/vnd.github+json', 'User-Agent':'TogetherDo-website' }, signal:AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Release unavailable');
        const release = await response.json();
        const version = String(release.tag_name || '').replace(/^v/,'');
        const parts = version.split('.').map(Number), floor = FALLBACK.version.split('.').map(Number);
        let older = false;
        for(let i=0;i<3;i++) { if(parts[i] < floor[i]) { older = true; break; } if(parts[i] > floor[i]) break; }
        if(older) throw new Error('Stale release');
        const asset = release.assets?.find(a => a.name === `couple-connect-setup-${version}.exe`);
        const expected = `https://github.com/Synex1213/to-gether-do/releases/download/v${version}/couple-connect-setup-${version}.exe`;
        if (release.draft || release.prerelease || !/^\d+\.\d+\.\d+$/.test(version) || asset?.browser_download_url !== expected || !(asset.size > 0)) throw new Error('Invalid release');
        cached = { version, size:asset.size, url:expected, page:FALLBACK.page };
        validUntil = now() + 2 * 60000;
      } catch (_) { cached = cached || FALLBACK; validUntil = now() + 60000; }
      return cached;
    })().finally(() => { pending = null; });
    return pending;
  };
}
module.exports = { createReleaseResolver, FALLBACK };
