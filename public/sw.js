/**
 * Service Worker for ICH 100L Class Board
 * Standard offline-ready installation, network pass-through, and Web Push notifications
 */

const CACHE_NAME = 'ich100l-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-192.png',
  '/logo-512.png',
  '/logo.svg',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[PWA SW] Resilient activation start. Pre-caching critical assets (including offline template)...');
      for (const url of ASSETS_TO_CACHE) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log(`[PWA SW] Cached successfully: ${url}`);
          } else {
            console.warn(`[PWA SW] Skip caching non-200 asset: ${url} (status: ${response.status})`);
          }
        } catch (err) {
          console.warn(`[PWA SW] Skip caching failed asset fetch: ${url}`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[PWA SW] Flushing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Bypass non-GET requests (e.g., POST/PUT/DELETE tracking and APIs)
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Bypass API calls, uploads, or hot-module-reload files
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/uploads/') || 
    url.pathname.includes('@vite') || 
    url.pathname.includes('node_modules') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebase')
  ) {
    return;
  }

  // Intercept standard layout & HTML navigation pages (Network-first with custom Offline fallback)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If response is valid, update our root / index.html cache dynamically
          if (response.ok && (url.pathname === '/' || url.pathname === '/index.html')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          // 1. Try to serve the cached main page
          const cachedMain = await cache.match('/') || await cache.match('/index.html');
          if (cachedMain) {
            return cachedMain;
          }
          // 2. Fall back to our dedicated offline screen
          const cachedOffline = await cache.match('/offline.html');
          if (cachedOffline) {
            return cachedOffline;
          }
          return Response.error();
        })
    );
    return;
  }

  // For static assets (JS, CSS, images, fonts, icons), implement a clean/strict Cache-First strategy
  if (
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return from cache instantly to keep app running fast and offline-ready
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  // Fallback for list of items or miscellaneous resources: Network-first, stale falls back to Cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return Response.error();
        });
      })
  );
});

// Handle real background Web Push events when the app is completely closed
self.addEventListener('push', (event) => {
  console.log('[PWA SW] Push event received:', event);

  let data = { 
    title: 'ICH 100L Alerts 🔔', 
    body: 'New live update from your Course Representative.' 
  };

  if (event.data) {
    try {
      data = event.data.json();
      console.log('[PWA SW] Parsed JSON push payload:', data);
    } catch (e) {
      // Fallback if payload is plain text
      try {
        const textPayload = event.data.text();
        if (textPayload) {
          data = { 
            title: 'ICH 100L Announcements 📢', 
            body: textPayload 
          };
        }
      } catch (err) {}
      console.log('[PWA SW] Parsed plain text push payload:', data);
    }
  }

  const baseUrl = self.location.origin || '';
  const options = {
    body: data.body || '',
    icon: baseUrl + '/logo-192.png',
    badge: baseUrl + '/logo-192.png',
    tag: data.id || `ich-alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    data: {
      url: baseUrl + '/'
    }
  };

  console.log('[PWA SW] Triggering showNotification via self.registration instance. Title:', data.title, 'Options:', options);

  const notificationPromise = self.registration.showNotification(data.title || 'ICH 100L Alerts 🔔', options)
    .then(() => {
      console.log('[PWA SW] showNotification completed successfully.');
    })
    .catch((err) => {
      console.error('[PWA SW] showNotification failed with error:', err);
    });

  // Safe App Badge Update
  let badgePromise = Promise.resolve();
  try {
    const badgingAPI = navigator || self.navigator || {};
    if (badgingAPI && typeof badgingAPI.setAppBadge === 'function') {
      const badgeCount = (data && typeof data.badgeCount === 'number') ? data.badgeCount : 1;
      badgePromise = badgingAPI.setAppBadge(badgeCount).catch(() => {});
    } else if (self.registration && typeof self.registration.setAppBadge === 'function') {
      const badgeCount = (data && typeof data.badgeCount === 'number') ? data.badgeCount : 1;
      badgePromise = self.registration.setAppBadge(badgeCount).catch(() => {});
    }
  } catch (badgeErr) {
    console.warn('[PWA SW] App badge logic skipped safely:', badgeErr);
  }

  event.waitUntil(
    Promise.all([
      notificationPromise,
      badgePromise
    ])
  );
});

// Handle lockscreen notification clicks in the background
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : self.location.origin + '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus on an existing open window tab matching the target URL
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If any client window is open, navigate it to targetUrl and focus
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise launch a standalone new window/tab instance
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
