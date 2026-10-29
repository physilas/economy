/* All paths are relative to this worker, including on GitHub project Pages. */
const VERSION = 'null-v2.1.2';
const FILES = ['./','./index.html','./style.css','./manifest.webmanifest','./src/app.mjs','./src/views.mjs','./src/icons.mjs','./src/data.mjs','./src/engine.mjs','./src/storage.mjs','./src/worker.mjs','./src/math.mjs','./src/help.mjs','./src/planning.mjs','./src/campaign.mjs','./src/ui-state.mjs','./src/offline.mjs','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
const absolute = path => new URL(path,self.location.href).href;

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(FILES.map(path=>new Request(absolute(path),{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys())if(name.startsWith('null-v')&&name!==VERSION)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(new URL('./',self.location.href).href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    // Versioned app files travel together. Never mix fresh HTML with old modules.
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached)return cached;
    if(request.mode==='navigate')return (await cache.match(absolute('./index.html')))||Response.error();
    return fetch(request);
  })());
});
