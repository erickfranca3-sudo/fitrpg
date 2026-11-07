const CACHE_NAME = 'fitrpg-v3';
const CODE = ['index.html', 'style.css', 'app.js', 'app2.js', 'manifest.json'];
const IMAGES = [
  'assets/icon-192.png', 'assets/icon-512.png',
  'assets/av1.png', 'assets/av2.png', 'assets/av3.png', 'assets/av4.png', 'assets/av5.png',
  'assets/av6.png', 'assets/av7.png', 'assets/av8.png', 'assets/av9.png', 'assets/av10.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(['./'].concat(CODE, IMAGES).map(a => cache.add(a).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const putCache = (req, res) => {
  if (res && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => { });
  }
  return res;
};

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;               // CDN (Tesseract) etc.: deixa passar
  const path = url.pathname;
  const isCode = req.mode === 'navigate' || path.endsWith('/') || CODE.some(f => path.endsWith('/' + f));
  const isImage = path.includes('/assets/');

  if (isCode) {                                                   // Network-First → fallback Cache
    event.respondWith(
      fetch(url.href, { cache: 'no-cache' }).then(res => putCache(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(c => c || caches.match('./index.html') || caches.match('./')))
    );
  } else if (isImage) {                                           // Cache-First
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => putCache(req, res)))
    );
  }
});