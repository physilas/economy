import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,buildingRate,capacity,advance} from '../src/engine.mjs';
import {ACHIEVEMENTS} from '../src/data.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);
function game(){const s=createGame('Telemetry',0,42);s.tier=6;s.cash=1e9;s.achievements=ACHIEVEMENTS.map(a=>a.id);return s;}

test('utilization applies the strongest constraint instead of multiplying independent shortages',()=>{
  const s=game();build(s,'lumber',8);build(s,'sawmill',2);s.priority='advanced';s.inventory.wood=1/6;
  const rate=buildingRate(s,'sawmill');near(rate.global,.5);near(rate.supply,.5);near(rate.utilization,.5);
  advance(s,1000);near(s.inventory.planks,2*6/60*rate.utilization);
});

test('cash-limited utilization agrees with actual production',()=>{
  const s=game();build(s,'lumber');s.inventory.wood=0;s.cash=.075;
  const rate=buildingRate(s,'lumber');near(rate.cash,.5);near(rate.utilization,.5);
  advance(s,1000);near(s.inventory.wood,8/60*rate.utilization);
});

test('nearly full warehouses report the actual remaining production fraction',()=>{
  const s=game();build(s,'lumber');s.inventory.wood=499.99;
  const rate=buildingRate(s,'lumber');near(rate.storage,.075);
  advance(s,1000);near(s.inventory.wood-499.99,8/60*rate.utilization);
});

test('a small coal reserve supplies only its actual energy contribution',()=>{
  const s=game();build(s,'weaver',5);build(s,'housing',2,true);build(s,'power',1,true);
  s.inventory.cotton=100;s.inventory.coal=.002;
  near(capacity(s).availableEnergy,6.75);near(capacity(s).power,.675);
  const rate=buildingRate(s,'weaver');near(rate.utilization,.675);
  advance(s,1000);near(s.inventory.fabric,5*10/60*rate.utilization);near(s.inventory.coal,0);
});
