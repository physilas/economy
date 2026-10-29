import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,prestige,buyOption} from '../src/engine.mjs';
import {encode,decode} from '../src/storage.mjs';
import {PROGRAMMES} from '../src/data.mjs';
import {normalizeUI} from '../src/ui-state.mjs';
import * as V from '../src/views.mjs';

function advancedUI(){return {tab:'finance',productionTab:'strategy',financeTab:'hedges',optionResource:'colonies',optionType:'call',optionDays:7,fixedDays:60,planStock:'nova',planPeriod:10,qty:10,amount:1000,buildFilter:'all',marketFilter:'all',open:new Set()};}

test('loading an earlier company makes displayed option resource match its purchase action',()=>{
  const earlier=createGame('Earlier',0,42);earlier.tier=3;earlier.cash=1000000;earlier.stats.peak=1000000;
  const loaded=decode(encode(earlier),0).game,ui=advancedUI();
  const html=V.finance(loaded,ui);
  assert.equal(ui.optionResource,'wood');assert.equal(ui.financeTab,'hedges');
  assert.ok(html.includes('<option value="wood" selected>Holz</option>'));
  assert.ok(!html.includes('Autonome Kolonien'));
  assert.ok(buyOption(loaded,ui.optionResource,ui.optionType,ui.qty,ui.optionDays).ok);
  assert.equal(loaded.options[0].resource,'wood');
});

test('a loaded tier-one company cannot retain previously unlocked financial subtabs',()=>{
  const s=createGame('Earlier',0,42);s.tier=1;
  for(const financeTab of ['properties','hedges']){
    const ui={...advancedUI(),financeTab};const html=V.finance(s,ui);
    assert.equal(ui.financeTab,'bank');assert.equal(ui.fixedDays,20);
    assert.ok(html.includes('Reservekonto'));assert.ok(!html.includes('Absicherung kaufen'));assert.ok(!html.includes('Vermietetes Wohnhaus'));
  }
});

test('prestige returns inaccessible tabs and products to starting selections',()=>{
  const old=createGame('Holding',0,42);old.tier=11;old.stats.peak=1e8;
  const fresh=prestige(old,0),ui=advancedUI();normalizeUI(ui,fresh);
  assert.equal(ui.tab,'overview');assert.equal(ui.productionTab,'business');assert.equal(ui.financeTab,'bank');assert.equal(ui.optionResource,'wood');assert.equal(ui.fixedDays,20);
  const production=V.production(fresh,ui),finance=V.finance(fresh,ui);
  assert.ok(production.includes('Holzfäller'));assert.ok(!production.includes('Strategie wählen'));
  assert.ok(!finance.includes('Reservekonto'));assert.ok(!finance.includes('Absicherung kaufen'));
});

test('valid unlocked preferences survive normalization without changing the company',()=>{
  const s=createGame('Advanced',0,42);s.tier=11;s.campaign.unlocked=true;
  const ui=advancedUI(),before=JSON.stringify(s),selection={...ui};
  assert.equal(normalizeUI(ui,s),ui);assert.deepEqual(ui,selection);assert.equal(JSON.stringify(s),before);
});

test('production rendering also rejects stale locked subtabs after a restart',()=>{
  const s=createGame('New',0,42),ui=advancedUI();ui.tab='production';
  const html=V.production(s,ui);assert.equal(ui.productionTab,'business');assert.ok(!html.includes('Strategie wählen'));assert.ok(html.includes('Holzfäller'));
});


test('a programme with only missing cash explains its disabled choices visibly',()=>{
  const s=createGame('Cash shortage',0,42),p=PROGRAMMES[0];s.tier=p.tier;s.campaign.unlocked=true;s.campaign.peak=p.wealth;s.cash=p.cash-4000;s.points=p.points;
  for(const[id,q]of Object.entries(p.materials))s.inventory[id]=q;
  const html=V.programmes(s);
  assert.ok(html.includes('Kapital verfügbar / benötigt'));
  assert.ok(html.includes('21.000 € / 25.000 €'));
  assert.ok(html.includes('<p class="notice mt16" role="status">Zum Start fehlen: 4.000 € Betriebskapital.</p>'));
  assert.equal((html.match(/data-action="startProgramme"[^>]* disabled/g)||[]).length,3);
  s.cash=p.cash;const ready=V.programmes(s);assert.ok(!ready.includes('Zum Start fehlen:'));assert.equal((ready.match(/data-action="startProgramme"[^>]* disabled/g)||[]).length,0);
});
