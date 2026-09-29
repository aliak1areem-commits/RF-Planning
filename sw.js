/* =========================================================
   RF Planning — Service Worker v4
   ========================================================= */
const VERSION = 'v4.0.0';
const STATIC_CACHE = 'rf-static-' + VERSION;
const TILE_CACHE = 'rf-tiles-' + VERSION;

// ✅ ملفات ثابتة — فقط ملفات تعمل دائماً (بدون Google Fonts)
const STATIC_FILES = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css',
  'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ============ INSTALL ============
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return Promise.all(
        STATIC_FILES.map(url =>
          cache.add(url).catch(err => console.warn('⚠️ Skipped:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== TILE_CACHE)
            .map(k => {
              console.log('🗑️ حذف cache قديم:', k);
              return caches.delete(k);
            })
      )
    ).then(() => self.clients.claim())
  );
});

// ============ FETCH ============
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const method = event.request.method;

  // تجاهل غير GET
  if (method !== 'GET') return;

  // ═══ 0. طلبات خارجية حساسة → تمرير مباشر بدون cache ═══
  // ✅ هذا يحل مشكلة "Failed to fetch" مع Google Fonts و Supabase
  if (url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('supabase.co') ||
      url.includes('nominatim.openstreetmap.org')) {
    return; // مرّر للشبكة مباشرة
  }

  // ═══ 1. HTML → Network First ═══
  if (url.includes('index.html') ||
      url.endsWith('/') ||
      url.includes('RF-Planning')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone)).catch(() => {});
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached =>
            cached || caches.match('./index.html')
          );
        })
    );
    return;
  }

  // ═══ 2. Tiles الخريطة → Cache First ═══
  if (url.includes('tile.openstreetmap') ||
      url.includes('arcgisonline') ||
      url.includes('opentopomap') ||
      url.includes('cartocdn')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone()).catch(() => {});
            return response;
          }).catch(() => new Response('', { status: 408 }));
        })
      )
    );
    return;
  }

  // ═══ 3. الباقي (CDN) → Cache First مع fallback آمن ═══
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok && response.status === 200) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone)).catch(() => {});
        }
        return response;
      }).catch(err => {
        // ✅ لا تنكسر — أرجع رد افتراضي بدل رمي الخطأ
        console.warn('⚠️ Fetch failed:', url);
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// ============ MESSAGE ============
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
