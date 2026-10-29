import * as E from './engine.mjs';
import * as V from './views.mjs';
import * as Store from './storage.mjs';
import { RESOURCES, BUILDINGS, INFRA, RESEARCH, TIERS, BONDS, VENTURES, DAY, OFFLINE_LIMIT, RELEASE, PROGRAMME_CHOICES } from './data.mjs';
import { icon, mark } from './icons.mjs';
import {help} from './help.mjs';
import {previewBuilding} from './planning.mjs';
import {programmeOffer,startProgramme,reserveProgrammeMaterials} from './campaign.mjs';

const app = document.querySelector('#app'), dialog = document.querySelector('#dialog');
const leaseKey = 'null-economy:lease', sessionId = globalThis.crypto?.randomUUID?.() || String(Math.random());
let game = null, running = false, busy = false, pending = null, toastTimer, lastSaveAttempt = 0, worker = null, registration = null, installPrompt = null, queuedDiscovery = null, interactingUntil = 0;
const ui = { screen:'menu', tab:'overview', productionTab:'business', financeTab:'bank', buildFilter:'all', marketFilter:'all', qty:1, amount:100, fixedDays:20,optionResource:'wood',optionType:'put',optionDays:3,planStock:'sylva',planPeriod:1, open:new Set(), offlineReady:false, updateReady:false, lastSaved:0, saveError:'', previousScreen:'menu' };

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

function morph(oldNode,newNode){
  if(oldNode.nodeType!==newNode.nodeType||oldNode.nodeName!==newNode.nodeName){oldNode.replaceWith(newNode.cloneNode(true));return;}
  if(oldNode.nodeType===Node.TEXT_NODE){if(oldNode.data!==newNode.data)oldNode.data=newNode.data;return;}
  if(oldNode.nodeType!==Node.ELEMENT_NODE)return;
  for(const attribute of [...oldNode.attributes])if(!newNode.hasAttribute(attribute.name))oldNode.removeAttribute(attribute.name);
  for(const attribute of newNode.attributes)if(oldNode.getAttribute(attribute.name)!==attribute.value)oldNode.setAttribute(attribute.name,attribute.value);
  const oldChildren=[...oldNode.childNodes],newChildren=[...newNode.childNodes];
  for(let i=0;i<Math.max(oldChildren.length,newChildren.length);i++){
    if(!newChildren[i])oldChildren[i].remove();else if(!oldChildren[i])oldNode.append(newChildren[i].cloneNode(true));else morph(oldChildren[i],newChildren[i]);
  }
}
function writeView(html,live){
  if(!live){app.innerHTML=html;return;}
  const template=document.createElement('template');template.innerHTML=html;
  if(app.childNodes.length===1&&template.content.childNodes.length===1)morph(app.firstChild,template.content.firstChild);
  else app.innerHTML=html;
}
function render(live=false) {
  if (busy) return;
  if (ui.screen === 'menu') { app.innerHTML = V.menu(game,ui); return; }
  const content = ui.tab === 'saves' ? V.savesView(game,ui,saves()) : ui.tab === 'guide' ? V.guide(game) : !game ? '' :
    ui.tab === 'overview' ? V.overview(game,ui) : ui.tab === 'production' ? V.production(game,ui) : ui.tab === 'market' ? V.market(game,ui) :
    ui.tab === 'finance' ? V.finance(game,ui) : ui.tab === 'research' ? V.researchView(game,ui) : ui.tab === 'contracts' ? V.contracts(game) :
    ui.tab === 'programmes' ? V.programmes(game) : ui.tab === 'journal' ? V.journal(game) : ui.tab === 'statistics' ? V.statistics(game) : V.more(game);
  if (game && ui.screen === 'game') writeView(V.frame(game,ui,content),live);
  else app.innerHTML = `<div class="shell"><header class="topbar"><button class="brand" data-action="menu">${mark()}NULL</button><button class="small" data-action="menu">Zurück</button></header><main id="content" class="mt24">${content}</main></div>`;
}

function openDialog(title, body, onConfirm = null, confirmLabel = 'Bestätigen', cancelLabel = 'Abbrechen') {
  pending = onConfirm;
  dialog.innerHTML = `<button class="dialog-close" data-action="closeDialog" aria-label="Dialog schließen">${icon('close')}</button><h2 id="dialog-title">${title}</h2>${body}<div class="dialog-actions">${onConfirm ? `<button data-action="closeDialog">${cancelLabel}</button><button class="primary" data-action="confirmDialog">${confirmLabel}</button>` : '<button class="primary" data-action="closeDialog">Verstanden</button>'}</div>`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { dialog.close(); pending = null;flushDiscovery(); }
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
  if (result?.message) toast(result.message,!result.ok);
  if (game && result?.ok !== false) { E.checkProgress(game); E.checkAchievements(game); safeSave(); }
  render();
  if (oldTier !== undefined) showDiscoveries(oldTier);
}

async function catchUp(s, now) {
  if(now<s.lastUpdate){s.lastUpdate=now;return {game:s,result:{seconds:0,skipped:0,steps:0,clockBack:true}};}
  if ((now - s.lastUpdate) / 1000 < 120) return { game:s, result:E.advance(s,now) };
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
  // Older WebViews still yield between batches rather than blocking the interface.
  const target = Math.min(now,s.lastUpdate + OFFLINE_LIMIT*1000), total = Math.max(1,target-s.lastUpdate), initial=s.lastUpdate;
  const result = {seconds:0,skipped:Math.max(0,(now-target)/1000),steps:0,cash:0,wealth:0,produced:0,interest:0,dividends:0,taxes:0};
  while (s.lastUpdate + 1000 <= target) {
    const part=E.advance(s,Math.min(target,s.lastUpdate+3600000),{offline:true});
    for(const key of Object.keys(result))if(key!=='skipped')result[key]+=part[key]||0;
    const node=document.querySelector('#offline-progress');if(node)node.value=(s.lastUpdate-initial)/total;
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if (now-target>0) s.lastUpdate=now-(target-s.lastUpdate);
  return {game:s,result};
}

function offlineReport(result, oldTier) {
  if (result.seconds < 60) { showDiscoveries(oldTier); return; }
  const body = `<p>Während deiner Abwesenheit wurden <strong>${V.duration(result.seconds)}</strong> echte Zeit simuliert.</p><div class="offline-numbers"><div><span>Veränderung Liquidität</span><strong class="number">${V.signed(result.cash)}</strong></div><div><span>Veränderung Vermögen</span><strong class="number">${V.signed(result.wealth)}</strong></div><div><span>Produzierte Einheiten</span><strong class="number">${V.compact(result.produced)}</strong></div><div><span>Zinsen & Dividenden netto</span><strong class="number">${V.cash(result.interest+result.dividends)}</strong></div></div><p>Steuern: ${V.cash(result.taxes)}. Alle Engpässe, Käufe, Verkäufe und Fälligkeiten wurden berücksichtigt. Details stehen in deiner Chronik.</p>${result.skipped?`<p><strong>Offline-Limit:</strong> ${V.duration(result.skipped)} über sieben Tage hinaus wurden nicht simuliert.</p>`:''}${game.tier>oldTier?'<p>Dein Wachstum hat neue Möglichkeiten freigeschaltet.</p>':''}`;
  openDialog('Willkommen zurück.',body,game.tier>oldTier?()=>showDiscoveries(oldTier):null,'Entdeckungen ansehen');
}

async function resume(s = game, force = false) {
  if (!s || busy) return;
  if(force&&s===game){try{const latest=Store.load();if(latest&&latest.game.lastUpdate>s.lastUpdate)s=latest.game;}catch{}}
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
  if (['research','finance'].includes(tab) && (!game || game.tier < 1)) return;
  ui.tab=tab; ui.screen=running?'game':'page'; render(); window.scrollTo({top:0});
  requestAnimationFrame(()=>document.querySelector('#content')?.focus({preventScroll:true}));
}

function prepareNew() {
  openDialog('Ein neuer Anfang.',`<p>Wie soll dein Unternehmen heißen?</p><label for="new-name" class="mt16">Unternehmensname</label><input id="new-name" type="text" maxlength="36" value="Mein Unternehmen" autocomplete="off">${game?'<p>Ein neues Unternehmen ersetzt den automatischen Spielstand. Manuelle Speicherplätze bleiben erhalten. Exportiere deinen bisherigen Stand vorher, wenn du ihn behalten möchtest.</p>':''}`,async()=>{
    const name=document.querySelector('#new-name')?.value||'Mein Unternehmen';
    if(!claimLease()) { toast('Bitte schließe zuerst die andere aktive NULL-Sitzung.',true);return; }
    if(game)safeSave(); const next=E.createGame(name);ui.tab='overview';ui.productionTab='business';ui.financeTab='bank';ui.open.clear();await resume(next);
  },'Unternehmen gründen');
  setTimeout(()=>document.querySelector('#new-name')?.select(),50);
}

function orderDialog(id) {
  const p=E.price(game,id);
  openDialog('Ein Preis. Eine Bedingung.',`<p>Limitauftrag für <strong>${RESOURCES[id].name}</strong>. Vollständige Ausführung zum Durchschnittspreis inklusive Gebühren.</p><div class="auto-form mt16"><div><label for="order-side">Richtung</label><select id="order-side"><option value="buy">Kaufen</option><option value="sell">Verkaufen</option></select></div><div><label for="order-quantity">Anzahl</label><input id="order-quantity" type="number" inputmode="numeric" min="1" max="1000000" value="${ui.qty}"></div><div><label for="order-limit">Limit je Stück (€)</label><input id="order-limit" type="number" inputmode="decimal" min="0.01" step="0.01" value="${p.toFixed(2)}"></div></div>`,()=>finish(E.placeOrder(game,id,document.querySelector('#order-side').value,Number(document.querySelector('#order-quantity').value),Number(document.querySelector('#order-limit').value))),'Auftrag anlegen');
}

function openBuildingPreview(id,quantity=ui.qty){
  const plan=previewBuilding(game,id,quantity);
  if(!plan){toast('Dieser Bauplan ist noch nicht verfügbar.',true);return;}
  const build=plan.affordable?()=>{const oldTier=game.tier;finish(E.build(game,id,quantity),oldTier);}:null;
  openDialog(`Bauplan: ${BUILDINGS[id].name}`,V.buildingPreview(plan),build,`${quantity}× bauen`);
  dialog.dataset.previewQuantity=String(quantity);
}

function installHelp() {
  if(installPrompt) { installPrompt.prompt(); installPrompt=null;return; }
  openDialog('Dein Spiel. In deiner Tasche.',`<p>Öffne NULL auf dem iPhone in <strong>Safari</strong>. Warte, bis oben <strong>„Offline bereit“</strong> steht.</p><p>Tippe dann auf <strong>Teilen → Zum Home-Bildschirm → Hinzufügen</strong>. Öffne das neue NULL-Symbol einmal online und teste anschließend im Flugmodus.</p><p>${ui.offlineReady?'Die Dateien dieser Sitzung sind bereits für offline gespeichert.':'Der Offline-Cache ist in dieser Sitzung noch nicht bereit. Öffne die Seite über HTTPS und lasse sie kurz geöffnet.'}</p><p>Safari und die installierte App können unterschiedliche Spielstände verwenden. Übertrage deinen Stand bei Bedarf über <strong>Spielstände → Exportieren / Importieren</strong>.</p>${registration?.waiting?'<button class="wfull mt16" data-action="update">Update jetzt installieren</button>':''}`);
}

async function action(button) {
  const action=button.dataset.action,id=button.dataset.id,side=button.dataset.side;
  if(busy || button.disabled)return;
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
    try { const latest=Store.load();if(latest&&latest.game.lastUpdate>game.lastUpdate)game=latest.game; }catch{}
    await resume();return;
  }
  if(action==='menu'){if(running){E.advance(game,Date.now());safeSave();}running=false;releaseLease();ui.screen='menu';render();return;}
  if(action==='tab'){go(id);return;}
  if(action==='saves'||action==='guide'){go(action);return;}
  if(action==='install'){installHelp();return;}
  if(action==='info'){
    const item=help(id,game),paragraphs=item.body.match(/<p>[\s\S]*?<\/p>/g)||[item.body];
    const body=paragraphs.length>2?paragraphs.slice(0,2).join('')+`<details class="help-more"><summary>Rechenregeln & Details</summary>${paragraphs.slice(2).join('')}</details>`:item.body;
    openDialog(item.title,body);return;
  }
  if(action==='qty'){ui.qty=Number(id);render();return;}
  if(action==='amount'){ui.amount=E.clamp(ui.amount+Number(id),1,1e14);render();return;}
  if(action==='expand'){ui.open.has(id)?ui.open.delete(id):ui.open.add(id);render();return;}
  if(['productionTab','financeTab','marketFilter'].includes(action)){ui[action]=id;if(action==='financeTab'&&id==='hedges'&&RESOURCES[ui.optionResource].tier>game.tier)ui.optionResource='wood';render();return;}
  if(action==='update'){
    if(!registration?.waiting){toast('Du verwendest bereits die aktuelle Version.');return;}
    // Paused menus may hold an older snapshot than another tab's autosave.
    if(game&&running&&!safeSave()){openDialog('Spielstand zuerst sichern.','<p>Der lokale Speicher ist gerade nicht verfügbar. Exportiere deinen Spielstand unter „Spielstände“, bevor du das Update erneut startest.</p>');return;}
    running=false;button.disabled=true;button.textContent='Wird geladen …';
    registration.waiting.postMessage({type:'SKIP_WAITING'});return;
  }
  if(action==='import'){document.querySelector('#import-file').click();return;}
  if(action==='loadSlot'){
    openDialog('Diesen Stand laden?','<p>Dein aktueller automatischer Stand wird ersetzt. Die seit der Sicherung verstrichene Zeit wird nachgerechnet. Exportiere vorher einen Stand, den du behalten möchtest.</p>',async()=>{
      try { const loaded=Store.load(id);if(!loaded)throw new Error('Spielstand nicht gefunden.');if(game)safeSave();ui.tab='overview';await resume(loaded.game);if(loaded.recovered)toast('Letzte gültige Sicherungskopie wiederhergestellt.'); }catch(error){toast(error.message,true);}
    },'Spielstand laden');return;
  }
  if(action==='deleteSlot'){openDialog('Spielstand löschen?','<p>Dieser manuelle Speicherplatz und seine Sicherungskopie werden gelöscht.</p>',()=>{try{Store.deleteSave(id);render();toast('Spielstand gelöscht.');}catch(error){toast(error.message,true);}},'Löschen');return;}
  if(!game)return;
  const oldTier=game.tier;
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
  if(action==='preview'){openBuildingPreview(id);return;}
  if(action==='previewQuantity'){
    const delta=Number(button.dataset.delta),quantity=E.clamp(Number(dialog.dataset.previewQuantity)+delta,1,100);
    openBuildingPreview(id,quantity);
    dialog.querySelector(`button[data-action="previewQuantity"][data-delta="${delta}"]:not(:disabled)`)?.focus({preventScroll:true});return;
  }
  if(action==='build'||action==='buildInfra'){finish(E.build(game,id,ui.qty,action==='buildInfra'),oldTier);return;}
  if(action==='demolish'||action==='demolishInfra'){
    const infra=action==='demolishInfra',name=(infra?INFRA:BUILDINGS)[id].name;
    openDialog('Kapazität zurückbauen?',`<p>${ui.qty}× <strong>${name}</strong> abbauen? Du erhältst 45 % des anteiligen Buchwerts zurück. Prüfe mögliche Engpässe vor dem Rückbau.</p>`,()=>finish(E.demolish(game,id,ui.qty,infra)),'Zurückbauen');return;
  }
  if(action==='active'){finish(E.setActive(game,id,Number(button.dataset.delta)));return;}
  if(action==='pause'){const own=game.buildings[id];finish(E.setActive(game,id,own.active?-own.active:own.count));return;}
  if(action==='upgrade'){finish(E.upgrade(game,id));return;}
  if(action==='trade'){finish(E.trade(game,id,ui.qty,side),oldTier);return;}
  if(action==='policy'){game.policy=id;finish(Eresult('Unternehmensstrategie geändert.'));return;}
  if(action==='profitGuard'){game.profitGuard=!game.profitGuard;finish(Eresult(game.profitGuard?'Margenwächter aktiv. Bei negativer Handelsmarge pausieren Betriebe automatisch.':'Margenwächter ausgeschaltet.'));return;}
  if(action==='priority'){game.priority=id;finish(Eresult('Produktionsreihenfolge geändert.'));return;}
  if(action==='setupSupplies'){
    openDialog('Vorprodukte bevorraten?','<p>Die benötigten Vorprodukte werden am Markt für etwa zwei Spielstunden eingekauft. Bereits vorhandene Verkaufseinstellungen bleiben mit ausreichend Abstand erhalten. Die Einkäufe kosten laufend Geld und nutzen deine freie Betriebskasse.</p>',()=>finish(E.setupSupplies(game,id)),'Einkauf einrichten');return;
  }
  if(action==='goResource'){ui.marketFilter='all';ui.open.add(`m-${id}`);go('market');return;}
  if(action==='treasuryToggle'){finish(E.setTreasury(game,'enabled',!game.treasury.enabled));return;}
  if(action==='treasuryStep'){finish(E.setTreasury(game,id,game.treasury[id]+Number(button.dataset.delta)));return;}
  if(action==='drip'){finish(E.toggleDividendReinvestment(game,id));return;}
  if(action==='createPlan'){finish(E.createSavingsPlan(game,ui.planStock,ui.amount,ui.planPeriod));return;}
  if(action==='cancelPlan'){finish(E.cancelSavingsPlan(game,Number(id)));return;}
  if(action==='property'){finish(E.propertyTrade(game,id,ui.qty,side),oldTier);return;}
  if(action==='emergency'){finish(E.emergencyAid(game));return;}
  if(action==='restructure'){
    openDialog('Ein tragfähiger Neustart.',`<p>Eine Sanierung gibt <strong>alle Produktionsanlagen, Infrastruktur, Waren und Finanzanlagen</strong> ab und löscht sämtliche Schulden. Du beginnst mit 600 €, einer kleinen Materialreserve und einem Holzfäller.</p><p>Forschung, bereits entdeckte Inhalte, Meilensteine, Vermächtnispunkte und Holdingprogramme bleiben erhalten. Deine Reputation fällt auf 15. Exportiere deinen Stand vorher, wenn du ihn behalten möchtest.</p>`,()=>{const next=E.restructure(game);if(next){game=next;ui.tab='overview';ui.open.clear();finish(Eresult('Die Sanierung ist abgeschlossen. Dein Wissen bleibt.'));}else toast('Nutze zuerst vorhandene liquide Mittel. Sanierung ist nur bei Überschuldung und fast leerer Kasse möglich.',true);},'Sanierung durchführen');return;
  }
  if(action==='buyOption'){
    const q=E.optionQuote(game,ui.optionResource,ui.optionType,ui.qty,ui.optionDays),resource=ui.optionResource,type=ui.optionType,quantity=ui.qty,days=ui.optionDays;
    openDialog('Eine Grenze für dein Risiko.',`<p>${quantity} Einheiten ${RESOURCES[resource].name}: ${type==='put'?'Schutz gegen fallende':'Schutz gegen steigende'} Preise. Laufzeit ${V.duration(days*DAY)} echt.</p><p>Prämie und maximaler Verlust: <strong>${V.money(q.premium,2)}</strong>. Abrechnung zum Außenmarktpreis, ohne Warenlieferung. Keine Nachschusspflicht.</p>`,()=>finish(E.buyOption(game,resource,type,quantity,days)),'Absicherung kaufen');return;
  }
  if(action==='sellOption'){finish(E.sellOption(game,Number(id)));return;}
  if(action==='autoStep'){
    const field=button.dataset.field,a=game.automation[id];a[field]=E.clamp(a[field]+Number(button.dataset.delta),0,1e9);
    if(a.low>a.high){if(field==='low')a.high=a.low;else a.low=a.high;}
    finish(Eresult('Automatik angepasst.'));return;
  }
  if(action==='orderDialog'){orderDialog(id);return;}
  if(action==='cancelOrder'){finish(E.cancelOrder(game,Number(id)));return;}
  if(action==='bank'){finish(E.bankTransfer(game,id,ui.amount,side),oldTier);return;}
  if(action==='fixed'){finish(E.fixedDeposit(game,ui.amount,ui.fixedDays));return;}
  if(action==='redeemFixed'){openDialog('Festgeld vorzeitig auflösen?','<p>Du erhältst 98 % des ursprünglich angelegten Kapitals. Alle aufgelaufenen Zinsen entfallen.</p>',()=>finish(E.redeemFixed(game,Number(id))),'Auflösen');return;}
  if(action==='borrow'||action==='termLoan'){
    const term=action==='termLoan',amount=ui.amount,rate=E.debtRate(game)*(term?.8:1);
    openDialog(term?'Wachstum auf Kredit.':'Liquidität mit Verpflichtung.',`<p>${V.money(amount)} aufnehmen? Der Zins beträgt ${V.pct(rate,3)} <strong>pro Spieltag (24 echte Minuten)</strong>${term?' und bleibt für diesen Kredit fest.':'. Der Zinssatz ist variabel.'}</p><p>${term?'Zehn Tilgungsraten alle zehn Spieltage. Nicht bezahlte Raten wandern ins Kontokorrent und senken die Reputation.':'Nicht zahlbare Zinsen erhöhen die Schuld. Zu hohe Verschuldung senkt die Reputation.'}</p>`,()=>finish(E.borrow(game,amount,term)),'Kredit aufnehmen');return;
  }
  if(action==='repay'){finish(E.repay(game,ui.amount));return;}
  if(action==='repayLoan'){finish(E.repay(game,ui.amount,Number(id)));return;}
  if(action==='stock'){finish(E.stockTrade(game,id,ui.qty,side));return;}
  if(action==='bond'){
    const d=BONDS[id],amount=ui.amount;
    openDialog(d.name,`<p>${V.money(amount)} für ${V.duration(d.days*DAY)} echte Zeit binden? Zins ${V.pct(d.rate,2)} pro Spieltag vor Steuer.</p><p>${d.description}. Eine vorzeitige Rückzahlung ist nicht möglich.</p>`,()=>finish(E.investBond(game,id,amount)),'Anleihe zeichnen');return;
  }
  if(action==='venture'){
    const d=VENTURES[id],amount=ui.amount;
    openDialog(d.name,`<p>${V.money(amount)} für ${V.duration(d.duration)} echte Zeit riskieren?</p><p>${d.description}.</p><p>Der Ausgang ist unabhängig von anderen Beteiligungen. Kapital ist bis zum Ergebnis gebunden. Auf einen Gewinn fallen 15 % Steuer an.</p>`,()=>finish(E.investVenture(game,id,amount)),'Risiko eingehen');return;
  }
  if(action==='research'){finish(E.research(game,id));return;}
  if(action==='accept'){finish(E.acceptContract(game,Number(id)));return;}
  if(action==='fulfill'){finish(E.fulfillContract(game,Number(id)),oldTier);return;}
  if(action==='abandon'){openDialog('Versprechen zurücknehmen?','<p>Der Vertrag wird aufgegeben. Deine Reputation sinkt um drei Punkte. Es gibt keine Geldstrafe.</p>',()=>finish(E.abandonContract(game,Number(id))),'Vertrag aufgeben');return;}
  if(action==='liquidate'){
    let total=0;for(const id of Object.keys(RESOURCES)){if(RESOURCES[id].tier<=game.tier&&game.inventory[id]>.001){const result=E.trade(game,id,game.inventory[id],'sell',true);if(result.ok)total+=result.total;}}
    finish(Eresult(`Lager verkauft: ${V.money(total)}. Vorprodukte können jetzt fehlen.`),oldTier);return;
  }
  if(action==='prestige'){
    openDialog('Das nächste Kapitel.',`<p>Eine neue Holding setzt dein Unternehmen, Geld, Anlagen, Forschung und Finanzprodukte zurück. Du erhältst <strong>${E.prestigeReward(game)} Vermächtnispunkte</strong>.</p><p>Alle bisherigen Punkte bleiben: dauerhaft +8 % Produktion und +4 % Forschung je Punkt. Abgeschlossene und laufende Holdingprogramme bleiben ebenfalls erhalten. Exportiere vor diesem Schritt deinen Spielstand.</p>`,()=>{const next=E.prestige(game);if(next){game=next;ui.tab='overview';finish(Eresult('Eine neue Geschichte beginnt.'));}},'Neue Holding gründen');return;
  }
}
const Eresult=message=>({ok:true,message});

document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if(button)action(button).catch(error=>{console.error(error);toast(`Aktion nicht ausgeführt: ${error.message}`,true);});
});
document.addEventListener('pointerdown',()=>{interactingUntil=Date.now()+1500;},{passive:true});
document.addEventListener('pointerup',()=>{interactingUntil=Date.now()+150;},{passive:true});
document.addEventListener('pointercancel',()=>{interactingUntil=Date.now()+150;},{passive:true});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
dialog.addEventListener('cancel',()=>{pending=null;});

document.addEventListener('change',event=>{
  const node=event.target;
  if(node.dataset.setting){
    const key=node.dataset.setting;
    if(key==='amount')ui.amount=Math.round(E.clamp(Number(node.value)||1,1,1e14));
    else if(key==='fixedDays')ui.fixedDays=Number(node.value);
    else if(key==='buildFilter')ui.buildFilter=node.value;
    else if(['optionResource','optionType','planStock'].includes(key))ui[key]=node.value;
    else if(['optionDays','planPeriod'].includes(key))ui[key]=Number(node.value);
    render();
  }
  if(node.dataset.treasury&&game){const field=node.dataset.treasury;finish(E.setTreasury(game,field,field==='bank'?node.value:Number(node.value)));}
  if(node.dataset.auto&&game){
    const a=game.automation[node.dataset.auto],field=node.dataset.field;
    if(field==='mode')a.mode=node.value;else a[field]=Math.round(E.clamp(Number(node.value)||0,0,1e9));
    if(a.low>a.high){if(field==='low')a.high=a.low;else a.low=a.high;}
    safeSave();render();toast('Automatik gespeichert.');
  }
});

document.querySelector('#import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try {
    if(file.size>2500000)throw new Error('Die Datei ist zu groß.');
    const loaded=Store.decode(await file.text());
    openDialog('Spielstand importieren?',`<p><strong>${V.esc(loaded.game.name)}</strong><br>${V.cash(loaded.game.cash)} · ${TIERS[loaded.game.tier].name}</p><p>Der aktuelle automatische Stand wird ersetzt. Die verstrichene Zeit wird anschließend nachgerechnet.</p>`,async()=>{if(game)safeSave();ui.tab='overview';await resume(loaded.game);},'Importieren');
  }catch(error){toast(error.message,true);}
});

setInterval(()=>{
  if(!running||!game||busy||document.hidden)return;
  if(!claimLease()){running=false;ui.screen='menu';render();toast('Das Unternehmen wird in einer anderen Sitzung fortgesetzt.',true);return;}
  if(Date.now()<game.lastUpdate){game.lastUpdate=Date.now();toast('Die Geräteuhr wurde korrigiert. Die Simulation läuft weiter.');}
  const oldTier=game.tier,result=E.advance(game,Date.now());
  if(Date.now()-lastSaveAttempt>=15000)safeSave();
  if(game.tier>oldTier)queuedDiscovery=queuedDiscovery===null?oldTier:Math.min(queuedDiscovery,oldTier);
  if(result.steps&&!dialog.open&&Date.now()>interactingUntil&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {render(true);flushDiscovery();}
},1000);

document.addEventListener('visibilitychange',async()=>{
  if(document.hidden){if(running&&!busy){E.advance(game,Date.now());safeSave();}}
  else if(running&&!busy){checkUpdate();await resume(game);}
});
window.addEventListener('pagehide',()=>{if(running&&!busy)safeSave();releaseLease();});
window.addEventListener('storage',event=>{
  if(event.key===leaseKey&&running&&event.newValue){
    try{if(JSON.parse(event.newValue).id!==sessionId){running=false;ui.screen='menu';if(dialog.open)closeDialog();render();toast('NULL wurde in einer anderen Sitzung geöffnet. Diese Sitzung pausiert.',true);}}catch{}
  }
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});

async function setupOffline() {
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
