import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createGame, advance, build, assets } from '../src/engine.mjs';
import { RESOURCES, BUILDINGS, INFRA, RESEARCH, TIERS, STOCKS, RELEASE } from '../src/data.mjs';
import * as V from '../src/views.mjs';

const ui={qty:1,amount:100,fixedDays:20,open:new Set(),productionTab:'business',buildFilter:'all',marketFilter:'all',financeTab:'bank'};

test('starting screens reveal no future resources or production chains',()=>{
  const s=createGame('Test',0,42);
  const production=V.production(s,ui),market=V.market(s,ui),dashboard=V.overview(s,ui);
  for(const d of Object.values(BUILDINGS).filter(d=>d.tier>0))assert.ok(!production.includes(d.name),`${d.name} hidden`);
  for(const d of Object.values(RESOURCES).filter(d=>d.tier>0))assert.ok(!market.includes(d.name),`${d.name} hidden`);
  assert.ok(!dashboard.includes(TIERS[1].name));
  assert.ok(!V.frame(s,ui,'').includes('Finanzen'));
});

test('each tier reveals only discovered production and research',()=>{
  for(let tier=1;tier<7;tier++){
    const s=createGame('Test',0,42);s.tier=tier;
    const production=V.production(s,ui),research=V.researchView(s,ui);
    for(const [id,b] of Object.entries(BUILDINGS))assert.equal(production.includes(`data-id="building:${id}"`),b.tier<=tier,`${b.name} tier ${tier}`);
    for(const [id,r] of Object.entries(RESEARCH))assert.equal(research.includes(`data-id="research:${id}"`),r.tier<=tier,`${r.name} tier ${tier}`);
  }
});

test('all recipes use known resources available no later than their own tier',()=>{
  for(const b of Object.values(BUILDINGS))for(const id of [...Object.keys(b.input),...Object.keys(b.output),...Object.keys(b.materials||{})]){
    assert.ok(RESOURCES[id],`known ${id}`);assert.ok(RESOURCES[id].tier<=b.tier,`${b.name}: ${id} must be unlocked`);
  }
  for(const id of Object.keys(RESOURCES))assert.ok(Object.values(BUILDINGS).some(b=>b.output[id]),`${id} is producible`);
  for(const p of Object.values(STOCKS))assert.ok(['raw','industry','food','consumer','tech','all'].includes(p.sector));
});

test('a plausible starter setup reaches its first discovery within five real minutes',()=>{
  const s=createGame('Test',0,42);build(s,'lumber',2);build(s,'quarry');
  s.automation.wood={mode:'sell',low:0,high:20};s.automation.stone={mode:'sell',low:0,high:20};
  advance(s,300000);
  assert.ok(assets(s).total>=2000);assert.ok(s.tier>=1);assert.ok(s.cash>0);
});

test('user-supplied names are escaped throughout generated markup',()=>{
  const s=createGame('<img src=x onerror=alert(1)>',0,42);
  for(const html of [V.menu(s,ui),V.frame(s,ui,''),V.overview(s,ui),V.more(s)]){
    assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));
  }
});

test('recipe cards scale inputs and outputs with the same production bonuses',()=>{
  const s=createGame('Recipes',0,42);s.tier=2;s.research.efficiency=1;s.buildings.sawmill.level=1;
  const html=V.production(s,ui),start=html.indexOf('<h3>Sägewerk'),end=html.indexOf('</article>',start),card=html.slice(start,end);
  assert.ok(card.includes('12,7 Holz'));assert.ok(card.includes('7,6 Bretter'));
});

test('every precached PWA file exists and manifest uses relative paths',async()=>{
  const worker=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  const paths=worker.match(/const FILES = \[(.*?)\];/s)[1].match(/'[^']+'/g).map(p=>p.slice(1,-1));
  for(const path of paths)await access(new URL('../'+(path==='./'?'index.html':path),import.meta.url));
  const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
  for(const entry of manifest.icons)await access(new URL('../'+entry.src,import.meta.url));
  const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(index.includes('viewport-fit=cover'));assert.ok(index.includes('apple-mobile-web-app-capable'));
  assert.ok(worker.includes('null-v'+RELEASE));
  assert.equal(JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version,RELEASE);
});
