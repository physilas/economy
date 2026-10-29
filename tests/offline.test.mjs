import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build} from '../src/engine.mjs';
import {OFFLINE_LIMIT} from '../src/data.mjs';
import {advanceOffline,advanceOfflineBatched} from '../src/offline.mjs';
import {loadCurrent,save} from '../src/storage.mjs';
function producer(){const s=createGame('Offline',0,42);build(s,'lumber');s.research.patience=3;return s;}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≈ ${b}`);

test('short offline returns apply researched production bonuses too',()=>{
  const s=producer(),before=s.inventory.wood;advanceOffline(s,30000);
  near(s.inventory.wood-before,8*.5*1.3);
});

test('offline economy is identical across the two-minute worker threshold',()=>{
  const full=producer(),split=structuredClone(full);advanceOffline(full,120000);
  advanceOffline(split,119000);advanceOffline(split,120000);
  assert.deepEqual(split,full);
});

test('cooperative catchup preserves state, totals and fractions across hour batches',async()=>{
  const full=producer(),batch=structuredClone(full),progress=[];full.automation.wood={mode:'sell',low:20,high:30};batch.automation.wood={mode:'sell',low:20,high:30};
  const expected=advanceOffline(full,7500500),actual=await advanceOfflineBatched(batch,7500500,{onProgress:p=>progress.push(p),yieldControl:async()=>{}});
  assert.deepEqual(batch,full);for(const key of Object.keys(expected))near(actual.result[key],expected[key]);assert.ok(progress.length>=3);assert.ok(progress.every(p=>p>=0&&p<=1));
});

test('offline cap consumes excess wall time exactly once, including fractional time',async()=>{
  const full=createGame('Cap',500,42),batch=structuredClone(full),now=500+(OFFLINE_LIMIT+31)*1000+750;
  const expected=advanceOffline(full,now),actual=await advanceOfflineBatched(batch,now,{yieldControl:async()=>{}});
  assert.deepEqual(batch,full);for(const key of Object.keys(expected))near(actual.result[key],expected[key]);
  const second=advanceOffline(batch,now);assert.equal(second.seconds,0);assert.equal(second.skipped,0);
});

test('backward clock correction has the same behavior in every catchup path',async()=>{
  const full=createGame('Clock',10000,42),batch=structuredClone(full);
  const a=advanceOffline(full,5000),b=await advanceOfflineBatched(batch,5000);
  assert.deepEqual(a,b.result);assert.deepEqual(full,batch);assert.equal(full.lastUpdate,5000);assert.equal(full.elapsed,0);
});

test('continuing uses newer actions even when simulation timestamps are equal',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  const old=createGame('Before',0,42),current=structuredClone(old);current.name='After';build(current,'lumber');current.automation.wood.mode='sell';
  assert.equal(current.lastUpdate,old.lastUpdate);save(current,'auto',storage);
  const loaded=loadCurrent(old,storage,0);assert.equal(loaded.name,'After');assert.equal(loaded.buildings.lumber.count,1);assert.equal(loaded.automation.wood.mode,'sell');assert.equal(old.name,'Before');
});

test('continuing without an autosave preserves the supplied company',()=>{
  const s=producer();assert.equal(loadCurrent(s,{getItem:()=>null},0),s);
});

test('invalid wall-clock values leave state unchanged in both offline paths',async()=>{
  for(const now of [NaN,Infinity,-Infinity]){
    const s=producer(),before=structuredClone(s),result=await advanceOfflineBatched(s,now);
    assert.deepEqual(result.result,{seconds:0,skipped:0,steps:0});assert.deepEqual(s,before);
  }
});
