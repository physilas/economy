import { VERSION, STEP, HOUR, DAY, OFFLINE_LIMIT, RESOURCES, BUILDINGS, INFRA, RESEARCH, STOCKS, BANKS, BONDS, VENTURES, EVENTS, ACHIEVEMENTS, POLICIES, TIERS, PROPERTIES } from './data.mjs';
import { optionPrice } from './math.mjs';
import {createCampaign,normalizeCampaign,settleProgramme} from './campaign.mjs';

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
    stocks: Object.fromEntries(Object.entries(STOCKS).map(([k, d]) => [k, { price: d.base, previous: d.base, history: [d.base], quantity: 0, basis: 0, drip:false, reserve:0 }])),
    properties:Object.fromEntries(Object.keys(PROPERTIES).map(id=>[id,{count:0,basis:0,index:1,occupancy:.9,history:[1]}])),
    options:[], savingsPlans:[], treasury:{enabled:false,floor:150,target:600,bank:'reserve'}, emergencyNext:0,
    banks: { reserve: 0, savings: 0 }, bonds: [], ventures: [], orders: [], loans: [], debt: 0,
    policy: 'balanced', priority: 'balanced', profitGuard:false, reputation: 50, tier: 0, legacy: 0, prestigeCount: 0,
    campaign:createCampaign(),
    contracts: [], board: [], achievements: [], journal: [], nextId: 1,
    event: null, economy: { cycle: 1, rate: 0.001, inflation: 2, phase: 'Stabil' },
    stats: { built: 0, trades: 0, produced: 0, revenue: 0, expenses: 0, interest: 0, dividends: 0, rent:0, optionPnl:0, grants:0, taxes: 0, contracts: 0, peak: 1200, lastProfit: 0, lastRevenue: 0, lastCosts: 0, history: [], resets: 0 },
    hourLedger: { revenue: 0, costs: 0 }, dayLedger: { revenue: 0, costs: 0 },
    tutorial: true, settings: { confirmLarge: true },
  };
  updateReports(s,true);
  s.stats.peak=assets(s).total;
  s.campaign.peak=s.stats.peak;
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
export const liquidity = id => RESOURCES[id].depth || 4800 / Math.pow(RESOURCES[id].base, 0.38);
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
  s.cash = Math.max(0,s.cash-amount);
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

const infraBase=(s,metric)=>Object.entries(INFRA).reduce((total,[id,d])=>total+(s.infra[id]||0)*(d.provides?.[metric]||0),0);
const logisticsBonus=s=>1+(s.campaign?.bonuses.logistics||0)/100;
export const energyBonus=s=>(1+s.research.energy*.15)*(1+(s.research.systems||0)*.12);
export function infrastructureYield(s,id,metric){
  const d=INFRA[id];let value=d?.provides?.[metric]||0;
  if(metric==='energy')value*=energyBonus(s)*(d.renewable?(s.event?.solar||1):1);
  if(metric==='transport')value*=(1+s.research.logistics*.2)*(s.event?.freight||1)*logisticsBonus(s);
  if(metric==='storage')value*=(1+s.research.logistics*.1)*logisticsBonus(s);
  if(metric==='research')value*=(1+s.legacy*.04)*(1+(s.research.science||0)*.15);
  return value;
}
export function researchRate(s){return Object.keys(INFRA).reduce((total,id)=>total+(s.infra[id]||0)*infrastructureYield(s,id,'research'),0);}
export function warehouseCapacity(s) { return (500+infraBase(s,'storage'))*(1+s.research.logistics*.1)*logisticsBonus(s); }
export function workforce(s) { return 12+infraBase(s,'workers'); }
export function productionBonus(s, id, offline = false) {
  const b = BUILDINGS[id], level = s.buildings[id].level;
  let mult = (1 + level * 0.18) * (1 + s.research.efficiency * 0.08) * (1 + s.legacy * 0.08) * POLICIES[s.policy].output;
  if (id === 'lumber') mult *= 1 + s.research.forestry * 0.2;
  if (['farm', 'cottonFarm'].includes(id)) mult *= (1 + s.research.agronomy * 0.2) * (s.event?.farm || 1);
  if (b.tier >= 4) mult *= 1 + s.research.computing * 0.15;
  if (offline) mult *= 1 + s.research.patience * 0.1;
  mult*=1+(s.campaign?.bonuses.production||0)/100;
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
  pollution = Math.max(0, pollution * POLICIES[s.policy].pollution * Math.pow(0.88, s.research.ecology) - infraBase(s,'cleanup'));
  const cleanEnergy=6+Object.entries(INFRA).filter(([,d])=>!d.fuel).reduce((total,[id])=>total+(s.infra[id]||0)*infrastructureYield(s,id,'energy'),0);
  const coalEnergy=s.infra.power*infrastructureYield(s,'power','energy');
  const potentialEnergy = cleanEnergy + coalEnergy;
  const fullLoadFuel = s.infra.power * 4 * STEP / HOUR;
  const fuelAvailability = fullLoadFuel ? Math.min(1,s.inventory.coal/fullLoadFuel) : 1;
  const availableEnergy = cleanEnergy + coalEnergy * fuelAvailability;
  const transport = (12+infraBase(s,'transport'))*(1+s.research.logistics*.2)*(s.event?.freight||1)*logisticsBonus(s);
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
  let storage=1;
  for(const[r,q]of Object.entries(b.output))storage=Math.min(storage,Math.max(0,warehouseCapacity(s)-s.inventory[r])/(q*own.active*mult*STEP/HOUR||1));
  const wages=own.active*b.wage*(1+own.level*.08)*POLICIES[s.policy].wage*STEP/HOUR;
  const cashAvailability=wages?Math.min(1,s.cash/wages):1;
  let utilization = own.active ? Math.min(global,supply,storage,cashAvailability) : 0;
  const outValue = sum(Object.fromEntries(Object.entries(b.output).map(([k, v]) => [k, v * price(s, k)])));
  const inValue = sum(Object.fromEntries(Object.entries(b.input).map(([k, v]) => [k, v * price(s, k)])));
  const margin = (outValue - inValue) * mult - b.wage * (1 + own.level * 0.08) * POLICIES[s.policy].wage;
  const guarded=!!s.profitGuard&&((outValue*(1-feeRate(s)-.008)-inValue*(1+feeRate(s)+.008))*mult-b.wage*(1+own.level*.08)*POLICIES[s.policy].wage)<0;
  if(guarded)utilization=0;
  return { utilization, mult, units: own.active * mult * utilization, margin, global, supply, storage,cash:cashAvailability,guarded };
}

export function buildQuote(s, id, amount = 1, infrastructure = false) {
  const d = infrastructure ? INFRA[id] : BUILDINGS[id];
  if (!d || !Number.isInteger(amount) || amount < 1 || amount > 100) return null;
  const n = infrastructure ? s.infra[id] : s.buildings[id].count, growth = infrastructure ? d.growth : 1.13;
  const cash = d.cost * Math.pow(growth, n) * (Math.pow(growth, amount) - 1) / (growth - 1);
  const materials = {};
  let materialCash = 0,ownedMaterialsValue=0;
  for (const [r, q] of Object.entries(d.materials || {})) {
    materials[r] = q * amount;
    materialCash += quote(s, r, Math.max(0, q * amount - s.inventory[r]), 'buy').total;
    ownedMaterialsValue+=Math.min(q*amount,s.inventory[r])*price(s,r)*.98;
  }
  return { cash, materials, materialCash, total: cash + materialCash,book:cash+materialCash+ownedMaterialsValue };
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
  if (infrastructure) { s.infra[id] += amount; s.infraBook[id] += q.book; }
  else { const own = s.buildings[id]; own.count += amount; own.active += amount; own.book += q.book; s.stats.built += amount; }
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

function autoTrade(s, context) {
  for (const id of context.automated) {
    const a = s.automation[id], stored = s.inventory[id];
    const sellAt = a.mode === 'both' ? a.high : a.high;
    if (['sell', 'both'].includes(a.mode) && stored > sellAt + 0.01) trade(s, id, stored - sellAt, 'sell', true);
    if (['buy', 'both'].includes(a.mode) && s.inventory[id] < a.low - 0.01) {
      const desired = Math.min(a.low - s.inventory[id], context.storage - s.inventory[id]);
      // Keep a cash buffer for wages. Purchases never create involuntary debt.
      const budget = Math.max(0, s.cash - context.cashBuffer);
      if (budget < 0.01) continue;
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

function productionContext(s, offline) {
  const c = capacity(s), policy = POLICIES[s.policy];
  const ids = Object.keys(BUILDINGS).filter(id => s.buildings[id].active);
  if (s.priority === 'advanced') ids.reverse();
  const context={ capacity:c, storage:warehouseCapacity(s), cashBuffer:Math.max(50,c.wages*.25),researchRate:researchRate(s),researchCost:infraBase(s,'research')*10,
    automated:Object.keys(RESOURCES).filter(id=>RESOURCES[id].tier<=s.tier&&s.automation[id].mode!=='off'),
    entries:ids.map(id=>{
      const b=BUILDINGS[id],own=s.buildings[id],mult=productionBonus(s,id,offline),scale=own.active*mult/HOUR;
      return { id,input:Object.entries(b.input).map(([r,q])=>[r,q*scale]), output:Object.entries(b.output).map(([r,q])=>[r,q*scale]),
        wages:own.active*b.wage*(1+own.level*.08)*policy.wage/HOUR };
    }),
  };
  refreshProfitGuard(s,context);return context;
}

function refreshProfitGuard(s,context){
  if(!s.profitGuard)return;
  const fee=feeRate(s)+.008;
  for(const entry of context.entries){
    const output=entry.output.reduce((n,[r,q])=>n+q*price(s,r)*(1-fee),0),input=entry.input.reduce((n,[r,q])=>n+q*price(s,r)*(1+fee),0);
    entry.guarded=output-input-entry.wages<0;
  }
}

function produce(s, seconds, context) {
  const h = seconds / HOUR, c = context.capacity;
  const desiredCoalPower = Math.max(0, c.energy - c.cleanEnergy);
  const coalEnergy=s.infra.power*infrastructureYield(s,'power','energy');
  const powerFraction = coalEnergy ? Math.min(1, desiredCoalPower / coalEnergy) : 0;
  const coalWanted = s.infra.power * 4 * h * powerFraction;
  const coalRatio = coalWanted ? Math.min(1, s.inventory.coal / coalWanted) : 1;
  s.inventory.coal = Math.max(0, s.inventory.coal - coalWanted * coalRatio);
  const actualPower = c.cleanEnergy + coalEnergy * powerFraction * coalRatio;
  const global = Math.min(c.staffing, c.energy ? actualPower / c.energy : 1, c.logistics, 1) * c.environment;
  for (const entry of context.entries) {
    if(entry.guarded)continue;
    let factor = global;
    for (const [r, q] of entry.input) factor = Math.min(factor, s.inventory[r] / (q * seconds));
    for (const [r, q] of entry.output) factor = Math.min(factor, Math.max(0, context.storage - s.inventory[r]) / (q * seconds));
    const wages = entry.wages * seconds;
    if (wages > 0) factor = Math.min(factor, s.cash / wages);
    factor = clamp(factor, 0, 1);
    if (factor < 1e-9) continue;
    for (const [r, q] of entry.input) s.inventory[r] = Math.max(0, s.inventory[r] - q * seconds * factor);
    for (const [r, q] of entry.output) { const made = q * seconds * factor; s.inventory[r] += made; s.stats.produced += made; }
    expense(s, wages * factor);
  }
  const labCost = context.researchCost * h;
  const labScale = labCost ? Math.min(1, s.cash / labCost) : 0;
  s.points += context.researchRate * h * labScale;
  expense(s, labCost * labScale);
  expense(s, Math.min(s.cash, c.ecoCost * h));
}

export function bankRate(s, id) {
  const base = id === 'reserve' ? BANKS.reserve.rate : clamp(s.economy.rate, 0.0004, 0.0018);
  return Math.min(.0025,base*(1+s.research.finance*.05)*(1+(s.campaign?.bonuses.finance||0)/100));
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
  const securities = Object.values(s.stocks).reduce((n, p) => n + p.price * p.quantity * 0.995 + p.reserve, 0);
  const properties=Object.entries(PROPERTIES).reduce((n,[id,d])=>n+s.properties[id].count*d.cost*s.properties[id].index*.97,0);
  const options=s.options.reduce((n,o)=>n+optionPrice(referencePrice(s,o.resource),o.strike,Math.max(0,(o.end-s.elapsed)/DAY),o.volatility,o.type)*o.quantity,0);
  const bonds = s.bonds.reduce((n, b) => n + b.principal, 0), ventures = s.ventures.reduce((n, b) => n + b.principal, 0);
  const debt = s.debt + s.loans.reduce((n, l) => n + l.principal, 0);
  return { cash: s.cash, inventory, buildings, securities, properties, options, banks: sum(s.banks), bonds, ventures, debt,
    total: s.cash + inventory + buildings + securities + properties + options + sum(s.banks) + bonds + ventures - debt };
}
export function creditLimit(s) {
  const a = assets(s);
  return Math.min(50000000*Math.pow(1+Math.max(0,s.tier-6),3), Math.max(1000, (a.buildings * 0.5 + a.inventory * 0.3 + a.securities * 0.4 + a.properties*.6 + a.banks * 0.8) * (0.6 + s.reputation / 100)));
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

const COMPANY_MODELS={
  sylva:{pe:12,outputs:['wood','stone','coal','ore'],inputs:['water','tools'],beta:.7},
  terra:{pe:18,outputs:['food'],inputs:['grain','water'],beta:.35},
  ferrum:{pe:14,outputs:['planks','bricks','iron','steel','machines'],inputs:['ore','coal','wood'],beta:1.25},
  forma:{pe:16,outputs:['furniture','vehicles','fabric'],inputs:['planks','cotton','steel'],beta:1.1},
  nova:{pe:24,outputs:['medicine','electronics','chips','satellites'],inputs:['chemicals','glass','iron'],beta:1.5},
};
export function companyFundamentals(s,id){
  if(id==='index'){
    const parts=Object.entries(COMPANY_MODELS).map(([key])=>({report:s.stocks[key].report||companyFundamentals(s,key),weight:100/(5*STOCKS[key].base)}));
    const revenue=parts.reduce((n,p)=>n+p.report.revenue*p.weight,0),eps=parts.reduce((n,p)=>n+p.report.eps*p.weight,0);
    return {at:s.elapsed,revenue,eps,margin:eps/revenue,fair:parts.reduce((n,p)=>n+p.report.fair*p.weight,0),dps:parts.reduce((n,p)=>n+p.report.dps*p.weight,0),inputIndex:1,outputIndex:1,growth:0};
  }
  const d=STOCKS[id],model=COMPANY_MODELS[id];if(!d||!model)return null;
  const average=keys=>keys.reduce((n,r)=>n+s.market[r].factor,0)/keys.length;
  const outputIndex=average(model.outputs),inputIndex=average(model.inputs),demand=Math.pow(s.economy.cycle,model.beta);
  const revenue=d.base/(model.pe*.18)*demand*outputIndex;
  const margin=clamp(.18+(outputIndex-inputIndex)*.22+(s.economy.cycle-1)*.15,.015,.4);
  const eps=revenue*margin,fair=eps*model.pe*(1+Math.min(1,s.elapsed/HOUR/20000));
  const dps=Math.min(d.base*d.dividend*(eps/(d.base/model.pe)),eps/30*.7);
  const previous=s.stocks[id].report;
  return {at:s.elapsed,revenue,eps,margin,fair,dps,inputIndex,outputIndex,growth:previous?.revenue?revenue/previous.revenue-1:0};
}
function updateReports(s,initial=false){
  for(const id of Object.keys(COMPANY_MODELS))s.stocks[id].report=companyFundamentals(s,id);
  s.stocks.index.report=companyFundamentals(s,'index');
  if(!initial&&Object.values(s.stocks).some(p=>p.quantity))log(s,'Neue Geschäftsberichte: Umsatz, Margen und Dividenden deiner Depotwerte wurden aktualisiert.','finance');
}

export function toggleDividendReinvestment(s,id) {
  const p=s.stocks[id];if(!p||s.tier<2)return fail('Dividendenautomatik ist noch nicht verfügbar.');
  p.drip=!p.drip;
  if(!p.drip){s.cash+=p.reserve;p.reserve=0;}
  return ok(p.drip?'Dividenden werden nach Steuer gesammelt und automatisch reinvestiert.':'Dividenden werden ausgezahlt. Verbleibende Reserve freigegeben.');
}
export function createSavingsPlan(s,stock,budget,period=1) {
  if(s.tier<2||!Object.hasOwn(STOCKS,stock)||!Number.isFinite(budget)||budget<10||budget>1e12||![1,5,10].includes(period))return fail('Sparpläne ab 10 €, mit 1, 5 oder 10 Spieltagen Abstand.');
  if(s.savingsPlans.some(p=>p.stock===stock))return fail('Für diesen Wert besteht bereits ein Sparplan.');
  s.savingsPlans.push({id:s.nextId++,stock,budget,period,next:s.elapsed+period*DAY,executions:0,skipped:0});
  return ok('Sparplan eingerichtet. Bei zu wenig freiem Kapital wird die Ausführung übersprungen.');
}
export function cancelSavingsPlan(s,id) {s.savingsPlans=s.savingsPlans.filter(p=>p.id!==id);return ok('Sparplan beendet. Gekaufte Anteile bleiben im Depot.');}
function executeSavingsPlans(s) {
  for(const plan of s.savingsPlans){
    if(plan.next>s.elapsed)continue;
    const p=s.stocks[plan.stock],buffer=s.treasury.enabled?s.treasury.floor:50;
    const quantity=Math.floor(Math.min(plan.budget,Math.max(0,s.cash-buffer))/(p.price*1.005));
    if(quantity>0){const cost=p.price*quantity*1.005;s.cash-=cost;p.quantity+=quantity;p.basis+=cost;plan.executions++;}
    else plan.skipped++;
    plan.next+=plan.period*DAY;
  }
}

export function propertyTrade(s,id,count,side) {
  const d=PROPERTIES[id],p=s.properties[id];
  if(!d||d.tier>s.tier||!Number.isInteger(count)||count<1||count>100||!['buy','sell'].includes(side))return fail('Ungültige Immobilientransaktion.');
  const gross=d.cost*p.index*count;
  if(side==='buy'){
    const cost=gross*1.02;if(cost>s.cash||p.count+count>100000)return fail('Guthaben oder Immobilienlimit reicht nicht.');
    s.cash-=cost;p.count+=count;p.basis+=cost;
  }else{
    if(count>p.count)return fail('So viele Immobilien besitzt du nicht.');
    const basis=p.basis*count/p.count,net=gross*.97,tax=Math.max(0,net-basis)*.15;
    p.count-=count;p.basis=Math.max(0,p.basis-basis);s.cash+=net-tax;s.stats.taxes+=tax;
  }
  return ok(count+'× '+d.name+(side==='buy'?' erworben.':' verkauft.'));
}

export function referencePrice(s,id){return RESOURCES[id]?RESOURCES[id].base*s.market[id].factor:0;}
export function optionQuote(s,resource,type,quantity,days=3) {
  if(!RESOURCES[resource]||!['put','call'].includes(type)||!Number.isInteger(quantity)||quantity<1||quantity>10000||![1,3,7].includes(days))return null;
  const spot=referencePrice(s,resource),volatility=RESOURCES[resource].sector==='tech'?.12:.085;
  const fair=optionPrice(spot,spot,days,volatility,type)*quantity;
  return {strike:spot,volatility,premium:fair*1.04+1,quantity,days,type,resource};
}
export function buyOption(s,resource,type,quantity,days=3) {
  const q=optionQuote(s,resource,type,quantity,days);
  if(!q||s.tier<3||RESOURCES[resource].tier>s.tier||s.options.length>=20||s.options.reduce((n,o)=>n+o.quantity,0)+quantity>10000)return fail('Absicherungen sind nicht verfügbar oder das Positionslimit ist erreicht.');
  if(q.premium>s.cash)return fail('Nicht genügend Geld für die Prämie.');
  s.cash-=q.premium;s.options.push({id:s.nextId++,resource,type,quantity,strike:q.strike,premium:q.premium,volatility:q.volatility,start:s.elapsed,end:s.elapsed+days*DAY});
  return ok('Absicherung abgeschlossen. Der maximale Verlust ist die bezahlte Prämie.');
}
export function sellOption(s,id){
  const o=s.options.find(o=>o.id===id);if(!o)return fail('Position nicht gefunden.');
  const value=optionPrice(referencePrice(s,o.resource),o.strike,Math.max(0,(o.end-s.elapsed)/DAY),o.volatility,o.type)*o.quantity*.96;
  const tax=Math.max(0,value-o.premium)*.15;s.cash+=value-tax;s.stats.taxes+=tax;s.stats.optionPnl+=value-tax-o.premium;
  s.options=s.options.filter(x=>x!==o);return ok('Absicherung zum Modellwert abzüglich 4 % Spread verkauft.');
}

function manageTreasury(s,sweep=false) {
  const t=s.treasury;if(!t.enabled||s.tier<2)return;
  if(!sweep&&s.cash<t.floor){
    for(const id of [t.bank,t.bank==='reserve'?'savings':'reserve']){const transfer=Math.min(s.banks[id],Math.max(0,t.target-s.cash));s.banks[id]-=transfer;s.cash+=transfer;}
  }
  if(sweep&&s.cash>t.target*1.2){const transfer=s.cash-t.target;s.cash-=transfer;s.banks[t.bank]+=transfer;}
}
export function setTreasury(s,field,value){
  if(s.tier<2)return fail('Liquiditätsmanager noch nicht verfügbar.');
  const t=s.treasury;
  if(field==='enabled')t.enabled=!!value;
  else if(field==='bank'&&Object.hasOwn(BANKS,value))t.bank=value;
  else if(['floor','target'].includes(field)&&Number.isFinite(value)){t[field]=clamp(Math.round(value),50,1e12);if(t.floor>t.target){if(field==='floor')t.target=t.floor;else t.floor=t.target;}}
  else return fail('Ungültige Einstellung.');
  return ok('Liquiditätsmanager gespeichert.');
}
export function emergencyAid(s){
  const a=assets(s),liquid=a.inventory+a.banks+a.securities;
  if(s.cash>=50||liquid>=75)return fail('Nutze zuerst vorhandenes Geld, Lagerbestände oder liquide Anlagen.');
  if(s.emergencyNext>s.elapsed)return fail('Ein neuer Notauftrag ist in '+Math.ceil((s.emergencyNext-s.elapsed)/60)+' echten Minuten verfügbar.');
  s.cash+=400;s.emergencyNext=s.elapsed+300;s.stats.grants+=400;
  log(s,'Öffentlicher Notauftrag erledigt: +400 € Betriebskapital.','contract');
  return ok('400 € Starthilfe. Pausiere unrentable Betriebe und starte eine tragfähige Kette.');
}

export function restructure(s,now=Date.now()){
  const a=assets(s);
  if(a.total>=0||s.cash>=100||a.inventory+a.banks+a.securities>=200)return null;
  const fresh=createGame(s.name,now,s.seed);
  fresh.created=s.created;fresh.elapsed=s.elapsed;fresh.cash=600;fresh.seed=s.seed;
  fresh.tier=s.tier;fresh.research={...s.research};fresh.legacy=s.legacy;fresh.prestigeCount=s.prestigeCount;
  fresh.reputation=15;fresh.tutorial=false;fresh.nextId=s.nextId;
  fresh.campaign=JSON.parse(JSON.stringify(s.campaign));
  fresh.achievements=[...s.achievements];fresh.journal=[...s.journal];
  fresh.stats={...s.stats,built:s.stats.built+1,resets:s.stats.resets+1,lastProfit:0,lastRevenue:0,lastCosts:0,history:[...s.stats.history]};
  fresh.market=JSON.parse(JSON.stringify(s.market));fresh.economy={...s.economy};fresh.event=s.event?{...s.event}:null;
  for(const id of Object.keys(STOCKS))fresh.stocks[id]={...s.stocks[id],history:[...s.stocks[id].history],quantity:0,basis:0,reserve:0,drip:false};
  for(const id of Object.keys(PROPERTIES))fresh.properties[id]={...s.properties[id],history:[...s.properties[id].history],count:0,basis:0};
  fresh.buildings.lumber={count:1,active:1,level:0,book:320};
  refreshBoard(fresh);
  log(fresh,'Sanierung abgeschlossen. Alle alten Anlagen und Finanzpositionen abgegeben, Schulden getilgt. Neustart mit 600 €, einem Holzfäller und deinem Wissen.','milestone');
  return fresh;
}

export function supplyPlan(s){
  const output=empty(RESOURCES),input=empty(RESOURCES),producers=Object.fromEntries(Object.keys(RESOURCES).map(id=>[id,[]]));
  for(const [id,b]of Object.entries(BUILDINGS)){
    if(b.tier>s.tier)continue;
    const own=s.buildings[id],scale=own.active*productionBonus(s,id);
    for(const[r,n]of Object.entries(b.output)){output[r]+=n*scale;producers[r].push(id);}
    for(const[r,n]of Object.entries(b.input))input[r]+=n*scale;
  }
  input.coal+=s.infra.power*4;
  return Object.keys(RESOURCES).filter(r=>RESOURCES[r].tier<=s.tier&&(output[r]>0||input[r]>0||s.inventory[r]>.01)).map(id=>({id,output:output[id],input:input[id],net:output[id]-input[id],producers:producers[id],hours:input[id]>output[id]?s.inventory[id]/(input[id]-output[id]):Infinity}));
}
export function setupSupplies(s,id){
  const b=BUILDINGS[id],own=s.buildings[id];if(!b||!own.active||!Object.keys(b.input).length)return fail('Ein aktiver Verarbeitungsbetrieb wird benötigt.');
  for(const[r,n]of Object.entries(b.input)){
    const desired=Math.ceil(n*own.active*productionBonus(s,id)*2),a=s.automation[r];
    a.low=Math.max(a.low,Math.min(warehouseCapacity(s),desired));a.high=Math.max(a.high,a.low*2);a.mode=a.mode==='sell'||a.mode==='both'?'both':'buy';
  }
  return ok('Vorprodukte werden jetzt automatisch für etwa zwei Spielstunden bevorratet. Einkäufe benötigen Geld.');
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
  for(const o of [...s.options]){
    if(o.end>s.elapsed)continue;
    const spot=referencePrice(s,o.resource),payoff=Math.max(0,o.type==='call'?spot-o.strike:o.strike-spot)*o.quantity,tax=Math.max(0,payoff-o.premium)*.15;
    s.cash+=payoff-tax;s.stats.taxes+=tax;s.stats.optionPnl+=payoff-tax-o.premium;
    log(s,`${o.type==='put'?'Preisuntergrenze':'Einkaufsschutz'} ${RESOURCES[o.resource].name} fällig: ${Math.round(payoff-tax).toLocaleString('de-DE')} € Auszahlung.`,payoff>o.premium?'finance':'info');
    s.options=s.options.filter(x=>x!==o);
  }
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
  executeSavingsPlans(s);
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
  for (const id of Object.keys(RESOURCES)) {
    const m = s.market[id]; m.previous = price(s, id);
    m.history.push(price(s, id)); if (m.history.length > 48) m.history.shift();
  }
  for (const p of Object.values(s.stocks)) {
    p.previous=p.price;p.history.push(p.price);if(p.history.length>48)p.history.shift();
  }
  for(const[id,d]of Object.entries(PROPERTIES)){
    const p=s.properties[id],sector=Object.keys(RESOURCES).filter(r=>RESOURCES[r].sector===d.sector),sectorIndex=sector.reduce((n,r)=>n+s.market[r].factor,0)/sector.length;
    const target=clamp(.55+.25*cycle+.2*sectorIndex+.04*Math.sin(hour/300+d.cost),.55,1.9);
    p.index=clamp(p.index+(target-p.index)*.015+(random(s)-.5)*(id==='datacenter'?.012:.005),.45,2.5);
    const occupancyTarget=id==='farmland'?.97:clamp(.88+(cycle-1)*(id==='industrial'?.65:.35)+(s.reputation-50)*.0007,.4,.99);
    p.occupancy=clamp(p.occupancy+(occupancyTarget-p.occupancy)*.025,.4,.99);
    p.history.push(p.index);if(p.history.length>48)p.history.shift();
  }
  s.stats.lastRevenue = s.hourLedger.revenue; s.stats.lastCosts = s.hourLedger.costs;
  s.stats.lastProfit = s.hourLedger.revenue - s.hourLedger.costs;
  s.stats.history.push({ at: s.elapsed, wealth: assets(s).total, profit: s.stats.lastProfit });
  if (s.stats.history.length > 96) s.stats.history.shift();
  s.hourLedger = { revenue: 0, costs: 0 };
  if (hour % 6 === 0) refreshBoard(s);
  if (hour % 24 === 0) daily(s);
  checkProgress(s); checkAchievements(s);
}

function marketTick(s, fraction) {
  const hour=s.elapsed/HOUR,cycle=s.economy.cycle;
  for (const [id, d] of Object.entries(RESOURCES)) {
    const m = s.market[id];
    const eventFactor = s.event && (s.event.sector === d.sector || s.event.sector === 'all') ? s.event.demand : 1;
    const target = cycle * eventFactor * (1 + Math.sin(hour / 72 + d.base) * 0.08);
    m.factor = clamp(m.factor + (target - m.factor) * (1-Math.pow(0.92,fraction)) + (random(s) - 0.5) * 0.025 * Math.sqrt(fraction), 0.45, 2.1);
    m.pressure *= Math.pow(0.982,fraction);
  }
  for (const [id, d] of Object.entries(STOCKS)) {
    if (id === 'index') continue;
    const p = s.stocks[id];
    const anchor = Math.max(d.base*.08,p.report.fair);
    const reversion = Math.log(anchor / p.price) * 0.012 * fraction;
    p.price = clamp(p.price * Math.exp(reversion + (random(s) - 0.5) * d.volatility * 2 * Math.sqrt(fraction) + .02*d.volatility*fraction), d.base * 0.08, d.base * 12);
  }
  const idx = s.stocks.index;
  idx.price = 100 * Object.entries(STOCKS).filter(([id]) => id !== 'index').reduce((n, [id, d]) => n + s.stocks[id].price / d.base, 0) / 5;
}

function daily(s) {
  if(s.elapsed%(5*DAY)===0)updateReports(s);
  const taxable = Math.max(0, s.dayLedger.revenue - s.dayLedger.costs), tax = taxable * 0.12;
  const paid = Math.min(s.cash, tax); s.cash -= paid; s.debt += tax - paid; s.stats.taxes += tax;
  s.dayLedger = { revenue: 0, costs: 0 };
  const dividends={};
  for(const[id,d]of Object.entries(STOCKS)){
    if(id==='index')continue;
    const p=s.stocks[id],payment=Math.min(p.report.dps,p.price*.05);
    dividends[id]=payment;p.price-=payment;
  }
  s.stocks.index.price=100*Object.entries(STOCKS).filter(([id])=>id!=='index').reduce((n,[id,d])=>n+s.stocks[id].price/d.base,0)/5;
  dividends.index=100*Object.entries(STOCKS).filter(([id])=>id!=='index').reduce((n,[id,d])=>n+dividends[id]/d.base,0)/5;
  for (const [id, d] of Object.entries(STOCKS)) {
    const p = s.stocks[id], gross = p.quantity * dividends[id];
    const net=gross*.85;
    if(p.drip){p.reserve+=net;const quantity=Math.floor(p.reserve/(p.price*1.005));if(quantity>0){const cost=quantity*p.price*1.005;p.quantity+=quantity;p.basis+=cost;p.reserve=Math.max(0,p.reserve-cost);}}
    else s.cash+=net;
    s.stats.dividends += net; s.stats.taxes += gross * 0.15;
  }
  for(const[id,d]of Object.entries(PROPERTIES)){
    const p=s.properties[id],net=Math.max(0,p.count*(d.rent*p.occupancy-d.maintenance)),tax=net*.15;
    s.cash+=net-tax;s.stats.rent+=net-tax;s.stats.taxes+=tax;
  }
  const utilization = (s.debt + s.loans.reduce((n, l) => n + l.principal, 0)) / creditLimit(s);
  if (utilization > 1) { s.reputation = Math.max(0, s.reputation - 1); }
  else s.reputation = Math.min(100, s.reputation + 0.15);
}

function accrueFinance(s, seconds) {
  const fraction = seconds / DAY;
  for (const id of Object.keys(BANKS)) {
    if(!s.banks[id])continue;
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
  s.campaign.peak=Math.max(s.campaign.peak,s.stats.peak);
  const tier = TIERS.reduce((n, t, i) => s.stats.peak >= t.wealth ? i : n, 0);
  if (tier > s.tier) {
    s.tier = tier;
    log(s, `${TIERS[tier].name} freigeschaltet. Neue Betriebe, Waren und Möglichkeiten warten.`, 'milestone');
    refreshBoard(s);
  }
  if(!s.campaign.unlocked&&s.tier>=3){s.campaign.unlocked=true;log(s,'Langfristige Holdingprogramme entdeckt. Ihre Spezialisierungen bleiben auch nach einer Neugründung erhalten.','milestone');}
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
  fresh.campaign=JSON.parse(JSON.stringify(s.campaign));
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
  let context=productionContext(s,!!options.offline);
  for (let i = 0; i < steps; i++) {
    manageTreasury(s);
    autoTrade(s,context);
    produce(s, STEP, context);
    accrueFinance(s, STEP);
    autoTrade(s,context);
    executeOrders(s);
    s.elapsed += STEP;
    s.campaign.age+=STEP;
    settleMaturities(s);
    const programme=settleProgramme(s);
    if(programme){log(s,programme,'milestone');context=productionContext(s,!!options.offline);}
    manageTreasury(s,true);
    if(s.elapsed%5===0){marketTick(s,5/HOUR);refreshProfitGuard(s,context);}
    if (s.elapsed % HOUR === 0) {hourly(s);context=productionContext(s,!!options.offline);}
    if (options.onProgress && i % 3600 === 0) options.onProgress(i / steps);
  }
  if (elapsed > OFFLINE_LIMIT) s.lastUpdate = now - (available - seconds) * 1000;
  else s.lastUpdate += seconds * 1000;
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
  for (const key of ['cash', 'points', 'debt','emergencyNext']) s[key] = finite(raw[key]);
  s.tier = Math.floor(finite(raw.tier, 0, TIERS.length-1)); s.legacy = Math.floor(finite(raw.legacy, 0, 10000)); s.prestigeCount = Math.floor(finite(raw.prestigeCount, 0, 10000));
  s.reputation = finite(raw.reputation, 50, 100); s.nextId = Math.max(1, Math.floor(finite(raw.nextId, 1, 1e12)));
  s.policy = Object.hasOwn(POLICIES, raw.policy) ? raw.policy : 'balanced'; s.priority = raw.priority === 'advanced' ? 'advanced' : 'balanced';
  s.profitGuard=raw.profitGuard===true;
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
    s.stocks[id] = { price: Math.max(0.01, finite(p.price, d.base, d.base * 12)), previous: finite(p.previous, d.base), quantity: Math.floor(finite(p.quantity, 0, 1e10)), basis: finite(p.basis), history: cleanHistory(p.history, d.base),drip:p.drip===true,reserve:finite(p.reserve) };
  }
  for(const id of Object.keys(PROPERTIES)){
    const p=raw.properties?.[id]||{};
    s.properties[id]={count:Math.floor(finite(p.count,0,100000)),basis:finite(p.basis),index:clamp(finite(p.index,1),.45,2.5),occupancy:clamp(finite(p.occupancy,.9),.4,.99),history:cleanHistory(p.history,1)};
  }
  s.options=cleanArray(raw.options,20).filter(o=>o&&Object.hasOwn(RESOURCES,o.resource)&&['put','call'].includes(o.type)).map(o=>({id:finite(o.id),resource:o.resource,type:o.type,quantity:Math.max(1,Math.floor(finite(o.quantity,1,10000))),strike:Math.max(.001,finite(o.strike,1,1e9)),premium:finite(o.premium),volatility:clamp(finite(o.volatility,.085),.01,.5),start:finite(o.start),end:finite(o.end)}));
  s.savingsPlans=cleanArray(raw.savingsPlans,6).filter(p=>p&&Object.hasOwn(STOCKS,p.stock)).map(p=>({id:finite(p.id),stock:p.stock,budget:finite(p.budget,100,1e12),period:[1,5,10].includes(p.period)?p.period:1,next:finite(p.next,s.elapsed+DAY),executions:finite(p.executions),skipped:finite(p.skipped)}));
  if(raw.treasury){const t=raw.treasury;s.treasury={enabled:t.enabled===true,floor:Math.max(50,finite(t.floor,150,1e12)),target:Math.max(50,finite(t.target,600,1e12)),bank:Object.hasOwn(BANKS,t.bank)?t.bank:'reserve'};s.treasury.target=Math.max(s.treasury.floor,s.treasury.target);}
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
  for (const key of Object.keys(s.stats)) { if (key !== 'history') s.stats[key] = typeof raw.stats[key] === 'number' && Number.isFinite(raw.stats[key]) ? clamp(raw.stats[key], ['lastProfit','optionPnl'].includes(key) ? -1e15 : 0, 1e15) : s.stats[key]; }
  s.stats.history = cleanArray(raw.stats.history, 96).filter(h => h && Number.isFinite(h.wealth) && Number.isFinite(h.profit)).map(h => ({ at: finite(h.at), wealth: h.wealth, profit: h.profit }));
  for (const ledger of ['hourLedger', 'dayLedger']) s[ledger] = { revenue: finite(raw[ledger]?.revenue), costs: finite(raw[ledger]?.costs) };
  s.tutorial = raw.tutorial !== false;
  s.campaign=normalizeCampaign(raw.campaign,s.elapsed,s.stats.peak);
  s.campaign.unlocked ||= s.tier>=3;
  for(const id of Object.keys(STOCKS)){
    const baseline=companyFundamentals(s,id),r=raw.stocks?.[id]?.report;
    s.stocks[id].report=r&&typeof r==='object'?Object.fromEntries(Object.entries(baseline).map(([key,value])=>[key,typeof r[key]==='number'&&Number.isFinite(r[key])?clamp(r[key],key==='growth'?-1:0,1e10):value])):baseline;
    s.stocks[id].report.eps=Math.max(.001,s.stocks[id].report.eps);s.stocks[id].report.fair=Math.max(.01,s.stocks[id].report.fair);
  }
  return s;
}
function cleanArray(a, max) { return Array.isArray(a) ? a.slice(0, max) : []; }
function cleanHistory(a, fallback) { const h = cleanArray(a, 48).filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e12); return h.length ? h : [fallback]; }
