/* 齿轮无双 - Service Worker：离线可玩（需 https 或 localhost 环境生效）
   策略：页面导航「网络优先」（更新立刻生效、断网回退缓存）；静态资源「缓存优先 + 后台更新」 */
'use strict';
const CACHE = 'gear-musou-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  /* 打开页面 / 刷新：先要网络（拿到最新版本），断网再用缓存 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }
  /* 其他静态资源：缓存优先 + 后台更新（离线时直接回退缓存） */
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req)
        .then(res => {
          if (res && res.ok && req.url.indexOf('chrome-extension') < 0) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
