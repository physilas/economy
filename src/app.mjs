import * as E from './engine.mjs';
import * as C from './corporate.mjs';
import * as V from './views.mjs';
import * as Store from './storage.mjs';
import { RESOURCES, BUILDINGS, INFRA, RESEARCH, TIERS, BONDS, VENTURES, DAY, RELEASE, PROGRAMME_CHOICES } from './data.mjs';
import { icon, mark } from './icons.mjs';
import {help} from './help.mjs';
import {previewBuilding} from './planning.mjs';
import {programmeOffer,startProgramme,reserveProgrammeMaterials} from './campaign.mjs';
import {normalizeUI} from './ui-state.mjs';
import {advanceOffline,advanceOfflineBatched} from './offline.mjs';
import {installHoldControls,lockZoom} from './controls.mjs';
import {morph,patchView} from './render.mjs';

const app = document.querySelector('#app'), dialog = document.querySelector('#dialog');
const leaseKey = 'null-economy:lease', sessionId = globalThis.crypto?.randomUUID?.() || String(Math.random());
let game = null, running = false, busy = false, pending = null, toastTimer, lastSaveAttempt = 0, worker = null, registration = null, installPrompt = null, queuedDiscovery = null, speedPointer = null, repeating = false, detailBuilding = null;
const ui = { companyId:'holding',companyTab:'owned',speed:1, screen:'menu', tab:'overview', productionTab:'business', financeTab:'bank', buildFilter:'all', marketFilter:'all', qty:1, amount:100, fixedDays:20,optionResource:'wood',optionType:'put',optionDays:3,planStock:'sylva',planPeriod:1, open:new Set(), offlineReady:false, updateReady:false, lastSaved:0, saveError:'', previousScreen:'menu' };

function toast(message, error = false) {
  const node = document.querySelector('#toast'); node.textContent = message; node.className = `visible${error ? ' error' : ''}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.className = '', error ? 6500 : 3800);
}

function safeSave(slot = 'auto', silent = true) {
  if (!game || busy) return false;
  const lease=readLease();
  if(slot==='auto'&&lease&&lease.id!==sessionId&&Date.now()-lease.at<14000)return false;
  try {
    const saved = Store.save(game, slot); ui.lastSaved = saved; ui.saveError = ''; lastSaveAttempt = saved;
    if (!silent) toast(slot === 'auto' ? 'Spielstand gesichert.' : 'Manueller Spielstand gespeichert.');
    return true;
  } catch (error) {
    const first = !ui.saveError; ui.saveError = error.message; lastSaveAttempt = Date.now();
    if (first || !silent) toast('Speichern eingeschränkt. Exportiere bitte deinen Spielstand.', true);
    return false;
  }
}

function saves() {
  try { return Store.listSaves(); } catch (error) { ui.saveError = error.message; return ['auto',...Store.SLOTS].map(slot => ({slot,empty:true})); }
}

function readLease() { try { return JSON.parse(localStorage.getItem(leaseKey) || 'null'); } catch { return null; } }
function claimLease(force = false) {
  try {
    const current = readLease();
    if (!force && current && current.id !== sessionId && Date.now() - current.at < 14000) return false;
    localStorage.setItem(leaseKey, JSON.stringify({ id:sessionId, at:Date.now() })); return true;
  } catch { return true; }
}
function releaseLease() { try { if (readLease()?.id === sessionId) localStorage.removeItem(leaseKey); } catch { /* Storage warning is handled by saving. */ } }

function writeView(html,live){
  if(!live){app.innerHTML=html;return;}
  patchView(app,html);
}
function render(live=true) {
  if (busy) return;
  normalizeUI(ui,game);
  if (ui.screen === 'menu') { app.innerHTML = V.menu(game,ui); return; }
  const business=game?C.scopeCompany(game,ui.companyId):null;
  const content = ui.tab === 'saves' ? V.savesView(game,ui,saves()) : ui.tab === 'guide' ? V.guide(game) : !game ? '' :
    ui.tab === 'companies' ? V.companiesView(game,ui) : ui.tab === 'overview' ? V.overview(business,ui) : ui.tab === 'production' ? V.production(business,ui) : ui.tab === 'market' ? V.market(business,ui) :
    ui.tab === 'finance' ? V.finance(business,ui) : ui.tab === 'research' ? V.researchView(business,ui) : ui.tab === 'contracts' ? V.contracts(business) :
    ui.tab === 'programmes' ? V.programmes(game) : ui.tab === 'journal' ? V.journal(business) : ui.tab === 'statistics' ? V.statistics(business) : ui.tab==='analysis'?V.analysis(business,ui):ui.tab==='legacy'?V.legacyView(game):V.more(game);
  if (game && ui.screen === 'game') writeView(V.frame(game,ui,content),live);
  else app.innerHTML = `<div class="shell"><header class="topbar"><button class="brand" data-action="menu">${mark()}NULL</button><button class="small" data-action="menu">Zurück</button></header><main id="content" class="mt24">${content}</main></div>`;
}

function openDialog(title, body, onConfirm = null, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen') {
  stopFastForward();
  detailBuilding=null;
  pending = onConfirm;
  dialog.innerHTML = `<button class="dialog-close" data-action="closeDialog" aria-label="Dialog schließen">${icon('close')}</button><h2 id="dialog-title">${title}</h2>${body}<div class="dialog-actions">${onConfirm ? `<button data-action="closeDialog">${cancelLabel}</button><button class="primary" data-action="confirmDialog">${confirmLabel}</button>` : '<button class="primary" data-action="closeDialog">Verstanden</button>'}</div>`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { dialog.close(); pending = null;detailBuilding=null;flushDiscovery(); }
function flushDiscovery(){if(queuedDiscovery!==null&&!dialog.open&&!busy&&running){const tier=queuedDiscovery;queuedDiscovery=null;setTimeout(()=>showDiscoveries(tier),0);}}

function showDiscoveries(oldTier) {
  if (!game || game.tier <= oldTier) return false;
  if(dialog.open){queuedDiscovery=queuedDiscovery===null?oldTier:Math.min(queuedDiscovery,oldTier);return true;}
  const b = Object.values(BUILDINGS).filter(d => d.tier > oldTier && d.tier <= game.tier);
  const resources = Object.values(RESOURCES).filter(d => d.tier > oldTier && d.tier <= game.tier);
  const research = Object.values(RESEARCH).filter(d => d.tier > oldTier && d.tier <= game.tier);
  const body = `<p>Dein Unternehmen hat einen neuen Horizont erreicht: <strong>${TIERS[game.tier].name}</strong>.</p><div class="divider"></div><div class="eyebrow">Neu entdeckt</div><p>${b.map(d => `${icon(d.icon)} ${d.name}`).join('<br>')}</p><p><strong>Neue Waren:</strong> ${resources.map(d=>d.name).join(', ')}.</p>${oldTier<1?'<p>Außerdem: Banken, Börse, Anleihen, Beteiligungen, Forschungsinstitute und Unternehmensstrategien.</p>':''}${oldTier<3&&game.tier>=3?'<p>Außerdem: langfristige Holdingprogramme mit dauerhafter Spezialisierung.</p>':''}${research.length?`<p>${research.length} neue Forschungszweige warten auf dich.</p>`:''}<p>Dein Fortschritt bleibt freigeschaltet, auch wenn dein Vermögen später schwankt.</p>`;
  openDialog('Die Welt wird größer.',body); return true;
}

function finish(result, oldTier = game?.tier) {
  if (!repeating&&result?.message) toast(result.message,!result.ok);
  if (game && result?.ok !== false) { E.checkProgress(game); E.checkAchievements(game); if(!repeating)safeSave(); }
  render(true);refreshBuildingDetails();
  if (oldTier !== undefined) showDiscoveries(oldTier);
}

async function catchUp(s, now) {
  if ((now - s.lastUpdate) / 1000 < 120) return {game:s,result:advanceOffline(s,now)};
  app.innerHTML = `<main class="loading-screen">${mark()}<h2>Die Welt stand nicht still.</h2><p>Deine Produktion, Märkte und Anlagen werden für die vergangene Zeit nachgerechnet.</p><progress id="offline-progress" value="0" max="1" aria-label="Offline-Fortschritt berechnen"></progress><p id="offline-progress-label" class="eyebrow">Deine Wirtschaft rechnet</p></main>`;
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise((resolve,reject) => {
        worker = new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
        worker.onmessage = event => {
          if ('progress' in event.data) { const progress=document.querySelector('#offline-progress'); if(progress)progress.value=event.data.progress; const label=document.querySelector('#offline-progress-label'); if(label)label.textContent=`${Math.floor(event.data.progress*100)} % nachgerechnet`; }
          else { worker.terminate(); worker=null; event.data.error ? reject(new Error(event.data.error)) : resolve(event.data); }
        };
        worker.onerror = error => { worker?.terminate(); worker=null; reject(new Error(error.message)); };
        worker.postMessage({game:s,now});
      });
    } catch (error) { console.warn('Worker unavailable; using cooperative catchup.',error); }
  }
  return advanceOfflineBatched(s,now,{onProgress:progress=>{
    const node=document.querySelector('#offline-progress');if(node)node.value=progress;
    const label=document.querySelector('#offline-progress-label');if(label)label.textContent=`${Math.floor(progress*100)} % nachgerechnet`;
  }});
}

function offlineReport(result, oldTier) {
  if (result.seconds < 60) { showDiscoveries(oldTier); return; }
  const body = `<p>Während deiner Abwesenheit wurden <strong>${V.duration(result.seconds)}</strong> echte Zeit simuliert.</p><div class="offline-numbers"><div><span>Veränderung Liquidität</span><strong class="number">${V.signed(result.cash)}</strong></div><div><span>Veränderung Vermögen</span><strong class="number">${V.signed(result.wealth)}</strong></div><div><span>Produzierte Einheiten</span><strong class="number">${V.compact(result.produced)}</strong></div><div><span>Zinsen & Dividenden netto</span><strong class="number">${V.cash(result.interest+result.dividends)}</strong></div></div><p>Steuern: ${V.cash(result.taxes)}. Alle Engpässe, Käufe, Verkäufe und Fälligkeiten wurden berücksichtigt. Details stehen in deiner Chronik.</p>${result.skipped?`<p><strong>Offline-Limit:</strong> ${V.duration(result.skipped)} über sieben Tage hinaus wurden nicht simuliert.</p>`:''}${game.tier>oldTier?'<p>Dein Wachstum hat neue Möglichkeiten freigeschaltet.</p>':''}`;
  openDialog('Willkommen zurück.',body,game.tier>oldTier?()=>showDiscoveries(oldTier):null,'Entdeckungen ansehen');
}

async function resume(s = game, force = false) {
  if (!s || busy) return;
  if(force&&s===game){try{s=Store.loadCurrent(s);}catch{}}
  if (!claimLease(force)) {
    openDialog('Ein Unternehmen. Eine Sitzung.','<p>NULL läuft bereits in einem anderen Tab. Um doppelte Simulation und widersprüchliche Spielstände zu vermeiden, kann immer nur eine Sitzung aktiv sein.</p><p>Beim Fortsetzen hier wird die andere Sitzung angehalten.</p>',()=>resume(s,true),'Hier fortsetzen'); return;
  }
  busy=true; const oldTier=s.tier;
  const pulse=setInterval(()=>claimLease(),5000);
  try {
    const outcome=await catchUp(s,Date.now());
    const lease=readLease();if(lease&&lease.id!==sessionId&&Date.now()-lease.at<14000)throw new Error('Das Unternehmen ist inzwischen in einer anderen Sitzung aktiv.');
    game=outcome.game; busy=false; running=true; ui.screen='game';
    if(['saves','guide'].includes(ui.tab))ui.tab='overview';
    safeSave(); render(); offlineReport(outcome.result,oldTier);
    if(outcome.result.clockBack)toast('Die Geräteuhr wurde korrigiert. Dein Unternehmen läuft ab jetzt weiter.');
    Store.requestPersistence();
  } catch(error) { busy=false;running=false;ui.screen='menu';render();toast(`Nachberechnung fehlgeschlagen: ${error.message}. Dein gespeicherter Stand bleibt erhalten.`,true); }
  finally { clearInterval(pulse); }
}

function go(tab) {
  stopFastForward();
  if (['research','finance'].includes(tab) && (!game || game.tier < 1)) return;
  ui.tab=tab; ui.screen=running?'game':'page'; render(); window.scrollTo({top:0});
  requestAnimationFrame(()=>document.querySelector('#content')?.focus({preventScroll:true}));
}

function prepareNew() {
  openDialog('Ein neuer Anfang.',`<p>Wie soll dein Unternehmen heißen?</p><label for="new-name" class="mt16">Unternehmensname</label><input id="new-name" type="text" maxlength="36" value="Mein Unternehmen" autocomplete="off">${game?'<p>Ein neues Unternehmen ersetzt den automatischen Spielstand. Manuelle Speicherplätze bleiben erhalten. Exportiere deinen bisherigen Stand vorher, wenn du ihn behalten möchtest.</p>':''}`,async()=>{
    const name=document.querySelector('#new-name')?.value||'Mein Unternehmen';
    if(!claimLease()) { toast('Bitte schließe zuerst die andere aktive NULL-Sitzung.',true);return; }
    if(game&&running)safeSave(); const next=E.createGame(name);ui.tab='overview';ui.productionTab='business';ui.financeTab='bank';ui.open.clear();await resume(next);
  },'Unternehmen gründen');
  setTimeout(()=>document.querySelector('#new-name')?.select(),50);
}

function orderDialog(id) {
  const business=C.scopeCompany(game,ui.companyId),p=E.price(business,id);
  openDialog('Ein Preis. Eine Bedingung.',`<p>Limitauftrag für <strong>${RESOURCES[id].name}</strong>. Vollständige Ausführung zum Durchschnittspreis inklusive Gebühren.</p><div class="auto-form mt16"><div><label for="order-side">Richtung</label><select id="order-side"><option value="buy">Kaufen</option><option value="sell">Verkaufen</option></select></div><div><label for="order-quantity">Anzahl</label><input id="order-quantity" type="number" inputmode="numeric" min="1" max="1000000" value="${ui.qty}"></div><div><label for="order-limit">Limit je Stück (€)</label><input id="order-limit" type="number" inputmode="decimal" min="0.01" step="0.01" value="${p.toFixed(2)}"></div></div>`,()=>finish(E.placeOrder(business,id,document.querySelector('#order-side').value,Number(document.querySelector('#order-quantity').value),Number(document.querySelector('#order-limit').value))),'Auftrag anlegen');
}

function openBuildingPreview(id,quantity=ui.qty){
  const business=C.scopeCompany(game,ui.companyId),plan=previewBuilding(business,id,quantity);
  if(!plan){toast('Dieser Bauplan ist noch nicht verfügbar.',true);return;}
  const build=plan.affordable?()=>{const oldTier=game.tier;finish(E.build(business,id,quantity),oldTier);}:null;
  openDialog(`Bauplan: ${BUILDINGS[id].name}`,V.buildingPreview(plan),build,`${quantity}× bauen`);
  dialog.dataset.previewQuantity=String(quantity);
}

function installHelp() {
  if(installPrompt) { installPrompt.prompt(); installPrompt=null;return; }
  openDialog('Dein Spiel. In deiner Tasche.',`<p>Öffne NULL auf dem iPhone in <strong>Safari</strong>. Warte, bis oben <strong>„Offline bereit“</strong> steht.</p><p>Tippe dann auf <strong>Teilen → Zum Home-Bildschirm → Hinzufügen</strong>. Öffne das neue NULL-Symbol einmal online und teste anschließend im Flugmodus.</p><p>${ui.offlineReady?'Die Dateien dieser Sitzung sind bereits für offline gespeichert.':'Der Offline-Cache ist in dieser Sitzung noch nicht bereit. Öffne die Seite über HTTPS und lasse sie kurz geöffnet.'}</p><p>Safari und die installierte App können unterschiedliche Spielstände verwenden. Übertrage deinen Stand bei Bedarf über <strong>Spielstände → Exportieren / Importieren</strong>.</p>${registration?.waiting?'<button class="wfull mt16" data-action="update">Update jetzt installieren</button>':''}`);
}

async function action(button) {
  const action=button.dataset.action,id=button.dataset.id,side=button.dataset.side;
  const business=game?C.scopeCompany(game,ui.companyId):null;
  if(busy || button.disabled)return;
  if(action==='speed')return;
  if(action==='closeDialog'){closeDialog();return;}
  if(action==='confirmDialog'){
    const callback=pending;pending=null;
    // Call before closing so form controls remain readable, then preserve any replacement dialog.
    const previous=dialog.innerHTML;
    try { const result=callback?.();if(dialog.innerHTML===previous)dialog.close();await result;flushDiscovery(); }catch(error){toast(error.message,true);}
    return;
  }
  if(action==='new'){prepareNew();return;}
  if(action==='continue'){
    try { game=Store.loadCurrent(game); }catch{}
    await resume();return;
  }
  if(action==='menu'){stopFastForward();if(running){E.advance(game,Date.now());safeSave();}running=false;releaseLease();ui.screen='menu';render();return;}
  if(action==='tab'){go(id);return;}
  if(action==='saves'||action==='guide'){go(action);return;}
  if(action==='install'){installHelp();return;}
  if(action==='info'){
    const item=help(id,business);
    if(id.startsWith('building:')){
      const key=id.split(':')[1];
      openDialog(item.title,V.buildingDetails(business,ui,key)+`<details class="help-more" data-preserve-open><summary>Rechenregeln & Details</summary>${item.body}</details>`);
      detailBuilding=key;
    }else if(id.startsWith('infra:')){
      const key=id.split(':')[1];
      openDialog(item.title,item.body+`<div class="row wrap mt8"><button data-action="bulkBuildInfra" data-id="${key}">Max. bauen</button><button data-action="bulkDemolishInfra" data-id="${key}">Alle abbauen</button></div>`);
    }else openDialog(item.title,item.body);
    return;
  }
  if(action==='qtyScale'){ui.qty=E.clamp(ui.qty*Number(id),1,10000);render(true);return;}
  if(action==='amountScale'){ui.amount=E.clamp(Math.round(ui.amount*Number(id)),1,1e14);render(true);return;}
  if(action==='qty'){ui.qty=Number(id);render();return;}
  if(action==='amount'){ui.amount=E.clamp(ui.amount+Number(id),1,1e14);render(true);return;}
  if(action==='expand'){ui.open.has(id)?ui.open.delete(id):ui.open.add(id);render();return;}
  if(['productionTab','financeTab','marketFilter','analysisTab'].includes(action)){ui[action]=id;if(action==='financeTab'&&id==='hedges'&&RESOURCES[ui.optionResource].tier>game.tier)ui.optionResource='wood';render();if(action.endsWith('Tab'))window.scrollTo({top:0});return;}
  if(action==='update'){
    stopFastForward();
    if(!registration?.waiting){toast('Du verwendest bereits die aktuelle Version.');return;}
    // Paused menus may hold an older snapshot than another tab's autosave.
    if(game&&running&&!safeSave()){openDialog('Spielstand zuerst sichern.','<p>Der lokale Speicher ist gerade nicht verfügbar. Exportiere deinen Spielstand unter „Spielstände“, bevor du das Update erneut startest.</p>');return;}
    running=false;button.disabled=true;button.textContent='Wird geladen …';
    registration.waiting.postMessage({type:'SKIP_WAITING'});return;
  }
  if(action==='import'){document.querySelector('#import-file').click();return;}
  if(action==='loadSlot'){
    openDialog('Diesen Stand laden?','<p>Dein aktueller automatischer Stand wird ersetzt. Die seit der Sicherung verstrichene Zeit wird nachgerechnet. Exportiere vorher einen Stand, den du behalten möchtest.</p>',async()=>{
      try { const loaded=Store.load(id);if(!loaded)throw new Error('Spielstand nicht gefunden.');if(game&&running)safeSave();ui.tab='overview';await resume(loaded.game);if(loaded.recovered)toast('Letzte gültige Sicherungskopie wiederhergestellt.'); }catch(error){toast(error.message,true);}
    },'Spielstand laden');return;
  }
  if(action==='deleteSlot'){openDialog('Spielstand löschen?','<p>Dieser manuelle Speicherplatz und seine Sicherungskopie werden gelöscht.</p>',()=>{try{Store.deleteSave(id);render();toast('Spielstand gelöscht.');}catch(error){toast(error.message,true);}},'Löschen');return;}
  if(!game)return;
  const oldTier=game.tier;
  const field=id=>document.getElementById(id)?.value;
  if(action==='companyTab'){ui.companyTab=id;go('companies');return;}
  if(action==='operateCompany'){const c=C.company(game,id);if(c&&C.controlled(game,c)){ui.companyId=id;go('production');}return;}
  if(action==='holdingStocks'){ui.companyId='holding';ui.financeTab='stocks';go('finance');return;}
  if(action==='companyTrade'){ui.companyId='holding';ui.financeTab='stocks';go('finance');return;}
  if(action==='newCompany'){openDialog('Eine eigene Gesellschaft.',V.newCompanyForm(),()=>finish(C.createCompany(game,field('firm-name'),field('firm-focus'),Number(field('firm-capital')))),'Gründen');return;}
  if(action==='companySettings'){openDialog('Führung und Kapital.',V.companySettingsForm(game,id),()=>finish(C.configureCompany(game,id,{name:field('firm-name'),ceo:field('firm-ceo')||null,mandate:field('firm-mandate'),reserve:Number(field('firm-reserve')),budget:Number(field('firm-budget')),payout:Number(field('firm-payout'))/100})),'Mandat speichern');return;}
  if(action==='parentSettings'){openDialog('Deine Holding.',V.parentSettingsForm(game),()=>finish(C.setParentPayout(game,Number(field('parent-payout'))/100)),'Quote speichern');return;}
  if(action==='reinvestWallet'){openDialog('Privatvermögen reinvestieren.',`<label for="wallet-value">Betrag (€)</label><input id="wallet-value" type="number" min="1" value="${Math.floor(game.group.wallet)}"><p>Du erhältst neue Holdinganteile zum anteiligen Konzern-Eigenkapital. Restbeträge bleiben privat verfügbar.</p>`,()=>finish(C.reinvestWallet(game,Number(field('wallet-value')))),'Reinvestieren');return;}
  if(action==='companyCapital'){openDialog('Kapital übertragen.',`<label for="capital-direction">Richtung</label><select id="capital-direction"><option value="deposit">Holding an Tochter</option><option value="withdraw">Tochter an Holding</option></select><label for="capital-value" class="mt16">Betrag (€)</label><input id="capital-value" type="number" min="1" value="${ui.amount}"><p>Freie Überträge erfordern 100 % Eigentum. Bei Fremdanteilen stehen Kredite und anteilige Dividenden zur Verfügung.</p>`,()=>finish(C.transferCapital(game,id,Number(field('capital-value')),field('capital-direction'))),'Übertragen');return;}
  if(action==='companyForm'){const current=id==='holding'?game.group.parent:C.company(game,id);openDialog('Gesellschaftsform wählen.',`<label for="firm-form">Neue Rechtsform</label><select id="firm-form">${Object.entries(C.FORMS).map(([key,d])=>`<option value="${key}"${key===current.form?' selected':''}>${d.name} · ${V.cash(d.fee)} Umwandlung · ${V.cash(d.daily)} / Tag</option>`).join('')}</select><p>Einzelunternehmen sind auf das Stammgeschäft ohne Fremdanteile beschränkt. GmbHs erlauben private Partner. AGs können an die Börse gehen und neue Aktien ausgeben. Jede Firma finanziert ihre eigenen Verbindlichkeiten.</p>`,()=>finish(C.convertCompany(game,id,field('firm-form'))),'Umwandeln');return;}
  if(action==='listCompany'){openDialog('An die Börse gehen?', '<p>Die Firma erhält handelbare Aktien. Der Börsengang kostet 2 % des Unternehmenswerts, mindestens 500 €. Er verändert die Eigentumsquote zunächst nicht. Eine anschließende Kapitalerhöhung bringt Geld von neuen Eigentümern in die Firma.</p>',()=>finish(C.listCompany(game,id)),'Börsengang');return;}
  if(action==='raiseCapital'){openDialog('Wachstum mit neuen Aktien.',`<label for="issue-value">Neues Kapital (€)</label><input id="issue-value" type="number" min="1" value="${ui.amount}"><p>Bis 30 % des Unternehmenswerts je Runde; frühestens alle fünf Spieltage. 2 % Emissionskosten. Bestehende Anteile werden verwässert, zusätzliche Mittel bleiben in der Firma.</p>`,()=>finish(C.raiseCapital(game,id,Number(field('issue-value')))),'Aktien ausgeben');return;}
  if(action==='ownShareTrade'){const c=C.company(game,id);openDialog('Eigene Unternehmensanteile.',`<p>${V.esc(c.name)} · ${V.pct(C.ownership(game,c),1)} Eigentum · ${V.money(C.companyValue(game,c)/c.shares,2)} je Anteil</p><label for="own-side">Richtung</label><select id="own-side"><option value="buy">Von Fremdeigentümern zurückkaufen</option><option value="sell">An Fremdeigentümer verkaufen</option></select><label class="mt16" for="own-quantity">Aktienzahl</label><input id="own-quantity" type="number" min="1" value="${ui.qty}"><p>0,5 % Handelskosten. Der Verkauf bestehender Anteile zahlt Geld an die Holding; neue Aktien finanzieren dagegen die Tochter.</p>`,()=>finish(C.tradeOwnShares(game,id,Number(field('own-quantity')),field('own-side'))),'Handeln');return;}
  if(action==='inspectCompany'){finish(C.inspectCompany(game,id));return;}
  if(action==='privateOffer'){const c=C.company(game,id),o=c.offer;openDialog('Mit Eigentümern verhandeln.',`<p>${V.esc(c.name)} · ${c.owner==='legacy'?'Der Gründer verlangt eine Prämie für die Abgabe seiner Kontrolle.':'Der Eigentümer schätzt schnelle Liquidität.'}</p><label for="offer-percent">Anteil (%)</label><input id="offer-percent" type="number" min="0.01" max="100" value="${o?o.quantity/c.shares*100:25}"><label class="mt16" for="offer-price">Gesamtes Kaufangebot (€)</label><input id="offer-price" type="number" min="1" value="${Math.ceil(o?.counter||C.companyValue(game,c)*.25)}"><label class="mt16" for="offer-terms">Zahlungsart</label><select id="offer-terms"><option value="cash">Sofort vollständig bezahlen</option><option value="sellerLoan">50 % jetzt, 50 % in 10 Spieltagen</option></select><p class="fine-print">Ein Angebot allein kauft keine Anteile. Bei Annahme kannst du den Kauf abschließen. Verkäuferfinanzierung erhöht den verlangten Preis und bleibt eine verbindliche Schuld.</p>`,()=>finish(C.offerPrivate(game,id,Number(field('offer-percent')),Number(field('offer-price')),field('offer-terms'))),'Angebot abgeben');return;}
  if(action==='acceptOffer'){finish(C.acceptOffer(game,id));return;}
  if(action==='buyRemaining'){openDialog('Die restlichen Anteile.', '<p>Bei börsennotierten Firmen werden alle verfügbaren Restanteile zum Marktpreis einschließlich Preiseffekt erworben. Private Eigentümer erhalten ein Angebot mit 20 % Prämie, das du anschließend abschließen kannst.</p>',()=>finish(C.buyRemaining(game,id)),'Restanteile anfragen');return;}
  if(action==='liquidateCompany'||action==='restructure'&&ui.companyId!=='holding'){const target=action==='liquidateCompany'?id:ui.companyId;openDialog('Diese Gesellschaft abwickeln?', '<p>Die überschuldete, vollständig eigene Tochter gibt ihre Vermögenswerte an ihre Gläubiger ab. Offene Firmenfinanzierungen müssen vorher abgewickelt werden. Die übrige Holding und ihre Firmen bleiben bestehen.</p>',()=>{const r=C.liquidateCompany(game,target);if(r.ok){ui.companyId='holding';ui.tab='companies';}finish(r);},'Gesellschaft abwickeln');return;}
  if(action==='mergeCompany'){openDialog('Mit der Holding verschmelzen?', '<p>Bestände, Anlagen, Kassen und Verbindlichkeiten gehen in das Stammgeschäft über. Die Tochter wird aufgelöst. Offene Konzernverträge und Finanzierungen müssen zuvor beendet werden.</p>',()=>{const r=C.mergeCompany(game,id);if(r.ok)ui.companyId='holding';finish(r);},'Verschmelzen');return;}
  if(action==='transferAsset'){openDialog('Assets einem Unternehmen zuordnen.',V.transferAssetForm(game),()=>{const[kind,key]=field('asset-kind').split(':');finish(C.transferAsset(game,field('asset-from'),field('asset-to'),kind,key,Number(field('asset-count'))));},'Übertragen');return;}
  if(action==='newAgreement'){openDialog('Firmen miteinander verbinden.',V.agreementForm(game),()=>{const[kind,resource]=field('agreement-asset').split(':');finish(C.createAgreement(game,{kind,resource,from:field('agreement-from'),to:field('agreement-to'),quantity:Number(field('agreement-quantity')),price:Number(field('agreement-price')),days:Number(field('agreement-days'))}));},'Vertrag schließen');return;}
  if(action==='repayCorporateLoan'){finish(C.repayCorporateLoan(game,Number(id)));return;}
  if(action==='cancelAgreement'){finish(C.cancelAgreement(game,Number(id)));return;}
  if(action==='newCorporateLoan'){openDialog('Ein Unternehmen finanzieren.',`<label for="credit-lender">Kreditgeber</label><select id="credit-lender"><option value="holding">${V.esc(game.name)}</option>${C.controlledCompanies(game).map(c=>`<option value="${c.id}">${V.esc(c.name)}</option>`).join('')}</select><label class="mt16" for="credit-company">Schuldner</label><select id="credit-company">${game.group.companies.map(c=>`<option value="${c.id}">${V.esc(c.name)}</option>`).join('')}</select><label class="mt16" for="credit-value">Kreditbetrag (€)</label><input id="credit-value" type="number" min="1" value="${ui.amount}"><p>Der Zins hängt von der Verschuldung ab, freie Sicherheiten begrenzen den Betrag. Die Firma zahlt täglich Zins und bis zu 1/20 Tilgung. Zahlungsstörungen können Verluste verursachen.</p>`,()=>finish(C.lendToCompany(game,field('credit-company'),Number(field('credit-value')),field('credit-lender'))),'Kredit vergeben');return;}

  if(action==='saveSlot'){
    const existing=saves().find(s=>s.slot===id);
    if(existing&&!existing.empty)openDialog('Spielstand überschreiben?',`<p>„${V.esc(existing.name)}“ wird durch deinen aktuellen Stand ersetzt.</p>`,()=>{safeSave(id,false);render();},'Speichern');
    else{safeSave(id,false);render();}return;
  }
  if(action==='export'){Store.exportFile(game);toast('Spielstand als Datei exportiert.');return;}
  if(action==='rename'){openDialog('Ein Name für deine Idee.',`<label class="mt16" for="rename">Unternehmensname</label><input id="rename" type="text" value="${V.esc(game.name)}" maxlength="36">`,()=>{game.name=document.querySelector('#rename').value.trim().slice(0,36)||'Mein Unternehmen';finish(Eresult('Unternehmen umbenannt.'));},'Speichern');return;}
  if(action==='dismissTutorial'){game.tutorial=false;finish(Eresult('Die Einführung ist in der Spielanleitung weiter verfügbar.'));return;}
  if(action==='startProgramme'){
    const chapter=programmeOffer(game),choice=PROGRAMME_CHOICES[id];if(!chapter||!choice)return;
    openDialog('Dein Schwerpunkt für dieses Kapitel.',`<p><strong>${V.esc(chapter.name)}: ${choice.name} +${chapter.bonus[id]} %</strong> dauerhaft nach Abschluss.</p><p>${choice.description}</p><p>Jetzt einmalig ${V.money(chapter.cash)}, ${V.number(chapter.points)} Forschungspunkte und die angezeigten Materialien investieren? Laufzeit: ${V.duration(chapter.duration)} echte Zeit. Die Wahl ist verbindlich.</p>`,()=>finish(startProgramme(game,id)),'Programm starten');return;
  }
  if(action==='programmeReserve'){
    openDialog('Materialreserven aufbauen?','<p>Die Marktregeln der Projektwaren werden auf die benötigten Vorräte angehoben. Laufende automatische Einkäufe verwenden freie Betriebskasse. Höhere bestehende Reserven bleiben erhalten.</p>',()=>finish(reserveProgrammeMaterials(game,E.warehouseCapacity(game))),'Bevorratung einrichten');return;
  }
  if(action==='goLab'){ui.productionTab='infra';go('production');return;}
  if(action==='showChain'){closeDialog();ui.chain=id;ui.productionTab='chains';go('production');return;}
  if(action==='preview'){openBuildingPreview(id);return;}
  if(action==='previewQuantity'){
    const delta=Number(button.dataset.delta),quantity=E.clamp(Number(dialog.dataset.previewQuantity)+delta,1,10000);
    openBuildingPreview(id,quantity);
    dialog.querySelector(`button[data-action="previewQuantity"][data-delta="${delta}"]:not(:disabled)`)?.focus({preventScroll:true});return;
  }
  if(action==='build'||action==='buildInfra'){finish(E.build(business,id,ui.qty,action==='buildInfra'),oldTier);return;}
  if(action==='demolish'||action==='demolishInfra'){finish(E.demolish(business,id,ui.qty,action==='demolishInfra'));return;}
  if(['bulkBuild','bulkBuildInfra','bulkDemolish','bulkDemolishInfra'].includes(action)){
    const kind={bulkBuild:'build',bulkBuildInfra:'buildInfra',bulkDemolish:'demolish',bulkDemolishInfra:'demolishInfra'}[action];
    const count=E.maxTransaction(business,kind,id),isBuild=kind.startsWith('build'),infra=kind.endsWith('Infra');
    if(!count){toast('Keine Einheiten verfügbar oder bezahlbar.',true);return;}
    const name=(infra?INFRA:BUILDINGS)[id].name;
    const cost=isBuild?E.buildQuote(business,id,count,infra).total:null;
    openDialog(isBuild?'Maximale Anzahl bauen?':'Alle Einheiten abbauen?',`<p>${V.number(count)}× ${name}${isBuild?` für aktuell ${V.cash(cost)}`:'. Rückbau erstattet 45 % des Buchwerts'}.</p>`,()=>finish(isBuild?E.build(business,id,count,infra):E.demolish(business,id,count,infra)),isBuild?'Bauen':'Alle abbauen');return;
  }
  if(action==='active'){finish(E.setActive(business,id,Number(button.dataset.delta)));return;}
  if(action==='pause'){const own=business.buildings[id];finish(E.setActive(business,id,own.active?-own.active:own.count));return;}
  if(action==='upgrade'){finish(E.upgrade(business,id));return;}
  if(['tradeAll','stockAll','bankAll','propertyAll'].includes(action)){
    const kind={tradeAll:'trade',stockAll:'stock',bankAll:'bank',propertyAll:'property'}[action],amount=E.maxTransaction(business,kind,id,side);
    if(!amount){toast('Kein Bestand oder kein freies Kaufbudget.',true);return;}
    const fn={trade:E.trade,stock:E.stockTrade,bank:E.bankTransfer,property:E.propertyTrade}[kind];finish(fn(business,id,amount,side),oldTier);return;
  }
  if(action==='trade'){finish(E.trade(business,id,ui.qty,side),oldTier);return;}
  if(action==='policy'){business.policy=id;finish(Eresult('Unternehmensstrategie geändert.'));return;}
  if(action==='profitGuard'){business.profitGuard=!business.profitGuard;finish(Eresult(business.profitGuard?'Margenwächter aktiv. Bei negativer Handelsmarge pausieren Betriebe automatisch.':'Margenwächter ausgeschaltet.'));return;}
  if(action==='priority'){business.priority=id;finish(Eresult('Produktionsreihenfolge geändert.'));return;}
  if(action==='setupSupplies'){
    openDialog('Vorprodukte bevorraten?','<p>Die benötigten Vorprodukte werden am Markt für etwa zwei Spielstunden eingekauft. Bereits vorhandene Verkaufseinstellungen bleiben mit ausreichend Abstand erhalten. Die Einkäufe kosten laufend Geld und nutzen deine freie Betriebskasse.</p>',()=>finish(E.setupSupplies(business,id)),'Einkauf einrichten');return;
  }
  if(action==='goResource'){ui.marketFilter='all';ui.open.add(`m-${id}`);go('market');return;}
  if(action==='treasuryToggle'){finish(E.setTreasury(business,'enabled',!business.treasury.enabled));return;}
  if(action==='treasuryStep'){finish(E.setTreasury(business,id,business.treasury[id]+Number(button.dataset.delta)));return;}
  if(action==='drip'){finish(E.toggleDividendReinvestment(business,id));return;}
  if(action==='createBankPlan'){finish(E.createBankPlan(business,ui.bankPlanProduct,ui.bankPlanDirection,ui.amount,ui.planPeriod,ui.fixedDays));return;}
  if(action==='cancelBankPlan'){finish(E.cancelBankPlan(business,Number(id)));return;}
  if(action==='createPlan'){finish(E.createSavingsPlan(business,ui.planStock,ui.amount,ui.planPeriod));return;}
  if(action==='cancelPlan'){finish(E.cancelSavingsPlan(business,Number(id)));return;}
  if(action==='property'){finish(E.propertyTrade(business,id,ui.qty,side),oldTier);return;}
  if(action==='emergency'){finish(E.emergencyAid(business));return;}
  if(action==='restructure'){
    openDialog('Ein tragfähiger Neustart.',`<p>Eine Sanierung gibt <strong>alle Produktionsanlagen, Infrastruktur, Waren und Finanzanlagen</strong> ab und löscht sämtliche Schulden. Du beginnst mit 600 €, einer kleinen Materialreserve und einem Holzfäller.</p><p>Forschung, bereits entdeckte Inhalte, Meilensteine, Vermächtnispunkte und Holdingprogramme bleiben erhalten. Deine Reputation fällt auf 15. Exportiere deinen Stand vorher, wenn du ihn behalten möchtest.</p>`,()=>{const next=E.restructure(game);if(next){game=next;ui.tab='overview';ui.open.clear();finish(Eresult('Die Sanierung ist abgeschlossen. Dein Wissen bleibt.'));}else toast('Nutze zuerst vorhandene liquide Mittel. Sanierung ist nur bei Überschuldung und fast leerer Kasse möglich.',true);},'Sanierung durchführen');return;
  }
  if(action==='buyOption'){
    const q=E.optionQuote(business,ui.optionResource,ui.optionType,ui.qty,ui.optionDays),resource=ui.optionResource,type=ui.optionType,quantity=ui.qty,days=ui.optionDays;
    openDialog('Eine Grenze für dein Risiko.',`<p>${quantity} Einheiten ${RESOURCES[resource].name}: ${type==='put'?'Schutz gegen fallende':'Schutz gegen steigende'} Preise. Laufzeit ${V.duration(days*DAY)} echt.</p><p>Prämie und maximaler Verlust: <strong>${V.money(q.premium,2)}</strong>. Abrechnung zum geglätteten Marktpreis einschließlich des Einflusses eigener Verkäufe. Keine Warenlieferung. Keine Nachschusspflicht.</p>`,()=>finish(E.buyOption(business,resource,type,quantity,days)),'Absicherung kaufen');return;
  }
  if(action==='sellOption'){finish(E.sellOption(business,Number(id)));return;}
  if(action==='autoStep'){
    const field=button.dataset.field,a=business.automation[id];a[field]=E.clamp(a[field]+Number(button.dataset.delta),0,1e9);
    if(a.low>a.high){if(field==='low')a.high=a.low;else a.low=a.high;}
    finish(Eresult('Automatik angepasst.'));return;
  }
  if(action==='orderDialog'){orderDialog(id);return;}
  if(action==='cancelOrder'){finish(E.cancelOrder(business,Number(id)));return;}
  if(action==='bank'){finish(E.bankTransfer(business,id,ui.amount,side),oldTier);return;}
  if(action==='fixed'){finish(E.fixedDeposit(business,ui.amount,ui.fixedDays));return;}
  if(action==='redeemFixed'){openDialog('Festgeld vorzeitig auflösen?','<p>Du erhältst 98 % des ursprünglich angelegten Kapitals. Alle aufgelaufenen Zinsen entfallen.</p>',()=>finish(E.redeemFixed(business,Number(id))),'Auflösen');return;}
  if(action==='borrow'||action==='termLoan'){
    const term=action==='termLoan',amount=ui.amount,rate=E.debtRate(business)*(term?.8:1);
    openDialog(term?'Wachstum auf Kredit.':'Liquidität mit Verpflichtung.',`<p>${V.money(amount)} aufnehmen? Der Zins beträgt ${V.pct(rate,3)} <strong>pro Spieltag (24 echte Minuten)</strong>${term?' und bleibt für diesen Kredit fest.':'. Der Zinssatz ist variabel.'}</p><p>${term?'Zehn Tilgungsraten alle zehn Spieltage. Nicht bezahlte Raten wandern ins Kontokorrent und senken die Reputation.':'Nicht zahlbare Zinsen erhöhen die Schuld. Zu hohe Verschuldung senkt die Reputation.'}</p>`,()=>finish(E.borrow(business,amount,term)),'Kredit aufnehmen');return;
  }
  if(action==='repay'){finish(E.repay(business,ui.amount));return;}
  if(action==='repayLoan'){finish(E.repay(business,ui.amount,Number(id)));return;}
  if(action==='stock'){finish(E.stockTrade(business,id,ui.qty,side));return;}
  if(action==='companyBond'){const lender=ui.companyId,issuer=ui.bondIssuer||'ferrum';openDialog('Eine Firma finanzieren.',`<p>${V.esc(C.company(game,issuer).name)} erhält ${V.cash(ui.amount)}. Täglicher Zins aus der Firmenkasse, Kapital in zehn Spieltagen. Bei fünf Zahlungsstörungen wird die Forderung unter Verwertung von Sicherheiten abgewickelt.</p>`,()=>finish(C.lendToCompany(game,issuer,ui.amount,lender,'bond')),'Anleihe zeichnen');return;}
  if(action==='bond'){
    const d=BONDS[id],amount=ui.amount;
    openDialog(d.name,`<p>${V.money(amount)} für ${V.duration(d.days*DAY)} echte Zeit binden? Zins ${V.pct(d.rate,2)} pro Spieltag vor Steuer.</p><p>${d.description}. Eine vorzeitige Rückzahlung ist nicht möglich.</p>`,()=>finish(E.investBond(business,id,amount)),'Anleihe zeichnen');return;
  }
  if(action==='venture'){
    const d=VENTURES[id],amount=ui.amount;
    openDialog(d.name,`<p>${V.money(amount)} für ${V.duration(d.duration)} echte Zeit riskieren?</p><p>${d.description}.</p><p>Der Ausgang ist unabhängig von anderen Beteiligungen. Kapital ist bis zum Ergebnis gebunden. Auf einen Gewinn fallen 15 % Steuer an.</p>`,()=>finish(E.investVenture(business,id,amount)),'Risiko eingehen');return;
  }
  if(action==='research'){finish(E.research(business,id));return;}
  if(action==='accept'){finish(E.acceptContract(business,Number(id)));return;}
  if(action==='fulfill'){finish(E.fulfillContract(business,Number(id)),oldTier);return;}
  if(action==='abandon'){openDialog('Versprechen zurücknehmen?','<p>Der Vertrag wird aufgegeben. Deine Reputation sinkt um drei Punkte. Es gibt keine Geldstrafe.</p>',()=>finish(E.abandonContract(business,Number(id))),'Vertrag aufgeben');return;}
  if(action==='liquidate'){
    let total=0;for(const id of Object.keys(RESOURCES)){if(RESOURCES[id].tier<=business.tier&&business.inventory[id]>.001){const result=E.trade(business,id,business.inventory[id],'sell',true);if(result.ok)total+=result.total;}}
    finish(Eresult(`Lager verkauft: ${V.money(total)}. Vorprodukte können jetzt fehlen.`),oldTier);return;
  }
  if(action==='prestige'){
    openDialog('Das nächste Kapitel.',`<p>Eine neue Holding setzt dein Unternehmen, Geld, Anlagen, Forschung und Finanzprodukte zurück. Du erhältst <strong>${E.prestigeReward(game)} Vermächtnispunkte</strong>.</p><p>Alle bisherigen Punkte bleiben: dauerhaft +8 % Produktion und +4 % Forschung je Punkt. Abgeschlossene und laufende Holdingprogramme bleiben ebenfalls erhalten. Exportiere vor diesem Schritt deinen Spielstand.</p>`,()=>{const next=E.prestige(game);if(next){game=next;ui.tab='overview';finish(Eresult('Eine neue Geschichte beginnt.'));}},'Neue Holding gründen');return;
  }
}
const Eresult=message=>({ok:true,message});

const stopRepeating=installHoldControls(document,{invoke:button=>action(button).catch(error=>{console.error(error);toast(error.message,true);}),onStart:()=>{repeating=true;},onEnd:()=>{repeating=false;safeSave();}});
window.addEventListener('blur',stopRepeating);
lockZoom(document);

function refreshBuildingDetails(){
  if(!dialog.open||!detailBuilding||!game)return;
  const old=dialog.querySelector('[data-building-details]');if(!old)return;
  const template=document.createElement('template');template.innerHTML=V.buildingDetails(C.scopeCompany(game,ui.companyId),ui,detailBuilding);morph(old,template.content.firstChild);
}

function showChartValue(event){const target=event.target.closest('[data-chart-value]');if(target){const output=target.closest('figure')?.querySelector('.chart-readout');if(output)output.textContent=target.dataset.chartValue;}}
document.addEventListener('pointerover',showChartValue);

document.addEventListener('click',event=>{
  showChartValue(event);
  const button=event.target.closest('button[data-action]');
  if(button)action(button).catch(error=>{console.error(error);toast(`Aktion nicht ausgeführt: ${error.message}`,true);});
});
function startFastForward(pointer=null){
  if(!game||!running||busy||dialog.open||ui.speed===100)return;
  E.advance(game,Date.now());ui.speed=100;speedPointer=pointer;render(true);
}
function stopFastForward(){
  if(ui.speed!==100)return;
  if(game&&running&&!busy)E.advance(game,Date.now(),{speed:100});
  const pointer=speedPointer;ui.speed=1;speedPointer=null;
  const button=document.querySelector('[data-action="speed"]');if(pointer!==null&&button?.hasPointerCapture(pointer))button.releasePointerCapture(pointer);
  safeSave();render(true);
}
window.addEventListener('blur',stopFastForward);
window.addEventListener('pointerup',stopFastForward,{passive:true});
window.addEventListener('pointercancel',stopFastForward,{passive:true});
document.addEventListener('pointerdown',event=>{
  const button=event.target.closest('[data-action="speed"]');
  if(event.button===0&&event.isPrimary!==false&&button){event.preventDefault();startFastForward(event.pointerId);if(ui.speed===100)button.setPointerCapture(event.pointerId);}
});
document.addEventListener('pointermove',event=>{
  if(speedPointer!==event.pointerId)return;const rect=document.querySelector('[data-action="speed"]')?.getBoundingClientRect();
  if(!rect||event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)stopFastForward();
},{passive:true});
window.addEventListener('lostpointercapture',stopFastForward,{passive:true,capture:true});
document.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)&&event.target.closest('[data-action="speed"]')){event.preventDefault();startFastForward();}});
document.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key))stopFastForward();});
document.addEventListener('contextmenu',event=>{if(event.target.closest('[data-action="speed"]'))event.preventDefault();});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
dialog.addEventListener('cancel',()=>{pending=null;detailBuilding=null;stopRepeating();});

document.addEventListener('change',event=>{
  const node=event.target;
  if(node.dataset.setting){
    const key=node.dataset.setting;
    if(key==='amount')ui.amount=Math.round(E.clamp(Number(node.value)||1,1,1e14));
    else if(key==='fixedDays')ui.fixedDays=Number(node.value);
    else if(key==='buildFilter')ui.buildFilter=node.value;
    else if(['optionResource','optionType','planStock','chain','bankPlanProduct','bankPlanDirection','analysisResource','analysisStock','planMode','companyId','bondIssuer'].includes(key))ui[key]=node.value;
    else if(['optionDays','planPeriod','analysisHours'].includes(key))ui[key]=Number(node.value);
    render();
  }
  if(node.dataset.treasury&&game){const field=node.dataset.treasury;finish(E.setTreasury(C.scopeCompany(game,ui.companyId),field,field==='bank'?node.value:Number(node.value)));}
  if(node.dataset.auto&&game){
    const a=C.scopeCompany(game,ui.companyId).automation[node.dataset.auto],field=node.dataset.field;
    if(field==='mode')a.mode=node.value;else a[field]=Math.round(E.clamp(Number(node.value)||0,0,1e9));
    if(a.low>a.high){if(field==='low')a.high=a.low;else a.low=a.high;}
    safeSave();render();toast('Automatik gespeichert.');
  }
});

document.querySelector('#import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try {
    if(file.size>5000000)throw new Error('Die Datei ist zu groß.');
    const loaded=Store.decode(await file.text());
    openDialog('Spielstand importieren?',`<p><strong>${V.esc(loaded.game.name)}</strong><br>${V.cash(loaded.game.cash)} · ${TIERS[loaded.game.tier].name}</p><p>Der aktuelle automatische Stand wird ersetzt. Die verstrichene Zeit wird anschließend nachgerechnet.</p>`,async()=>{if(game&&running)safeSave();ui.tab='overview';await resume(loaded.game);},'Importieren');
  }catch(error){toast(error.message,true);}
});

setInterval(()=>{
  if(!running||!game||busy||document.hidden)return;
  if(!claimLease()){ui.speed=1;speedPointer=null;stopRepeating();running=false;ui.screen='menu';render();toast('Das Unternehmen wird in einer anderen Sitzung fortgesetzt.',true);return;}
  if(Date.now()<game.lastUpdate){game.lastUpdate=Date.now();toast('Die Geräteuhr wurde korrigiert. Die Simulation läuft weiter.');}
  const oldTier=game.tier,result=E.advance(game,Date.now(),{speed:ui.speed});
  if(Date.now()-lastSaveAttempt>=15000)safeSave();
  if(game.tier>oldTier)queuedDiscovery=queuedDiscovery===null?oldTier:Math.min(queuedDiscovery,oldTier);
  if(result.steps){render(true);refreshBuildingDetails();if(!repeating)flushDiscovery();}
},500);

document.addEventListener('visibilitychange',async()=>{
  if(document.hidden){stopRepeating();stopFastForward();if(running&&!busy){E.advance(game,Date.now());safeSave();}}
  else if(running&&!busy){checkUpdate();await resume(game);}
});
window.addEventListener('pagehide',()=>{stopFastForward();if(running&&!busy)safeSave();releaseLease();});
window.addEventListener('storage',event=>{
  if(event.key===leaseKey&&running&&event.newValue){
    try{if(JSON.parse(event.newValue).id!==sessionId){ui.speed=1;speedPointer=null;stopRepeating();running=false;ui.screen='menu';if(dialog.open)closeDialog();render();toast('NULL wurde in einer anderen Sitzung geöffnet. Diese Sitzung pausiert.',true);}}catch{}
  }
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});

async function setupOffline() {
  if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('preview'))return;
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  const hadController=!!navigator.serviceWorker.controller;
  try {
    registration=await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname,updateViaCache:'none'});
    await navigator.serviceWorker.ready;ui.offlineReady=true;
    if(!busy)render();
    let refreshing=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController||refreshing)return;refreshing=true;if(game&&running)safeSave();window.location.reload();});
    const offer=()=>{if(registration.waiting){ui.updateReady=true;if(!busy&&!dialog.open)render();toast('Neue Version bereit. Tippe auf „Update laden“.');}};
    offer();registration.addEventListener('updatefound',()=>{const installing=registration.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&navigator.serviceWorker.controller)setTimeout(offer,0);});});
    checkUpdate();
  }catch(error){console.warn('Offline installation failed',error);toast('Offline-Dateien konnten noch nicht gespeichert werden. Bitte später online erneut öffnen.',true);}
}
function checkUpdate(){if(registration&&navigator.onLine)registration.update().catch(()=>{});}
window.addEventListener('online',checkUpdate);
setInterval(checkUpdate,15*60*1000);

try {
  const saved=Store.load();if(saved){game=saved.game;ui.lastSaved=saved.saved;if(saved.recovered)toast('Automatische Sicherungskopie wiederhergestellt.');}
}catch(error){ui.saveError=error.message;toast('Autosave konnte nicht gelesen werden. Manuelle Spielstände und Import sind weiter verfügbar.',true);}
render();setupOffline();

// A small public diagnostics surface exposes no save mutation API.
window.NULL_VERSION=RELEASE;
