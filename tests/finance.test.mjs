import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,assets,propertyTrade,advance,buyOption,optionQuote,sellOption,referencePrice,stockTrade,toggleDividendReinvestment,createSavingsPlan,cancelSavingsPlan,setTreasury,emergencyAid,restructure,companyFundamentals,build,supplyPlan,setupSupplies} from '../src/engine.mjs';
import {normalCDF,optionPrice} from '../src/math.mjs';
import {encode,decode} from '../src/storage.mjs';
import {DAY,ACHIEVEMENTS,PROPERTIES,STOCKS,BUILDINGS,RESOURCES,INFRA,RESEARCH,BONDS,VENTURES} from '../src/data.mjs';
import {help} from '../src/help.mjs';
import * as V from '../src/views.mjs';
const now=1800000000000;
function game(){const s=createGame('Finance',now,42);s.tier=6;s.stats.peak=3e7;s.cash=1e7;s.achievements=ACHIEVEMENTS.map(a=>a.id);return s;}
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} ≈ ${b}`);

test('option pricing obeys parity, expiry payoff and monotonic volatility',()=>{
  near(normalCDF(0),.5);near(normalCDF(1)+normalCDF(-1),1);
  near(optionPrice(100,90,3,.1,'call')-optionPrice(100,90,3,.1,'put'),10);
  assert.equal(optionPrice(80,100,0,.1,'put'),20);
  assert.equal(optionPrice(80,100,0,.1,'call'),0);
  assert.ok(optionPrice(100,100,3,.2)>optionPrice(100,100,3,.1));
});

test('property roundtrips lose fees and rents are paid once per day',()=>{
  const s=game(),cash=s.cash;propertyTrade(s,'apartments',1,'buy');propertyTrade(s,'apartments',1,'sell');
  near(cash-s.cash,PROPERTIES.apartments.cost*.05);
  propertyTrade(s,'farmland',1,'buy');const before=s.cash;
  advance(s,now+DAY*1000);assert.ok(s.cash>before);assert.ok(s.stats.rent>0);
  const after=s.cash;advance(s,s.lastUpdate+1000);near(s.cash,after);
});

test('property and hedging content stays hidden before unlock',()=>{
  const s=game(),ui={qty:1,amount:100,fixedDays:20,open:new Set(),financeTab:'bank'};s.tier=1;
  const html=V.finance(s,ui);assert.ok(!html.includes('Sachwerte'));assert.ok(!html.includes('Absicherung'));
  assert.equal(propertyTrade(s,'apartments',1,'buy').ok,false);assert.equal(buyOption(s,'wood','put',1).ok,false);
});

test('options cannot be manipulated through the player scarcity pressure',()=>{
  const s=game(),q=optionQuote(s,'wood','call',100,3),reference=referencePrice(s,'wood');
  s.market.wood.pressure=4;near(referencePrice(s,'wood'),reference);near(optionQuote(s,'wood','call',100,3).premium,q.premium);
});

test('put pays a bounded cash settlement and never requires additional margin',()=>{
  const s=game();buyOption(s,'wood','put',100,1);const o=s.options[0];
  s.market.wood.factor=.5;o.end=1;const before=s.cash;
  advance(s,now+1000);assert.equal(s.options.length,0);assert.ok(s.cash>before);assert.equal(s.debt,0);
  const t=game();buyOption(t,'wood','put',100,1);t.market.wood.factor=2;t.options[0].end=1;const afterPremium=t.cash;
  advance(t,now+1000);near(t.cash,afterPremium);assert.equal(t.debt,0);
});

test('buying and immediately closing an option cannot generate wealth',()=>{
  const s=game(),cash=s.cash;buyOption(s,'wood','put',100,3);sellOption(s,s.options[0].id);assert.ok(s.cash<cash);
});

test('treasury moves existing bank capital and creates no equity',()=>{
  const s=game();s.cash=10;s.banks.reserve=1000;setTreasury(s,'enabled',true);const wealth=assets(s).total;
  advance(s,now+1000);near(s.cash,600);assert.ok(assets(s).total>=wealth);assert.ok(assets(s).total-wealth<.01);
  s.cash=1000;advance(s,s.lastUpdate+1000);near(s.cash,600);assert.ok(s.banks.reserve>800);
});

test('dividend reinvestment accumulates reserve, buys whole shares and releases leftovers',()=>{
  const s=game();stockTrade(s,'sylva',10000,'buy');toggleDividendReinvestment(s,'sylva');advance(s,now+DAY*1000);
  assert.ok(s.stocks.sylva.quantity>10000);assert.ok(s.stocks.sylva.reserve>=0);assert.ok(s.stats.dividends>0);
  const reserve=s.stocks.sylva.reserve,cash=s.cash;toggleDividendReinvestment(s,'sylva');near(s.cash-cash,reserve);assert.equal(s.stocks.sylva.reserve,0);
});

test('savings plans skip insufficient cash and never use credit',()=>{
  const s=game();s.cash=10;createSavingsPlan(s,'sylva',100,1);advance(s,now+DAY*1000);
  assert.equal(s.stocks.sylva.quantity,0);assert.equal(s.savingsPlans[0].skipped,1);assert.equal(s.debt,0);
  s.cash=1000;advance(s,s.lastUpdate+DAY*1000);assert.ok(s.stocks.sylva.quantity>0);assert.ok(s.cash>=50);
  cancelSavingsPlan(s,s.savingsPlans[0].id);assert.equal(s.savingsPlans.length,0);
});

test('company earnings respond to output prices, input costs and business cycle',()=>{
  const s=game(),base=companyFundamentals(s,'terra');s.market.grain.factor=1.8;const expensive=companyFundamentals(s,'terra');
  assert.ok(expensive.margin<base.margin);assert.ok(expensive.fair<base.fair);
  s.market.grain.factor=1;s.market.food.factor=1.5;const strong=companyFundamentals(s,'terra');assert.ok(strong.eps>base.eps);
  s.economy.cycle=.8;assert.ok(companyFundamentals(s,'terra').revenue<strong.revenue);
});

test('reports remain published until the next reporting date, then update',()=>{
  const s=game(),original=s.stocks.terra.report.at;advance(s,now+DAY*1000);assert.equal(s.stocks.terra.report.at,original);
  advance(s,now+5*DAY*1000);assert.equal(s.stocks.terra.report.at,5*DAY);
  assert.ok(s.stocks.terra.report.eps>0);assert.ok(s.stocks.index.report.fair>0);
});

test('dividends have a matching ex-dividend price adjustment, preventing free dividend capture',()=>{
  const withDividend=game();withDividend.elapsed=DAY-1;withDividend.stocks.sylva.quantity=100;
  const withoutDividend=structuredClone(withDividend),dps=withDividend.stocks.sylva.report.dps;
  withoutDividend.stocks.sylva.report.dps=0;
  advance(withDividend,now+1000);advance(withoutDividend,now+1000);
  near(withDividend.cash-withoutDividend.cash,100*dps*.85);
  near(withoutDividend.stocks.sylva.price-withDividend.stocks.sylva.price,dps);
});

test('supply planning exposes input deficits and setup configures valid buffers',()=>{
  const s=game();build(s,'sawmill');const row=supplyPlan(s).find(r=>r.id==='wood');assert.ok(row.net<0);
  assert.ok(setupSupplies(s,'sawmill').ok);assert.equal(s.automation.wood.mode,'buy');assert.ok(s.automation.wood.low<=s.automation.wood.high);
});

test('margin guard pauses negative-margin production and resumes after prices recover',()=>{
  const s=game();build(s,'bakery');s.inventory.grain=100;s.inventory.water=100;s.profitGuard=true;
  s.market.food.factor=.45;s.market.food.pressure=-1.5;
  const cash=s.cash,grain=s.inventory.grain;advance(s,now+1000);
  assert.equal(s.inventory.food,0);near(s.cash,cash);near(s.inventory.grain,grain);assert.equal(s.buildings.bakery.active,1);
  s.market.food.factor=2;s.market.food.pressure=1;
  advance(s,now+2000);assert.ok(s.inventory.food>0);assert.ok(s.cash<cash);
  assert.equal(decode(encode(s),now+2000).game.profitGuard,true);
});

test('empty companies have a recovery path with a cooldown',()=>{
  const s=createGame('Recovery',now,42);s.cash=0;for(const r of Object.keys(s.inventory))s.inventory[r]=0;
  assert.ok(emergencyAid(s).ok);assert.equal(s.cash,400);s.cash=0;assert.equal(emergencyAid(s).ok,false);
  s.elapsed=300;assert.ok(emergencyAid(s).ok);
});

test('recovery aid alone funds a working starter without relying on unclaimed achievements',()=>{
  const s=createGame('Restart',now,42);s.cash=0;s.achievements=ACHIEVEMENTS.map(a=>a.id);for(const id of Object.keys(s.inventory))s.inventory[id]=0;
  emergencyAid(s);assert.ok(build(s,'lumber').ok);const cash=s.cash;s.automation.wood={mode:'sell',low:0,high:20};
  advance(s,now+300000);assert.ok(s.cash>cash);assert.ok(s.stats.produced>0);
});

test('a debt spiral has a recovery path that preserves discoveries but cancels all financial positions',()=>{
  const s=game();assert.equal(restructure(s,now),null);
  s.cash=0;s.debt=1e8;for(const id of Object.keys(s.inventory))s.inventory[id]=0;
  s.research.forestry=2;s.legacy=3;
  s.bonds.push({id:900,type:'state',principal:5000,start:0,end:DAY,rate:.0015});
  const next=restructure(s,now);
  assert.ok(next);assert.equal(next.cash,600);assert.equal(next.debt,0);assert.equal(next.bonds.length,0);assert.equal(next.buildings.lumber.count,1);
  assert.equal(next.tier,6);assert.equal(next.research.forestry,2);assert.equal(next.legacy,3);assert.equal(next.reputation,15);
  next.automation.wood={mode:'sell',low:0,high:10};const cash=next.cash;advance(next,now+60000);assert.ok(next.cash>cash);
  assert.deepEqual(decode(encode(next),now+60000).game,next);
});

test('extended finance state roundtrips without losing basis, reports, plans or settings',()=>{
  const s=game();propertyTrade(s,'apartments',2,'buy');stockTrade(s,'terra',10,'buy');toggleDividendReinvestment(s,'terra');
  buyOption(s,'wood','put',10,3);createSavingsPlan(s,'index',100,5);setTreasury(s,'enabled',true);
  const decoded=decode(encode(s),now).game;
  for(const key of ['properties','stocks','options','savingsPlans','treasury'])assert.deepEqual(decoded[key],s[key]);
  near(assets(decoded).total,assets(s).total);
});

test('every discoverable product has a meaningful info explanation',()=>{
  const s=game();
  for(const [group,items] of Object.entries({building:BUILDINGS,infra:INFRA,research:RESEARCH,resource:RESOURCES,stock:STOCKS,bond:BONDS,venture:VENTURES,property:PROPERTIES})){
    for(const id of Object.keys(items)){const h=help(group+':'+id,s);assert.ok(h.title.length>1);assert.ok(h.body.length>100,`${group}:${id}`);}
  }
  const ui={qty:1,amount:100,fixedDays:20,open:new Set(),productionTab:'business',buildFilter:'all',marketFilter:'all',financeTab:'bank'};
  const html=V.production(s,ui);for(const id of Object.keys(BUILDINGS))assert.ok(html.includes(`data-id="building:${id}"`));
});
