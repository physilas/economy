import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.mjs';
import * as C from '../src/corporate.mjs';
import * as V from '../src/views.mjs';
import {BUILDINGS,RESOURCES,CHAINS,DAY,HOUR,ACHIEVEMENTS,PROGRAMMES} from '../src/data.mjs';
import {encode,decode} from '../src/storage.mjs';
import {advanceOfflineBatched} from '../src/offline.mjs';
import {normalizeUI} from '../src/ui-state.mjs';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} ≈ ${b}`);
function game(){const s=E.createGame('Holding',0,42);s.cash=1e6;s.tier=3;s.achievements=ACHIEVEMENTS.map(a=>a.id);E.checkProgress(s);return s;}
function firm(s,name='Werk GmbH',capital=10000){assert.ok(C.createCompany(s,name,'mixed',capital).ok);return s.group.companies.at(-1);}
const settings={name:'Industrie',ceo:null,mandate:'reserve',payout:0,reserve:100,budget:1000};

test('ten producible goods and factories form exactly four complete chains',()=>{
  assert.equal(Object.keys(BUILDINGS).length,10);assert.equal(Object.keys(RESOURCES).length,10);assert.equal(CHAINS.length,4);
  assert.deepEqual(new Set(CHAINS.flatMap(c=>c.buildings)),new Set(Object.keys(BUILDINGS)));
  for(const b of Object.values(BUILDINGS))for(const id of [...Object.keys(b.input),...Object.keys(b.output)])assert.ok(RESOURCES[id]);
});
test('founding pays only its fee and capital transfers conserve consolidated equity',()=>{
  const s=game(),before=E.assets(s).total,c=firm(s);near(E.assets(s).total,before-500);
  assert.ok(C.transferCapital(s,c.id,1000).ok);near(E.assets(s).total,before-500);
  assert.ok(C.transferCapital(s,c.id,500,'withdraw').ok);near(E.assets(s).total,before-500);
  const snapshot=JSON.stringify(s);assert.equal(C.transferCapital(s,c.id,Infinity).ok,false);assert.equal(JSON.stringify(s),snapshot);
});
test('factory, property and inventory transfers preserve assets and actual ownership',()=>{
  const s=game(),c=firm(s);E.build(s,'lumber',3);E.propertyTrade(s,'apartments',1,'buy');const before=E.assets(s).total;
  assert.ok(C.transferAsset(s,'holding',c.id,'building','lumber',2).ok);assert.equal(s.buildings.lumber.count,1);assert.equal(c.state.buildings.lumber.count,2);
  assert.ok(C.transferAsset(s,'holding',c.id,'property','apartments',1).ok);assert.ok(C.transferAsset(s,'holding',c.id,'inventory','wood',10).ok);near(E.assets(s).total,before);
  assert.equal(C.transferAsset(s,c.id,c.id,'building','lumber',1).ok,false);
});
test('operating a subsidiary debits its own cash and produces its own goods',()=>{
  const s=game(),c=firm(s),b=C.scopeCompany(s,c.id),holdingCash=s.cash;assert.ok(E.build(b,'lumber').ok);near(s.cash,holdingCash);const wood=s.inventory.wood;
  E.advance(s,HOUR*1000);assert.ok(c.state.inventory.wood>0);assert.ok(c.state.stats.expenses>0);near(s.inventory.wood,wood);assert.ok(c.state.stats.history.length);
});
test('all five market companies own real facilities or properties and can lose cash',()=>{
  const s=game();for(const c of s.group.companies){assert.ok(Object.values(c.state.buildings).some(b=>b.count)||Object.values(c.state.properties).some(p=>p.count));}
  const c=C.company(s,'sylva'),cash=c.state.cash;E.advance(s,HOUR*1000);assert.notEqual(c.state.cash,cash);assert.ok(c.state.stats.produced>0);
});
test('real share supply is finite and split immediate roundtrips cannot create wealth',()=>{
  const s=game(),c=C.company(s,'sylva'),cash=s.cash;
  assert.equal(E.stockTrade(s,c.id,c.shares+1,'buy').ok,false);assert.ok(E.stockTrade(s,c.id,100,'buy').ok);assert.ok(E.stockTrade(s,c.id,100,'sell').ok);assert.ok(s.cash<cash);
  s.cash=1e8;assert.ok(E.stockTrade(s,c.id,c.shares,'buy').ok);assert.equal(E.stockTrade(s,c.id,1,'buy').ok,false);assert.ok(C.controlled(s,c));
});
test('private shares require a reviewable accepted negotiation and support full takeovers',()=>{
  const s=game(),c=C.company(s,'forma');assert.equal(E.stockTrade(s,c.id,1,'buy').ok,false);
  assert.ok(C.offerPrivate(s,c.id,100,1).ok);assert.equal(c.offer.accepted,false);assert.equal(C.acceptOffer(s,c.id).ok,false);
  const counter=c.offer.counter;assert.ok(C.offerPrivate(s,c.id,100,counter).ok);assert.equal(c.offer.accepted,true);assert.equal(C.sharesHeld(s,c),0);
  const before=s.cash;assert.ok(C.acceptOffer(s,c.id).ok);assert.equal(C.ownership(s,c),1);near(before-s.cash,counter*1.005);assert.ok(C.controlled(s,c));
  assert.equal(C.acceptOffer(s,c.id).ok,false);
});
test('seller financing books the unpaid purchase price as a real liability',()=>{
  const s=game(),c=C.company(s,'nova');C.offerPrivate(s,c.id,25,1,'sellerLoan');const price=c.offer.counter;C.offerPrivate(s,c.id,25,price,'sellerLoan');const before=s.cash;
  assert.ok(C.acceptOffer(s,c.id).ok);near(before-s.cash,price*.505);near(E.assets(s).payables,price*.5);
  const p=s.group.payables[0];p.due=HOUR;E.advance(s,HOUR*1000);assert.equal(s.group.payables.length,0);
});
test('minority ownership prevents asset stripping and unapproved management changes',()=>{
  const s=game(),c=firm(s);c.held=4000;assert.equal(C.configureCompany(s,c.id,settings).ok,false);assert.equal(C.transferCapital(s,c.id,100).ok,false);assert.equal(C.transferAsset(s,'holding',c.id,'inventory','wood',1).ok,false);
  const ui=normalizeUI({companyId:c.id},s);assert.equal(ui.companyId,'holding');
});
test('IPO and a capital increase conserve shares and dilute existing owners',()=>{
  const s=game(),c=firm(s,'Finanz AG',100000);assert.ok(C.convertCompany(s,c.id,'ag').ok);assert.ok(C.listCompany(s,c.id).ok);
  const shares=c.shares,held=c.held,cash=c.state.cash,holdingCash=s.cash;assert.ok(C.raiseCapital(s,c.id,10000).ok);
  assert.ok(c.shares>shares);assert.equal(c.held,held);assert.ok(C.ownership(s,c)<1);near(c.state.cash,cash+9800);near(s.cash,holdingCash);
  assert.equal(C.raiseCapital(s,c.id,1000).ok,false);const rest=C.freeFloat(s,c);assert.ok(C.tradeOwnShares(s,c.id,rest,'buy').ok);assert.equal(C.ownership(s,c),1);
});
test('holding equity issues dilute the player and cannot multiply personal wealth',()=>{
  const s=game();assert.ok(C.convertCompany(s,'holding','ag').ok);assert.ok(C.listCompany(s,'holding').ok);const before=E.assets(s).total;
  assert.ok(C.raiseCapital(s,'holding',10000).ok);assert.ok(s.group.parent.held<s.group.parent.shares);assert.ok(E.assets(s).total<before);
});
test('positive distributable profit pays owners from the company cash exactly once',()=>{
  const s=game(),c=firm(s);c.held=6000;c.payout=.5;c.reserve=100;c.ceo=null;c.state.stats.revenue=1000;c.state.cash=10000;s.elapsed=DAY-HOUR;
  const before=s.cash;E.advance(s,HOUR*1000);near(s.cash-before,996*.5*.6);near(c.state.cash,10000-4-996*.5);
  const after=s.cash;E.advance(s,HOUR*1000+500);near(s.cash,after);
});
test('a CEO changes operations under its reserve and daily budget and reports decisions',()=>{
  const s=game(),c=firm(s);assert.ok(C.configureCompany(s,c.id,{...settings,ceo:'builder',mandate:'grow',budget:400,reserve:500}).ok);
  E.advance(s,HOUR*1000);assert.ok(Object.values(c.state.buildings).some(b=>b.count));assert.ok(c.spent<=400);assert.ok(c.state.cash>=500);assert.ok(c.report.length);
});
test('intercompany credit creates a matching receivable and debt, not fresh equity',()=>{
  const s=game(),c=firm(s);E.build(C.scopeCompany(s,c.id),'lumber',10);const before=E.assets(s).total;
  assert.ok(C.lendToCompany(s,c.id,1000).ok);near(E.assets(s).total,before);near(C.companyBalance(s,c).total,E.assets(C.scopeCompany(s,c.id)).total);near(E.assets(C.scopeCompany(s,c.id)).debt,1000);
  const b=C.scopeCompany(s,c.id);assert.equal(E.borrow(b,E.creditLimit(b)).ok,false);
});
test('a lender cannot pledge the same borrower assets beyond the secured limit',()=>{
  const s=game(),c=firm(s);E.build(C.scopeCompany(s,c.id),'lumber',10);assert.ok(C.lendToCompany(s,c.id,1000).ok);assert.equal(C.lendToCompany(s,c.id,1000).ok,false);
});
test('supply contracts exchange actual goods and cash without creating consolidated wealth',()=>{
  const s=game(),c=firm(s),price=E.price(s,'wood');assert.ok(C.createAgreement(s,{kind:'supply',from:'holding',to:c.id,resource:'wood',quantity:5,price,days:2}).ok);
  s.elapsed=DAY-HOUR;const wood=s.inventory.wood,firmWood=c.state.inventory.wood,totalCash=s.cash+c.state.cash;E.advance(s,HOUR*1000);
  near(s.inventory.wood,wood-5);near(c.state.inventory.wood,firmWood+5);near(s.cash+c.state.cash,totalCash-4);assert.equal(s.group.agreements[0].fulfilled,1);
  assert.equal(C.createAgreement(s,{kind:'supply',from:'holding',to:c.id,resource:'wood',quantity:1,price:price*10}).ok,false);
});
test('leased properties receive no duplicate outside rent and cannot be transferred mid-lease',()=>{
  const s=game(),c=firm(s);E.propertyTrade(s,'apartments',1,'buy');assert.ok(C.createAgreement(s,{kind:'lease',from:'holding',to:c.id,resource:'apartments',quantity:1,price:171,days:2}).ok);
  E.advance(s,500);near(s.stats.rent,0);assert.equal(C.transferAsset(s,'holding',c.id,'property','apartments',1).ok,false);
});
test('merging carries cash, assets, liabilities and tax ledgers without creating equity',()=>{
  const s=game(),c=firm(s),b=C.scopeCompany(s,c.id);E.build(b,'lumber');E.trade(b,'wood',1,'buy');const before=E.assets(s).total;
  assert.ok(C.mergeCompany(s,c.id).ok);near(E.assets(s).total,before);assert.equal(C.company(s,c.id),undefined);assert.equal(s.buildings.lumber.count,1);assert.ok(s.dayLedger.costs>0);
});
test('corporate live, offline and irregular catchup preserve identical company state',async()=>{
  const a=game(),c=firm(a);E.build(C.scopeCompany(a,c.id),'lumber');C.configureCompany(a,c.id,{...settings,ceo:'builder',mandate:'grow'});C.lendToCompany(a,c.id,100);
  const b=structuredClone(a),d=structuredClone(a),end=2*DAY*1000;E.advance(a,end);for(let time=13000;time<end;time+=13000)E.advance(b,time);E.advance(b,end);await advanceOfflineBatched(d,end,{yieldControl:async()=>{}});
  assert.deepEqual(a,b);assert.deepEqual(a,d);assert.deepEqual(decode(encode(a),a.lastUpdate).game,a);
});
test('removed legacy content is compensated once and new saves roundtrip',()=>{
  const raw=E.createGame('Legacy',0,42);delete raw.economyRevision;delete raw.group;raw.buildings.aerospace={count:1,active:1,level:0,book:10000};raw.inventory.water=100;raw.infra.city=1;raw.infraBook.city=5000;raw.options.push({resource:'water',premium:50});
  const restored=E.validateGame(raw,0);near(restored.cash,1200+10000+100*3*.98+5000+50);assert.ok(!Object.hasOwn(restored.inventory,'water'));assert.ok(!Object.hasOwn(restored.buildings,'aerospace'));assert.equal(restored.options.length,0);
  assert.deepEqual(E.validateGame(restored,0),restored);
});
test('hostile imports reject duplicate firms, invalid assets and excess real share claims',()=>{
  const s=game(),c=firm(s);s.group.companies.push(structuredClone(c));s.group.companies.push({...c,id:'__proto__'});s.stocks.sylva.quantity=20000;
  const v=E.validateGame(s,0);assert.equal(v.group.companies.filter(x=>x.id===c.id).length,1);assert.equal(C.company(v,'__proto__'),undefined);assert.equal(v.stocks.sylva.quantity,10000);assert.ok(v.cash>s.cash);assert.deepEqual(E.validateGame(v,0),v);
});
test('every company control and valuation renders safely including hostile names',()=>{
  const s=game();firm(s,'<img src=x onerror=alert(1)>');const ui=normalizeUI({},s);
  for(const mode of ['owned','market','contracts']){ui.companyTab=mode;const html=V.companiesView(s,ui);assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));assert.ok(!html.includes('<img src=x'));}
  for(const fn of [V.newCompanyForm,()=>V.companySettingsForm(s,s.group.companies.at(-1).id),()=>V.transferAssetForm(s),()=>V.agreementForm(s)])assert.ok(!fn().includes('undefined'));
});
test('holding programs now fit an active session instead of several real days',()=>{assert.ok(PROGRAMMES.every(p=>p.duration<=3600));assert.ok(PROGRAMMES[0].duration<=600);});

test('cash and asset extractions from acquired market companies conserve real consolidated equity',()=>{
  const s=game();s.cash=1e8;const c=C.company(s,'sylva');assert.ok(E.stockTrade(s,c.id,c.shares,'buy').ok);
  const before=E.assets(s).total;assert.ok(C.transferCapital(s,c.id,1000,'withdraw').ok);near(E.assets(s).total,before);
  assert.ok(C.transferAsset(s,c.id,'holding','building','lumber',1).ok);near(E.assets(s).total,before);
});
test('indirect voting control does not allow extraction of minority investors economic property',()=>{
  const s=game(),c=firm(s,'Investment',900000);c.held=5100;const b=C.scopeCompany(s,c.id),world=C.company(s,'sylva');assert.ok(E.stockTrade(b,world.id,world.shares,'buy').ok);
  assert.equal(C.ownership(s,world),1);near(C.economicOwnership(s,world),.51);assert.equal(C.transferCapital(s,world.id,1000,'withdraw').ok,false);assert.equal(C.transferAsset(s,world.id,'holding','building','lumber',1).ok,false);
});
test('a private takeover followed by IPO and immediate resale cannot generate cash profit',()=>{
  const s=game(),c=C.company(s,'forma'),cash=s.cash;C.offerPrivate(s,c.id,100,1);C.offerPrivate(s,c.id,100,c.offer.counter);assert.ok(C.acceptOffer(s,c.id).ok);assert.ok(C.convertCompany(s,c.id,'ag').ok);assert.ok(C.listCompany(s,c.id).ok);near(s.stocks[c.id].price,c.price);assert.ok(E.stockTrade(s,c.id,c.shares,'sell').ok);assert.ok(s.cash<cash);
});
test('seller-financing capacity is checked before issuing a new liability',()=>{
  const s=game(),c=C.company(s,'nova');for(let i=0;i<20;i++){C.offerPrivate(s,c.id,1,1,'sellerLoan');C.offerPrivate(s,c.id,1,c.offer.counter,'sellerLoan');assert.ok(C.acceptOffer(s,c.id).ok);}C.offerPrivate(s,c.id,1,1,'sellerLoan');C.offerPrivate(s,c.id,1,c.offer.counter,'sellerLoan');assert.equal(C.acceptOffer(s,c.id).ok,false);assert.equal(s.group.payables.length,20);assert.deepEqual(decode(encode(s),0).game,s);
});
test('holding equity rounds retain the founders voting majority',()=>{
  const s=game();C.convertCompany(s,'holding','ag');C.listCompany(s,'holding');for(let i=0;i<2;i++){const value=E.assets(s).groupEquity*.29;assert.ok(C.raiseCapital(s,'holding',value).ok);s.elapsed+=5*DAY;}
  const before=JSON.stringify(s);assert.equal(C.raiseCapital(s,'holding',E.assets(s).groupEquity*.29).ok,false);assert.equal(JSON.stringify(s),before);assert.ok(s.group.parent.held/s.group.parent.shares>.5);
});
test('tenant companies receive the promised capacity and lose it when the contract ends',()=>{
  const s=game(),c=firm(s),b=C.scopeCompany(s,c.id);E.propertyTrade(s,'apartments',1,'buy');const workforce=E.workforce(b);C.createAgreement(s,{kind:'lease',from:'holding',to:c.id,resource:'apartments',quantity:1,price:171,days:2});assert.equal(E.workforce(b),workforce+10);C.cancelAgreement(s,s.group.agreements[0].id);assert.equal(E.workforce(b),workforce);
});
test('company-owned property values follow the common economy market',()=>{
  const s=game(),c=firm(s,'Immobilien',30000);assert.ok(E.propertyTrade(C.scopeCompany(s,c.id),'apartments',1,'buy').ok);E.advance(s,HOUR*1000);near(c.state.properties.apartments.index,s.properties.apartments.index);assert.ok(C.transferAsset(s,c.id,'holding','property','apartments',1).ok);
});
test('private financial details require a completed company examination',()=>{
  const s=game(),ui=normalizeUI({companyTab:'market'},s),c=C.company(s,'nova');let html=V.companiesView(s,ui);assert.ok(html.includes('Eine Unternehmensprüfung für 150 €'));assert.ok(C.inspectCompany(s,c.id).ok);html=V.companiesView(s,ui);assert.ok(html.includes('Unternehmensprüfung liegt vor'));
});
test('private dividends reinvested into a diluted holding preserve personal equity',()=>{
  const s=game();C.convertCompany(s,'holding','ag');C.listCompany(s,'holding');C.raiseCapital(s,'holding',10000);s.group.wallet=5000;const before=E.assets(s).total;assert.ok(C.reinvestWallet(s,4000).ok);near(E.assets(s).total,before,1e-6);
});
test('rendering scoped operation views keeps the chosen company and charges its own account',()=>{
  const s=game(),c=firm(s),b=C.scopeCompany(s,c.id),ui=normalizeUI({companyId:c.id},s);
  for(const render of [V.production,V.finance,V.analysis]){render(b,ui);assert.equal(ui.companyId,c.id);}
  assert.ok(V.frame(s,ui,'').includes(`value="${c.id}" selected`));const cash=s.cash;assert.ok(E.build(b,'lumber').ok);near(s.cash,cash);
});
test('company snapshots retain common markets and tenant capacity in previews without mutation',async()=>{
  const {previewBuilding}=await import('../src/planning.mjs');const s=game(),c=firm(s),b=C.scopeCompany(s,c.id);E.propertyTrade(s,'apartments',1,'buy');C.createAgreement(s,{kind:'lease',from:'holding',to:c.id,resource:'apartments',quantity:1,price:171,days:2});const before=JSON.stringify(s),p=previewBuilding(b,'lumber');assert.equal(p.capacity.staff.available,22);E.currentSupplyPlan(b);assert.equal(JSON.stringify(s),before);
});
test('retired research and paid legacy programs keep their investment value and permanent bonuses',()=>{
  const raw=E.createGame('Legacy',0,42);delete raw.economyRevision;delete raw.group;raw.research.computing=2;raw.campaign.completed=[{chapter:'identity',choice:'production'},{chapter:'reliability',choice:'production'},{chapter:'borders',choice:'production'},{chapter:'connections',choice:'finance'}];raw.campaign.active={chapter:'systems',choice:'logistics',start:0,end:100000};
  const s=E.validateGame(raw,0);near(s.cash,1200+180000+180000*2.2);assert.ok(s.points>=350+Math.round(350*1.75));assert.equal(s.campaign.bonuses.finance,12);assert.equal(s.campaign.bonuses.logistics,12);assert.equal(s.campaign.active,null);assert.deepEqual(E.validateGame(s,0),s);
});
test('legacy synthetic private shares receive one cash adjustment when converted to real company value',()=>{
  const raw=E.createGame('Legacy shares',0,42);delete raw.group;delete raw.economyRevision;raw.stocks.forma.quantity=100;raw.stocks.forma.price=85;const old=1200+100*85*.995;
  const s=E.validateGame(raw,0);near(s.cash+E.assets(s).securities,old);assert.deepEqual(E.validateGame(s,0),s);
});
test('a finance subsidiary owns its own bond claim and receives actual issuer repayments',()=>{
  const s=game(),c=firm(s,'Finanzen',10000),b=C.scopeCompany(s,c.id),before=E.assets(s).total,holding=s.cash;
  assert.ok(C.lendToCompany(s,'sylva',1000,c.id,'bond').ok);near(s.cash,holding);near(E.assets(s).total,before);near(E.assets(b).receivables,1000);assert.equal(s.group.loans[0].kind,'bond');
  E.advance(s,10*DAY*1000);assert.equal(s.group.loans.length,0);assert.ok(c.state.stats.interest>0);assert.ok(c.state.cash>10000-40);assert.deepEqual(decode(encode(s),s.lastUpdate).game,s);
});
test('unpaid issuer obligations create actual lender losses after five missed payments',()=>{
  const s=game(),c=C.company(s,'sylva'),cash=s.cash;assert.ok(C.lendToCompany(s,c.id,1000).ok);c.state.cash=0;c.ceo=null;for(const b of Object.values(c.state.buildings))b.active=0;for(const r of Object.keys(c.state.inventory))c.state.inventory[r]=0;
  E.advance(s,5*DAY*1000);assert.equal(s.group.loans.length,0);assert.ok(s.cash>=cash-100);assert.ok(c.state.buildings.lumber.count<8);assert.ok(s.journal.some(j=>j.text.includes('Forderungsverlust')));
});
test('private holding distributions include real daughter dividends and debit the company once',()=>{
  const s=game(),c=firm(s);C.setParentPayout(s,1);c.ceo=null;c.payout=1;c.reserve=100;c.state.stats.revenue=1000;c.state.dayLedger.revenue=1000;s.elapsed=DAY-HOUR;
  E.advance(s,HOUR*1000);assert.ok(s.group.wallet>0);assert.ok(s.group.wallet<1000);assert.equal(s.group.parent.listed,false);
});
test('secured borrower cash and assets cannot be stripped against a partly owned lender',()=>{
  const s=game(),lender=firm(s,'Finanzen',10000),borrower=firm(s,'Produktion',10000);lender.held=5100;E.build(C.scopeCompany(s,borrower.id),'lumber',10);assert.ok(C.lendToCompany(s,borrower.id,1000,lender.id).ok);
  assert.equal(C.transferCapital(s,borrower.id,borrower.state.cash,'withdraw').ok,false);assert.equal(C.transferAsset(s,borrower.id,'holding','building','lumber',10).ok,false);assert.ok(C.repayCorporateLoan(s,s.group.loans[0].id).ok);assert.ok(C.transferAsset(s,borrower.id,'holding','building','lumber',10).ok);
});
test('internal interest has matching tax entries and cannot lower consolidated operating taxes',()=>{
  const a=game(),c=firm(a);E.build(C.scopeCompany(a,c.id),'lumber',10);for(const b of Object.values(c.state.buildings))b.active=0;E.trade(a,'wood',10,'sell');const b=structuredClone(a);C.lendToCompany(b,c.id,1000);E.advance(a,DAY*1000);E.advance(b,DAY*1000);near(a.stats.taxes,b.stats.taxes);near(E.assets(a).total,E.assets(b).total,1e-6);
});
test('crossing the control threshold keeps one continuous share valuation basis',()=>{
  const s=game();E.stockTrade(s,'sylva',5000,'buy');const before=E.assets(s).total;E.stockTrade(s,'sylva',1,'buy');assert.ok(Math.abs(E.assets(s).total-before)<100);assert.ok(C.controlled(s,C.company(s,'sylva')));
});
test('retired index holdings and unavailable automatic plans are safely unwound on import',()=>{
  const s=game(),cash=s.cash;s.stocks.index.quantity=10;s.stocks.index.reserve=7;s.stocks.nova.drip=true;s.stocks.nova.reserve=5;s.savingsPlans.push({id:99,stock:'index',budget:100,period:1,next:DAY,executions:0,skipped:0});const v=E.validateGame(s,0);near(v.cash,cash+10*s.stocks.index.price*.995+12);assert.equal(v.stocks.index.quantity,0);assert.equal(v.stocks.nova.drip,false);assert.equal(v.savingsPlans.length,0);assert.equal(E.createSavingsPlan(v,'index',100,1).ok,false);assert.deepEqual(E.validateGame(v,0),v);
});
test('large real company valuations survive saves beyond former synthetic stock price limits',()=>{
  const s=game(),c=C.company(s,'nova');c.state.cash=1e9;E.advance(s,5000);assert.ok(s.stocks.nova.price>210*12);assert.deepEqual(E.validateGame(s,s.lastUpdate),s);
});
test('an insolvent limited subsidiary can be wound up without erasing healthy group companies',()=>{
  const s=game(),bad=firm(s,'Schieflage'),healthy=firm(s,'Bestand');bad.state.debt=30000;bad.state.cash=0;const before=E.assets(s).total;assert.ok(C.liquidateCompany(s,bad.id).ok);assert.equal(C.company(s,bad.id),undefined);assert.ok(C.company(s,healthy.id));near(E.assets(s).total,before);
});
test('an insolvent subsidiary cannot discard unpaid intra-group creditor claims',()=>{
  const s=game(),c=firm(s);E.build(C.scopeCompany(s,c.id),'lumber',10);assert.ok(C.lendToCompany(s,c.id,1000).ok);c.state.debt=30000;c.state.cash=0;assert.equal(C.liquidateCompany(s,c.id).ok,false);assert.equal(s.group.loans.length,1);
});
