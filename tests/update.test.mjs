import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.mjs';
import * as V from '../src/views.mjs';
import {BUILDINGS,RESOURCES,STOCKS,ACHIEVEMENTS,DAY,STEP} from '../src/data.mjs';
import {chainBlueprint} from '../src/chains.mjs';
import {advanceOfflineBatched} from '../src/offline.mjs';
import {encode,decode} from '../src/storage.mjs';
import {normalizeUI} from '../src/ui-state.mjs';
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);
const game=()=>{const s=E.createGame('Update',0,42);s.tier=3;s.cash=1e8;s.achievements=ACHIEVEMENTS.map(a=>a.id);return s;};

test('half-second steps book operating flows while company dividends follow their reporting day',()=>{
  const s=game();E.build(s,'lumber');s.banks.reserve=10000;s.debt=1000;s.stocks.sylva.quantity=1000;s.properties.farmland.count=2;
  const before=structuredClone(s);const result=E.advance(s,500);
  assert.equal(STEP,.5);assert.equal(result.steps,1);assert.equal(result.seconds,.5);
  near(s.inventory.wood-before.inventory.wood,8/120);near(s.hourLedger.costs-before.hourLedger.costs,9/120+1000*(Math.pow(1+E.debtRate(before),.5/DAY)-1));
  assert.ok(s.stats.interest>0);assert.ok(s.stats.rent>0);assert.equal(s.stats.dividends,0);assert.ok(s.banks.reserve>before.banks.reserve);
  near(s.stocks.sylva.price,before.stocks.sylva.price);
  near(s.stats.rent,2*(430*.9-30)*.85*.5/DAY);
});

test('operating taxes settle continuously and later costs release the current-day overpayment',()=>{
  const s=game();E.trade(s,'wood',10,'sell');E.advance(s,500);
  near(s.dayLedger.taxPaid,.12*(s.dayLedger.revenue-s.dayLedger.costs));assert.ok(s.dayLedger.taxPaid>0);
  const tax=s.dayLedger.taxPaid;E.trade(s,'wood',10,'buy');const cash=s.cash;E.advance(s,1000);
  near(s.dayLedger.taxPaid,0);near(s.cash-cash,tax);near(s.stats.taxes,0);
});

test('100x live advancement matches ordinary simulation and keeps its wall clock correct',()=>{
  const fast=game();E.build(fast,'lumber');fast.automation.wood={mode:'sell',low:0,high:0};fast.banks.reserve=10000;
  const normal=structuredClone(fast);E.advance(fast,10000,{speed:100});E.advance(normal,1000000);
  assert.equal(fast.lastUpdate,10000);assert.equal(normal.lastUpdate,1000000);
  const fastCopy=structuredClone(fast);fastCopy.lastUpdate=normal.lastUpdate;assert.deepEqual(fastCopy,normal);
  const elapsed=fast.elapsed;E.advance(fast,10500);assert.equal(fast.elapsed-elapsed,.5);
});

test('releasing short speed bursts preserves fractional wall time and offline ignores speed',()=>{
  const s=game();E.advance(s,123,{speed:100});assert.equal(s.elapsed,12);assert.equal(s.lastUpdate,120);
  E.advance(s,620);assert.equal(s.elapsed,12.5);assert.equal(s.lastUpdate,620);
  E.advance(s,1120,{speed:100,offline:true});assert.equal(s.elapsed,13);
  const restored=decode(encode(s),1120).game;assert.ok(!Object.hasOwn(restored,'speed'));
});

test('cooperative offline fallback handles a remaining half-second exactly',async()=>{
  const a=game();E.build(a,'lumber');const b=structuredClone(a);
  E.advance(a,600500,{offline:true});await advanceOfflineBatched(b,600500,{yieldControl:async()=>{}});assert.deepEqual(a,b);
});

test('every complete base chain has whole factory counts and exactly balanced intermediate goods',()=>{
  const s=game();
  for(const id of Object.keys(BUILDINGS)){
    const blueprint=chainBlueprint(s,id),balance=Object.fromEntries(Object.keys(RESOURCES).map(r=>[r,0]));
    for(const node of blueprint.nodes){
      assert.ok(Number.isSafeInteger(node.count)&&node.count>0,`${id}: ${node.id}`);
      for(const[r,q]of Object.entries(BUILDINGS[node.id].output))balance[r]+=q*node.count;
      for(const[r,q]of Object.entries(BUILDINGS[node.id].input))balance[r]-=q*node.count;
    }
    for(const[r,n]of Object.entries(balance))assert.equal(n,blueprint.output.find(o=>o.resource===r)?.amount||0,`${id}: balanced ${r}`);
  }
  const sawmill=chainBlueprint(s,'sawmill');assert.equal(sawmill.nodes.find(n=>n.id==='lumber').count,2);assert.equal(sawmill.nodes.find(n=>n.id==='sawmill').count,1);
  s.tier=0;assert.equal(chainBlueprint(s,'sawmill'),null);
});

test('factory base prices stay fixed and each upgrade doubles both recipe sides',()=>{
  const s=game(),first=E.buildQuote(s,'sawmill').cash;E.build(s,'sawmill',50);
  assert.equal(E.buildQuote(s,'sawmill').cash,first);assert.equal(E.buildQuote(s,'sawmill',1000).cash,first*1000);
  const cost=E.upgradeQuote(s,'sawmill');assert.equal(cost,1200*4*50);
  const before=E.productionBonus(s,'sawmill');assert.ok(E.upgrade(s,'sawmill').ok);near(E.productionBonus(s,'sawmill'),before*2);near(E.upgradeQuote(s,'sawmill'),cost*3);
  const inputs=E.supplyPlan(s).find(r=>r.id==='wood');near(inputs.input,16*50*2);
});

test('maximum market buys respect nonlinear price impact, cash and storage',()=>{
  for(const pressure of [-4,0,4]){
    const s=game();s.cash=137;s.market.wood.pressure=pressure;
    const amount=E.maxTransaction(s,'trade','wood','buy');assert.ok(amount>0);assert.ok(E.quote(s,'wood',amount).total<=s.cash+1e-7);
    assert.ok(E.trade(s,'wood',amount,'buy').ok);assert.ok(s.cash>=0);assert.ok(s.inventory.wood<=E.warehouseCapacity(s));
    const all=E.maxTransaction(s,'trade','wood','sell');assert.ok(E.trade(s,'wood',all,'sell').ok);near(s.inventory.wood,0);
  }
  const full=game();full.inventory.wood=E.warehouseCapacity(full);assert.equal(E.maxTransaction(full,'trade','wood','buy'),0);
});

test('maximum construction and sales honor ownership and factory limits',()=>{
  const s=game();s.cash=1000;assert.equal(E.maxTransaction(s,'build','lumber'),3);E.build(s,'lumber',3);assert.equal(E.maxTransaction(s,'build','lumber'),0);
  assert.equal(E.maxTransaction(s,'demolish','lumber'),3);assert.ok(E.demolish(s,'lumber',3).ok);
  s.buildings.lumber.count=9999;s.cash=1e8;assert.equal(E.maxTransaction(s,'build','lumber'),1);
  s.infra.housing=10000;assert.equal(E.maxTransaction(s,'buildInfra','housing'),0);
});

test('maximum stock, property and bank transfers are executable and leave no hidden position',()=>{
  const s=game();s.cash=10000;let n=E.maxTransaction(s,'stock','sylva','buy');assert.ok(E.stockTrade(s,'sylva',n,'buy').ok);n=E.maxTransaction(s,'stock','sylva','sell');assert.ok(E.stockTrade(s,'sylva',n,'sell').ok);assert.equal(s.stocks.sylva.quantity,0);
  s.cash=100000;assert.ok(E.propertyTrade(s,'apartments',E.maxTransaction(s,'property','apartments','buy'),'buy').ok);assert.ok(E.propertyTrade(s,'apartments',E.maxTransaction(s,'property','apartments','sell'),'sell').ok);assert.equal(s.properties.apartments.count,0);
  const cash=s.cash;E.bankTransfer(s,'savings',E.maxTransaction(s,'bank','savings','deposit'),'deposit');assert.equal(s.cash,0);E.bankTransfer(s,'savings',E.maxTransaction(s,'bank','savings','withdraw'),'withdraw');near(s.cash,cash);
});

test('bank deposit and payout plans execute once per due date without creating money',()=>{
  const s=game();s.cash=1000;E.createBankPlan(s,'reserve','deposit',100,1);E.createBankPlan(s,'savings','withdraw',200,1);s.banks.savings=500;
  E.advance(s,DAY*1000);near(s.cash,1100);assert.ok(s.banks.reserve>=100);assert.ok(s.banks.savings>300);
  assert.equal(s.bankPlans[0].executions,1);assert.equal(s.bankPlans[1].executions,1);
  E.advance(s,DAY*1000+500);assert.equal(s.bankPlans[0].executions,1);
  E.cancelBankPlan(s,s.bankPlans[0].id);assert.equal(s.bankPlans.length,1);
});

test('unfunded bank rates are skipped, retain a cash buffer and never borrow or partially execute',()=>{
  const s=game();s.cash=125;E.createBankPlan(s,'reserve','deposit',100,1);E.createBankPlan(s,'savings','withdraw',100,1);
  E.advance(s,DAY*1000);assert.equal(s.cash,125);assert.equal(s.banks.reserve,0);assert.equal(s.debt,0);assert.ok(s.bankPlans.every(p=>p.skipped===1));
  s.cash=250;E.advance(s,2*DAY*1000);assert.equal(s.cash,150);assert.equal(s.bankPlans[0].executions,1);
});

test('fixed-deposit plans keep their term and principal matures automatically',()=>{
  const s=game();s.cash=2000;assert.ok(E.createBankPlan(s,'fixed','deposit',500,1,10).ok);assert.equal(E.createBankPlan(s,'fixed','withdraw',500).ok,false);
  E.advance(s,DAY*1000);assert.equal(s.bonds.length,1);assert.equal(s.bonds[0].days,10);assert.equal(s.bonds[0].end,11*DAY);
  E.cancelBankPlan(s,s.bankPlans[0].id);E.advance(s,11*DAY*1000);assert.equal(s.bonds.length,0);assert.ok(s.cash>2000);
});

test('old saves retain counts, levels, research, legacy and short histories with safe defaults',()=>{
  const old=game();E.build(old,'sawmill',7);old.buildings.sawmill.level=3;old.research.forestry=4;old.legacy=11;old.prestigeCount=2;
  old.stats.history=[{at:60,wealth:40000,profit:200}];delete old.bankPlans;delete old.dayLedger.taxPaid;
  const restored=decode(encode(old),0).game;
  for(const key of ['buildings','inventory','research','stocks','banks','campaign','legacy','prestigeCount','tier'])assert.deepEqual(restored[key],old[key],key);
  assert.deepEqual(restored.stats.history,old.stats.history);assert.deepEqual(restored.bankPlans,[]);assert.equal(restored.dayLedger.taxPaid,0);
  const html=V.analysis(restored,normalizeUI({},restored));assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
});

test('new telemetry, tax ledgers and bank plans roundtrip exactly at fractional times',()=>{
  const s=game();E.createBankPlan(s,'savings','deposit',100,5);E.build(s,'lumber');E.advance(s,60500);
  assert.ok(Number.isFinite(s.stats.history[0].cash));assert.equal(s.elapsed,60.5);assert.deepEqual(decode(encode(s),60500).game,s);
});

test('legacy preview separates already active points from unclaimed rewards and next thresholds',()=>{
  const s=game();s.legacy=3;s.stats.peak=399999999;let p=E.legacyProgress(s);
  assert.equal(p.earned,3);assert.equal(p.pending,1);assert.equal(p.threshold,400000000);assert.equal(p.remaining,1);
  s.stats.peak=400000000;p=E.legacyProgress(s);assert.equal(p.pending,2);assert.equal(p.threshold,900000000);
  const next=E.prestige(s,0);assert.equal(next.legacy,5);assert.equal(next.cash,4700);
  const html=V.legacyView(s);assert.ok(html.includes('Erreicht'));assert.ok(html.includes('ausstehende'));assert.ok(html.includes('+2'));
});

test('minute clock, compact info controls, sticky amounts and unique market views are rendered',()=>{
  const s=game(),ui=normalizeUI({},s);s.elapsed=61.5;assert.equal(V.gameTime(s),'Tag 1 · 01:01');
  const production=V.production(s,ui),market=V.market(s,ui),finance=V.finance(s,ui);
  assert.ok(production.includes('sticky-controls'));assert.ok(production.includes('compact-asset'));assert.ok(production.includes('building:sawmill'));
  assert.ok(!market.includes('Mein Lager'));assert.ok(market.includes('tradeAll'));assert.ok(finance.includes('sticky-controls'));assert.ok(finance.includes('amountScale'));
  assert.ok(V.frame(s,ui,'').includes('100×'));ui.marketFilter='owned';normalizeUI(ui,s);assert.equal(ui.marketFilter,'all');
});
