// Custom service worker for Game 256
const CACHE_NAME = 'game256-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/App.css',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// Handle background sync for game state
self.addEventListener('sync', (event) => {
  if (event.tag === 'game-sync') {
    event.waitUntil(syncGameData());
  }
});

async function syncGameData() {
  // Sync game state when online
  console.log('Syncing game data...');
}