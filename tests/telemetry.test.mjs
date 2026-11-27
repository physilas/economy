import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,buildingRate,capacity,advance} from '../src/engine.mjs';
import {ACHIEVEMENTS} from '../src/data.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
function game(){const s=createGame('Telemetry',0,42);s.tier=3;s.cash=1e9;s.achievements=ACHIEVEMENTS.map(a=>a.id);return s;}

test('utilization applies the strongest constraint instead of multiplying independent shortages',()=>{
  const s=game();build(s,'lumber',8);build(s,'sawmill',2);s.priority='advanced';s.inventory.wood=2/15;
  const rate=buildingRate(s,'sawmill');near(rate.global,.5);near(rate.supply,.5);near(rate.utilization,.5);
  advance(s,500);near(s.inventory.planks,2*8/120*rate.utilization);
});

test('cash-limited utilization agrees with actual production',()=>{
  const s=game();build(s,'lumber');s.inventory.wood=0;s.cash=.0375;
  const rate=buildingRate(s,'lumber');near(rate.cash,.5);near(rate.utilization,.5);
  advance(s,500);near(s.inventory.wood,8/120*rate.utilization);
});

test('nearly full warehouses report the actual remaining production fraction',()=>{
  const s=game();build(s,'lumber');s.inventory.wood=499.99;
  const rate=buildingRate(s,'lumber');near(rate.storage,.15);
  advance(s,500);near(s.inventory.wood-499.99,8/120*rate.utilization);
});

test('grid energy replaces the removed fuel commodity and charges operating costs',()=>{
  const s=game();build(s,'sawmill',10);build(s,'housing',3,true);build(s,'transport',1,true);build(s,'power',1,true);s.inventory.wood=100;
  near(capacity(s).availableEnergy,31);near(capacity(s).power,1);
  const before=s.stats.expenses,rate=buildingRate(s,'sawmill');advance(s,500);
  near(s.inventory.planks,10*8/120*rate.utilization);assert.ok(s.stats.expenses-before>10*22/120);assert.ok(!Object.hasOwn(s.inventory,'coal'));
});
