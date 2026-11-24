// Service worker: lets the game be installed like an app and keep working with no internet.
// Strategy: always try the network first (so you get the newest version when you're online) and keep a copy;
// when you're offline, play from the saved copy. Bump CACHE when you want everyone's old copies thrown away.
const CACHE = 'glitching-tales-v1';
const APP = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
    'js/voxel.js', 'js/models3d.js', 'js/animations.js', 'js/villagers.js', 'js/kiterace.js', 'js/autoplay.js', 'js/audio.js', 'js/combat3d.js', 'js/overworld3d.js', 'js/charactercreation.js',
    'js/savegame.js', 'js/quest.js', 'js/gravitycore.js', 'js/mobile.js', 'js/main3d.js'];
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/PointerLockControls.js'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(async (c) => {
        await c.addAll(APP).catch(() => {});
        await Promise.all(LIBS.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {})));
    }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    e.respondWith(fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
        return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});
