/**
 * AllTrip Service Worker
 * - Next.js 번들 (/_next/): SW 미개입 (항상 네트워크)
 * - API 호출: Network First (오프라인 시 캐시 fallback)
 * - 기타 정적 자산: Cache First
 */

const CACHE_NAME = 'alltrip-v2';
const STATIC_ASSETS = [
  '/manifest.json',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Next.js 빌드 파일 — SW 미개입 (서버 재시작 시 번들 변경 대응)
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // API 요청: Network First → Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // 성공 응답은 캐시에 저장
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 정적 자산: Cache First
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
