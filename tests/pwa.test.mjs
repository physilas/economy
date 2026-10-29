import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url),workerURL='https://example.test/economy/sw.js';
const absolute=path=>new URL(path,workerURL).href;
const source=await readFile(new URL('sw.js',root),'utf8');

// Model browser Cache Storage, including atomic addAll and cloned response bodies.
function cacheStorage(){
  const entries=new Map(),requests=[],removed=[];let online=true,missing=null;
  const key=(request,ignoreSearch=false)=>{const url=new URL(typeof request==='string'?request:request.url);if(ignoreSearch)url.search='';return url.href;};
  const fetch=async request=>{
    requests.push(request);
    if(!online)throw new Error('Network offline');
    return new Response(`new bundle: ${request.url||request}`,{status:key(request)===missing?404:200});
  };
  const caches={
    keys:async()=>[...entries.keys()],
    delete:async name=>{removed.push(name);return entries.delete(name);},
    open:async name=>{
      if(!entries.has(name))entries.set(name,new Map());const cache=entries.get(name);
      return {
        addAll:async inputs=>{
          const responses=await Promise.all(inputs.map(fetch));
          if(responses.some(response=>!response.ok))throw new Error('Precache contains a failed response');
          inputs.forEach((input,index)=>cache.set(key(input),responses[index]));
        },
        match:async(input,{ignoreSearch=false}={})=>{
          const wanted=key(input,ignoreSearch),found=[...cache].find(([url])=>key(url,ignoreSearch)===wanted);
          return found?.[1].clone();
        },
      };
    },
  };
  return {caches,entries,requests,removed,fetch,setOnline:value=>{online=value;},setMissing:path=>{missing=absolute(path);}};
}

function runtime(script,storage){
  const listeners=new Map();let claims=0;
  const self={location:{href:workerURL,origin:new URL(workerURL).origin},addEventListener:(name,listener)=>listeners.set(name,listener),clients:{claim:async()=>{claims++;}},skipWaiting:()=>{}};
  const context=vm.createContext({self,caches:storage.caches,URL,Request,Response,fetch:storage.fetch});
  vm.runInContext(script,context,{filename:'sw.js'});
  const inventory=vm.runInContext('({version:VERSION,files:[...FILES]})',context);
  return {
    version:inventory.version,files:Array.from(inventory.files),claims:()=>claims,
    dispatch:async name=>{const promises=[];listeners.get(name)({waitUntil:promise=>promises.push(promise)});await Promise.all(promises);},
    fetch:async(path,mode='cors')=>{let response;listeners.get('fetch')({request:{url:absolute(path),method:'GET',mode},respondWith:promise=>{response=promise;}});return response;},
  };
}

const local=reference=>reference&&!reference.startsWith('#')&&!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference);
async function dependencies(){
  const needed=new Set(['./','./index.html']),visited=new Set();
  async function visit(path){
    const url=new URL(path,root);assert.ok(url.href.startsWith(root.href),`${path} remains in the offline project`);
    const relative='./'+url.href.slice(root.href.length);needed.add(relative);
    if(visited.has(relative))return;visited.add(relative);await access(url);
    if(!/\.(?:mjs|js|css|html|webmanifest)$/.test(url.pathname))return;
    const text=await readFile(url,'utf8'),refs=[];
    if(/\.(?:mjs|js)$/.test(url.pathname)){
      for(const match of text.matchAll(/\b(?:import|export)\s+(?:[^;'"]*?\s+from\s*)?['"]([^'"]+)['"]/g))refs.push(match[1]);
      for(const match of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g))refs.push(match[1]);
      for(const match of text.matchAll(/new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g)){
        // The browser stores its registered service worker independently of Cache Storage.
        if(new URL(match[1],url).href!==new URL('sw.js',root).href)refs.push(match[1]);
      }
    }else if(url.pathname.endsWith('.html')){
      for(const match of text.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/g))refs.push(match[1]);
    }else if(url.pathname.endsWith('.css')){
      for(const match of text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g))refs.push(match[1]||match[2]);
    }else{
      const manifest=JSON.parse(text);refs.push(manifest.start_url,...(manifest.icons||[]).map(icon=>icon.src));
    }
    for(const reference of refs.filter(local))await visit(new URL(reference,url).href.slice(root.href.length));
  }
  await visit('index.html');await visit('src/app.mjs');await visit('src/worker.mjs');
  return needed;
}

test('offline precache contains the complete transitive app, worker and presentation assets',async()=>{
  const worker=runtime(source,cacheStorage()),cached=new Set(worker.files.map(absolute));
  const needed=await dependencies();
  for(const path of needed)assert.ok(cached.has(absolute(path)),`${path} is required by the app but absent from the offline bundle`);
  // These entry points are independently necessary even if one stops importing the other.
  for(const path of ['./src/app.mjs','./src/worker.mjs','./src/engine.mjs','./src/data.mjs','./style.css','./manifest.webmanifest'])assert.ok(needed.has(path));
});

test('failed installation preserves the complete previously installed offline version',async()=>{
  const storage=cacheStorage(),oldSource=source.replace(/const VERSION\s*=\s*'[^']+';/,"const VERSION = 'null-vprevious';"),old=runtime(oldSource,storage),next=runtime(source,storage);
  const previous=new Map(old.files.map(path=>[absolute(path),new Response(`old bundle: ${absolute(path)}`)]));storage.entries.set(old.version,previous);
  storage.setMissing('./src/worker.mjs');await assert.rejects(next.dispatch('install'),/failed response/);
  assert.equal(storage.entries.get(old.version).size,new Set(old.files.map(absolute)).size);assert.equal(next.claims(),0);assert.equal(storage.removed.length,0);
  storage.setOnline(false);
  for(const path of ['./','./src/app.mjs','./src/worker.mjs'])assert.equal(await(await old.fetch(path)).text(),`old bundle: ${absolute(path)}`);
});

test('activation switches a complete bundle offline and preserves unrelated application caches',async()=>{
  const storage=cacheStorage(),worker=runtime(source,storage);
  storage.entries.set('null-vprevious',new Map());storage.entries.set('another-app-v1',new Map());
  await worker.dispatch('install');
  assert.ok(storage.requests.every(request=>request.cache==='reload'),'every file bypasses an old HTTP-cache response');
  assert.equal(storage.entries.get(worker.version).size,new Set(worker.files.map(absolute)).size);
  await worker.dispatch('activate');assert.equal(worker.claims(),1);assert.ok(!storage.entries.has('null-vprevious'));assert.ok(storage.entries.has('another-app-v1'));assert.ok(storage.entries.has(worker.version));
  storage.setOnline(false);const requests=storage.requests.length;
  for(const path of worker.files)assert.equal(await(await worker.fetch(path+'?verify=offline')).text(),`new bundle: ${absolute(path)}`);
  assert.equal(await(await worker.fetch('./unvisited-screen','navigate')).text(),`new bundle: ${absolute('./index.html')}`);
  assert.equal(storage.requests.length,requests,'offline cached files never require a network request');
});
