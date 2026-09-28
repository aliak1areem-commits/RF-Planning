const VERSION = 'v1.0.0';
const APP_CACHE = 'app-shell-' + VERSION;
const TILE_CACHE = 'map-tiles-' + VERSION;

const APP_SHELL = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet.tilelayer.pouchdbcached@1.0.0/L.TileLayer.PouchDBCached.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== APP_CACHE && k !== TILE_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  if (url.includes('tile.openstreetmap') || url.includes('arcgisonline') || url.includes('cartocdn') || url.includes('opentopomap')) {
    e.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res; })
            .catch(() => new Response('', { status: 408 }))
        )
      )
    );
    return;
  }

  if (APP_SHELL.some(s => url.includes(s.replace(/^\.\//, '')))) {
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
    return;
  }

  if (url.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
});
