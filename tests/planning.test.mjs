import test from 'node:test';
import assert from 'node:assert/strict';
import {previewBuilding} from '../src/planning.mjs';
import {createGame,build,buildQuote,capacity,productionBonus} from '../src/engine.mjs';
import {BUILDINGS,ACHIEVEMENTS,INFRA,TIERS} from '../src/data.mjs';
import * as V from '../src/views.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
function game(){const s=createGame('Planning',0,42);s.cash=1e8;s.tier=TIERS.length-1;s.achievements=ACHIEVEMENTS.map(a=>a.id);return s;}

test('previews do not alter game state, random seed, achievements or time',()=>{
  const s=game(),before=JSON.stringify(s);
  for(const id of Object.keys(BUILDINGS))for(const count of [1,10,100])assert.ok(previewBuilding(s,id,count));
  assert.equal(JSON.stringify(s),before);
});

test('locked recipes and invalid preview quantities are rejected',()=>{
  const s=createGame('Start',0,42);
  assert.equal(previewBuilding(s,'sawmill'),null);assert.equal(previewBuilding(s,'unknown'),null);
  for(const count of [0,-1,101,1.5,NaN,Infinity])assert.equal(previewBuilding(s,'lumber',count),null);
  const plan=previewBuilding(s,'lumber',100);
  for(const deficit of plan.deficits)for(const option of deficit.options)assert.ok(INFRA[option.id].tier<=s.tier);
});

test('raw facility preview reports quoted cost, wages and fee-adjusted market margin',()=>{
  const s=createGame('Start',0,42),p=previewBuilding(s,'lumber');
  near(p.cost,320);near(p.wages,9);near(p.outputs[0].quantity,8);assert.equal(p.inputs.length,0);
  assert.ok(p.fullMargin>0&&p.fullMargin<39);assert.equal(p.affordable,true);near(p.cashAfter,880);
  near(p.paybackSeconds,p.cost/p.capacityMargin*60);
});

test('preview inputs, outputs and supplier counts include production upgrades',()=>{
  const s=game();s.research.efficiency=2;s.buildings.sawmill.level=1;
  const p=previewBuilding(s,'sawmill',3),multiplier=productionBonus(s,'sawmill');
  near(p.inputs[0].quantity,30*multiplier);near(p.outputs[0].quantity,18*multiplier);
  const wood=p.supplies.find(r=>r.id==='wood');near(wood.gap,30*multiplier);
  assert.equal(wood.producer,'lumber');assert.equal(wood.additionalProducers,5);
});

test('planning warns when new facilities reduce existing productivity',()=>{
  const s=game();build(s,'lumber',5);
  const p=previewBuilding(s,'lumber',5);near(p.utilizationBefore,1);near(p.utilizationAfter,.6);assert.ok(p.affectsExisting);
  const staff=p.deficits.find(d=>d.metric==='staff');near(staff.shortage,8);assert.equal(staff.options[0].quantity,1);
});

test('existing and additional shortages are clearly distinguished',()=>{
  const s=game();build(s,'weaver',5);
  const p=previewBuilding(s,'lumber');
  assert.equal(p.deficits.find(d=>d.metric==='energy').additionalShortage,0);
  assert.equal(p.deficits.find(d=>d.metric==='staff').additionalShortage,2);
});

test('small capacity changes are not described as a decrease between identical rounded values',()=>{
  const s=game();s.buildings.lumber={count:9000,active:9000,level:0,book:1000};
  const html=V.buildingPreview(previewBuilding(s,'lumber'));
  assert.ok(html.includes('sinkt geringfügig'));
});

test('energy alternatives and transport units respect existing research and event bonuses',()=>{
  const s=game();s.research.energy=2;s.research.logistics=1;
  const p=previewBuilding(s,'aerospace',1),energy=p.deficits.find(d=>d.metric==='energy');
  assert.equal(energy.options.find(o=>o.id==='power').quantity,3);
  assert.equal(energy.options.find(o=>o.id==='solar').quantity,3);
  assert.equal(p.deficits.find(d=>d.metric==='freight').options[0].quantity,1);
  for(const deficit of p.deficits)for(const option of deficit.options)near(option.cost,buildQuote(s,option.id,option.quantity,true).total);
});

test('recommended capacity additions actually remove the projected structural shortages',()=>{
  const s=game();s.research.automation=3;s.research.logistics=2;s.research.energy=2;
  s.event={name:'Transport scenario',freight:.75,solar:1.3};
  const plan=previewBuilding(s,'aerospace');
  for(const deficit of plan.deficits){const option=deficit.options.find(o=>o.id==='solar')||deficit.options[0];assert.ok(build(s,option.id,option.quantity,true).ok);}
  assert.ok(build(s,'aerospace').ok);const c=capacity(s);
  assert.ok(c.workers>=c.staff);assert.ok(c.potentialEnergy>=c.energy);assert.ok(c.transport>=c.freight);
});

test('construction materials are removed from hypothetical reserves without mutating real inventory',()=>{
  const s=game();s.inventory.wood=30;s.inventory.stone=25;
  const p=previewBuilding(s,'coalMine');
  assert.equal(p.materials.find(r=>r.id==='wood').fromStock,25);assert.equal(p.materials.find(r=>r.id==='wood').purchased,0);
  assert.equal(s.inventory.wood,30);assert.equal(s.inventory.stone,25);
});

test('supplier demand accounts for existing production instead of duplicating the whole chain',()=>{
  const s=game();build(s,'lumber',2);
  const p=previewBuilding(s,'sawmill'),wood=p.supplies.find(r=>r.id==='wood');
  assert.equal(wood.gap,0);assert.equal(wood.additionalProducers,0);assert.equal(wood.coverageHours,null);
});

test('unaffordable and loss-making projects remain inspectable without a fictitious payback',()=>{
  const s=game();s.cash=1;s.market.wood.factor=.45;s.market.wood.pressure=-1.5;s.profitGuard=true;
  const p=previewBuilding(s,'lumber');assert.equal(p.affordable,false);assert.ok(p.missingCash>0);assert.ok(p.guarded);
  assert.equal(p.paybackSeconds,null);assert.equal(p.capacityMargin,0);assert.ok(p.fullMargin<0);
});

test('extreme saved construction counts produce a safe unavailable quote',()=>{
  const s=game();s.buildings.lumber.count=10000;
  const p=previewBuilding(s,'lumber');assert.equal(p.cost,null);assert.equal(p.affordable,false);assert.equal(p.withinLimit,false);
  const serialized=JSON.stringify(p);assert.ok(!serialized.includes('NaN'));
});

test('preview UI exposes no future factories or infrastructure at the start',()=>{
  const s=createGame('Start',0,42),html=V.buildingPreview(previewBuilding(s,'lumber',100));
  for(const d of Object.values(BUILDINGS).filter(d=>d.tier>0))assert.ok(!html.includes(d.name));
  for(const d of Object.values(INFRA).filter(d=>d.tier>0))assert.ok(!html.includes(d.name));
  assert.ok(html.includes('Es fehlen'));assert.ok(html.includes('data-action="previewQuantity"'));
});

test('building cards offer previews even for projects that cannot yet be financed',()=>{
  const s=createGame('Start',0,42),ui={qty:100,productionTab:'business',buildFilter:'all',open:new Set()};
  const html=V.production(s,ui);assert.ok(html.includes('data-action="preview" data-id="lumber"'));
  assert.ok(!html.includes('data-action="preview" data-id="aerospace"'));
});
