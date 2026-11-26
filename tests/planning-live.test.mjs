import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,currentSupplyPlan,supplyPlan,advance} from '../src/engine.mjs';
import {STEP,HOUR,ACHIEVEMENTS} from '../src/data.mjs';
import * as V from '../src/views.mjs';
import {normalizeUI} from '../src/ui-state.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
function game(){const s=createGame('Plan',0,42);s.tier=3;s.cash=1e6;s.achievements=ACHIEVEMENTS.map(a=>a.id);return s;}

test('live planning matches actual resource deltas, including shared suppliers and strongest constraints',()=>{
  const s=game();build(s,'lumber',4);build(s,'sawmill',2);s.inventory.wood=0;
  const before=structuredClone(s),rows=currentSupplyPlan(s);assert.deepEqual(s,before,'planning is read-only');
  advance(s,STEP*1000);
  for(const row of rows)near((s.inventory[row.id]-before.inventory[row.id])*HOUR/STEP,row.net);
  assert.ok(rows.find(r=>r.id==='planks').output>0,'same-step upstream output reaches the processor');
});

test('live planning shows idle, cash, storage, supply and margin constraints while target planning keeps full rates',()=>{
  for(const reason of ['idle','cash','storage','supply','guard']){
    const s=game();build(s,'sawmill');
    if(reason==='idle')s.buildings.sawmill.active=0;
    if(reason==='cash')s.cash=0;
    if(reason==='storage')s.inventory.planks=500;
    if(reason==='supply')s.inventory.wood=0;
    if(reason==='guard'){s.profitGuard=true;s.market.planks.factor=.45;s.market.planks.pressure=-1.5;}
    near(currentSupplyPlan(s).find(r=>r.id==='planks')?.output||0,0);
    if(reason!=='idle')assert.ok(supplyPlan(s).find(r=>r.id==='planks').output>0);
  }
});

test('planning is an independent production tab with both live and target views',()=>{
  const s=game(),ui=normalizeUI({productionTab:'planner'},s);
  const html=V.production(s,ui);assert.ok(html.includes('data-action="productionTab" data-id="planner"'));assert.ok(html.includes('Produktion / h'));assert.ok(html.includes('Ist · aktuelle Produktion'));assert.ok(html.includes('Soll · volle Auslastung'));
  s.tier=0;normalizeUI(ui,s);assert.equal(ui.productionTab,'planner');
});
