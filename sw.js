/* Date Night service worker: app shell cache-first, Carto tiles network-first with an offline fallback. */
const VERSION = 'dn-7529a99a29';
const TILES = 'dn-tiles';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname.endsWith('basemaps.cartocdn.com')) { e.respondWith(tileFetch(e.request)); return; }
  if (u.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
      return res;
    })));
    return;
  }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(fetch(e.request).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return res; })
      .catch(() => caches.match(e.request)));
  }
});

async function tileFetch(req) {
  const c = await caches.open(TILES);
  try {
    const res = await fetch(req);
    if (res.ok) { c.put(req, res.clone()); trimTiles(c); }
    return res;
  } catch (err) {
    const hit = await c.match(req);
    return hit || Response.error();
  }
}
let trimming = false;
async function trimTiles(c) {
  if (trimming) return; trimming = true;
  try { const keys = await c.keys(); if (keys.length > 320) for (const k of keys.slice(0, keys.length - 300)) await c.delete(k); }
  finally { trimming = false; }
}
