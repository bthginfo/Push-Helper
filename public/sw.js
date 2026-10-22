const CACHE = 'push-companion-v4';
const SHELL = ['/venue-map.jpg', '/manifest.webmanifest', '/icon.svg', '/theme-init.js', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) throw new Error('The app shell could not be cached.');
    const html = await response.clone().text();
    const assets = Array.from(html.matchAll(/(?:src|href)=["']([^"']+)["']/g), match => new URL(match[1], self.location.origin)).filter(url => url.origin === self.location.origin && !url.search && /\.(?:js|css|svg|png|jpg|webmanifest|woff2?)$/.test(url.pathname)).map(url => url.pathname);
    await cache.put('/', response);
    await cache.addAll([...new Set([...SHELL, ...assets])]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.search || request.headers.has('authorization')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { if (response.ok) { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put('/', copy)); } return response; }).catch(() => caches.match('/').then(response => response || Response.error())));
    return;
  }
  if (!/\.(?:js|css|svg|png|jpg|webmanifest|woff2?)$/.test(url.pathname)) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok && response.type === 'basic') { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; })));
});
