// Whole-month progression with normal starting capital and public game actions only.
import assert from 'node:assert/strict';
import * as E from '../src/engine.mjs';
import * as C from '../src/campaign.mjs';
import {BUILDINGS,INFRA,RESEARCH,PROGRAMMES,TIERS} from '../src/data.mjs';
const s=E.createGame('Month validation',0,42),milestones=[],choices=['production','logistics','finance'];
let lastTier=0;
function infrastructure(metric,gap){
  let best=null;
  for(const[id,d]of Object.entries(INFRA)){
    if(d.tier>s.tier||!d.provides[metric]||d.fuel)continue;
    const quantity=Math.ceil(gap/E.infrastructureYield(s,id,metric));if(quantity<1||quantity>100)continue;
    const cost=E.buildQuote(s,id,quantity,true).total;if(!best||cost<best.cost)best={id,quantity,cost};
  }
  return best;
}
function configure(){
  const p=C.programmeOffer(s);
  for(const row of E.supplyPlan(s)){
    const a=s.automation[row.id],cap=E.warehouseCapacity(s),hold=p?.materials[row.id]||0;
    a.mode=row.input>0||hold?'both':'sell';a.low=Math.min(cap*.8,Math.max(hold,Math.ceil(row.input*2)));a.high=Math.min(cap*.95,Math.max(a.low,20,a.low*1.2));
  }
  if(p)C.reserveProgrammeMaterials(s,E.warehouseCapacity(s));
}
function project(){
  const p=C.programmeOffer(s);if(!p)return;
  const missingStorage=Math.max(...Object.values(p.materials))-E.warehouseCapacity(s);
  if(missingStorage>0){const option=infrastructure('storage',missingStorage);if(option&&option.cost<s.cash*.2)E.build(s,option.id,option.quantity,true);}
  configure();if(s.cash>p.cash+E.capacity(s).wages*3)C.startProgramme(s,choices[s.campaign.completed.length%choices.length]);
}
function develop(){
  project();
  if(s.tier>=2)s.profitGuard=true;
  // Reserve enough for the next programme instead of permanently reinvesting its capital.
  const programme=C.programmeOffer(s),reserve=(programme?.cash||0)+Math.max(100,E.capacity(s).wages*3);
  for(let decision=0;decision<12;decision++){
    const c=E.capacity(s);let best=null;
    for(const[id,b]of Object.entries(BUILDINGS)){
      if(b.tier>s.tier)continue;
      const margin=E.buildingRate(s,id).margin;if(margin<=0)continue;
      const needs=[['workers',c.staff+b.staff*Math.pow(.92,s.research.automation)-c.workers],['energy',c.energy+b.energy-c.cleanEnergy],['transport',c.freight+b.freight-c.transport]];
      const additions=[];let possible=true;
      for(const[metric,gap]of needs)if(gap>0){const option=infrastructure(metric,gap);if(!option){possible=false;break;}additions.push(option);}
      if(!possible)continue;
      const cost=E.buildQuote(s,id).total+additions.reduce((n,o)=>n+o.cost,0);
      const score=margin/cost;if(!best||score>best.score)best={id,additions,score,cost};
    }
    if(!best||best.cost>s.cash-reserve)break;
    for(const o of best.additions)assert.ok(E.build(s,o.id,o.quantity,true).ok);
    assert.ok(E.build(s,best.id).ok);configure();
  }
  const target=s.tier>=8?400:s.tier>=6?25:s.tier>=4?8:3;
  if(s.tier>=1&&E.researchRate(s)<target){const o=infrastructure('research',target-E.researchRate(s));if(o&&o.cost<Math.max(0,s.cash-reserve)*.2)E.build(s,o.id,o.quantity,true);}
  for(const[id,r]of Object.entries(RESEARCH)){
    const q=E.researchCost(s,id);if(r.tier<=s.tier&&q.points<=s.points-(programme?.points||0)&&q.cash<Math.max(0,s.cash-reserve)*.1)E.research(s,id);
  }
  const pollution=E.capacity(s).pollution;if(pollution>20){const o=infrastructure('cleanup',pollution-15);if(o&&o.cost<Math.max(0,s.cash-reserve)*.3)E.build(s,o.id,o.quantity,true);}
  const supply=E.supplyPlan(s),needed=Math.max(...supply.map(r=>Math.max(r.input*3,r.output*2)));
  if(needed>E.warehouseCapacity(s)){const o=infrastructure('storage',needed-E.warehouseCapacity(s));if(o&&o.cost<Math.max(0,s.cash-reserve)*.2)E.build(s,o.id,o.quantity,true);}
  for(const contract of [...s.board])if(s.inventory[contract.resource]>=contract.quantity){E.acceptContract(s,contract.id);E.fulfillContract(s,contract.id);}
  configure();
}
for(let minute=0;minute<35*1440;){
  develop();const step=minute<1440?5:30;minute+=step;E.advance(s,minute*60000);
  if(s.tier>lastTier){milestones.push({day:Number((minute/1440).toFixed(2)),tier:s.tier,name:TIERS[s.tier].name});lastTier=s.tier;}
  assert.ok(Number.isFinite(E.assets(s).total)&&s.cash>=0);for(const q of Object.values(s.inventory))assert.ok(q>=0&&Number.isFinite(q));
  if(minute%1440===0)console.log(`Day ${minute/1440}: tier ${s.tier}, equity ${Math.round(E.assets(s).total)}, cash ${Math.round(s.cash)}, completed ${s.campaign.completed.length}, active ${s.campaign.active?.chapter||'-'}`);
}
console.log(JSON.stringify({buildings:Object.fromEntries(Object.entries(s.buildings).filter(([,b])=>b.count).map(([id,b])=>[id,b.count])),capacity:E.capacity(s),milestones,equity:E.assets(s).total,completed:s.campaign.completed,research:s.points,active:s.campaign.active},null,2));
assert.equal(s.tier,TIERS.length-1,'All discoveries must be reachable without injected resources.');
assert.equal(s.campaign.completed.length,PROGRAMMES.length,'The complete long-term campaign must be reachable.');
assert.ok(milestones.some(m=>m.day>=14),'Later discoveries should create new decisions beyond the first two weeks.');
