import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,advance} from '../src/engine.mjs';
test('one-second cadence preserves hourly collection and wage rates',()=>{
  const s=createGame('Cadence',0,42);build(s,'lumber');const initial=s.cash;
  advance(s,1000);assert.ok(Math.abs(s.inventory.wood-15-8/60)<1e-8);assert.ok(Math.abs(initial-s.cash-9/60)<1e-8);
  advance(s,60000);assert.ok(Math.abs(s.inventory.wood-23)<1e-8);assert.ok(Math.abs(initial-s.cash-9)<1e-8);
});
