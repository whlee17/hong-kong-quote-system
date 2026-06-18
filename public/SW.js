// Service Worker for 香港裝修傢俬報價系統 - 離線版本
const CACHE_NAME = 'quote-system-v1';
const STATIC_CACHE_NAME = 'quote-static-v1';

// 需要緩存的靜態資源
const STATIC_ASSETS = [
  './',
  './index.html',
  './assets/index.css',
  './assets/index.js',
  './assets/vendor.js',
  './base.js'
];

// 安裝事件 - 緩存靜態資源
self.addEventListener('install', (event) => {
  console.log('[SW] 安裝 Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 緩存靜態資源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] 安裝完成');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] 安裝失敗:', error);
      })
  );
});

// 激活事件 - 清理舊緩存
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活 Service Worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
            .map((name) => {
              console.log('[SW] 刪除舊緩存:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] 激活完成');
        return self.clients.claim();
      })
  );
});

// 請求攔截 - 緩存優先策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只處理同源請求
  if (url.origin !== location.origin) {
    return;
  }

  // 靜態資源 - 緩存優先
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 其他請求 - 網絡優先，失敗時使用緩存
  event.respondWith(networkFirst(request));
});

// 判斷是否為靜態資源
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname) ||
         pathname === '/' ||
         pathname === '/index.html';
}

// 緩存優先策略
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] 網絡請求失敗:', error);
    // 返回離線頁面或默認響應
    return new Response('離線模式 - 資源不可用', { status: 503 });
  }
}

// 網絡優先策略
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] 網絡不可用，使用緩存');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('離線模式', { status: 503 });
  }
}

// 消息處理 - 用於手動更新緩存
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});

console.log('[SW] Service Worker 載入完成');