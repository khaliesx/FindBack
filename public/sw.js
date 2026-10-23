const CACHE='findback-phone-v18';
const ASSETS=['./','./index.html','./styles.css','./mobile.css','./app.js','./data.js','./ai.js','./pwa.js','./vendor/qrcode.js','./vendor/jsQR.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable.png','./icons/apple-touch-icon.png','./images/items/black-bottle.webp','./images/items/green-fob-keys.jpg','./images/items/brown-wallet.webp','./images/items/black-earbuds.jpg','./images/items/black-headphones.jpg','./images/items/football.jpg','./images/items/basketball.webp'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(a=>new Request(a,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('findback-phone-')&&key!==CACHE)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(!ASSETS.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request,{ignoreSearch:true});
    return cached||fetch(event.request);
  })());
});
