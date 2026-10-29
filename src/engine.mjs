import { VERSION, STEP, HOUR, DAY, OFFLINE_LIMIT, RESOURCES, BUILDINGS, INFRA, RESEARCH, STOCKS, BANKS, BONDS, VENTURES, EVENTS, ACHIEVEMENTS, POLICIES, TIERS } from './data.mjs';

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);
const finite = (n, fallback = 0, max = 1e15) => typeof n === 'number' && Number.isFinite(n) ? clamp(n, 0, max) : fallback;
const empty = keys => Object.fromEntries(Object.keys(keys).map(k => [k, 0]));
const fail = message => ({ ok: false, message });
const ok = (message, extra = {}) => ({ ok: true, message, ...extra });

export function random(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

export function createGame(name = 'Mein Unternehmen', now = Date.now(), seed = (Date.now() ^ 0x9e3779b9) >>> 0) {
  const s = {
    version: VERSION, name: String(name).trim().slice(0, 36) || 'Mein Unternehmen', created: now, lastUpdate: now,
    seed, elapsed: 0, cash: 1200, inventory: { ...empty(RESOURCES), wood: 15, stone: 10, grain: 10, water: 20 },
    buildings: Object.fromEntries(Object.keys(BUILDINGS).map(k => [k, { count: 0, active: 0, level: 0, book: 0 }])),
    infra: empty(INFRA), infraBook: empty(INFRA), research: empty(RESEARCH), points: 0,
    market: Object.fromEntries(Object.entries(RESOURCES).map(([k, d]) => [k, { factor: 1, pressure: 0, history: [d.base], previous: d.base }])),
    automation: Object.fromEntries(Object.keys(RESOURCES).map(k => [k, { mode: 'off', low: 20, high: 100 }])),
    stocks: Object.fromEntries(Object.entries(STOCKS).map(([k, d]) => [k, { price: d.base, previous: d.base, history: [d.base], quantity: 0, basis: 0 }])),
    banks: { reserve: 0, savings: 0 }, bonds: [], ventures: [], orders: [], loans: [], debt: 0,
    policy: 'balanced', priority: 'balanced', reputation: 50, tier: 0, legacy: 0, prestigeCount: 0,
    contracts: [], board: [], achievements: [], journal: [], nextId: 1,
    event: null, economy: { cycle: 1, rate: 0.001, inflation: 2, phase: 'Stabil' },
    stats: { built: 0, trades: 0, produced: 0, revenue: 0, expenses: 0, interest: 0, dividends: 0, taxes: 0, contracts: 0, peak: 1200, lastProfit: 0, lastRevenue: 0, lastCosts: 0, history: [], resets: 0 },
    hourLedger: { revenue: 0, costs: 0 }, dayLedger: { revenue: 0, costs: 0 },
    tutorial: true, settings: { confirmLarge: true },
  };
  log(s, 'Willkommen bei NULL. Dein Unternehmen beginnt mit 1.200 € und einer kleinen Materialreserve.', 'milestone');
  refreshBoard(s);
  return s;
}

export function log(s, text, type = 'info') {
  s.journal.unshift({ id: s.nextId++, at: s.elapsed, text, type });
  s.journal.length = Math.min(s.journal.length, 100);
}

export function price(s, id) {
  const d = RESOURCES[id], m = s.market[id];
  return d ? d.base * m.factor * Math.exp(clamp(m.pressure, -1.5, 1.5)) : 0;
}
export const liquidity = id => 4800 / Math.pow(RESOURCES[id].base, 0.38);
export const feeRate = s => Math.max(0.004, 0.012 * (1 - s.research.finance * 0.1) * (1.1 - s.reputation / 500));

// Exact integral of the marginal price, including its upper and lower bounds.
function priceIntegral(a, b) {
  if (a === b) return 0;
  if (a > b) return -priceIntegral(b, a);
  let total = 0;
  if (a < -1.5) total += (Math.min(b, -1.5) - a) * Math.exp(-1.5);
  const lo = Math.max(a, -1.5), hi = Math.min(b, 1.5);
  if (hi > lo) total += Math.exp(hi) - Math.exp(lo);
  if (b > 1.5) total += (b - Math.max(a, 1.5)) * Math.exp(1.5);
  return total;
}

export function quote(s, id, amount, side = 'buy') {
  if (!RESOURCES[id] || !Number.isFinite(amount) || amount <= 0 || amount > 1e8) return { total: 0, unit: 0, fee: 0, gross: 0 };
  const m = s.market[id], l = liquidity(id), direction = side === 'buy' ? 1 : -1;
  const gross = Math.abs(RESOURCES[id].base * m.factor * l * priceIntegral(m.pressure, m.pressure + direction * amount / l));
  const fee = gross * (feeRate(s) + 0.008);
  const total = side === 'buy' ? gross + fee : gross - fee;
  return { total, unit: total / amount, fee, gross };
}

function revenue(s, amount) {
  s.cash += amount;
  s.stats.revenue += amount;
  s.hourLedger.revenue += amount;
  s.dayLedger.revenue += amount;
}
function expense(s, amount) {
  s.cash -= amount;
  s.stats.expenses += amount;
  s.hourLedger.costs += amount;
  s.dayLedger.costs += amount;
}

export function trade(s, id, amount, side, automated = false) {
  if (!RESOURCES[id] || !Number.isFinite(amount) || amount <= 0 || amount > 1e8 || !['buy', 'sell'].includes(side)) return fail('Ungültiger Handelsauftrag.');
  if (RESOURCES[id].tier > s.tier) return fail('Diese Ware ist noch nicht freigeschaltet.');
  if (side === 'sell' && s.inventory[id] + 1e-7 < amount) return fail('Nicht genügend Ware im Lager.');
  if (side === 'buy' && s.inventory[id] + amount > warehouseCapacity(s) + 1e-7) return fail('Das Lager ist voll.');
  const q = quote(s, id, amount, side);
  if (side === 'buy' && q.total > s.cash + 1e-7) return fail('Nicht genügend frei verfügbares Geld.');
  s.inventory[id] = Math.max(0, s.inventory[id] + (side === 'buy' ? amount : -amount));
  s.market[id].pressure = clamp(s.market[id].pressure + (side === 'buy' ? amount : -amount) / liquidity(id), -4, 4);
  if (side === 'buy') expense(s, q.total); else revenue(s, q.total);
  s.cash = Math.max(0, s.cash);
  s.stats.trades++;
  if (!automated) checkAchievements(s);
  return ok(`${RESOURCES[id].name} ${side === 'buy' ? 'gekauft' : 'verkauft'}.`, { amount, total: q.total });
}

export function warehouseCapacity(s) { return (500 + s.infra.warehouse * 500) * (1 + s.research.logistics * 0.1); }
export function workforce(s) { return 12 + s.infra.housing * 20; }
export function productionBonus(s, id, offline = false) {
  const b = BUILDINGS[id], level = s.buildings[id].level;
  let mult = (1 + level * 0.18) * (1 + s.research.efficiency * 0.08) * (1 + s.legacy * 0.08) * POLICIES[s.policy].output;
  if (id === 'lumber') mult *= 1 + s.research.forestry * 0.2;
  if (['farm', 'cottonFarm'].includes(id)) mult *= (1 + s.research.agronomy * 0.2) * (s.event?.farm || 1);
  if (b.tier >= 4) mult *= 1 + s.research.computing * 0.15;
  if (offline) mult *= 1 + s.research.patience * 0.1;
  return mult;
}

export function capacity(s) {
  let staff = 0, energy = 0, freight = 0, pollution = 0, wages = 0;
  for (const [id, b] of Object.entries(BUILDINGS)) {
    const n = s.buildings[id].active;
    staff += n * b.staff * Math.pow(0.92, s.research.automation);
    energy += n * b.energy;
    freight += n * b.freight;
    pollution += n * b.pollution;
    wages += n * b.wage * (1 + s.buildings[id].level * 0.08) * POLICIES[s.policy].wage;
  }
  pollution = Math.max(0, pollution * POLICIES[s.policy].pollution * Math.pow(0.88, s.research.ecology) - s.infra.park * 8);
  const powerBonus = 1 + s.research.energy * 0.15;
  const cleanEnergy = 6 + s.infra.solar * 20 * powerBonus * (s.event?.solar || 1);
  const potentialEnergy = cleanEnergy + s.infra.power * 25 * powerBonus;
  const availableEnergy = cleanEnergy + (s.inventory.coal > 0.001 ? s.infra.power * 25 * powerBonus : 0);
  const transport = (12 + s.infra.transport * 20) * (1 + s.research.logistics * 0.2) * (s.event?.freight || 1);
  return { staff, workers: workforce(s), energy, cleanEnergy, potentialEnergy, availableEnergy, freight, transport, pollution, wages,
    staffing: staff ? Math.min(1, workforce(s) / staff) : 1,
    power: energy ? Math.min(1, availableEnergy / energy) : 1,
    logistics: freight ? Math.min(1, transport / freight) : 1,
    environment: Math.max(0.55, 1 - Math.max(0, pollution - 30) * 0.003),
    ecoCost: Math.max(0, pollution - 15) * 0.65 * (s.event?.pollution || 1),
  };
}

export function buildingRate(s, id, offline = false) {
  const b = BUILDINGS[id], own = s.buildings[id], c = capacity(s);
  const global = Math.min(c.staffing, c.power, c.logistics) * c.environment;
  const mult = productionBonus(s, id, offline);
  let supply = 1;
  for (const [r, q] of Object.entries(b.input)) {
    if (s.inventory[r] < q * own.active * mult * STEP / HOUR) supply = Math.min(supply, s.inventory[r] / (q * own.active * mult * STEP / HOUR || 1));
  }
  const r = Object.keys(b.output)[0];
  const storage = s.inventory[r] >= warehouseCapacity(s) - 0.01 ? 0 : 1;
  const utilization = own.active ? global * supply * storage : 0;
  const outValue = sum(Object.fromEntries(Object.entries(b.output).map(([k, v]) => [k, v * price(s, k)])));
  const inValue = sum(Object.fromEntries(Object.entries(b.input).map(([k, v]) => [k, v * price(s, k)])));
  const margin = (outValue - inValue) * mult - b.wage * (1 + own.level * 0.08) * POLICIES[s.policy].wage;
  return { utilization, mult, units: own.active * mult * utilization, margin, global, supply, storage };
}

export function buildQuote(s, id, amount = 1, infrastructure = false) {
  const d = infrastructure ? INFRA[id] : BUILDINGS[id];
  if (!d || !Number.isInteger(amount) || amount < 1 || amount > 100) return null;
  const n = infrastructure ? s.infra[id] : s.buildings[id].count, growth = infrastructure ? d.growth : 1.13;
  const cash = d.cost * Math.pow(growth, n) * (Math.pow(growth, amount) - 1) / (growth - 1);
  const materials = {};
  let materialCash = 0;
  for (const [r, q] of Object.entries(d.materials || {})) {
    materials[r] = q * amount;
    materialCash += quote(s, r, Math.max(0, q * amount - s.inventory[r]), 'buy').total;
  }
  return { cash, materials, materialCash, total: cash + materialCash };
}

export function build(s, id, amount = 1, infrastructure = false) {
  const d = infrastructure ? INFRA[id] : BUILDINGS[id], q = buildQuote(s, id, amount, infrastructure);
  if (!q) return fail('Ungültige Bauanzahl.');
  if (d.tier > s.tier) return fail('Diese Epoche ist noch nicht freigeschaltet.');
  if (!Number.isFinite(q.total) || q.total > s.cash + 1e-7) return fail('Nicht genügend Geld. Fehlende Baustoffe sind im Preis enthalten.');
  if ((infrastructure ? s.infra[id] : s.buildings[id].count) + amount > 10000) return fail('Maximal 10.000 Einheiten je Typ.');
  for (const [r, n] of Object.entries(q.materials)) {
    const missing = Math.max(0, n - s.inventory[r]);
    if (missing) {
      const cost = quote(s, r, missing, 'buy').total;
      s.cash -= cost;
      s.market[r].pressure = clamp(s.market[r].pressure + missing / liquidity(r), -4, 4);
    }
    s.inventory[r] = Math.max(0, s.inventory[r] - n);
  }
  s.cash = Math.max(0, s.cash - q.cash);
  if (infrastructure) { s.infra[id] += amount; s.infraBook[id] += q.total; }
  else { const own = s.buildings[id]; own.count += amount; own.active += amount; own.book += q.total; s.stats.built += amount; }
  checkProgress(s);
  checkAchievements(s);
  return ok(`${amount}× ${d.name} gebaut.`, { total: q.total });
}

export function demolish(s, id, amount = 1, infrastructure = false) {
  const d = infrastructure ? INFRA[id] : BUILDINGS[id];
  if (!d || !Number.isInteger(amount) || amount < 1 || amount > 100) return fail('Ungültige Anzahl.');
  const count = infrastructure ? s.infra[id] : s.buildings[id].count;
  if (amount > count) return fail('So viele Einheiten besitzt du nicht.');
  const book = infrastructure ? s.infraBook[id] : s.buildings[id].book;
  const removed = book * amount / count;
  if (infrastructure) { s.infra[id] -= amount; s.infraBook[id] -= removed; }
  else { const own = s.buildings[id]; own.count -= amount; own.active = Math.min(own.active, own.count); own.book -= removed; }
  s.cash += removed * 0.45;
  return ok(`${amount}× ${d.name} abgebaut. 45 % des Buchwerts erstattet.`);
}

export function setActive(s, id, delta) {
  if (!BUILDINGS[id] || !Number.isInteger(delta)) return fail('Ungültige Einstellung.');
  const own = s.buildings[id];
  own.active = clamp(own.active + delta, 0, own.count);
  return ok(`${own.active} Betrieb(e) aktiv.`);
}
export function upgradeQuote(s, id) {
  if (!BUILDINGS[id]) return Infinity;
  const own = s.buildings[id];
  return BUILDINGS[id].cost * 0.65 * Math.pow(2.1, own.level) * Math.pow(Math.max(1, own.count), 0.72);
}
export function upgrade(s, id) {
  const own = s.buildings[id];
  if (!own?.count) return fail('Baue zuerst einen Betrieb.');
  if (own.level >= 5) return fail('Maximale Ausbaustufe erreicht.');
  const cost = upgradeQuote(s, id);
  if (cost > s.cash) return fail('Nicht genügend Geld.');
  s.cash -= cost; own.book += cost; own.level++;
  return ok(`Ausbaustufe ${own.level}: +18 % Grundproduktion, +8 % Grundlohn je Stufe.`);
}

function autoTrade(s) {
  let cashBuffer;
  for (const id of Object.keys(RESOURCES)) {
    if (RESOURCES[id].tier > s.tier) continue;
    const a = s.automation[id], stored = s.inventory[id];
    const sellAt = a.mode === 'both' ? a.high : a.high;
    if (['sell', 'both'].includes(a.mode) && stored > sellAt + 0.01) trade(s, id, stored - sellAt, 'sell', true);
    if (['buy', 'both'].includes(a.mode) && s.inventory[id] < a.low - 0.01) {
      const desired = Math.min(a.low - s.inventory[id], warehouseCapacity(s) - s.inventory[id]);
      // Keep a cash buffer for wages. Purchases never create involuntary debt.
      cashBuffer ??= Math.max(50, capacity(s).wages * 0.25);
      const budget = Math.max(0, s.cash - cashBuffer);
      let n = desired;
      if (quote(s, id, n).total > budget) {
        let lo = 0, hi = n;
        for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (quote(s, id, mid).total > budget) hi = mid; else lo = mid; }
        n = lo;
      }
      if (n > 0.001) trade(s, id, n, 'buy', true);
    }
  }
}

function produce(s, seconds, offline) {
  const h = seconds / HOUR, c = capacity(s), policy = POLICIES[s.policy];
  const desiredCoalPower = Math.max(0, c.energy - c.cleanEnergy);
  const powerFraction = s.infra.power ? Math.min(1, desiredCoalPower / (s.infra.power * 25 * (1 + s.research.energy * 0.15))) : 0;
  const coalWanted = s.infra.power * 4 * h * powerFraction;
  const coalRatio = coalWanted ? Math.min(1, s.inventory.coal / coalWanted) : 1;
  s.inventory.coal = Math.max(0, s.inventory.coal - coalWanted * coalRatio);
  const actualPower = c.cleanEnergy + s.infra.power * 25 * (1 + s.research.energy * 0.15) * powerFraction * coalRatio;
  const global = Math.min(c.staffing, c.energy ? actualPower / c.energy : 1, c.logistics, 1) * c.environment;
  const ids = Object.keys(BUILDINGS);
  if (s.priority === 'advanced') ids.reverse();
  for (const id of ids) {
    const b = BUILDINGS[id], own = s.buildings[id];
    if (!own.active) continue;
    const mult = productionBonus(s, id, offline);
    let factor = global;
    const units = own.active * h;
    for (const [r, q] of Object.entries(b.input)) factor = Math.min(factor, s.inventory[r] / (q * units * mult));
    for (const [r, q] of Object.entries(b.output)) factor = Math.min(factor, Math.max(0, warehouseCapacity(s) - s.inventory[r]) / (q * units * mult));
    const wages = own.active * b.wage * (1 + own.level * 0.08) * policy.wage * h;
    if (wages > 0) factor = Math.min(factor, s.cash / wages);
    factor = clamp(factor, 0, 1);
    if (factor < 1e-9) continue;
    for (const [r, q] of Object.entries(b.input)) s.inventory[r] = Math.max(0, s.inventory[r] - q * units * mult * factor);
    for (const [r, q] of Object.entries(b.output)) { const made = q * units * mult * factor; s.inventory[r] += made; s.stats.produced += made; }
    expense(s, wages * factor);
  }
  const labCost = s.infra.lab * 10 * h;
  const labScale = labCost ? Math.min(1, s.cash / labCost) : 0;
  s.points += s.infra.lab * h * labScale * (1 + s.legacy * 0.04);
  expense(s, labCost * labScale);
  expense(s, Math.min(s.cash, c.ecoCost * h));
}

export function bankRate(s, id) {
  const base = id === 'reserve' ? BANKS.reserve.rate : clamp(s.economy.rate, 0.0004, 0.0018);
  return base * (1 + s.research.finance * 0.05);
}
export function bankTransfer(s, id, amount, direction) {
  if (!BANKS[id] || !Number.isFinite(amount) || amount <= 0 || amount > 1e14 || !['deposit', 'withdraw'].includes(direction)) return fail('Ungültiger Betrag.');
  if (direction === 'deposit') {
    if (amount > s.cash + 1e-7) return fail('Nicht genügend Geld.');
    s.cash = Math.max(0, s.cash - amount); s.banks[id] += amount;
  } else {
    if (amount > s.banks[id] + 1e-7) return fail('Dieser Betrag ist nicht angelegt.');
    s.banks[id] = Math.max(0, s.banks[id] - amount); s.cash += amount;
  }
  checkAchievements(s);
  return ok(direction === 'deposit' ? 'Geld angelegt.' : 'Geld ausgezahlt.');
}

export function assets(s) {
  const inventory = Object.keys(RESOURCES).reduce((n, id) => n + s.inventory[id] * price(s, id) * 0.98, 0);
  const buildings = Object.values(s.buildings).reduce((n, b) => n + b.book, 0) + sum(s.infraBook);
  const securities = Object.values(s.stocks).reduce((n, p) => n + p.price * p.quantity * 0.995, 0);
  const bonds = s.bonds.reduce((n, b) => n + b.principal, 0), ventures = s.ventures.reduce((n, b) => n + b.principal, 0);
  const debt = s.debt + s.loans.reduce((n, l) => n + l.principal, 0);
  return { cash: s.cash, inventory, buildings, securities, banks: sum(s.banks), bonds, ventures, debt,
    total: s.cash + inventory + buildings + securities + sum(s.banks) + bonds + ventures - debt };
}
export function creditLimit(s) {
  const a = assets(s);
  return Math.min(50000000, Math.max(1000, (a.buildings * 0.5 + a.inventory * 0.3 + a.securities * 0.4 + a.banks * 0.8) * (0.6 + s.reputation / 100)));
}
export function debtRate(s) { return 0.003 + s.economy.rate + (100 - s.reputation) * 0.000015; }
export function borrow(s, amount, term = false) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e14) return fail('Ungültiger Kreditbetrag.');
  const outstanding = s.debt + s.loans.reduce((n, l) => n + l.principal, 0);
  if (amount + outstanding > creditLimit(s) + 1e-7) return fail('Der Kreditrahmen reicht nicht aus.');
  if (term && s.loans.length >= 5) return fail('Maximal fünf Investitionskredite.');
  if (term) s.loans.push({ id: s.nextId++, principal: amount, original: amount, rate: debtRate(s) * 0.8, nextPayment: s.elapsed + 10 * DAY, payments: 10 });
  else s.debt += amount;
  s.cash += amount;
  log(s, `${term ? 'Investitionskredit' : 'Kontokorrent'} aufgenommen: ${Math.round(amount).toLocaleString('de-DE')} €.`, 'finance');
  return ok('Kredit ausgezahlt.');
}
export function repay(s, amount, loanId = null) {
  const loan = loanId === null ? null : s.loans.find(l => l.id === loanId), debt = loan ? loan.principal : s.debt;
  if (loanId !== null && !loan) return fail('Kredit nicht gefunden.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > s.cash + 1e-7 || amount > debt + 1e-7) return fail('Betrag übersteigt Guthaben oder Restschuld.');
  s.cash = Math.max(0, s.cash - amount);
  if (loan) { loan.principal = Math.max(0, loan.principal - amount); if (loan.principal < 0.01) s.loans = s.loans.filter(l => l !== loan); }
  else s.debt = Math.max(0, s.debt - amount);
  return ok('Kredit zurückgezahlt.');
}

export function investBond(s, type, amount) {
  const b = BONDS[type];
  if (!b || !Number.isFinite(amount) || amount < b.min || amount > s.cash || s.bonds.length >= 30) return fail('Mindestanlage, Guthaben oder Limit von 30 Anleihen beachten.');
  s.cash -= amount;
  s.bonds.push({ id: s.nextId++, type, principal: amount, start: s.elapsed, end: s.elapsed + b.days * DAY, rate: b.rate });
  return ok('Anleihe gezeichnet. Das Kapital bleibt bis zur Fälligkeit gebunden.');
}
export function fixedDeposit(s, amount, days = 20) {
  if (!Number.isFinite(amount) || amount < 500 || amount > s.cash || ![10, 20, 60].includes(days) || s.bonds.length >= 30) return fail('Festgeld ab 500 €. Maximal 30 gebundene Anlagen.');
  s.cash -= amount;
  const rate = days === 10 ? 0.0014 : days === 20 ? 0.0019 : 0.0027;
  s.bonds.push({ id: s.nextId++, type: 'fixed', principal: amount, start: s.elapsed, end: s.elapsed + days * DAY, rate, days });
  return ok('Festgeld eröffnet. Vorzeitige Auflösung kostet 2 % des Kapitals.');
}
export function redeemFixed(s, id) {
  const b = s.bonds.find(x => x.id === id && x.type === 'fixed');
  if (!b) return fail('Festgeld nicht gefunden.');
  s.cash += b.principal * 0.98;
  s.bonds = s.bonds.filter(x => x !== b);
  return ok('Festgeld aufgelöst. 2 % Vorfälligkeitskosten, aufgelaufene Zinsen entfallen.');
}
export function investVenture(s, type, amount) {
  const v = VENTURES[type];
  if (!v || s.tier < v.tier || !Number.isFinite(amount) || amount < v.min || amount > s.cash || s.ventures.length >= 12) return fail('Mindestanlage, Epoche und maximal zwölf Beteiligungen beachten.');
  s.cash -= amount;
  s.ventures.push({ id: s.nextId++, type, principal: amount, start: s.elapsed, end: s.elapsed + v.duration });
  return ok('Beteiligung abgeschlossen. Ausgang wird bei Fälligkeit ermittelt.');
}

export function stockTrade(s, id, quantity, side) {
  const d = STOCKS[id], p = s.stocks[id];
  if (!d || s.tier < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 1e7 || !['buy', 'sell'].includes(side)) return fail('Ungültiger Aktienauftrag. Börse ab Epoche Handwerk.');
  const gross = p.price * quantity, fee = gross * 0.005;
  if (side === 'buy') {
    if (gross + fee > s.cash) return fail('Nicht genügend Geld.');
    p.basis += gross + fee; p.quantity += quantity; s.cash -= gross + fee;
  } else {
    if (quantity > p.quantity) return fail('Nicht genügend Anteile.');
    const basis = p.basis * quantity / p.quantity, gain = Math.max(0, gross - fee - basis), tax = gain * 0.15;
    p.quantity -= quantity; p.basis = Math.max(0, p.basis - basis); s.cash += gross - fee - tax; s.stats.taxes += tax;
  }
  checkAchievements(s);
  return ok(`${quantity} Anteil(e) ${side === 'buy' ? 'gekauft' : 'verkauft'}.`);
}

export function researchCost(s, id) {
  const r = RESEARCH[id], level = s.research[id];
  return r ? { points: Math.round(r.cost * Math.pow(1.75, level)), cash: r.money * Math.pow(2.2, level) } : null;
}
export function research(s, id) {
  const r = RESEARCH[id], c = researchCost(s, id);
  if (!r || s.tier < r.tier || s.research[id] >= r.max) return fail('Forschung nicht verfügbar.');
  if (s.points < c.points || s.cash < c.cash) return fail('Forschungspunkte oder Geld fehlen.');
  s.points -= c.points; s.cash -= c.cash; s.research[id]++;
  log(s, `${r.name}: Stufe ${s.research[id]} erforscht.`, 'research');
  checkAchievements(s);
  return ok('Forschung abgeschlossen.');
}

export function placeOrder(s, resource, side, quantity, limit) {
  if (!RESOURCES[resource] || RESOURCES[resource].tier > s.tier || !['buy', 'sell'].includes(side) || !Number.isInteger(quantity) || quantity < 1 || quantity > 1e6 || !Number.isFinite(limit) || limit <= 0 || limit > 1e9 || s.orders.length >= 20) return fail('Ungültiger Limitauftrag oder Auftragslimit erreicht.');
  s.orders.push({ id: s.nextId++, resource, side, quantity, limit });
  return ok('Limitauftrag aktiv. Ausführung vollständig zum Durchschnittspreis inklusive Gebühren, sofern Geld und Lager ausreichen.');
}
export function cancelOrder(s, id) { s.orders = s.orders.filter(o => o.id !== id); return ok('Auftrag gelöscht.'); }
function executeOrders(s) {
  for (const o of [...s.orders]) {
    const q = quote(s, o.resource, o.quantity, o.side);
    if ((o.side === 'buy' && q.unit <= o.limit) || (o.side === 'sell' && q.unit >= o.limit)) {
      if (trade(s, o.resource, o.quantity, o.side, true).ok) {
        s.orders = s.orders.filter(x => x.id !== o.id);
        log(s, `Limitauftrag ausgeführt: ${o.quantity} ${RESOURCES[o.resource].name}.`, 'trade');
      }
    }
  }
}

export function refreshBoard(s) {
  const resources = Object.keys(RESOURCES).filter(k => RESOURCES[k].tier <= s.tier);
  s.board = Array.from({ length: 3 }, () => {
    const resource = resources[Math.floor(random(s) * resources.length)];
    const quantity = Math.round((30 + random(s) * 100) * (1 + s.tier * 0.65));
    const premium = 1.15 + random(s) * 0.3;
    return { id: s.nextId++, resource, quantity, reward: Math.round(quantity * price(s, resource) * premium), duration: DAY * (1 + Math.ceil(random(s) * 2)), premium };
  });
}
export function acceptContract(s, id) {
  const c = s.board.find(x => x.id === id);
  if (!c || s.contracts.length >= 3) return fail('Maximal drei laufende Lieferverträge.');
  s.contracts.push({ ...c, end: s.elapsed + c.duration });
  s.board = s.board.filter(x => x !== c);
  return ok('Liefervertrag angenommen. Bei Fristablauf: −3 Reputation, keine Geldstrafe.');
}
export function fulfillContract(s, id) {
  const c = s.contracts.find(x => x.id === id);
  if (!c || c.end <= s.elapsed) return fail('Vertrag nicht mehr verfügbar.');
  if (s.inventory[c.resource] + 1e-7 < c.quantity) return fail('Nicht genügend Ware für die vollständige Lieferung.');
  s.inventory[c.resource] = Math.max(0, s.inventory[c.resource] - c.quantity);
  revenue(s, c.reward); s.reputation = Math.min(100, s.reputation + 2); s.points += 2 + s.tier; s.stats.contracts++;
  s.contracts = s.contracts.filter(x => x !== c);
  log(s, `Liefervertrag erfüllt: ${c.quantity} ${RESOURCES[c.resource].name}. +2 Reputation.`, 'contract');
  checkAchievements(s);
  return ok('Lieferung erfüllt. Prämie und Forschungspunkte gutgeschrieben.');
}
export function abandonContract(s, id) {
  if (!s.contracts.some(x => x.id === id)) return fail('Vertrag nicht gefunden.');
  s.contracts = s.contracts.filter(x => x.id !== id); s.reputation = Math.max(0, s.reputation - 3);
  return ok('Vertrag aufgegeben. −3 Reputation.');
}

function settleMaturities(s) {
  for (const b of [...s.bonds]) {
    if (b.end > s.elapsed) continue;
    const d = BONDS[b.type], days = (b.end - b.start) / DAY;
    const defaults = d && random(s) < d.risk;
    const interest = b.principal * (Math.pow(1 + b.rate, days) - 1);
    const returned = defaults ? b.principal * (b.type === 'corporate' ? 0.2 : 0.4) : b.principal + interest * 0.85;
    s.cash += returned;
    if (!defaults) { s.stats.interest += interest * 0.85; s.stats.taxes += interest * 0.15; }
    log(s, `${b.type === 'fixed' ? 'Festgeld' : d.name} fällig: ${Math.round(returned).toLocaleString('de-DE')} € ${defaults ? '(Ausfall, Teilrückzahlung)' : 'ausgezahlt'}.`, defaults ? 'warning' : 'finance');
    s.bonds = s.bonds.filter(x => x !== b);
  }
  for (const v of [...s.ventures]) {
    if (v.end > s.elapsed) continue;
    const d = VENTURES[v.type], success = random(s) < d.success;
    const gross = v.principal * (success ? d.multiple : d.recovery), tax = Math.max(0, gross - v.principal) * 0.15;
    s.cash += gross - tax; s.stats.taxes += tax;
    log(s, `${d.name}: ${success ? 'erfolgreich' : 'gescheitert'}. ${Math.round(gross - tax).toLocaleString('de-DE')} € Rückzahlung.`, success ? 'finance' : 'warning');
    s.ventures = s.ventures.filter(x => x !== v);
  }
  for (const c of [...s.contracts]) {
    if (c.end > s.elapsed) continue;
    s.reputation = Math.max(0, s.reputation - 3); s.contracts = s.contracts.filter(x => x !== c);
    log(s, `Liefervertrag abgelaufen: ${c.quantity} ${RESOURCES[c.resource].name}. −3 Reputation.`, 'warning');
  }
  for (const l of [...s.loans]) {
    if (l.nextPayment > s.elapsed) continue;
    const due = Math.min(l.principal, l.original / 10), payment = Math.min(s.cash, due);
    s.cash -= payment; l.principal -= due;
    if (payment < due) { s.debt += due - payment; s.reputation = Math.max(0, s.reputation - 4); log(s, 'Kreditrate teilweise in Kontokorrent umgebucht. −4 Reputation.', 'warning'); }
    l.payments--; l.nextPayment += 10 * DAY;
    if (l.principal < 0.01 || l.payments <= 0) s.loans = s.loans.filter(x => x !== l);
  }
}

function hourly(s) {
  const hour = Math.floor(s.elapsed / HOUR);
  const cycle = 1 + Math.sin(hour / 160) * 0.18 + Math.sin(hour / 43) * 0.045;
  s.economy = { cycle, rate: clamp(0.001 + (cycle - 1) * 0.003, 0.0004, 0.0018), inflation: 2 + (cycle - 1) * 9,
    phase: cycle > 1.1 ? 'Aufschwung' : cycle < 0.9 ? 'Rezession' : 'Stabil' };
  if (s.event && s.event.end <= s.elapsed) { log(s, `${s.event.name} ist vorüber.`, 'event'); s.event = null; }
  if (!s.event && hour > 4 && random(s) < 0.055) {
    const e = EVENTS[Math.floor(random(s) * EVENTS.length)];
    s.event = { ...e, end: s.elapsed + e.duration * HOUR };
    log(s, `${e.name}: ${e.description}`, 'event');
  }
  for (const [id, d] of Object.entries(RESOURCES)) {
    const m = s.market[id]; m.previous = price(s, id);
    const eventFactor = s.event && (s.event.sector === d.sector || s.event.sector === 'all') ? s.event.demand : 1;
    const target = cycle * eventFactor * (1 + Math.sin(hour / 72 + d.base) * 0.08);
    m.factor = clamp(m.factor + (target - m.factor) * 0.08 + (random(s) - 0.5) * 0.025, 0.45, 2.1);
    m.pressure *= 0.982;
    m.history.push(price(s, id)); if (m.history.length > 48) m.history.shift();
  }
  for (const [id, d] of Object.entries(STOCKS)) {
    if (id === 'index') continue;
    const p = s.stocks[id]; p.previous = p.price;
    const sectorPrices = Object.keys(RESOURCES).filter(r => RESOURCES[r].sector === d.sector);
    const sector = sectorPrices.reduce((n, r) => n + price(s, r) / RESOURCES[r].base, 0) / sectorPrices.length;
    const anchor = d.base * clamp(sector, 0.4, 2) * (1 + Math.min(1, hour / 20000));
    const reversion = Math.log(anchor / p.price) * 0.012;
    p.price = clamp(p.price * Math.exp(reversion + (random(s) - 0.49) * d.volatility * 2), d.base * 0.08, d.base * 12);
    p.history.push(p.price); if (p.history.length > 48) p.history.shift();
  }
  const idx = s.stocks.index; idx.previous = idx.price;
  idx.price = 100 * Object.entries(STOCKS).filter(([id]) => id !== 'index').reduce((n, [id, d]) => n + s.stocks[id].price / d.base, 0) / 5;
  idx.history.push(idx.price); if (idx.history.length > 48) idx.history.shift();
  s.stats.lastRevenue = s.hourLedger.revenue; s.stats.lastCosts = s.hourLedger.costs;
  s.stats.lastProfit = s.hourLedger.revenue - s.hourLedger.costs;
  s.stats.history.push({ at: s.elapsed, wealth: assets(s).total, profit: s.stats.lastProfit });
  if (s.stats.history.length > 96) s.stats.history.shift();
  s.hourLedger = { revenue: 0, costs: 0 };
  if (hour % 6 === 0) refreshBoard(s);
  if (hour % 24 === 0) daily(s);
  checkProgress(s); checkAchievements(s);
}

function daily(s) {
  const taxable = Math.max(0, s.dayLedger.revenue - s.dayLedger.costs), tax = taxable * 0.12;
  const paid = Math.min(s.cash, tax); s.cash -= paid; s.debt += tax - paid; s.stats.taxes += tax;
  s.dayLedger = { revenue: 0, costs: 0 };
  for (const [id, d] of Object.entries(STOCKS)) {
    const p = s.stocks[id], gross = p.quantity * p.price * d.dividend;
    s.cash += gross * 0.85; s.stats.dividends += gross * 0.85; s.stats.taxes += gross * 0.15;
  }
  const utilization = (s.debt + s.loans.reduce((n, l) => n + l.principal, 0)) / creditLimit(s);
  if (utilization > 1) { s.reputation = Math.max(0, s.reputation - 1); }
  else s.reputation = Math.min(100, s.reputation + 0.15);
}

function accrueFinance(s, seconds) {
  const fraction = seconds / DAY;
  for (const id of Object.keys(BANKS)) {
    const gross = s.banks[id] * (Math.pow(1 + bankRate(s, id), fraction) - 1);
    s.banks[id] += gross * 0.85; s.stats.interest += gross * 0.85; s.stats.taxes += gross * 0.15;
  }
  if (s.debt > 0) {
    const interest = s.debt * (Math.pow(1 + debtRate(s), fraction) - 1);
    const paid = Math.min(s.cash, interest); expense(s, paid); s.debt += interest - paid;
  }
  for (const l of s.loans) {
    const interest = l.principal * (Math.pow(1 + l.rate, fraction) - 1), paid = Math.min(s.cash, interest);
    expense(s, paid); s.debt += interest - paid;
  }
}

export function checkProgress(s) {
  const wealth = assets(s).total;
  s.stats.peak = Math.max(s.stats.peak, wealth);
  const tier = TIERS.reduce((n, t, i) => s.stats.peak >= t.wealth ? i : n, 0);
  if (tier > s.tier) {
    s.tier = tier;
    log(s, `${TIERS[tier].name} freigeschaltet. Neue Betriebe, Waren und Möglichkeiten warten.`, 'milestone');
    refreshBoard(s);
  }
}

export function checkAchievements(s) {
  const processors = Object.entries(BUILDINGS).filter(([id, b]) => Object.keys(b.input).length && s.buildings[id].count).length;
  const conditions = {
    firstBuild: s.stats.built > 0, firstTrade: s.stats.trades > 0, chain: processors >= 3,
    ten: Object.values(s.buildings).reduce((n, b) => n + b.count, 0) >= 10,
    research: sum(s.research) > 0, invest: sum(s.banks) > 0, contract: s.stats.contracts >= 5,
    wealth100k: s.stats.peak >= 100000, million: s.stats.peak >= 1000000,
    green: s.infra.solar >= 5 && s.infra.park >= 3, diverse: Object.entries(s.stocks).filter(([id]) => id !== 'index').every(([, p]) => p.quantity > 0),
    week: s.elapsed >= 7 * 86400, space: s.inventory.satellites >= 1, legacy: s.prestigeCount > 0,
  };
  for (const a of ACHIEVEMENTS) {
    if (conditions[a.id] && !s.achievements.includes(a.id)) {
      s.achievements.push(a.id); s.cash += a.reward;
      log(s, `${a.name} · +${a.reward.toLocaleString('de-DE')} €`, 'achievement');
    }
  }
}

export function prestigeReward(s) { return s.stats.peak >= 100000000 ? Math.max(1, Math.floor(Math.sqrt(s.stats.peak / 100000000))) : 0; }
export function prestige(s, now = Date.now()) {
  const reward = prestigeReward(s);
  if (!reward) return null;
  const fresh = createGame(s.name, now, s.seed);
  fresh.legacy = s.legacy + reward; fresh.prestigeCount = s.prestigeCount + 1;
  fresh.cash += fresh.legacy * 500; fresh.tutorial = false;
  log(fresh, `Neue Holding gegründet. ${fresh.legacy} Vermächtnispunkte: +${fresh.legacy * 8} % Produktion.`, 'milestone');
  checkAchievements(fresh);
  return fresh;
}

export function advance(s, now = Date.now(), options = {}) {
  if (!Number.isFinite(now)) return { seconds: 0, skipped: 0, steps: 0 };
  if (now < s.lastUpdate) return { seconds: 0, skipped: 0, steps: 0, clockBack: true };
  const elapsed = Math.max(0, (now - s.lastUpdate) / 1000), available = Math.min(elapsed, OFFLINE_LIMIT);
  const steps = Math.floor(available / STEP), seconds = steps * STEP;
  if (!steps) return { seconds: 0, skipped: 0, steps: 0 };
  const before = { cash: s.cash, wealth: assets(s).total, produced: s.stats.produced, interest: s.stats.interest, dividends: s.stats.dividends, taxes: s.stats.taxes };
  for (let i = 0; i < steps; i++) {
    autoTrade(s);
    produce(s, STEP, !!options.offline);
    accrueFinance(s, STEP);
    autoTrade(s);
    executeOrders(s);
    s.elapsed += STEP;
    settleMaturities(s);
    if (s.elapsed % HOUR === 0) hourly(s);
    if (options.onProgress && i % 720 === 0) options.onProgress(i / steps);
  }
  if (elapsed > OFFLINE_LIMIT) s.lastUpdate = now - (available - seconds) * 1000;
  else s.lastUpdate += seconds * 1000;
  checkProgress(s); checkAchievements(s);
  const after = assets(s);
  return { seconds, skipped: Math.max(0, elapsed - OFFLINE_LIMIT), steps,
    cash: s.cash - before.cash, wealth: after.total - before.wealth,
    produced: s.stats.produced - before.produced, interest: s.stats.interest - before.interest,
    dividends: s.stats.dividends - before.dividends, taxes: s.stats.taxes - before.taxes,
  };
}

// Import only known fields. No arbitrary object is ever merged into live state.
export function validateGame(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== VERSION || !raw.buildings || !raw.inventory || !raw.market || !raw.stats) throw new Error('Diese Datei enthält keinen unterstützten NULL-Spielstand.');
  const s = createGame(typeof raw.name === 'string' ? raw.name : 'Mein Unternehmen', now);
  s.created = finite(raw.created, now, now); s.lastUpdate = finite(raw.lastUpdate, now, now + 7 * 86400000);
  s.seed = finite(raw.seed, 1, 4294967295) >>> 0; s.elapsed = Math.floor(finite(raw.elapsed, 0, 1e10) / STEP) * STEP;
  for (const key of ['cash', 'points', 'debt']) s[key] = finite(raw[key]);
  s.tier = Math.floor(finite(raw.tier, 0, 6)); s.legacy = Math.floor(finite(raw.legacy, 0, 10000)); s.prestigeCount = Math.floor(finite(raw.prestigeCount, 0, 10000));
  s.reputation = finite(raw.reputation, 50, 100); s.nextId = Math.max(1, Math.floor(finite(raw.nextId, 1, 1e12)));
  s.policy = Object.hasOwn(POLICIES, raw.policy) ? raw.policy : 'balanced'; s.priority = raw.priority === 'advanced' ? 'advanced' : 'balanced';
  for (const id of Object.keys(RESEARCH)) s.research[id] = Math.floor(finite(raw.research?.[id], 0, RESEARCH[id].max));
  for (const id of Object.keys(INFRA)) { s.infra[id] = Math.floor(finite(raw.infra?.[id], 0, 10000)); s.infraBook[id] = finite(raw.infraBook?.[id]); }
  for (const id of Object.keys(BUILDINGS)) {
    const r = raw.buildings[id] || {}, count = Math.floor(finite(r.count, 0, 10000));
    s.buildings[id] = { count, active: Math.floor(finite(r.active, count, count)), level: Math.floor(finite(r.level, 0, 5)), book: finite(r.book) };
  }
  for (const id of Object.keys(RESOURCES)) {
    s.inventory[id] = finite(raw.inventory[id], 0, 1e10);
    const m = raw.market[id] || {};
    s.market[id] = { factor: clamp(finite(m.factor, 1), 0.45, 2.1), pressure: typeof m.pressure === 'number' && Number.isFinite(m.pressure) ? clamp(m.pressure, -4, 4) : 0,
      previous: finite(m.previous, RESOURCES[id].base), history: cleanHistory(m.history, RESOURCES[id].base) };
    const a = raw.automation?.[id] || {};
    s.automation[id] = { mode: ['off', 'buy', 'sell', 'both'].includes(a.mode) ? a.mode : 'off', low: finite(a.low, 20, 1e9), high: finite(a.high, 100, 1e9) };
    if (s.automation[id].high < s.automation[id].low) s.automation[id].high = s.automation[id].low;
  }
  for (const [id, d] of Object.entries(STOCKS)) {
    const p = raw.stocks?.[id] || {};
    s.stocks[id] = { price: Math.max(0.01, finite(p.price, d.base, d.base * 12)), previous: finite(p.previous, d.base), quantity: Math.floor(finite(p.quantity, 0, 1e10)), basis: finite(p.basis), history: cleanHistory(p.history, d.base) };
  }
  for (const id of Object.keys(BANKS)) s.banks[id] = finite(raw.banks?.[id]);
  s.bonds = cleanArray(raw.bonds, 30).filter(b => b && (b.type === 'fixed' || Object.hasOwn(BONDS, b.type))).map(b => ({ id: finite(b.id), type: b.type, principal: finite(b.principal), start: finite(b.start), end: finite(b.end), rate: finite(b.rate, 0.001, 0.01), days: finite(b.days, 20, 60) }));
  s.ventures = cleanArray(raw.ventures, 12).filter(v => v && Object.hasOwn(VENTURES, v.type)).map(v => ({ id: finite(v.id), type: v.type, principal: finite(v.principal), start: finite(v.start), end: finite(v.end) }));
  s.loans = cleanArray(raw.loans, 5).filter(l => l && typeof l === 'object').map(l => ({ id: finite(l.id), principal: finite(l.principal), original: finite(l.original), rate: finite(l.rate, 0.004, 0.02), nextPayment: finite(l.nextPayment), payments: Math.floor(finite(l.payments, 10, 10)) }));
  s.orders = cleanArray(raw.orders, 20).filter(o => o && Object.hasOwn(RESOURCES, o.resource) && ['buy', 'sell'].includes(o.side)).map(o => ({ id: finite(o.id), resource: o.resource, side: o.side, quantity: Math.max(1, Math.floor(finite(o.quantity, 1, 1e6))), limit: Math.max(0.001, finite(o.limit, 1, 1e9)) }));
  const cleanContract = c => ({ id: finite(c.id), resource: c.resource, quantity: Math.max(1, finite(c.quantity, 1, 1e6)), reward: finite(c.reward), duration: finite(c.duration, DAY, 10 * DAY), ...(typeof c.end === 'number' ? { end: finite(c.end, s.elapsed + DAY) } : {}), premium: finite(c.premium, 1.2, 2) });
  s.contracts = cleanArray(raw.contracts, 3).filter(c => c && Object.hasOwn(RESOURCES, c.resource)).map(cleanContract);
  s.board = cleanArray(raw.board, 3).filter(c => c && Object.hasOwn(RESOURCES, c.resource)).map(cleanContract);
  s.achievements = cleanArray(raw.achievements, 100).filter(id => ACHIEVEMENTS.some(a => a.id === id));
  s.journal = cleanArray(raw.journal, 100).filter(j => j && typeof j.text === 'string').map(j => ({ id: finite(j.id), at: finite(j.at), text: j.text.slice(0, 500), type: typeof j.type === 'string' ? j.type.slice(0, 20) : 'info' }));
  if (raw.event && EVENTS.some(e => e.name === raw.event.name)) s.event = { ...EVENTS.find(e => e.name === raw.event.name), end: finite(raw.event.end, s.elapsed) };
  if (raw.economy) s.economy = { cycle: clamp(finite(raw.economy.cycle, 1), 0.5, 2), rate: clamp(finite(raw.economy.rate, 0.001), 0.0004, 0.0018), inflation: finite(raw.economy.inflation, 2, 10), phase: ['Stabil', 'Aufschwung', 'Rezession'].includes(raw.economy.phase) ? raw.economy.phase : 'Stabil' };
  for (const key of Object.keys(s.stats)) { if (key !== 'history') s.stats[key] = typeof raw.stats[key] === 'number' && Number.isFinite(raw.stats[key]) ? clamp(raw.stats[key], key === 'lastProfit' ? -1e15 : 0, 1e15) : s.stats[key]; }
  s.stats.history = cleanArray(raw.stats.history, 96).filter(h => h && Number.isFinite(h.wealth) && Number.isFinite(h.profit)).map(h => ({ at: finite(h.at), wealth: h.wealth, profit: h.profit }));
  for (const ledger of ['hourLedger', 'dayLedger']) s[ledger] = { revenue: finite(raw[ledger]?.revenue), costs: finite(raw[ledger]?.costs) };
  s.tutorial = raw.tutorial !== false;
  return s;
}
function cleanArray(a, max) { return Array.isArray(a) ? a.slice(0, max) : []; }
function cleanHistory(a, fallback) { const h = cleanArray(a, 48).filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e12); return h.length ? h : [fallback]; }
