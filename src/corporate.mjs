import {BUILDINGS,INFRA,RESOURCES,PROPERTIES,STOCKS,DAY,HOUR} from './data.mjs';
import * as E from './engine.mjs';

export const FORMS={sole:{name:'Einzelunternehmen',fee:0,daily:0},gmbh:{name:'GmbH',fee:350,daily:4},ag:{name:'AG',fee:1500,daily:15}};
export const MANDATES={grow:'Wachstum',income:'Ausschütten',debt:'Entschulden',reserve:'Reserven bilden'};
export const CEOS={builder:{name:'Unternehmerin',salary:40,description:'Erweitert rentable Betriebe und löst Kapazitätsengpässe.'},steward:{name:'Sanierer',salary:30,description:'Tilgt Schulden und hält eine größere Liquiditätsreserve.'},financier:{name:'Finanzexpertin',salary:35,description:'Verwaltet Rücklagen, legt Überschüsse an und refinanziert Schulden.'}};
export const FOCUSES={mixed:'Frei definierbar',wood:'Holz & Wohnen',food:'Ernährung',metal:'Metall & Werkzeuge',construction:'Baustoffe',property:'Immobilien',finance:'Finanzgeschäfte'};
const FOCUS_BUILDINGS={wood:['lumber','sawmill','carpenter'],food:['farm','bakery'],metal:['ironMine','smelter','toolmaker'],construction:['quarry','kiln'],mixed:Object.keys(BUILDINGS),property:[],finance:[]};
const SHARED=new Set(['elapsed','lastUpdate','market','economy','event','tier','research','points','legacy','campaign','seed','achievements']);
const LOCAL=['research','legacy','campaign','tier','name','cash','inventory','buildings','infra','infraBook','automation','stocks','properties','options','savingsPlans','bankPlans','treasury','emergencyNext','banks','bonds','ventures','orders','loans','debt','policy','priority','profitGuard','reputation','stats','hourLedger','dayLedger','contracts','board','journal','nextId'];
const good=message=>({ok:true,message});const bad=message=>({ok:false,message});
const amount=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e100;
const number=(v,def=0,max=1e100)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,v)):def;
const word=(v,def='Unternehmen')=>typeof v==='string'&&v.trim()?v.trim().slice(0,48):def;
const safeId=id=>typeof id==='string'&&/^[a-z][a-z0-9_-]{0,30}$/.test(id);
const clone=o=>JSON.parse(JSON.stringify(o));

function business(name,seed){const base=E.createGame(name,0,seed,false);base.cash=0;for(const id of Object.keys(base.inventory))base.inventory[id]=0;return Object.fromEntries(LOCAL.map(k=>[k,base[k]]));}
function record(id,name,focus,state,extra={}){return {id,name,focus,state,world:false,form:'gmbh',listed:false,shares:10000,held:10000,price:1,payout:.25,mandate:'reserve',reserve:500,budget:2000,ceo:null,spent:0,lastDecision:0,lastIssue:-5*DAY,lastDividend:0,lastDailyProfit:0,previousRevenue:0,previousCosts:0,report:[],inspected:false,offer:null,...extra};}
export function initializeGroup(s){
  s.group={revision:1,nextId:1,wallet:0,parent:{form:'sole',listed:false,shares:10000,held:10000,payout:0,price:1,lastIssue:-5*DAY,lastDividend:0,previousIncome:0,previousCosts:0},companies:[],loans:[],agreements:[],payables:[]};
  const specs=[['sylva','Sylva Rohstoffe','wood',true,{lumber:8,sawmill:3},30000],['terra','Terra Lebensmittel','food',true,{farm:8,bakery:4},50000],['ferrum','Ferrum Industrie','metal',true,{ironMine:5,smelter:3,toolmaker:2},80000],['forma','Forma Manufakturen','construction',false,{quarry:6,kiln:3,carpenter:2},45000],['nova','Nova Immobilien','property',false,{},80000]];
  for(const[id,name,focus,listed,buildings,cash]of specs){
    const state=business(name,s.seed);state.cash=cash;state.tier=3;state.campaign.unlocked=true;state.infra.housing=5;state.infra.power=3;state.infra.transport=4;state.infra.warehouse=2;
    for(const key of ['housing','power','transport','warehouse'])state.infraBook[key]=INFRA[key].cost*state.infra[key];
    for(const[key,count]of Object.entries(buildings))state.buildings[key]={count,active:count,level:0,book:BUILDINGS[key].cost*count};
    for(const[key,b]of Object.entries(BUILDINGS))if(state.buildings[key].count){for(const r of Object.keys(b.output))state.automation[r]={mode:'sell',low:0,high:40};for(const r of Object.keys(b.input)){state.inventory[r]=100;state.automation[r]={mode:'both',low:60,high:150};}}
    if(id==='nova'){state.properties.apartments.count=4;state.properties.apartments.basis=88000;state.properties.industrial.count=1;state.properties.industrial.basis=125000;}
    state.debt=id==='ferrum'?40000:id==='forma'?25000:0;
    const c=record(id,name,focus,state,{world:true,form:listed?'ag':'gmbh',listed,shares:10000,held:0,price:STOCKS[id].base,payout:id==='nova'?.65:.35,ceo:'builder',mandate:'grow',reserve:3000,budget:4000,owner:id==='forma'?'legacy':'liquidity'});
    s.group.companies.push(c);
  }
  for(const c of s.group.companies.filter(c=>!c.listed)){const price=Math.max(.01,companyValue(s,c)/c.shares);c.price=price;s.stocks[c.id].price=price;s.stocks[c.id].previous=price;s.stocks[c.id].history=[price];}
}
export const company=(s,id)=>s.group?.companies.find(c=>c.id===id);
export function scopeCompany(s,id='holding'){
  const c=company(s,id);if(!c)return s;
  return new Proxy(c.state,{get(target,key){if(key==='_holding')return s;if(key==='_firm')return c;if(key==='group')return undefined;if(c.world&&!controlled(s,c)&&['research','legacy','campaign','tier'].includes(key))return target[key];if(SHARED.has(key))return s[key];return target[key];},set(target,key,value){if(SHARED.has(key))s[key]=value;else target[key]=value;return true;},ownKeys(target){return [...new Set([...Reflect.ownKeys(target),...SHARED])];},getOwnPropertyDescriptor(target,key){return Reflect.getOwnPropertyDescriptor(target,key)||(SHARED.has(key)?{enumerable:true,configurable:true}:undefined);}});
}
const root=s=>s._holding||s;
export function sharesHeld(s,c){if(!c.world)return c.held;return (s.stocks[c.id]?.quantity||0)+s.group.companies.filter(x=>!x.world&&x.held/x.shares>.5).reduce((n,x)=>n+(x.state.stocks[c.id]?.quantity||0),0);}
export const freeFloat=(s,c)=>Math.max(0,c.shares-(c.world?books(s).reduce((n,b)=>n+(b.stocks[c.id]?.quantity||0),0):c.held));
export function economicOwnership(s,c){if(!c.world)return c.held/c.shares;return Math.min(1,((s.stocks[c.id]?.quantity||0)+s.group.companies.filter(x=>!x.world).reduce((n,x)=>n+(x.held/x.shares)*(x.state.stocks[c.id]?.quantity||0),0))/c.shares);}
const fullyOwned=(s,c)=>economicOwnership(s,c)>1-1e-12;
function repriceTransfer(s,c,delta){if(!c?.world)return;const p=s.stocks[c.id];p.price=Math.max(.01,p.price+delta/c.shares);p.report.fair=Math.max(.01,p.report.fair+delta/c.shares);c.price=p.price;}
export const ownership=(s,c)=>Math.min(1,sharesHeld(s,c)/c.shares);
export const controlled=(s,c)=>ownership(s,c)>.5;
export const controlledCompanies=s=>(s.group?.companies||[]).filter(c=>controlled(s,c));
function books(s){return [s,...s.group.companies.filter(c=>!c.world).map(c=>c.state)];}
export function companyReceivables(s,id){return s.group.loans.filter(l=>l.lender===id).reduce((n,l)=>n+l.principal,0);}
export function companyGroupDebt(s,id){return debtToGroup(s,id);}
function debtToGroup(s,id){return s.group.loans.filter(l=>l.borrower===id).reduce((n,l)=>n+l.principal,0);}
export function companyBalance(s,c){return E.assets(scopeCompany(s,c.id));}
export function companyValue(s,c){const a=companyBalance(s,c),operating=a.buildings+a.properties+a.inventory,financial=a.total-operating;return Math.max(0,financial+Math.max(operating,c.lastDailyProfit*120));}
export function groupAdjustments(s){
  const subsidiaries=s.group.companies.filter(c=>!c.world).reduce((n,c)=>n+Math.max(0,companyBalance(s,c).total)*ownership(s,c),0);
  const receivables=companyReceivables(s,'holding'),payables=s.group.payables.reduce((n,l)=>n+l.amount,0),p=s.group.parent;
  return {subsidiaries,receivables,payables,ownership:p.held/p.shares,wallet:s.group.wallet};
}
export function createCompany(s,name,focus='mixed',capital=1000){
  if(!s.group||s.tier<1)return bad('Unternehmensgründungen ab 2.000 € Konzernvermögen.');
  if(!Object.hasOwn(FOCUSES,focus)||!amount(capital)||capital<100)return bad('Wähle einen Schwerpunkt und mindestens 100 € Kapital.');
  if(s.group.companies.filter(c=>!c.world).length>=8)return bad('Maximal acht eigene Tochtergesellschaften.');
  if(capital+500>s.cash)return bad('Kapital und 500 € Gründungskosten fehlen in der Holding.');
  const id=`firm-${s.group.nextId++}`,state=business(word(name),s.seed);state.cash=capital;s.cash-=capital+500;
  const c=record(id,state.name,focus,state);c.price=capital/c.shares;s.group.companies.push(c);E.log(s,`${c.name} gegründet: ${Math.round(capital)} € Kapital, 100 % Eigentum.`,'finance');return good('Tochterunternehmen gegründet.');
}
export function transferCapital(s,id,value,direction='deposit'){
  const c=company(s,id);if(!c||!amount(value)||!fullyOwned(s,c)||!['deposit','withdraw'].includes(direction))return bad('Freie Kapitalüberträge sind nur bei vollständig eigenen Firmen möglich. Nutze bei Fremdanteilen Kredite oder Dividenden.');
  const source=direction==='deposit'?s:c.state,target=direction==='deposit'?c.state:s;
  if(direction==='withdraw'){const debt=companyBalance(s,c).debt;if(debt>0&&value>Math.max(0,source.cash-debt-c.reserve))return bad('Kreditverpflichtungen und Liquiditätsreserve begrenzen freie Entnahmen. Tilge zuerst die Finanzierung.');}
  if(value>source.cash)return bad('Die abgebende Kasse reicht nicht aus.');source.cash-=value;target.cash+=value;repriceTransfer(s,c,direction==='deposit'?value:-value);return good('Kapital innerhalb der Holding übertragen.');
}
export function transferAsset(s,from,to,kind,id,count){
  const a=company(s,from),b=company(s,to);if(from===to||![from,to].every(key=>key==='holding'||company(s,key)&&fullyOwned(s,company(s,key))))return bad('Assetüberträge benötigen zwei vollständig eigene Unternehmen.');
  if(!Number.isInteger(count)||count<1||count>10000)return bad('Ungültige Menge.');
  if(a&&companyBalance(s,a).debt>0)return bad('Vermögenswerte sind bei offenen Krediten als Sicherheiten gebunden. Tilge zuerst die Finanzierung.');
  const source=a?a.state:s,target=b?b.state:s,fromBefore=a?companyBalance(s,a).total:0,toBefore=b?companyBalance(s,b).total:0;
  if(kind==='building'&&Object.hasOwn(BUILDINGS,id)){
    const x=source.buildings[id],y=target.buildings[id];if(x.count<count||y.count+count>10000)return bad('Bestand oder Betriebsgrenze reicht nicht aus.');
    if(y.count&&y.level!==x.level)return bad('Betriebe benötigen dieselbe Ausbaustufe.');
    const book=x.book*count/x.count,active=Math.min(x.active,count);if(!y.count)y.level=x.level;x.count-=count;x.active-=active;x.book-=book;y.count+=count;y.active+=active;y.book+=book;
  }else if(kind==='property'&&Object.hasOwn(PROPERTIES,id)){
    if(s.group.agreements.some(x=>x.kind==='lease'&&x.from===from&&x.resource===id))return bad('Beende zuerst bestehende Mietverträge.');
    const x=source.properties[id],y=target.properties[id];if(x.count<count||y.count+count>100000)return bad('Nicht genügend Immobilien oder Bestandsgrenze erreicht.');if(y.count&&Math.abs(x.index-y.index)>1e-9)return bad('Bewertungen zunächst angleichen lassen.');
    const basis=x.basis*count/x.count;if(!y.count){y.index=x.index;y.occupancy=x.occupancy;}x.count-=count;x.basis-=basis;y.count+=count;y.basis+=basis;
  }else if(kind==='inventory'&&Object.hasOwn(RESOURCES,id)){
    if(source.inventory[id]<count||target.inventory[id]+count>E.warehouseCapacity(scopeCompany(s,to)))return bad('Warenbestand oder Lagerplatz reicht nicht aus.');source.inventory[id]-=count;target.inventory[id]+=count;
  }else return bad('Unbekannter Vermögenswert.');if(a)repriceTransfer(s,a,companyBalance(s,a).total-fromBefore);if(b)repriceTransfer(s,b,companyBalance(s,b).total-toBefore);return good('Vermögenswert samt Buchwert übertragen.');
}
export function configureCompany(s,id,settings){
  const c=company(s,id);if(!c||!controlled(s,c))return bad('Eine Stimmrechtsmehrheit ist erforderlich.');
  if(!Object.hasOwn(MANDATES,settings.mandate)||!(settings.ceo===null||Object.hasOwn(CEOS,settings.ceo))||!Number.isFinite(settings.payout)||settings.payout<0||settings.payout>1||!Number.isFinite(settings.reserve)||settings.reserve<100||!Number.isFinite(settings.budget)||settings.budget<0)return bad('Prüfe Mandat, Reserve, Budget und Ausschüttungsquote.');
  c.name=word(settings.name,c.name);c.state.name=c.name;c.mandate=settings.mandate;c.ceo=settings.ceo;c.payout=settings.payout;c.reserve=Math.min(1e12,settings.reserve);c.budget=Math.min(1e12,settings.budget);c.lastDecision=s.elapsed-HOUR;return good('Führungsmandat gespeichert.');
}
export function convertCompany(s,id,form){
  const c=id==='holding'?s.group.parent:company(s,id);if(!c||id!=='holding'&&!controlled(s,c)||!Object.hasOwn(FORMS,form))return bad('Gesellschaftsform oder Kontrolle fehlt.');
  if(c.form===form)return bad('Diese Gesellschaftsform besteht bereits.');if(c.listed||form==='sole'&&(c.shares!==c.held||id!=='holding'))return bad('Fremdanteile und Börsennotierung benötigen eine Kapitalgesellschaft.');
  const account=id==='holding'?s:c.state,fee=FORMS[form].fee;if(account.cash<fee)return bad('Die Firmenkasse reicht für die Umwandlung nicht aus.');account.cash-=fee;c.form=form;return good(`In ${FORMS[form].name} umgewandelt.`);
}
export function listCompany(s,id){
  const c=id==='holding'?s.group.parent:company(s,id);if(!c||c.form!=='ag'||c.listed||id!=='holding'&&!controlled(s,c))return bad('Nur eine kontrollierte, noch nicht notierte AG kann an die Börse.');
  const a=id==='holding'?E.assets(s).groupEquity:companyValue(s,c),account=id==='holding'?s:c.state,fee=Math.max(500,a*.02);if(account.cash<fee)return bad('Die Firmenkasse reicht für 2 % Börsengangskosten (mindestens 500 €) nicht aus.');
  account.cash-=fee;c.listed=true;c.price=Math.max(.01,(a-fee)/c.shares);if(c.world){s.stocks[id].price=c.price;s.stocks[id].report=E.companyFundamentals(s,id);}E.log(s,`${id==='holding'?s.name:c.name} ist jetzt börsennotiert. Neue Aktien können Wachstum finanzieren.`,'finance');return good('Börsengang abgeschlossen.');
}
export function raiseCapital(s,id,value){
  const c=id==='holding'?s.group.parent:company(s,id);if(!c||!c.listed||id!=='holding'&&!controlled(s,c)||!amount(value))return bad('Eine kontrollierte börsennotierte AG und ein positiver Betrag sind erforderlich.');
  if(s.elapsed-c.lastIssue<5*DAY)return bad('Investoren zeichnen frühestens fünf Spieltage nach der letzten Kapitalerhöhung erneut.');
  const equity=id==='holding'?E.assets(s).groupEquity:companyValue(s,c);if(equity<=0||value>equity*.3)return bad('Investoren finanzieren höchstens 30 % des aktuellen Unternehmenswerts je Runde.');
  const price=equity/c.shares,issued=Math.ceil(value/price);if(id==='holding'&&c.held/(c.shares+issued)<=.5)return bad('Diese Kapitalrunde würde deine Stimmrechtsmehrheit an der Holding aufheben. Reduziere den Betrag.');if(c.shares+issued>1e9)return bad('Maximale Aktienzahl erreicht.');
  const account=id==='holding'?s:c.state;account.cash+=value*.98;c.shares+=issued;c.lastIssue=s.elapsed;c.price=(equity+value*.98)/c.shares;if(c.world){s.stocks[id].price=c.price;s.stocks[id].report=E.companyFundamentals(s,id);}
  E.log(s,`${id==='holding'?s.name:c.name}: ${Math.round(value)} € neues Kapital, ${issued} neue Aktien. Bestehende Anteile werden verwässert.`,'finance');return good('Kapitalerhöhung abzüglich 2 % Emissionskosten ausgeführt.');
}
export function reinvestWallet(s,value){
  const p=s.group.parent,equity=E.assets(s).groupEquity;if(!amount(value)||value>s.group.wallet||equity<=0)return bad('Prüfe dein Privatvermögen und einen positiven Holdingwert.');
  const price=equity/p.shares,issued=Math.floor(value/price);if(issued<1||p.shares+issued>1e9)return bad('Der Betrag reicht nicht für eine ganze neue Aktie oder die Aktiengrenze ist erreicht.');const cost=issued*price;s.group.wallet-=cost;s.cash+=cost;p.shares+=issued;p.held+=issued;return good('Privatkapital gegen neue Holdinganteile reinvestiert.');
}
export function setParentPayout(s,value){if(!Number.isFinite(value)||value<0||value>1)return bad('Quote zwischen 0 und 100 % wählen.');s.group.parent.payout=value;return good('Ausschüttungsquote der Holding gespeichert.');}
export function corporateTrade(account,id,quantity,side,privateDeal=false,dealPrice=null){
  const s=root(account),c=company(s,id);if(!c)return null;
  if(!c.listed&&!privateDeal)return bad('Private Anteile werden mit den Eigentümern verhandelt.');
  if(account._firm?.world)return bad('Börsenbeteiligungen werden über die Holding oder eine eigene Investmentgesellschaft verwaltet.');
  if(s.tier<1||!Number.isInteger(quantity)||quantity<1||!['buy','sell'].includes(side)||account._firm?.id===id)return bad('Ungültiger Anteilskauf. Eigene Aktien können hier nicht gehandelt werden.');
  const p=account.stocks[id],remaining=freeFloat(s,c);if(side==='buy'&&quantity>remaining||side==='sell'&&quantity>p.quantity)return bad('Nicht genügend verfügbare Anteile.');
  const spot=dealPrice??s.stocks[id].price,impact=(side==='buy'?1:-1)*.4*quantity/c.shares,gross=privateDeal?spot*quantity:spot*quantity*Math.expm1(impact)/impact,fee=gross*.005;
  if(side==='buy'){if(gross+fee>account.cash)return bad('Nicht genügend Liquidität.');account.cash-=gross+fee;p.quantity+=quantity;p.basis+=gross+fee;}
  else{const basis=p.basis*quantity/p.quantity,tax=Math.max(0,gross-fee-basis)*.15;p.quantity-=quantity;p.basis=Math.max(0,p.basis-basis);account.cash+=gross-fee-tax;account.stats.taxes+=tax;}
  if(!privateDeal)s.stocks[id].price*=Math.exp(impact);c.price=s.stocks[id].price;return good(`${quantity} echte Unternehmensanteile ${side==='buy'?'erworben':'verkauft'}.`);
}
export function tradeOwnShares(s,id,quantity,side){
  const c=company(s,id);if(!c||c.world||!c.listed||!Number.isInteger(quantity)||quantity<1||!['buy','sell'].includes(side))return bad('Wähle eine eigene börsennotierte Firma und eine ganze Aktienzahl.');
  if(side==='buy'&&quantity>freeFloat(s,c)||side==='sell'&&quantity>c.held)return bad('Nicht genügend verfügbare Anteile.');
  const price=companyValue(s,c)/c.shares,gross=price*quantity,fee=gross*.005;if(side==='buy'){if(s.cash<gross+fee)return bad('Nicht genügend Geld für den Rückkauf.');s.cash-=gross+fee;c.held+=quantity;}else{s.cash+=gross-fee;c.held-=quantity;}
  return good('Eigene Unternehmensanteile zum aktuellen Unternehmenswert gehandelt.');
}
export function inspectCompany(s,id){const c=company(s,id);if(!c)return bad('Unternehmen nicht gefunden.');if(c.inspected)return good('Die Unternehmensprüfung liegt bereits vor.');if(s.cash<150)return bad('Die Unternehmensprüfung kostet 150 €.');s.cash-=150;c.inspected=true;return good('Unternehmensprüfung abgeschlossen: Bilanz, Verbindlichkeiten und Finanzierungsbedarf offengelegt.');}
export function offerPrivate(s,id,percent,price,terms='cash'){
  const c=company(s,id);if(!c||c.listed||!c.world||!Number.isFinite(percent)||percent<=0||percent>100||!amount(price)||!['cash','sellerLoan'].includes(terms))return bad('Prüfe private Firma, Anteil, Angebot und Zahlungsart.');
  const quantity=Math.max(1,Math.floor(c.shares*percent/100));if(quantity>freeFloat(s,c))return bad('So viele Anteile sind nicht mehr verfügbar.');
  const fair=companyValue(s,c)/c.shares,threshold=fair*(c.owner==='legacy'?1.18:1.05)*(terms==='sellerLoan'?1.08:1),required=threshold*quantity;
  c.offer={quantity,price,terms,accepted:price>=required,counter:required,expires:s.elapsed+3*DAY};
  return good(price>=required?'Eigentümer akzeptiert. Das Angebot kann jetzt abgeschlossen werden.':`Gegenangebot: ${Math.ceil(required).toLocaleString('de-DE')} €. ${c.owner==='legacy'?'Der Gründer verlangt eine Kontrollprämie.':'Der Eigentümer bevorzugt eine sichere Auszahlung.'}`);
}
export function acceptOffer(s,id){
  const c=company(s,id),o=c?.offer;if(!o||!o.accepted||o.expires<s.elapsed)return bad('Kein gültiges angenommenes Angebot.');if(o.quantity>freeFloat(s,c))return bad('Der angebotene Anteil ist inzwischen nicht mehr verfügbar.');
  if(o.terms==='sellerLoan'&&s.group.payables.length>=20)return bad('Maximal 20 offene Verkäuferfinanzierungen.');
  const upfront=o.terms==='sellerLoan'?o.price*.5:o.price,fee=o.price*.005;if(s.cash<upfront+fee)return bad('Sofortzahlung und Kaufgebühr fehlen.');
  s.cash-=upfront+fee;s.stocks[id].quantity+=o.quantity;s.stocks[id].basis+=o.price+fee;if(o.terms==='sellerLoan')s.group.payables.push({id:s.group.nextId++,amount:o.price*.5,due:s.elapsed+10*DAY});
  c.offer=null;E.log(s,`${c.name}: ${Math.round(ownership(s,c)*100)} % der Stimmrechte erworben.${controlled(s,c)?' Die Unternehmensführung liegt jetzt bei deiner Holding.':''}`,'finance');return good('Beteiligung erworben.');
}
export function buyRemaining(s,id){const c=company(s,id);if(!c||!controlled(s,c))return bad('Eine Mehrheit ist erforderlich.');const quantity=freeFloat(s,c);if(quantity<1)return bad('Die Firma gehört bereits vollständig zur Holding.');return !c.world?tradeOwnShares(s,id,quantity,'buy'):c.listed?corporateTrade(s,id,quantity,'buy'):offerPrivate(s,id,quantity/c.shares*100,companyValue(s,c)*quantity/c.shares*1.2,'cash');}
export function loanQuote(s,id){const c=company(s,id);if(!c)return null;const a=companyBalance(s,c),limit=Math.max(0,a.buildings*.45+a.properties*.5+a.inventory*.2-a.debt),rate=.0045+Math.min(.006,a.debt/Math.max(1,a.buildings+a.properties)*.004);return {limit,rate};}
export function lendToCompany(s,id,value,lender='holding',kind='loan'){
  const c=company(s,id),source=lender==='holding'?s:company(s,lender)&&controlled(s,company(s,lender))?scopeCompany(s,lender):null;
  if(!c||!source||id===lender||!['loan','bond'].includes(kind)||!amount(value)||value>source.cash||s.group.loans.length>=20)return bad('Prüfe zwei unterschiedliche Unternehmen, verfügbares Kapital und maximal 20 Finanzierungen.');
  const q=loanQuote(s,id);if(value>q.limit)return bad('Die freien Sicherheiten reichen für diese Finanzierung nicht aus.');
  const rate=q.rate+(kind==='bond'?.001:0);source.cash-=value;c.state.cash+=value;s.group.loans.push({id:s.group.nextId++,lender,borrower:id,kind,principal:value,original:value,rate,next:s.elapsed+DAY,end:s.elapsed+(kind==='bond'?10:20)*DAY,missed:0});return good(`${kind==='bond'?'Anleihe gezeichnet':'Kredit vergeben'} zu ${(rate*100).toFixed(2)} % pro Spieltag. ${kind==='bond'?'Kapital in zehn Spieltagen fällig.':'Zins und 1/20 Tilgung werden täglich bedient.'}`);
}
export function repayCorporateLoan(s,id){
  const l=s.group.loans.find(l=>l.id===id),c=l&&company(s,l.borrower);if(!l||!c||!controlled(s,c)||c.state.cash<l.principal)return bad('Kontrolle über den Schuldner und ausreichend Firmenliquidität sind erforderlich.');
  const lender=l.lender==='holding'?s:company(s,l.lender)?.state;if(!lender)return bad('Gläubiger nicht gefunden.');c.state.cash-=l.principal;lender.cash+=l.principal;s.group.loans=s.group.loans.filter(x=>x!==l);return good('Firmenfinanzierung vollständig zurückgezahlt; Sicherheiten sind frei.');
}
export function createAgreement(s,{kind,from,to,resource,quantity,price,days=10}){
  if(!['supply','lease'].includes(kind)||from===to||![from,to].every(id=>id==='holding'||company(s,id)&&controlled(s,company(s,id)))||!Number.isInteger(quantity)||quantity<1||!amount(price)||!Number.isInteger(days)||days<1||days>60||s.group.agreements.length>=20)return bad('Prüfe zwei kontrollierte Firmen, Menge, Preis und Laufzeit.');
  if(kind==='supply'&&!Object.hasOwn(RESOURCES,resource)||kind==='lease'&&!Object.hasOwn(PROPERTIES,resource))return bad('Ware oder Immobilie nicht gefunden.');
  const landlord=scopeCompany(s,from);if(kind==='lease'&&landlord.properties[resource].count<leasedUnits(s,from,resource)+quantity)return bad('Keine freien Immobilien für diesen Mietvertrag.');
  const market=kind==='supply'?E.price(s,resource):PROPERTIES[resource].rent*.9;if(price<market*.8||price>market*1.2)return bad('Konzernverträge müssen innerhalb von 20 % des Marktpreises liegen.');
  s.group.agreements.push({id:s.group.nextId++,kind,from,to,resource,quantity,price,next:s.elapsed+DAY,end:s.elapsed+days*DAY,fulfilled:0,missed:0});return good('Konzernvertrag eingerichtet. Zahlung und Lieferung erfolgen einmal je Spieltag.');
}
export function cancelAgreement(s,id){const n=s.group.agreements.length;s.group.agreements=s.group.agreements.filter(a=>a.id!==id);return n!==s.group.agreements.length?good('Vertrag beendet.'):bad('Vertrag nicht gefunden.');}
export function syncPropertyMarkets(s){if(!s.group)return;for(const c of s.group.companies)for(const[id,p]of Object.entries(c.state.properties)){const market=s.properties[id];p.index=market.index;p.occupancy=market.occupancy;p.history=[...market.history];}}
const PROPERTY_USE={apartments:{workers:10},farmland:{farm:.1},industrial:{storage:500,transport:10},datacenter:{storage:2000,transport:40}};
export function leasedCapacity(account,metric){const s=root(account),id=account._firm?.id||'holding';return (s.group?.agreements||[]).filter(a=>a.kind==='lease'&&a.to===id&&a.end>=s.elapsed).reduce((n,a)=>n+a.quantity*(PROPERTY_USE[a.resource]?.[metric]||0),0);}
export function leasedUnits(s,id,property){return (s.group?.agreements||[]).filter(a=>a.kind==='lease'&&a.from===id&&a.resource===property&&a.end>=s.elapsed).reduce((n,a)=>n+a.quantity,0);}
export function liquidateCompany(s,id){
  const c=company(s,id);if(!c||c.world||!fullyOwned(s,c)||companyBalance(s,c).total>=0)return bad('Abwicklung ist für überschuldete, vollständig eigene Tochtergesellschaften möglich.');
  if(s.group.loans.some(l=>l.borrower===id||l.lender===id))return bad('Offene Firmenfinanzierungen müssen zuerst zurückgezahlt oder durch Sicherheitenverwertung abgewickelt werden.');
  s.group.agreements=s.group.agreements.filter(a=>a.from!==id&&a.to!==id);s.group.companies=s.group.companies.filter(x=>x!==c);E.log(s,`${c.name} abgewickelt. Vermögenswerte gehen an Gläubiger; die übrige Holding bleibt bestehen.`,'finance');return good('Überschuldete Tochter abgewickelt.');
}
export function mergeCompany(s,id){
  const c=company(s,id);if(!c||c.world||!fullyOwned(s,c))return bad('Nur vollständig eigene Neugründungen können mit der Holding verschmolzen werden.');
  if(s.group.agreements.some(a=>a.from===id||a.to===id)||s.group.loans.some(l=>l.borrower===id||l.lender===id)||c.state.options.length||c.state.contracts.length||c.state.orders.length)return bad('Beende zuerst Lieferungen, Finanzierungen und offene Positionen.');
  for(const[k,b]of Object.entries(c.state.buildings)){if(s.buildings[k].count+b.count>10000||b.count&&s.buildings[k].count&&b.level!==s.buildings[k].level)return bad('Betriebsgrenze oder unterschiedliche Ausbaustufen verhindern die Verschmelzung.');}
  for(const k of Object.keys(INFRA))if(s.infra[k]+c.state.infra[k]>10000)return bad('Infrastrukturgrenze überschritten.');
  for(const k of Object.keys(RESOURCES))if(s.inventory[k]+c.state.inventory[k]>E.warehouseCapacity(s))return bad('Die Holding benötigt mehr Lagerplatz.');
  if(s.loans.length+c.state.loans.length>5||s.bonds.length+c.state.bonds.length>30||s.ventures.length+c.state.ventures.length>12)return bad('Zu viele Finanzpositionen für die Holding.');
  for(const[k,p]of Object.entries(c.state.properties))if(s.properties[k].count+p.count>100000||p.count&&s.properties[k].count&&Math.abs(s.properties[k].index-p.index)>1e-9)return bad('Immobilienbestand oder Bewertung verhindern die Verschmelzung.');
  const v=c.state;s.cash+=v.cash;s.debt+=v.debt;
  for(const k of Object.keys(RESOURCES))s.inventory[k]+=v.inventory[k];for(const k of Object.keys(INFRA)){s.infra[k]+=v.infra[k];s.infraBook[k]+=v.infraBook[k];}
  for(const[k,b]of Object.entries(v.buildings)){const x=s.buildings[k];if(!x.count)x.level=b.level;x.count+=b.count;x.active+=b.active;x.book+=b.book;}
  for(const[k,p]of Object.entries(v.properties)){const x=s.properties[k];if(!x.count){x.index=p.index;x.occupancy=p.occupancy;}x.count+=p.count;x.basis+=p.basis;}
  for(const[k,p]of Object.entries(v.stocks)){s.stocks[k].quantity+=p.quantity;s.stocks[k].basis+=p.basis;s.stocks[k].reserve+=p.reserve;}
  for(const k of Object.keys(v.banks))s.banks[k]+=v.banks[k];for(const k of ['loans','bonds','ventures'])s[k].push(...v[k].map(x=>({...x,id:s.nextId++})));
  for(const k of Object.keys(v.stats))if(k!=='history'&&Number.isFinite(v.stats[k])&&k!=='peak')s.stats[k]+=v.stats[k];
  for(const ledger of ['dayLedger','hourLedger'])for(const k of Object.keys(v[ledger]))s[ledger][k]=(s[ledger][k]||0)+v[ledger][k];
  s.group.companies=s.group.companies.filter(x=>x!==c);return good('Tochtergesellschaft mit der Holding verschmolzen.');
}

function report(c,text){c.report.unshift(text);c.report=c.report.slice(0,6);}
function manageCompany(s,c){
  if(!c.ceo||s.elapsed-c.lastDecision<HOUR)return;c.lastDecision=s.elapsed;const b=scopeCompany(s,c.id),reserve=c.reserve*(c.ceo==='steward'?1.5:1);
  if((c.mandate==='debt'||c.ceo==='steward')&&b.debt>0){const payment=Math.min(b.debt,Math.max(0,b.cash-reserve));if(payment>0){E.repay(b,payment);report(c,`${Math.round(payment)} € Schulden getilgt.`);}return;}
  if(c.mandate==='reserve'||c.ceo==='financier'){const excess=Math.max(0,b.cash-reserve);if(excess>100){E.bankTransfer(b,'savings',excess,'deposit');report(c,`${Math.round(excess)} € Reserve auf Tagesgeld angelegt.`);}if(b.cash<reserve&&b.banks.savings>0)E.bankTransfer(b,'savings',Math.min(reserve-b.cash,b.banks.savings),'withdraw');return;}
  if(c.mandate!=='grow'||c.ceo!=='builder')return;
  let configured=false;for(const[id,d]of Object.entries(BUILDINGS))if(b.buildings[id].active){if(Object.keys(d.input).some(r=>b.automation[r].mode==='off')){E.setupSupplies(b,id);configured=true;}for(const r of Object.keys(d.output))if(b.automation[r].mode==='off'){b.automation[r]={mode:'sell',low:0,high:50};configured=true;}}if(configured)report(c,'Ein- und Verkauf für übernommene Produktionsstätten eingerichtet.');
  const budget=Math.min(c.budget-c.spent,b.cash-reserve);if(budget<=0){report(c,'Ausbau ausgesetzt: Reserve oder Investitionsbudget erreicht.');return;}
  const cap=E.capacity(b),shortage=cap.staffing<.95?'housing':cap.power<.95?'power':cap.logistics<.95?'transport':null;
  if(shortage){const q=E.buildQuote(b,shortage,1,true);if(q.total<=budget&&E.build(b,shortage,1,true).ok){c.spent+=q.total;report(c,`${INFRA[shortage].name} als Engpasslösung gebaut.`);}return;}
  if(c.focus==='property'){const id='apartments',cost=PROPERTIES[id].cost*b.properties[id].index*1.02;if(cost<=budget&&E.propertyTrade(b,id,1,'buy').ok){c.spent+=cost;report(c,'Ein Wohnhaus zur Vermietung erworben.');}return;}
  const choices=(FOCUS_BUILDINGS[c.focus]||[]).filter(id=>BUILDINGS[id].tier<=s.tier).map(id=>({id,q:E.buildQuote(b,id),margin:E.buildingRate(b,id).margin})).filter(x=>x.q.total<=budget&&x.margin>0).sort((a,b)=>b.margin/b.q.total-a.margin/a.q.total);
  const next=choices[0];if(next&&E.build(b,next.id).ok){c.spent+=next.q.total;E.setupSupplies(b,next.id);for(const r of Object.keys(BUILDINGS[next.id].output))if(b.automation[r].mode==='off')b.automation[r]={mode:'sell',low:0,high:50};report(c,`${BUILDINGS[next.id].name} gebaut; Ein- und Verkauf eingerichtet.`);}
}
function payCompanyDividend(s,c){
  if(c.lastDividend===s.elapsed)return;c.lastDividend=s.elapsed;const b=scopeCompany(s,c.id),profit=Math.max(0,c.lastDailyProfit),total=Math.min(profit*c.payout,Math.max(0,b.cash-c.reserve));if(total<=0)return;
  b.cash-=total;let internal=0;
  if(c.world){for(const account of books(s)){const p=account.stocks[c.id];if(!p?.quantity)continue;const gross=total*p.quantity/c.shares,tax=gross*(controlled(s,c)?0:.15),net=gross-tax;if(p.drip)p.reserve+=net;else account.cash+=net;account.stats.dividends+=net;account.stats.taxes+=tax;internal+=gross;}}
  else{s.cash+=total*c.held/c.shares;s.stats.dividends+=total*c.held/c.shares;internal=total*c.held/c.shares;}
  const ex=total/c.shares;c.price=Math.max(.01,c.price-ex);if(c.world)s.stocks[c.id].price=Math.max(.01,s.stocks[c.id].price-ex);report(c,`${Math.round(total)} € Dividende; ${Math.round(internal)} € an Konzerneigentümer.`);
}
export function tickGroup(s,offline=false){
  if(!s.group||s.elapsed%HOUR!==0)return;
  for(const c of s.group.companies){
    const b=scopeCompany(s,c.id);for(const id of Object.keys(STOCKS)){b.stocks[id].price=s.stocks[id].price;b.stocks[id].report={...s.stocks[id].report};}
    E.advanceBusiness(b,HOUR,offline&&controlled(s,c));manageCompany(s,c);
    if(s.elapsed%DAY===0){
      const revenue=b.stats.revenue+b.stats.rent+b.stats.interest+b.stats.dividends,costs=b.stats.expenses;
      const overhead=FORMS[c.form].daily+(c.ceo?CEOS[c.ceo].salary:0);const paid=Math.min(b.cash,overhead);b.cash-=paid;b.debt+=overhead-paid;b.stats.expenses+=overhead;b.dayLedger.costs+=overhead;
      c.lastDailyProfit=(revenue-c.previousRevenue)-(costs+overhead-c.previousCosts)-(fullyOwned(s,c)?Math.max(0,b.dayLedger.revenue-b.dayLedger.costs)*.12:(b.dayLedger.taxPaid||0));c.previousRevenue=revenue;c.previousCosts=costs+overhead;c.spent=0;payCompanyDividend(s,c);
    }
    c.price=c.world?s.stocks[c.id].price:companyValue(s,c)/c.shares;
  }
  for(const a of [...s.group.agreements]){
    if(a.next>s.elapsed)continue;
    if((a.from!=='holding'&&!controlled(s,company(s,a.from)))||(a.to!=='holding'&&!controlled(s,company(s,a.to)))){a.missed++;a.next+=DAY;continue;}
    const seller=scopeCompany(s,a.from),buyer=scopeCompany(s,a.to),cost=a.quantity*a.price,deliver=a.kind==='lease'||seller.inventory[a.resource]>=a.quantity;
    const room=a.kind==='lease'||buyer.inventory[a.resource]+a.quantity<=E.warehouseCapacity(buyer);
    if(deliver&&room&&buyer.cash>=cost){buyer.cash-=cost;seller.cash+=cost;buyer.stats.expenses+=cost;buyer.dayLedger.costs+=cost;buyer.hourLedger.costs+=cost;seller.stats.revenue+=cost;seller.dayLedger.revenue+=cost;seller.hourLedger.revenue+=cost;if(a.kind==='supply'){seller.inventory[a.resource]-=a.quantity;buyer.inventory[a.resource]+=a.quantity;}a.fulfilled++;}
    else a.missed++;a.next+=DAY;
    if(a.end<=s.elapsed)s.group.agreements=s.group.agreements.filter(x=>x!==a);
  }
  for(const l of [...s.group.loans]){
    if(l.next>s.elapsed)continue;const c=company(s,l.borrower),lender=l.lender==='holding'?s:company(s,l.lender)?.state;if(!c||!lender)continue;
    const b=c.state,interest=l.principal*l.rate,paid=Math.min(b.cash,interest);b.cash-=paid;b.stats.expenses+=interest;b.dayLedger.costs+=interest;b.hourLedger.costs+=interest;const internal=fullyOwned(s,c)&&(l.lender==='holding'||fullyOwned(s,company(s,l.lender))),tax=internal?0:paid*.15;lender.cash+=paid-tax;lender.stats.interest+=paid-tax;lender.stats.taxes+=tax;l.principal+=interest-paid;if(internal){lender.dayLedger.revenue+=interest;lender.hourLedger.revenue+=interest;}repriceTransfer(s,c,-interest);if(l.lender!=='holding')repriceTransfer(s,company(s,l.lender),interest-tax);
    const due=l.kind==='bond'?(l.end<=s.elapsed?l.principal:0):Math.min(l.principal,l.original/20),principal=Math.min(due,Math.max(0,b.cash-c.reserve));b.cash-=principal;lender.cash+=principal;l.principal-=principal;
    if(paid<interest||(l.kind==='bond'&&l.end<=s.elapsed&&principal<due)){l.missed++;report(c,'Finanzierung: Zahlung teilweise gestundet.');}else l.missed=0;l.next+=DAY;
    if(l.missed>=5){
      const before=companyBalance(s,c).total,claim=l.principal;let recovered=0;
      const collect=()=>{const paid=Math.min(l.principal,b.cash);b.cash-=paid;lender.cash+=paid;l.principal-=paid;recovered+=paid;};collect();
      const borrower=scopeCompany(s,c.id);
      for(const[id,owned]of Object.entries(b.buildings)){if(l.principal<=.001)break;if(!owned.count||!owned.book)continue;const count=Math.min(owned.count,Math.ceil(l.principal/(owned.book/owned.count*.45)));E.demolish(borrower,id,count);collect();}
      for(const[id,owned]of Object.entries(b.properties)){if(l.principal<=.001)break;if(!owned.count)continue;E.propertyTrade(borrower,id,Math.min(owned.count,Math.ceil(l.principal/(PROPERTIES[id].cost*owned.index*.97))),'sell');collect();}
      const loss=l.principal;l.principal=0;repriceTransfer(s,c,companyBalance(s,c).total-before);if(l.lender!=='holding')repriceTransfer(s,company(s,l.lender),-loss);
      E.log(s,`${c.name}: Sicherheiten verwertet, ${Math.round(recovered)} € zurückgewonnen; ${Math.round(claim-recovered)} € Forderungsverlust.`,'warning');
    }
    if(l.principal<.001)s.group.loans=s.group.loans.filter(x=>x!==l);
  }
  for(const p of [...s.group.payables])if(p.due<=s.elapsed){const paid=Math.min(s.cash,p.amount);s.cash-=paid;s.debt+=p.amount-paid;s.group.payables=s.group.payables.filter(x=>x!==p);E.log(s,'Verkäuferdarlehen fällig und bezahlt; Fehlbetrag gegebenenfalls ins Kontokorrent übernommen.','finance');}
  if(s.elapsed%DAY===0){
    const p=s.group.parent,fee=FORMS[p.form].daily,paid=Math.min(s.cash,fee);s.cash-=paid;s.debt+=fee-paid;s.stats.expenses+=fee;s.dayLedger.costs+=fee;
    const income=s.stats.revenue+s.stats.rent+s.stats.interest+s.stats.dividends,costs=s.stats.expenses;
    const available=Math.max(0,income-p.previousIncome-(costs-p.previousCosts)-(s.dayLedger.taxPaid||0));p.previousIncome=income;p.previousCosts=costs;
    if(p.payout>0){const total=Math.min(s.cash*.1,available*p.payout),own=total*p.held/p.shares,tax=own*.15;s.cash-=total;s.group.wallet+=own-tax;s.stats.taxes+=tax;p.lastDividend=s.elapsed;}
    p.price=Math.max(.01,E.assets(s).groupEquity/p.shares);
  }
}

export function normalizeGroup(s,raw,now){
  if(!raw||typeof raw!=='object')raw={};
  const defaults=s.group,seen=new Set(),result=[];
  const rows=Array.isArray(raw.companies)?raw.companies.slice(0,13):[];
  for(const r of rows){if(!r||!safeId(r.id)||seen.has(r.id)||!r.state||!r.state.buildings||!r.state.inventory)continue;const world=Object.hasOwn(STOCKS,r.id)&&r.id!=='index';if(!world&&!/^firm-\d+$/.test(r.id))continue;seen.add(r.id);
    const hydrated={...r.state,version:1,economyRevision:3,market:s.market,stats:r.state.stats||{},research:r.state.research||s.research,tier:Number.isFinite(r.state.tier)?r.state.tier:s.tier};
    const validated=E.validateGame(hydrated,now,false),state=Object.fromEntries(LOCAL.map(k=>[k,validated[k]]));
    if(world)for(const p of Object.values(state.stocks)){state.cash+=p.quantity*p.price*.995+p.reserve;p.quantity=0;p.basis=0;p.reserve=0;p.drip=false;}
    const c=record(r.id,word(r.name),Object.hasOwn(FOCUSES,r.focus)?r.focus:'mixed',state,{world});
    c.form=Object.hasOwn(FORMS,r.form)?r.form:'gmbh';c.listed=c.form==='ag'&&r.listed===true;c.shares=Math.max(1,Math.floor(number(r.shares,10000,1e9)));c.held=world?0:Math.floor(number(r.held,c.shares,c.shares));c.price=Math.max(.01,number(r.price,1));c.payout=number(r.payout,.25,1);c.mandate=Object.hasOwn(MANDATES,r.mandate)?r.mandate:'reserve';c.reserve=Math.max(100,number(r.reserve,500,1e12));c.budget=number(r.budget,2000,1e12);c.ceo=Object.hasOwn(CEOS,r.ceo)?r.ceo:null;
    for(const k of ['spent','lastDecision','lastDividend','previousRevenue','previousCosts'])c[k]=number(r[k]);c.lastIssue=typeof r.lastIssue==='number'&&Number.isFinite(r.lastIssue)?Math.max(-5*DAY,Math.min(s.elapsed,r.lastIssue)):-5*DAY;c.lastDailyProfit=typeof r.lastDailyProfit==='number'&&Number.isFinite(r.lastDailyProfit)?Math.max(-1e100,Math.min(1e100,r.lastDailyProfit)):0;
    c.report=Array.isArray(r.report)?r.report.filter(x=>typeof x==='string').slice(0,6).map(x=>x.slice(0,300)):[];c.inspected=r.inspected===true;if(world)c.owner=r.owner==='legacy'?'legacy':'liquidity';
    const o=r.offer;if(world&&o&&Number.isInteger(o.quantity)&&o.quantity>0&&o.quantity<=c.shares&&amount(o.price)&&amount(o.counter)&&['cash','sellerLoan'].includes(o.terms)&&Number.isFinite(o.expires))c.offer={quantity:o.quantity,price:o.price,terms:o.terms,accepted:o.accepted===true&&o.price>=o.counter,counter:o.counter,expires:Math.max(0,Math.min(s.elapsed+3*DAY,o.expires))};
    result.push(c);
  }
  for(const c of defaults.companies)if(!seen.has(c.id))result.push(c);
  defaults.companies=result;defaults.nextId=Math.max(1,Math.floor(number(raw.nextId,1,1e12)),...result.filter(c=>!c.world).map(c=>Number(c.id.slice(5))+1));defaults.wallet=number(raw.wallet);
  const p=raw.parent||{},d=defaults.parent;d.form=Object.hasOwn(FORMS,p.form)?p.form:'sole';d.listed=d.form==='ag'&&p.listed===true;d.shares=Math.max(1,Math.floor(number(p.shares,10000,1e9)));d.held=Math.floor(number(p.held,d.shares,d.shares));d.payout=number(p.payout,0,1);d.price=Math.max(.01,number(p.price,1));d.lastIssue=typeof p.lastIssue==='number'&&Number.isFinite(p.lastIssue)?Math.max(-5*DAY,Math.min(s.elapsed,p.lastIssue)):-5*DAY;d.lastDividend=number(p.lastDividend);d.previousIncome=number(p.previousIncome,s.stats.revenue+s.stats.rent+s.stats.interest+s.stats.dividends);d.previousCosts=number(p.previousCosts,s.stats.expenses);if(d.form==='sole'){d.held=d.shares;d.listed=false;}
  defaults.loans=(Array.isArray(raw.loans)?raw.loans:[]).filter(l=>l&&company(s,l.borrower)&&amount(l.principal)&&amount(l.original)).slice(0,20).map(l=>({id:Math.floor(number(l.id,1,1e12)),lender:l.lender==='holding'||company(s,l.lender)?l.lender:'holding',borrower:l.borrower,kind:l.kind==='bond'?'bond':'loan',principal:number(l.principal),original:number(l.original),rate:number(l.rate,.006,.02),next:number(l.next,s.elapsed+DAY,s.elapsed+DAY),end:number(l.end,s.elapsed+20*DAY,s.elapsed+60*DAY),missed:Math.floor(number(l.missed,0,5))}));
  defaults.payables=(Array.isArray(raw.payables)?raw.payables:[]).filter(x=>x&&amount(x.amount)).slice(0,20).map(x=>({id:Math.floor(number(x.id,1,1e12)),amount:number(x.amount),due:number(x.due,s.elapsed+DAY,s.elapsed+10*DAY)}));
  defaults.agreements=(Array.isArray(raw.agreements)?raw.agreements:[]).filter(a=>a&&['supply','lease'].includes(a.kind)&&a.from!==a.to&&[a.from,a.to].every(id=>id==='holding'||company(s,id))&&Object.hasOwn(a.kind==='supply'?RESOURCES:PROPERTIES,a.resource)).slice(0,20).map(a=>({id:Math.floor(number(a.id,1,1e12)),kind:a.kind,from:a.from,to:a.to,resource:a.resource,quantity:Math.max(1,Math.floor(number(a.quantity,1,10000))),price:Math.max(.001,number(a.price,1,1e12)),next:number(a.next,s.elapsed+DAY,s.elapsed+DAY),end:number(a.end,s.elapsed+DAY,s.elapsed+60*DAY),fulfilled:Math.floor(number(a.fulfilled)),missed:Math.floor(number(a.missed))}));
  for(const account of books(s)){
    const index=account.stocks.index;if(index.quantity||index.reserve){account.cash+=index.price*index.quantity*.995+index.reserve;index.quantity=0;index.basis=0;index.reserve=0;index.drip=false;}
    account.savingsPlans=account.savingsPlans.filter(plan=>company(s,plan.stock)?.listed);
    for(const[id,p]of Object.entries(account.stocks))if(id!=='index'&&!company(s,id)?.listed&&p.drip){account.cash+=p.reserve;p.reserve=0;p.drip=false;}
  }
  for(const c of result.filter(c=>c.world)){let remaining=c.shares;for(const b of books(s)){const p=b.stocks[c.id],valid=Math.min(p.quantity,remaining);if(p.quantity>valid){const excess=p.quantity-valid;b.cash+=excess*p.price*.995;p.basis*=valid/p.quantity;p.quantity=valid;}remaining-=valid;}}
  if(!Array.isArray(raw.companies)){
    let compensation=0;
    for(const c of result.filter(c=>c.world)){const p=s.stocks[c.id],old=p.price,oldValue=p.quantity*old*.995;
      if(!c.listed){const fair=Math.max(.01,companyValue(s,c)/c.shares);p.price=fair;p.previous=fair;p.history=[fair];c.price=fair;if(old>0)p.basis*=Math.min(1,fair/old);}
      const value=p.price;compensation+=Math.max(0,oldValue-value*p.quantity);
    }
    if(compensation>0){s.cash+=compensation;E.log(s,`${Math.round(compensation)} € Wertausgleich für die Überführung synthetischer Aktien in echte Firmenanteile.`,'finance');}
  }

}
