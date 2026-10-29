import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.mjs';
import * as C from '../src/campaign.mjs';
import * as V from '../src/views.mjs';
import {PROGRAMMES,PROGRAMME_CHOICES,INFRA,BUILDINGS,RESOURCES,RESEARCH,TIERS} from '../src/data.mjs';
import {encode,decode} from '../src/storage.mjs';
import {help} from '../src/help.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≈ ${b}`);
function prepared(){const s=E.createGame('Holding',0,42),p=PROGRAMMES[0];s.cash=1e6;s.tier=p.tier;s.points=100;s.stats.peak=1e6;E.checkProgress(s);for(const[id,q]of Object.entries(p.materials))s.inventory[id]=q;return s;}

test('programmes have real durations, valid recipes and sequential progression',()=>{
  let total=0;
  for(const p of PROGRAMMES){total+=p.duration;assert.ok(p.duration>=3600);assert.ok(p.wealth>=TIERS[p.tier].wealth);for(const id of Object.keys(p.materials))assert.ok(RESOURCES[id].tier<=p.tier);for(const id of Object.keys(PROGRAMME_CHOICES))assert.ok(p.bonus[id]>0);}
  assert.ok(total>=18*86400);
  for(const d of Object.values(INFRA))for(const id of Object.keys(d.materials||{}))assert.ok(RESOURCES[id].tier<=d.tier);
});

test('future programmes stay hidden until their tier and wealth are discovered',()=>{
  const s=E.createGame('Start',0,42);assert.equal(C.programmeOffer(s),null);
  assert.ok(!V.frame(s,{tab:'overview'},'').includes('Holding'));
  assert.ok(!V.more(s).includes('Holdingprogramme'));
  assert.ok(!V.programmes(s).includes(PROGRAMMES[0].name));
  const ready=prepared();assert.ok(V.programmes(ready).includes(PROGRAMMES[0].name));
  for(const p of PROGRAMMES.slice(1))assert.ok(!V.programmes(ready).includes(p.name));
  ready.tier=0;assert.equal(C.programmeOffer(ready),null);
});

test('programme start is atomic for every missing cost and invalid choice',()=>{
  for(const missing of ['cash','points','planks','tools','choice']){
    const s=prepared();if(missing==='cash')s.cash=0;else if(missing==='points')s.points=0;else if(missing!=='choice')s.inventory[missing]=0;
    const before=JSON.stringify(s);assert.equal(C.startProgramme(s,missing==='choice'?'unknown':'production').ok,false);assert.equal(JSON.stringify(s),before);
  }
});

test('a valid programme pays exactly once and settles exactly once after its real duration',()=>{
  const s=prepared(),p=PROGRAMMES[0],cash=s.cash,points=s.points;assert.ok(C.startProgramme(s,'production').ok);
  near(s.cash,cash-p.cash);near(s.points,points-p.points);for(const id of Object.keys(p.materials))near(s.inventory[id],0);
  const before=JSON.stringify(s);assert.equal(C.startProgramme(s,'finance').ok,false);assert.equal(JSON.stringify(s),before);
  E.advance(s,(p.duration-1)*1000,{offline:true});assert.equal(s.campaign.completed.length,0);assert.equal(s.campaign.bonuses.production,0);
  E.advance(s,p.duration*1000,{offline:true});assert.equal(s.campaign.completed.length,1);assert.equal(s.campaign.active,null);assert.equal(s.campaign.bonuses.production,p.bonus.production);
  assert.equal(C.settleProgramme(s),null);E.advance(s,s.lastUpdate+1000);assert.equal(s.campaign.completed.length,1);
  assert.deepEqual(decode(encode(s),s.lastUpdate).game,s);
});

test('holding specializations affect recipes, capacity and bank rates consistently',()=>{
  const s=prepared(),base=E.productionBonus(s,'lumber'),bank=E.bankRate(s,'reserve');s.campaign.bonuses={production:25,finance:50,logistics:30};
  near(E.productionBonus(s,'lumber'),base*1.25);near(E.bankRate(s,'reserve'),bank*1.5);
  near(E.warehouseCapacity(s),650);near(E.capacity(s).transport,12*1.3);
  s.campaign.bonuses.finance=1e6;assert.equal(E.bankRate(s,'savings'),.0025);assert.ok(E.bankRate(s,'savings')<E.debtRate(s));
});

test('holding material reservation respects current warehouse and preserves higher rules',()=>{
  const s=prepared(),before=JSON.stringify(s.automation);assert.equal(C.reserveProgrammeMaterials(s,10).ok,false);assert.equal(JSON.stringify(s.automation),before);
  s.automation.planks={mode:'sell',low:100,high:500};assert.ok(C.reserveProgrammeMaterials(s,E.warehouseCapacity(s)).ok);
  assert.deepEqual(s.automation.planks,{mode:'both',low:100,high:500});assert.equal(s.automation.tools.low,20);assert.equal(s.automation.tools.mode,'both');assert.ok(s.automation.tools.high>20);
});

test('prestige and restructuring retain active projects, permanent bonuses and cumulative time',()=>{
  const s=prepared();C.startProgramme(s,'logistics');s.campaign.age=100;s.stats.peak=1e8;
  const next=E.prestige(s,0);assert.deepEqual(next.campaign,s.campaign);assert.notEqual(next.campaign,s.campaign);
  E.advance(next,2000);assert.equal(next.campaign.age,102);assert.equal(next.campaign.active.end,PROGRAMMES[0].duration);
  s.cash=0;s.debt=1e9;for(const id of Object.keys(s.inventory))s.inventory[id]=0;const repaired=E.restructure(s,0);assert.ok(repaired);assert.deepEqual(repaired.campaign,s.campaign);
});

test('campaign migration rebuilds bonuses and rejects nonsequential or invalid records',()=>{
  const raw={age:50000,peak:1e6,bonuses:{production:1e9},completed:[{chapter:PROGRAMMES[0].id,choice:'finance',at:21600},{chapter:PROGRAMMES[2].id,choice:'production'}],active:{chapter:PROGRAMMES[1].id,choice:'logistics',start:21600,end:21601}};
  const c=C.normalizeCampaign(raw);assert.equal(c.completed.length,1);assert.equal(c.bonuses.production,0);assert.equal(c.bonuses.finance,10);assert.equal(c.active.end,21600+PROGRAMMES[1].duration);
  raw.active.choice='invalid';assert.equal(C.normalizeCampaign(raw).active,null);
  const s=prepared();delete s.campaign;const migrated=E.validateGame(s,0);assert.equal(migrated.campaign.age,s.elapsed);assert.equal(migrated.campaign.peak,s.stats.peak);assert.equal(migrated.campaign.unlocked,true);
});

test('bulk infrastructure and research produce their advertised capacity and points',()=>{
  const s=prepared();s.tier=10;s.cash=1e12;s.legacy=2;s.research.science=2;s.research.systems=2;s.research.energy=1;s.research.logistics=2;
  for(const id of ['city','archive','orbital','hub','university','reserve'])assert.ok(E.build(s,id,1,true).ok);
  const c=E.capacity(s);near(c.workers,512);near(E.warehouseCapacity(s),20500*1.2);near(c.transport,512*1.4);near(c.cleanEnergy,6+500*1.15*1.24);
  const rate=25*1.08*1.3;near(E.researchRate(s),rate);const points=s.points;E.advance(s,60000);near(s.points-points,rate);
  for(const id of Object.keys(INFRA)){const h=help('infra:'+id,s);assert.ok(!h.body.includes('undefined'));assert.ok(h.body.length>100);}
  for(const id of Object.keys(RESEARCH))assert.ok(help('research:'+id,s).body.length>100);
});

test('each new recipe operates without negative stocks or undefined rates',()=>{
  for(const[id,b]of Object.entries(BUILDINGS).filter(([,d])=>d.tier>=7)){
    const s=prepared();s.tier=10;s.cash=1e12;
    for(const type of ['city','archive','orbital','hub','reserve'])assert.ok(E.build(s,type,10,true).ok);
    assert.ok(E.build(s,id).ok);for(const[r,q]of Object.entries(b.input))s.inventory[r]=q*5;
    E.advance(s,1000);
    for(const r of Object.keys(b.output))assert.ok(s.inventory[r]>0,`${id} produces ${r}`);
    for(const q of Object.values(s.inventory))assert.ok(q>=0&&Number.isFinite(q));assert.ok(Number.isFinite(E.assets(s).total));
  }
});
