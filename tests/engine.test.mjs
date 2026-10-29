import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, build, buildQuote, trade, quote, price, assets, capacity, bankTransfer, borrow, repay, investBond, fixedDeposit, redeemFixed, investVenture, stockTrade, research, placeOrder, acceptContract, fulfillContract, validateGame, prestige } from '../src/engine.mjs';
import { ACHIEVEMENTS, RESOURCES, BUILDINGS, DAY, OFFLINE_LIMIT } from '../src/data.mjs';
import { encode, decode, save, load } from '../src/storage.mjs';

const START = 1800000000000;
function game() { const s = createGame('Test', START, 42); s.achievements = ACHIEVEMENTS.map(a => a.id); return s; }
function near(a, b, tolerance = 0.00001) { assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`); }

test('initial discovery progress includes the value of the starting material reserves',()=>{
  const s=createGame('Start',START,42);
  near(s.stats.peak,assets(s).total);assert.ok(s.stats.peak>s.cash);assert.equal(s.cash,1200);
});

test('production and offline catchup are deterministic across reload intervals', () => {
  const a = game(); build(a, 'lumber', 2); a.automation.wood = { mode: 'sell', low: 0, high: 10 };
  const b = structuredClone(a);
  advance(a, START + 3600000);
  for (let i = 1; i <= 720; i++) advance(b, START + i * 5000);
  assert.deepEqual(a, b);
  assert.ok(a.stats.produced > 0); assert.ok(a.stats.revenue > 0);
});

test('buy and immediate resale cannot create money, even at price boundaries', () => {
  for (const pressure of [-4, -1.5, 0, 1.5, 4]) {
    const s = game(); s.cash = 1e8; s.infra.warehouse = 100; s.market.wood.pressure = pressure;
    const cash = s.cash; assert.ok(trade(s, 'wood', 1000, 'buy').ok); assert.ok(trade(s, 'wood', 1000, 'sell').ok);
    assert.ok(s.cash < cash, `pressure ${pressure}`);
  }
});

test('quotes integrate price impact and split trades have identical gross cost', () => {
  const s = game(), q = quote(s, 'wood', 100, 'buy');
  s.cash = 1e6;
  const first = trade(s, 'wood', 40, 'buy'), second = trade(s, 'wood', 60, 'buy');
  near(q.total, first.total + second.total);
  assert.ok(price(s, 'wood') > RESOURCES.wood.base);
});

test('unaffordable construction is atomic and materials are priced', () => {
  const s = game(), before = structuredClone(s);
  assert.equal(build(s, 'lumber', 100).ok, false); assert.deepEqual(s, before);
  s.tier = 2; s.cash = 1e6; const q = buildQuote(s, 'smelter', 2);
  assert.ok(q.materialCash > 0); const cash = s.cash;
  assert.ok(build(s, 'smelter', 2).ok); near(cash - s.cash, q.total);
  assert.equal(s.buildings.smelter.count, 2); assert.ok(s.inventory.bricks >= 0);
});

test('construction capitalizes owned materials instead of deleting their value',()=>{
  const s=game();s.cash=100000;s.tier=2;s.inventory.bricks=80;s.inventory.planks=60;
  const before=assets(s).total,q=buildQuote(s,'smelter',2);
  assert.equal(q.materialCash,0);assert.ok(q.book>q.total);assert.ok(build(s,'smelter',2).ok);
  near(assets(s).total,before);assert.equal(s.inventory.bricks,0);assert.equal(s.inventory.planks,0);
});

test('production stops with no inputs, wages or storage', () => {
  const s = game(); s.tier = 1; s.cash = 10000; build(s, 'sawmill');
  s.inventory.wood = 0; advance(s, START + 60000); assert.equal(s.inventory.planks, 0);
  s.inventory.wood = 100; s.cash = 0; advance(s, START + 120000); assert.equal(s.inventory.planks, 0);
  s.cash = 1000; s.inventory.planks = 500; advance(s, START + 180000); assert.equal(s.inventory.planks, 500);
});

test('workforce, power and freight constrain production', () => {
  const s = game(); s.cash = 1e9; s.tier = 6; build(s, 'lumber', 20);
  assert.ok(capacity(s).staffing < 1); assert.ok(capacity(s).logistics < 1);
  build(s, 'housing', 10, true); build(s, 'transport', 10, true);
  assert.equal(capacity(s).staffing, 1); assert.equal(capacity(s).logistics, 1);
});

test('bank transfers conserve capital and net interest increases wealth', () => {
  const s = game(), before = assets(s).total;
  assert.ok(bankTransfer(s, 'reserve', 500, 'deposit').ok); near(assets(s).total, before);
  advance(s, START + DAY * 1000); assert.ok(s.banks.reserve > 500);
  assert.ok(bankTransfer(s, 'reserve', 500, 'withdraw').ok);
  assert.equal(bankTransfer(s, 'reserve', 1000, 'withdraw').ok, false);
});

test('loans respect collateral; borrowing and repayment conserve equity', () => {
  const s = game(), wealth = assets(s).total;
  assert.equal(borrow(s, 1000000).ok, false); assert.ok(borrow(s, 500).ok); near(assets(s).total, wealth);
  assert.ok(repay(s, 500).ok); near(assets(s).total, wealth); assert.equal(s.debt, 0);
});

test('fixed deposits have explicit early withdrawal loss', () => {
  const s = game(); fixedDeposit(s, 500, 10); const id = s.bonds[0].id;
  assert.ok(redeemFixed(s, id).ok); near(s.cash, 1190); assert.equal(s.bonds.length, 0);
});

test('guaranteed bonds mature once and pay net interest', () => {
  const s = game(); investBond(s, 'state', 1000);
  advance(s, START + 10 * DAY * 1000);
  assert.equal(s.bonds.length, 0); assert.ok(s.cash > 1200);
  const cash = s.cash; advance(s, s.lastUpdate + 5000); near(s.cash, cash);
});

test('stocks reject shorts and apply capital gain tax only on profits', () => {
  const s = game(); s.tier = 1;
  assert.equal(stockTrade(s, 'sylva', 1, 'sell').ok, false);
  stockTrade(s, 'sylva', 1, 'buy'); s.stocks.sylva.price *= 2;
  stockTrade(s, 'sylva', 1, 'sell'); assert.equal(s.stocks.sylva.quantity, 0); near(s.stocks.sylva.basis, 0); assert.ok(s.stats.taxes > 0);
});

test('limit orders wait for their all-in price and cannot overspend', () => {
  const s = game(); placeOrder(s, 'wood', 'buy', 10, 0.01); advance(s, START + 5000);
  assert.equal(s.orders.length, 1);
  s.orders[0].limit = 100; advance(s, START + 10000); assert.equal(s.orders.length, 0); assert.ok(s.inventory.wood > 24);
});

test('contracts consume full quantities and grant reputation', () => {
  const s = game(), c = s.board[0]; acceptContract(s, c.id);
  assert.equal(fulfillContract(s, c.id).ok, false); s.inventory[c.resource] = c.quantity;
  assert.ok(fulfillContract(s, c.id).ok); assert.equal(s.contracts.length, 0); assert.equal(s.reputation, 52);
});

test('research cost and prerequisites are enforced', () => {
  const s = game(); assert.equal(research(s, 'forestry').ok, false);
  s.tier = 1; s.cash = 10000; s.points = 100;
  assert.ok(research(s, 'forestry').ok); assert.equal(s.research.forestry, 1); assert.equal(s.points, 80);
});

test('offline limit, substep time and backward clocks are safe', () => {
  const s = game(); assert.equal(advance(s, START - 10000).clockBack, true);
  assert.equal(advance(s, START + 999).seconds, 0);
  const result = advance(s, START + (OFFLINE_LIMIT + 100) * 1000 + 3000);
  assert.equal(result.seconds, OFFLINE_LIMIT); assert.equal(result.skipped, 103); assert.equal(s.lastUpdate, START + (OFFLINE_LIMIT + 100) * 1000 + 3000);
});

for(const guard of [false,true])test(`week-long complex economy remains finite with margin guard ${guard ? 'on' : 'off'}`, () => {
  const s = game(); s.cash = 1e8; s.tier = 6;s.profitGuard=guard;
  for (const id of Object.keys(BUILDINGS)) build(s, id, 1);
  for (const id of ['housing', 'power', 'warehouse', 'transport', 'solar', 'lab']) build(s, id, 10, true);
  for (const id of Object.keys(RESOURCES)) { s.inventory[id] = 100; s.automation[id] = { mode: 'both', low: 30, high: 150 }; }
  bankTransfer(s, 'reserve', 100000, 'deposit'); borrow(s, 10000); s.tier = 6;
  investVenture(s, 'trade', 2000);
  advance(s, START + OFFLINE_LIMIT * 1000, { offline: true });
  assert.ok(Number.isFinite(assets(s).total)); assert.ok(s.cash >= 0);
  for (const value of Object.values(s.inventory)) assert.ok(Number.isFinite(value) && value >= 0);
  assert.equal(s.ventures.length, 0);
});

test('save encoding detects truncation and state roundtrips exactly', () => {
  const s = game(); build(s, 'lumber'); advance(s, START + 120000);
  const encoded = encode(s), decoded = decode(encoded, START + 120000).game;
  assert.deepEqual(decoded, s);
  assert.throws(() => decode(encoded.slice(0, -10)));
  const tampered = JSON.parse(encoded); tampered.data = tampered.data.replace('Test', 'Fake');
  assert.throws(() => decode(JSON.stringify(tampered)), /Prüfsumme/);
});

test('damaged autosaves recover previous verified snapshot', () => {
  const map = new Map(), store = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  const s = game(); save(s, 'auto', store); s.cash = 999; save(s, 'auto', store);
  map.set('null-economy:v1:auto', 'broken');
  const result = load('auto', store, START); assert.equal(result.recovered, true); assert.equal(result.game.cash, 1200);
});

test('imports reject incompatible versions and sanitize untrusted fields', () => {
  assert.throws(() => validateGame({ version: 99 }));
  const raw = game(); raw.cash = Infinity; raw.inventory.wood = -10; raw.buildings.lumber.count = 3; raw.buildings.lumber.active = 999;
  const s = validateGame(raw, START); assert.equal(s.cash, 0); assert.equal(s.inventory.wood, 0); assert.equal(s.buildings.lumber.active, 3);
});

test('prestige requires wealth and carries permanent production bonus', () => {
  const s = game(); assert.equal(prestige(s, START), null);
  s.stats.peak = 400000000; const next = prestige(s, START); assert.equal(next.legacy, 2); assert.equal(next.prestigeCount, 1); assert.equal(next.buildings.lumber.count, 0);
});
