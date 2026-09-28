/* =========================================================
   RF Planning — Service Worker v3
   ========================================================= */
const VERSION = 'v3.0.0';
const STATIC_CACHE = 'rf-static-' + VERSION;
const TILE_CACHE = 'rf-tiles-' + VERSION;

// ملفات ثابتة (تُحفظ مرة واحدة)
const STATIC_FILES = [
  './',
  './index.html',
  './sw.js',
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
          cache.add(url).catch(err => console.warn('Failed:', url, err))
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

  // ═══ 1. HTML → Network First (يجيب الجديد دائماً) ═══
  if (url.includes('index.html') || 
      url.endsWith('/') || 
      url.includes('RF-Planning')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // حدّث الـ cache
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // لا يوجد إنترنت → ارجع من cache
          return caches.match(event.request).then(cached => 
            cached || caches.match('./index.html')
          );
        })
    );
    return;
  }

  // ═══ 2. Tiles الخريطة → Cache First (سريع جداً) ═══
  if (url.includes('tile.openstreetmap') || 
      url.includes('arcgisonline') || 
      url.includes('opentopomap') ||
      url.includes('cartocdn')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache => 
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => new Response('', { status: 408 }));
        })
      )
    );
    return;
  }

  // ═══ 3. Supabase → Network First (البيانات لازم حديثة) ═══
  if (url.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // ═══ 4. الباقي (CDN, Fonts) → Cache First ═══
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && (url.includes('unpkg.com') || url.includes('cdn') || url.includes('fonts'))) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ============ MESSAGE (لتحديث فوري) ============
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
