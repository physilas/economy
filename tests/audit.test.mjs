import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.mjs';
import {BUILDINGS,INFRA,RESOURCES,DAY} from '../src/data.mjs';
import {encode,decode} from '../src/storage.mjs';

function guardBoundary(){
  const s=E.createGame('Guard boundary',0,42);E.build(s,'lumber');s.profitGuard=true;
  s.market.wood.factor=.45;
  s.market.wood.pressure=Math.log(9/(8*6*.45*(1-E.feeRate(s)-.008)))+.002;
  s.automation.wood={mode:'sell',low:0,high:0};return s;
}
test('margin guard checks the same post-trade prices in bulk and one-second simulation',()=>{
  const bulk=guardBoundary(),seconds=structuredClone(bulk);
  E.advance(bulk,5000);for(let second=1;second<=5;second++)E.advance(seconds,second*1000);
  assert.deepEqual(bulk,seconds);
  assert.equal(bulk.stats.produced,0,'The initial sale makes the production unprofitable before the first output.');
});

test('a complex guarded economy stays deterministic across irregular catch-up chunks',()=>{
  const bulk=E.createGame('Guarded catch-up',0,42);bulk.tier=11;bulk.cash=1e12;
  for(const id of Object.keys(INFRA))assert.ok(E.build(bulk,id,3,true).ok);
  for(const id of Object.keys(BUILDINGS))assert.ok(E.build(bulk,id).ok);
  for(const id of Object.keys(RESOURCES))bulk.automation[id]={mode:'both',low:100,high:300};
  bulk.profitGuard=true;const chunks=structuredClone(bulk),end=3*DAY;
  E.advance(bulk,end*1000);
  for(let second=0;second<end;second+=13)E.advance(chunks,Math.min(end,second+13)*1000);
  assert.deepEqual(bulk,chunks);
});

test('interest, share positions, book values and financial statistics survive large endgame saves',()=>{
  const s=E.createGame('Large endgame',0,42);s.tier=11;s.cash=1e20;
  assert.ok(E.build(s,'lumber',100).ok);assert.ok(E.build(s,'lumber',100).ok);assert.ok(E.build(s,'lumber',50).ok);
  assert.ok(s.buildings.lumber.book>1e15);s.buildings.lumber.active=0;
  s.banks.savings=1e15;s.stocks.sylva.quantity=1e10;
  assert.ok(E.stockTrade(s,'sylva',1,'buy').ok);assert.equal(s.stocks.sylva.quantity,1e10+1);
  E.advance(s,DAY*1000);assert.ok(s.banks.savings>1e15);assert.ok(s.stats.peak>1e15);assert.ok(s.campaign.peak>1e15);
  const restored=decode(encode(s),s.lastUpdate).game;
  assert.deepEqual(restored,s);
  assert.equal(E.assets(restored).total,E.assets(s).total);
});

test('existing fixed and ordinary bonds keep their terms through save validation',()=>{
  const s=E.createGame('Bonds',0,42);s.tier=3;s.cash=1e6;
  assert.ok(E.fixedDeposit(s,1000,60).ok);assert.ok(E.investBond(s,'corporate',5000).ok);
  assert.deepEqual(E.validateGame(s,0).bonds,s.bonds);
  const previousShape=structuredClone(s);previousShape.bonds[1].days=20;
  assert.deepEqual(E.validateGame(previousShape,0).bonds,previousShape.bonds);
});

test('extreme imported amounts stay bounded and forged bond maturities cannot overflow',()=>{
  const raw=E.createGame('Untrusted extremes',0,42);
  raw.cash=1e308;raw.banks.reserve=1e308;raw.stats.peak=1e308;
  raw.stats.history=[{at:0,wealth:1e308,profit:-1e308}];
  raw.elapsed=60*DAY;
  raw.bonds=[{id:99,type:'fixed',principal:1e308,start:0,end:1e308,rate:.01,days:60}];
  const s=E.validateGame(raw,0);
  assert.equal(s.cash,1e100);assert.equal(s.banks.reserve,1e100);assert.equal(s.stats.peak,1e100);
  assert.equal(s.stats.history[0].wealth,1e100);assert.equal(s.stats.history[0].profit,-1e100);
  assert.equal(s.bonds[0].end,60*DAY);
  E.advance(s,1000);assert.equal(s.bonds.length,0);
  for(const n of [s.cash,s.banks.reserve,s.stats.interest,s.stats.taxes,E.assets(s).total])assert.ok(Number.isFinite(n));
});
