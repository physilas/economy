// System playtest: a simple, non-cheating company manager uses only public game actions.
// No injected capital, unlocked recipes or accelerated production. Run with npm run test:long.
import assert from 'node:assert/strict';
import * as E from '../src/engine.mjs';
import {BUILDINGS,RESEARCH,TIERS} from '../src/data.mjs';
const state=E.createGame('Long-run validation',0,42),milestones=[];
let oldTier=0;
function configureTrade(){
  for(const row of E.supplyPlan(state)){
    const rule=state.automation[row.id],capacity=E.warehouseCapacity(state);
    rule.mode=row.input>0?'both':'sell';rule.low=Math.min(capacity*.7,Math.ceil(row.input*2));rule.high=Math.min(capacity*.9,Math.max(20,rule.low*1.5));
  }
}
for(let minute=0;minute<14*1440;minute+=5){
  if(state.tier>=2)state.profitGuard=true;
  for(let decision=0;decision<8;decision++){
    const capacity=E.capacity(state);let best=null;
    for(const[id,building]of Object.entries(BUILDINGS)){
      if(building.tier>state.tier)continue;
      const margin=E.buildingRate(state,id).margin;if(margin<=0)continue;
      const needed=[],staff=building.staff*Math.pow(.92,state.research.automation);
      if(capacity.staff+staff>capacity.workers)needed.push(['housing',Math.ceil((capacity.staff+staff-capacity.workers)/20)]);
      if(capacity.energy+building.energy>capacity.availableEnergy)needed.push([state.tier>=2?'solar':'power',Math.ceil((capacity.energy+building.energy-capacity.availableEnergy)/(state.tier>=2?20:25))]);
      if(capacity.freight+building.freight>capacity.transport)needed.push(['transport',Math.ceil((capacity.freight+building.freight-capacity.transport)/20)]);
      if(needed.some(([infra])=>state.tier===0&&infra!=='housing'))continue;
      const cost=E.buildQuote(state,id).total+needed.reduce((total,[infra,quantity])=>total+(E.buildQuote(state,infra,quantity,true)?.total||1e100),0);
      if(cost>state.cash-Math.max(100,(capacity.wages+building.wage)*2))continue;
      const score=margin/cost;if(!best||score>best.score)best={id,needed,score};
    }
    if(!best)break;
    for(const[id,quantity]of best.needed)assert.ok(E.build(state,id,quantity,true).ok);
    assert.ok(E.build(state,best.id).ok);configureTrade();
  }
  if(state.tier>=1&&state.infra.lab<5){const quote=E.buildQuote(state,'lab',1,true);if(quote.total<state.cash*.15)E.build(state,'lab',1,true);}
  for(const[id,research]of Object.entries(RESEARCH)){const cost=E.researchCost(state,id);if(research.tier<=state.tier&&cost.points<=state.points&&cost.cash<state.cash*.1)E.research(state,id);}
  for(const contract of [...state.board])if(state.inventory[contract.resource]>=contract.quantity){E.acceptContract(state,contract.id);E.fulfillContract(state,contract.id);}
  E.advance(state,(minute+5)*60000);
  if(state.tier>oldTier){milestones.push({realHours:(minute+5)/60,discovery:TIERS[state.tier].name});oldTier=state.tier;}
  assert.ok(Number.isFinite(E.assets(state).total));assert.ok(state.cash>=0);
  for(const quantity of Object.values(state.inventory))assert.ok(Number.isFinite(quantity)&&quantity>=0);
  if(minute%1440===0)console.log(`Simulated day ${minute/1440}: tier ${state.tier}, equity ${Math.round(E.assets(state).total)} €`);
  if(state.stats.peak>=1e8)break;
}
assert.equal(state.tier,TIERS.length-1,'All discoveries must be reachable through ordinary play.');
assert.ok(E.prestigeReward(state)>0,'The long-term endgame must be reachable.');
const next=E.prestige(state,state.lastUpdate);assert.ok(next&&next.legacy>0);
console.log(JSON.stringify({milestones,finalEquity:Math.round(E.assets(state).total),legacyPoints:next.legacy},null,2));
