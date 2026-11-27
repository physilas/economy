export const VERSION = 1;
export const RELEASE = '3.0.0';
export const STEP = 0.5; // Two real simulation steps per second; hourly rates stay unchanged.
export const HOUR = 60; // One economy hour takes one real minute.
export const DAY = 24 * HOUR;
export const OFFLINE_LIMIT = 7 * 86400;

export const RESOURCES = {
  wood: { name: 'Holz', icon: 'tree', base: 6, tier: 0, sector: 'raw' },
  stone: { name: 'Stein', icon: 'mountain', base: 8, tier: 0, sector: 'raw' },
  grain: { name: 'Getreide', icon: 'wheat', base: 5, tier: 0, sector: 'food' },
  ore: { name: 'Eisenerz', icon: 'hexagon', base: 16, tier: 1, sector: 'raw' },
  planks: { name: 'Bretter', icon: 'layers', base: 22, tier: 1, sector: 'industry' },
  bricks: { name: 'Ziegel', icon: 'brick', base: 28, tier: 1, sector: 'industry' },
  food: { name: 'Brot', icon: 'bread', base: 19, tier: 1, sector: 'food' },
  iron: { name: 'Eisen', icon: 'box', base: 55, tier: 2, sector: 'industry' },
  tools: { name: 'Werkzeuge', icon: 'tool', base: 115, tier: 2, sector: 'industry' },
  furniture: { name: 'Möbel', icon: 'chair', base: 125, tier: 2, sector: 'consumer' },
};

// Exact base recipes per economy hour (one real minute). Power-of-two batches
// give every complete chain whole-number factory ratios without rounding.
export const BUILDINGS = {
  lumber: { name: 'Holzfäller', icon: 'tree', tier: 0, cost: 320, staff: 2, wage: 9, output: { wood: 8 }, input: {}, energy: 0, freight: 1, pollution: 0.1, description: 'Der Anfang jeder Wertschöpfung.' },
  quarry: { name: 'Steinbruch', icon: 'mountain', tier: 0, cost: 480, staff: 3, wage: 12, output: { stone: 8 }, input: {}, energy: 0, freight: 1, pollution: 0.3 },
  farm: { name: 'Getreidehof', icon: 'wheat', tier: 0, cost: 380, staff: 2, wage: 8, output: { grain: 8 }, input: {}, energy: 0, freight: 1, pollution: 0.05 },
  ironMine: { name: 'Erzmine', icon: 'hexagon', tier: 1, cost: 2200, staff: 6, wage: 38, output: { ore: 8 }, input: {}, energy: 1, freight: 2, pollution: 1.3, materials: { wood: 30, stone: 30 } },
  sawmill: { name: 'Sägewerk', icon: 'layers', tier: 1, cost: 1200, staff: 4, wage: 22, output: { planks: 8 }, input: { wood: 16 }, energy: 1, freight: 1, pollution: 0.3, materials: { wood: 20, stone: 10 } },
  kiln: { name: 'Ziegelei', icon: 'brick', tier: 1, cost: 1500, staff: 4, wage: 25, output: { bricks: 8 }, input: { stone: 16 }, energy: 1, freight: 2, pollution: 0.6 },
  bakery: { name: 'Bäckerei', icon: 'bread', tier: 1, cost: 1100, staff: 3, wage: 19, output: { food: 8 }, input: { grain: 16 }, energy: 1, freight: 1, pollution: 0.1 },
  smelter: { name: 'Eisenhütte', icon: 'box', tier: 2, cost: 6200, staff: 8, wage: 60, output: { iron: 8 }, input: { ore: 16 }, energy: 3, freight: 3, pollution: 2.5, materials: { bricks: 40, planks: 30 } },
  toolmaker: { name: 'Werkzeugbau', icon: 'tool', tier: 2, cost: 8800, staff: 8, wage: 68, output: { tools: 8 }, input: { iron: 8, planks: 8 }, energy: 3, freight: 2, pollution: 0.6, materials: { iron: 20, bricks: 40 } },
  carpenter: { name: 'Möbelmanufaktur', icon: 'chair', tier: 2, cost: 12000, staff: 12, wage: 80, output: { furniture: 8 }, input: { planks: 24 }, energy: 4, freight: 4, pollution: 0.5 },
};

export const TIERS = [
  {name:'Gründung',wealth:0,icon:'seed'},
  {name:'Handwerk',wealth:2000,icon:'tool'},
  {name:'Unternehmensgruppe',wealth:15000,icon:'factory'},
  {name:'Holding',wealth:50000,icon:'building'},
];

export const INFRA = {
  housing: { name: 'Wohnquartier', icon: 'home', cost: 600, growth: 1.2, description: '+20 Arbeitskräfte', tier: 0,provides:{workers:20} },
  warehouse: { name: 'Lagerhalle', icon: 'archive', cost: 750, growth: 1.24, description: '+500 Lagerplätze je Ressource', tier: 0,provides:{storage:500} },
  transport: { name: 'Logistikzentrum', icon: 'truck', cost: 1600, growth: 1.23, description: '+20 Transportkapazität', tier: 1,provides:{transport:20} },
  power: { name: 'Kraftwerk', icon: 'bolt', cost: 1800, growth: 1.22, description: '+25 Energie · kostet bis zu 12 €/h', tier: 1,provides:{energy:25},utility:true },
  solar: { name: 'Solarpark', icon: 'sun', cost: 18000, growth: 1.2, description: '+20 Energie · keine Brennstoffe', tier: 2,provides:{energy:20},renewable:true },
  lab: { name: 'Forschungsinstitut', icon: 'flask', cost: 5000, growth: 1.28, description: '+1 Forschungspunkt/h · kostet 10 €/h', tier: 1,provides:{research:1} },
  park: { name: 'Grüngürtel', icon: 'leaf', cost: 5000, growth: 1.2, description: '−8 Umweltbelastung', tier: 2,provides:{cleanup:8} },
};

export const RESEARCH = {
  forestry: { name: 'Nachhaltige Forstwirtschaft', description: 'Holzfäller produzieren 20 % mehr.', cost: 20, money: 1500, max: 5, tier: 1, icon: 'tree' },
  agronomy: { name: 'Agrarwissenschaft', description: 'Getreide +20 % je Stufe.', cost: 25, money: 1800, max: 5, tier: 1, icon: 'wheat' },
  efficiency: { name: 'Prozessoptimierung', description: 'Alle Betriebe: +8 % Produktion je Stufe.', cost: 45, money: 4500, max: 10, tier: 2, icon: 'gear' },
  automation: { name: 'Automatisierung', description: '−8 % Personalbedarf je Stufe.', cost: 65, money: 8000, max: 6, tier: 2, icon: 'chip' },
  logistics: { name: 'Intelligente Logistik', description: '+20 % Transport, +10 % Lager je Stufe.', cost: 35, money: 3500, max: 8, tier: 1, icon: 'truck' },
  finance: { name: 'Finanzmathematik', description: '−10 % Handelsgebühren, +5 % Sparzins je Stufe.', cost: 60, money: 6000, max: 6, tier: 2, icon: 'chart' },
  energy: { name: 'Energietechnik', description: '+15 % Energieausbeute je Stufe.', cost: 75, money: 12000, max: 8, tier: 2, icon: 'bolt' },
  ecology: { name: 'Kreislaufwirtschaft', description: '−12 % Umweltbelastung je Stufe.', cost: 100, money: 25000, max: 6, tier: 3, icon: 'leaf' },
  patience: { name: 'Autonome Verwaltung', description: '+10 % Produktion während der Abwesenheit.', cost: 200, money: 65000, max: 5, tier: 3, icon: 'clock' },
};

export const STOCKS = {
  sylva: { name: 'SYLVA', full: 'Sylva Rohstoffe', sector: 'raw', base: 42, volatility: 0.025, dividend: 0.0008, description: 'Forstbetriebe und Sägewerke. Börsennotiert.' },
  terra: { name: 'TERRA', full: 'Terra Lebensmittel', sector: 'food', base: 65, volatility: 0.015, dividend: 0.001, description: 'Defensive Grundversorgung.' },
  ferrum: { name: 'FERRUM', full: 'Ferrum Industrie', sector: 'industry', base: 120, volatility: 0.028, dividend: 0.0007, description: 'Industrie und Infrastruktur.' },
  forma: { name: 'FORMA', full: 'Forma Konsum', sector: 'consumer', base: 85, volatility: 0.022, dividend: 0.0009, description: 'Konsumgüter und Mobilität.' },
  nova: { name: 'NOVA', full: 'Nova Immobilien', sector: 'consumer', base: 210, volatility: 0.045, dividend: 0.00025, description: 'Wohnhäuser und Gewerbe. Privat geführt.' },
  index: { name: 'NULL 5', full: 'Breiter Marktindex', sector: 'all', base: 100, volatility: 0.011, dividend: 0.00065, description: 'Gleichgewichteter Korb aller fünf Aktien.' },
};

export const BANKS = {
  reserve: { name: 'Reservekonto', icon: 'shield', rate: 0.0018, description: 'Jederzeit verfügbar. Fester Zins.' },
  savings: { name: 'Tagesgeld', icon: 'bank', rate: 0.0025, description: 'Variabler Zins. Jederzeit verfügbar.' },
};
export const BONDS = {
  state: { name: 'Staatsanleihe', days: 10, rate: 0.0032, risk: 0, min: 1000, description: '10 Spieltage · garantierte Rückzahlung' },
  municipal: { name: 'Infrastrukturanleihe', days: 30, rate: 0.0048, risk: 0.02, min: 2500, description: '30 Spieltage · 2 % Ausfallrisiko (40 % Rückzahlung)' },
  corporate: { name: 'Unternehmensanleihe', days: 60, rate: 0.007, risk: 0.08, min: 5000, description: '60 Spieltage · 8 % Ausfallrisiko (20 % Rückzahlung)' },
};
export const VENTURES = {
  trade: { name: 'Handelsexpedition', icon: 'compass', duration: 3600, min: 1500, success: 0.72, multiple: 1.45, recovery: 0.55, tier: 1, description: '1 echte Stunde · 72 % Chance auf 1,45× · sonst 0,55×' },
  startup: { name: 'Tech-Startup', icon: 'rocket', duration: 14400, min: 15000, success: 0.45, multiple: 2.8, recovery: 0.15, tier: 2, description: '4 echte Stunden · 45 % Chance auf 2,8× · sonst 0,15×' },
  frontier: { name: 'Industrieprojekt', icon: 'waves', duration: 43200, min: 150000, success: 0.30, multiple: 4.5, recovery: 0.05, tier: 2, description: '12 echte Stunden · 30 % Chance auf 4,5× · sonst 0,05×' },
  orbital: { name: 'Infrastrukturprojekt', icon: 'orbit', duration: 86400, min: 2000000, success: 0.18, multiple: 8, recovery: 0, tier: 3, description: '24 echte Stunden · 18 % Chance auf 8× · sonst Totalverlust' },
};

export const EVENTS = [
  { name: 'Bauboom', description: 'Neue Städte treiben die Nachfrage nach Baumaterial.', sector: 'industry', demand: 1.35, duration: 12, icon: 'building' },
  { name: 'Erntefest', description: 'Reiche Ernten drücken die Agrarpreise. Höhere landwirtschaftliche Ausbeute.', sector: 'food', demand: 0.75, farm: 1.3, duration: 10, icon: 'wheat' },
  { name: 'Kältewelle', description: 'Energie und Rohstoffe sind besonders gefragt.', sector: 'raw', demand: 1.4, duration: 8, icon: 'snow' },
  { name: 'Technologie-Euphorie', description: 'Technologiewerte und Elektronik stehen im Fokus.', sector: 'tech', demand: 1.4, duration: 10, icon: 'cpu' },
  { name: 'Lieferkettenkrise', description: 'Die verfügbare Transportkapazität sinkt um 25 %.', sector: 'industry', demand: 1.2, freight: 0.75, duration: 8, icon: 'truck' },
  { name: 'Konsumflaute', description: 'Haushalte sparen. Konsumgüter werden günstiger.', sector: 'consumer', demand: 0.7, duration: 12, icon: 'chart' },
  { name: 'Grüne Wende', description: 'Umweltabgaben steigen, erneuerbare Energie wird produktiver.', sector: 'tech', demand: 1.15, pollution: 1.5, solar: 1.3, duration: 10, icon: 'leaf' },
  { name: 'Weltausstellung', description: 'Die Nachfrage nach allen Gütern nimmt zu.', sector: 'all', demand: 1.18, duration: 8, icon: 'globe' },
];

export const ACHIEVEMENTS = [
  { id: 'firstBuild', name: 'Der erste Stein', description: 'Baue deinen ersten Betrieb.', reward: 150 },
  { id: 'firstTrade', name: 'Angebot & Nachfrage', description: 'Schließe deinen ersten Handel ab.', reward: 100 },
  { id: 'chain', name: 'Wertschöpfung', description: 'Besitze drei verschiedene Verarbeitungsbetriebe.', reward: 2500 },
  { id: 'ten', name: 'Arbeitgeber', description: 'Besitze zehn Produktionsstätten.', reward: 1500 },
  { id: 'research', name: 'Wissen ist Kapital', description: 'Schließe deine erste Forschung ab.', reward: 1000 },
  { id: 'invest', name: 'Zinseszins', description: 'Lege erstmals Geld bei einer Bank an.', reward: 250 },
  { id: 'contract', name: 'Verlässlich', description: 'Erfülle fünf Lieferaufträge.', reward: 5000 },
  { id: 'wealth100k', name: 'Sechsstellig', description: 'Erreiche 100.000 € Nettovermögen.', reward: 5000 },
  { id: 'million', name: 'Die erste Million', description: 'Erreiche 1 Million € Nettovermögen.', reward: 25000 },
  { id: 'green', name: 'Saubere Bilanz', description: 'Besitze fünf Solarparks und drei Grüngürtel.', reward: 20000 },
  { id: 'diverse', name: 'Diversifiziert', description: 'Halte alle fünf Einzelaktien.', reward: 1500 },
  { id: 'week', name: 'Langfristig', description: 'Lasse dein Unternehmen sieben echte Tage bestehen.', reward: 15000 },
  { id: 'space', name: 'Jenseits des Horizonts', description: 'Produziere deinen ersten Satelliten.', reward: 1000000 },
  { id: 'legacy', name: 'Ein neuer Anfang', description: 'Gründe eine neue Holding.', reward: 1000 },
];

export const POLICIES = {
  balanced: { name: 'Ausgewogen', output: 1, wage: 1, pollution: 1, description: 'Solide Produktion bei normalen Kosten.' },
  growth: { name: 'Wachstum', output: 1.22, wage: 1.4, pollution: 1.3, description: '+22 % Produktion · +40 % Löhne · +30 % Belastung' },
  lean: { name: 'Sparbetrieb', output: 0.8, wage: 0.65, pollution: 0.8, description: '−20 % Produktion · −35 % Löhne · −20 % Belastung' },
  green: { name: 'Nachhaltig', output: 0.94, wage: 1.08, pollution: 0.45, description: '−6 % Produktion · +8 % Löhne · −55 % Belastung' },
};

export const PROPERTIES = {
  apartments: { name: 'Vermietetes Wohnhaus', icon: 'building', tier: 2, cost: 22000, rent: 190, maintenance: 35, sector: 'consumer', description: 'Externe Vermietung. Stetige Mieten, konjunkturabhängiger Leerstand.' },
  farmland: { name: 'Pachtland', icon: 'wheat', tier: 2, cost: 60000, rent: 430, maintenance: 30, sector: 'food', description: 'Langfristige Pacht. Geringere Rendite, stabilere Auslastung.' },
  industrial: { name: 'Gewerbepark', icon: 'factory', tier: 3, cost: 125000, rent: 1120, maintenance: 180, sector: 'industry', description: 'Gewerbemieter reagieren stärker auf die Konjunktur.' },
  datacenter: { name: 'Logistikimmobilie', icon: 'truck', tier: 3, cost: 950000, rent: 8500, maintenance: 1600, sector: 'industry', description: 'Logistikmieten mit hohen Betriebskosten und schwankenden Bewertungen.' },
};

export const PROGRAMME_CHOICES={
  production:{name:'Produktion',icon:'factory',description:'Dauerhaft mehr Produktion in allen Betrieben. Vorproduktverbrauch steigt im selben Verhältnis.'},
  finance:{name:'Finanzen',icon:'bank',description:'Dauerhafter Zinsbonus auf Reservekonto und Tagesgeld. Bis 0,40 % vor Steuer pro Spieltag.'},
  logistics:{name:'Logistik',icon:'truck',description:'Dauerhaft mehr Transport und Lagerplatz aus sämtlichen Infrastrukturtypen.'},
};
export const PROGRAMMES=[
  {id:'identity',name:'Gemeinsame Dienste',tier:1,wealth:10000,cash:1500,points:10,materials:{planks:20},duration:600,bonus:{production:5,finance:15,logistics:10},brief:'Bündle Einkauf, Finanzierung oder Transport. Erste Konzernstrukturen in zehn echten Minuten.'},
  {id:'reliability',name:'Verlässlicher Verbund',tier:2,wealth:40000,cash:5000,points:40,materials:{iron:30,tools:20},duration:1800,bonus:{production:8,finance:20,logistics:15},brief:'Gemeinsame Systeme machen deine Tochterunternehmen belastbarer.'},
  {id:'borders',name:'Eigenständig wachsen',tier:3,wealth:150000,cash:20000,points:120,materials:{furniture:30,bricks:100},duration:3600,bonus:{production:10,finance:25,logistics:20},brief:'Ein funktionierender Konzern braucht Verantwortung und einen klaren Schwerpunkt.'},
];
export const CHAINS=[{name:'Holz & Wohnen',buildings:['lumber','sawmill','carpenter']},{name:'Ernährung',buildings:['farm','bakery']},{name:'Metall & Werkzeuge',buildings:['ironMine','smelter','toolmaker']},{name:'Baustoffe',buildings:['quarry','kiln']}];
