export const VERSION = 1;
export const STEP = 5; // One simulated step is five real seconds.
export const HOUR = 60; // One economy hour takes one real minute.
export const DAY = 24 * HOUR;
export const OFFLINE_LIMIT = 7 * 86400;

export const RESOURCES = {
  wood: { name: 'Holz', icon: 'tree', base: 6, tier: 0, sector: 'raw' },
  stone: { name: 'Stein', icon: 'mountain', base: 8, tier: 0, sector: 'raw' },
  grain: { name: 'Getreide', icon: 'wheat', base: 5, tier: 0, sector: 'food' },
  water: { name: 'Wasser', icon: 'drop', base: 3, tier: 0, sector: 'food' },
  coal: { name: 'Kohle', icon: 'diamond', base: 12, tier: 1, sector: 'raw' },
  ore: { name: 'Eisenerz', icon: 'hexagon', base: 16, tier: 1, sector: 'raw' },
  cotton: { name: 'Baumwolle', icon: 'flower', base: 9, tier: 1, sector: 'consumer' },
  planks: { name: 'Bretter', icon: 'layers', base: 22, tier: 1, sector: 'industry' },
  bricks: { name: 'Ziegel', icon: 'brick', base: 28, tier: 1, sector: 'industry' },
  food: { name: 'Brot', icon: 'bread', base: 19, tier: 1, sector: 'food' },
  iron: { name: 'Eisen', icon: 'box', base: 55, tier: 2, sector: 'industry' },
  fabric: { name: 'Stoff', icon: 'grid', base: 35, tier: 2, sector: 'consumer' },
  glass: { name: 'Glas', icon: 'flask', base: 42, tier: 2, sector: 'industry' },
  tools: { name: 'Werkzeuge', icon: 'tool', base: 115, tier: 2, sector: 'industry' },
  steel: { name: 'Stahl', icon: 'beam', base: 155, tier: 3, sector: 'industry' },
  furniture: { name: 'Möbel', icon: 'chair', base: 125, tier: 3, sector: 'consumer' },
  chemicals: { name: 'Chemikalien', icon: 'flask', base: 110, tier: 3, sector: 'tech' },
  machines: { name: 'Maschinen', icon: 'gear', base: 680, tier: 4, sector: 'industry' },
  medicine: { name: 'Medikamente', icon: 'cross', base: 290, tier: 4, sector: 'tech' },
  electronics: { name: 'Elektronik', icon: 'chip', base: 520, tier: 4, sector: 'tech' },
  vehicles: { name: 'Fahrzeuge', icon: 'truck', base: 3300, tier: 5, sector: 'consumer' },
  chips: { name: 'Mikrochips', icon: 'cpu', base: 1850, tier: 5, sector: 'tech' },
  satellites: { name: 'Satelliten', icon: 'orbit', base: 18000, tier: 6, sector: 'tech' },
};

// Output and input are per economy hour (one real minute).
export const BUILDINGS = {
  lumber: { name: 'Holzfäller', icon: 'tree', tier: 0, cost: 320, staff: 2, wage: 9, output: { wood: 8 }, input: {}, energy: 0, freight: 1, pollution: 0.1, description: 'Der Anfang jeder Wertschöpfung.' },
  quarry: { name: 'Steinbruch', icon: 'mountain', tier: 0, cost: 480, staff: 3, wage: 12, output: { stone: 8 }, input: {}, energy: 0, freight: 1, pollution: 0.3 },
  farm: { name: 'Getreidehof', icon: 'wheat', tier: 0, cost: 380, staff: 2, wage: 8, output: { grain: 10 }, input: {}, energy: 0, freight: 1, pollution: 0.05 },
  well: { name: 'Wasserwerk', icon: 'drop', tier: 0, cost: 260, staff: 1, wage: 5, output: { water: 14 }, input: {}, energy: 0, freight: 0.5, pollution: 0 },
  coalMine: { name: 'Kohlegrube', icon: 'diamond', tier: 1, cost: 1600, staff: 5, wage: 30, output: { coal: 9 }, input: {}, energy: 1, freight: 2, pollution: 1.8, materials: { wood: 25, stone: 20 } },
  ironMine: { name: 'Erzmine', icon: 'hexagon', tier: 1, cost: 2200, staff: 6, wage: 38, output: { ore: 8 }, input: {}, energy: 1, freight: 2, pollution: 1.3, materials: { wood: 30, stone: 30 } },
  cottonFarm: { name: 'Baumwollfarm', icon: 'flower', tier: 1, cost: 1400, staff: 4, wage: 22, output: { cotton: 12 }, input: { water: 4 }, energy: 0, freight: 1, pollution: 0.1 },
  sawmill: { name: 'Sägewerk', icon: 'layers', tier: 1, cost: 1200, staff: 4, wage: 22, output: { planks: 6 }, input: { wood: 10 }, energy: 1, freight: 1, pollution: 0.3, materials: { wood: 20, stone: 10 } },
  kiln: { name: 'Ziegelei', icon: 'brick', tier: 1, cost: 1500, staff: 4, wage: 25, output: { bricks: 6 }, input: { stone: 10, water: 3 }, energy: 1, freight: 2, pollution: 0.6 },
  bakery: { name: 'Bäckerei', icon: 'bread', tier: 1, cost: 1100, staff: 3, wage: 19, output: { food: 8 }, input: { grain: 12, water: 4 }, energy: 1, freight: 1, pollution: 0.1 },
  smelter: { name: 'Eisenhütte', icon: 'box', tier: 2, cost: 6200, staff: 8, wage: 60, output: { iron: 7 }, input: { ore: 10, coal: 5 }, energy: 3, freight: 3, pollution: 2.5, materials: { bricks: 40, planks: 30 } },
  weaver: { name: 'Weberei', icon: 'grid', tier: 2, cost: 4800, staff: 7, wage: 48, output: { fabric: 10 }, input: { cotton: 15 }, energy: 2, freight: 2, pollution: 0.5 },
  glassworks: { name: 'Glashütte', icon: 'flask', tier: 2, cost: 5800, staff: 6, wage: 50, output: { glass: 8 }, input: { stone: 12, coal: 5 }, energy: 3, freight: 2, pollution: 1.4 },
  toolmaker: { name: 'Werkzeugbau', icon: 'tool', tier: 2, cost: 8800, staff: 8, wage: 68, output: { tools: 5 }, input: { iron: 5, planks: 5 }, energy: 3, freight: 2, pollution: 0.6, materials: { iron: 20, bricks: 40 } },
  steelworks: { name: 'Stahlwerk', icon: 'beam', tier: 3, cost: 32000, staff: 16, wage: 160, output: { steel: 8 }, input: { iron: 12, coal: 8 }, energy: 8, freight: 5, pollution: 4.5, materials: { tools: 30, bricks: 80 } },
  carpenter: { name: 'Möbelmanufaktur', icon: 'chair', tier: 3, cost: 24000, staff: 12, wage: 120, output: { furniture: 8 }, input: { planks: 18, fabric: 8 }, energy: 4, freight: 4, pollution: 0.5 },
  refinery: { name: 'Chemiewerk', icon: 'flask', tier: 3, cost: 38000, staff: 14, wage: 135, output: { chemicals: 11 }, input: { coal: 14, water: 18 }, energy: 7, freight: 4, pollution: 3.5, materials: { iron: 60, glass: 30 } },
  machineworks: { name: 'Maschinenbau', icon: 'gear', tier: 4, cost: 185000, staff: 28, wage: 380, output: { machines: 5 }, input: { steel: 10, tools: 8 }, energy: 12, freight: 7, pollution: 1.8, materials: { steel: 80, tools: 60 } },
  pharma: { name: 'Pharmalabor', icon: 'cross', tier: 4, cost: 165000, staff: 24, wage: 360, output: { medicine: 12 }, input: { chemicals: 14, glass: 10, water: 12 }, energy: 10, freight: 4, pollution: 1.2 },
  electronics: { name: 'Elektronikwerk', icon: 'chip', tier: 4, cost: 220000, staff: 30, wage: 450, output: { electronics: 8 }, input: { iron: 10, glass: 10, chemicals: 8 }, energy: 14, freight: 5, pollution: 1.1 },
  automaker: { name: 'Fahrzeugwerk', icon: 'truck', tier: 5, cost: 1450000, staff: 65, wage: 1450, output: { vehicles: 4 }, input: { steel: 22, machines: 6, electronics: 6, fabric: 8 }, energy: 28, freight: 14, pollution: 3, materials: { machines: 40, steel: 150 } },
  foundry: { name: 'Chipfabrik', icon: 'cpu', tier: 5, cost: 1900000, staff: 60, wage: 1700, output: { chips: 8 }, input: { electronics: 12, chemicals: 16, water: 40 }, energy: 35, freight: 8, pollution: 2, materials: { machines: 60, glass: 100 } },
  aerospace: { name: 'Raumfahrtzentrum', icon: 'orbit', tier: 6, cost: 18000000, staff: 160, wage: 6800, output: { satellites: 3 }, input: { chips: 10, machines: 8, steel: 30, electronics: 15 }, energy: 80, freight: 25, pollution: 4, materials: { vehicles: 30, chips: 100, machines: 100 } },
};

export const TIERS = [
  { name: 'Gründung', wealth: 0, icon: 'seed' },
  { name: 'Handwerk', wealth: 2000, icon: 'tool' },
  { name: 'Industrie', wealth: 15000, icon: 'factory' },
  { name: 'Expansion', wealth: 90000, icon: 'globe' },
  { name: 'Technologie', wealth: 600000, icon: 'chip' },
  { name: 'Konzern', wealth: 4000000, icon: 'building' },
  { name: 'Orbitalwirtschaft', wealth: 30000000, icon: 'orbit' },
];

export const INFRA = {
  housing: { name: 'Wohnquartier', icon: 'home', cost: 600, growth: 1.2, description: '+20 Arbeitskräfte', tier: 0 },
  warehouse: { name: 'Lagerhalle', icon: 'archive', cost: 750, growth: 1.24, description: '+500 Lagerplätze je Ressource', tier: 0 },
  transport: { name: 'Logistikzentrum', icon: 'truck', cost: 1600, growth: 1.23, description: '+20 Transportkapazität', tier: 1 },
  power: { name: 'Kraftwerk', icon: 'bolt', cost: 1800, growth: 1.22, description: '+25 Energie · benötigt 4 Kohle/h', tier: 1 },
  solar: { name: 'Solarpark', icon: 'sun', cost: 18000, growth: 1.2, description: '+20 Energie · keine Brennstoffe', tier: 2 },
  lab: { name: 'Forschungsinstitut', icon: 'flask', cost: 5000, growth: 1.28, description: '+1 Forschungspunkt/h · kostet 10 €/h', tier: 1 },
  park: { name: 'Grüngürtel', icon: 'leaf', cost: 5000, growth: 1.2, description: '−8 Umweltbelastung', tier: 2 },
};

export const RESEARCH = {
  forestry: { name: 'Nachhaltige Forstwirtschaft', description: 'Holzfäller produzieren 20 % mehr.', cost: 20, money: 1500, max: 5, tier: 1, icon: 'tree' },
  agronomy: { name: 'Agrarwissenschaft', description: 'Getreide und Baumwolle +20 % je Stufe.', cost: 25, money: 1800, max: 5, tier: 1, icon: 'wheat' },
  efficiency: { name: 'Prozessoptimierung', description: 'Alle Betriebe: +8 % Produktion je Stufe.', cost: 45, money: 4500, max: 10, tier: 2, icon: 'gear' },
  automation: { name: 'Automatisierung', description: '−8 % Personalbedarf je Stufe.', cost: 65, money: 8000, max: 6, tier: 2, icon: 'chip' },
  logistics: { name: 'Intelligente Logistik', description: '+20 % Transport, +10 % Lager je Stufe.', cost: 35, money: 3500, max: 8, tier: 1, icon: 'truck' },
  finance: { name: 'Finanzmathematik', description: '−10 % Handelsgebühren, +5 % Sparzins je Stufe.', cost: 60, money: 6000, max: 6, tier: 2, icon: 'chart' },
  energy: { name: 'Energietechnik', description: '+15 % Energieausbeute je Stufe.', cost: 75, money: 12000, max: 8, tier: 2, icon: 'bolt' },
  ecology: { name: 'Kreislaufwirtschaft', description: '−12 % Umweltbelastung je Stufe.', cost: 100, money: 25000, max: 6, tier: 3, icon: 'leaf' },
  computing: { name: 'Quantenprozesse', description: 'Technologiebetriebe produzieren 15 % mehr.', cost: 350, money: 180000, max: 8, tier: 4, icon: 'cpu' },
  patience: { name: 'Autonome Verwaltung', description: '+10 % Produktion während der Abwesenheit.', cost: 200, money: 65000, max: 5, tier: 3, icon: 'clock' },
};

export const STOCKS = {
  sylva: { name: 'SYLVA', full: 'Sylva Rohstoffe', sector: 'raw', base: 42, volatility: 0.025, dividend: 0.0008, description: 'Holz, Erz und Kohle. Zyklisch.' },
  terra: { name: 'TERRA', full: 'Terra Lebensmittel', sector: 'food', base: 65, volatility: 0.015, dividend: 0.001, description: 'Defensive Grundversorgung.' },
  ferrum: { name: 'FERRUM', full: 'Ferrum Industrie', sector: 'industry', base: 120, volatility: 0.028, dividend: 0.0007, description: 'Industrie und Infrastruktur.' },
  forma: { name: 'FORMA', full: 'Forma Konsum', sector: 'consumer', base: 85, volatility: 0.022, dividend: 0.0009, description: 'Konsumgüter und Mobilität.' },
  nova: { name: 'NOVA', full: 'Nova Technologies', sector: 'tech', base: 210, volatility: 0.045, dividend: 0.00025, description: 'Wachstum mit großen Schwankungen.' },
  index: { name: 'NULL 5', full: 'Breiter Marktindex', sector: 'all', base: 100, volatility: 0.011, dividend: 0.00065, description: 'Gleichgewichteter Korb aller fünf Aktien.' },
};

export const BANKS = {
  reserve: { name: 'Reservekonto', icon: 'shield', rate: 0.0006, description: 'Jederzeit verfügbar. Fester Zins.' },
  savings: { name: 'Tagesgeld', icon: 'bank', rate: 0.001, description: 'Variabler Zins. Jederzeit verfügbar.' },
};
export const BONDS = {
  state: { name: 'Staatsanleihe', days: 10, rate: 0.0015, risk: 0, min: 1000, description: '10 Spieltage · garantierte Rückzahlung' },
  municipal: { name: 'Infrastrukturanleihe', days: 30, rate: 0.0025, risk: 0.02, min: 2500, description: '30 Spieltage · 2 % Ausfallrisiko (40 % Rückzahlung)' },
  corporate: { name: 'Unternehmensanleihe', days: 60, rate: 0.0045, risk: 0.08, min: 5000, description: '60 Spieltage · 8 % Ausfallrisiko (20 % Rückzahlung)' },
};
export const VENTURES = {
  trade: { name: 'Handelsexpedition', icon: 'compass', duration: 3600, min: 1500, success: 0.72, multiple: 1.45, recovery: 0.55, tier: 1, description: '1 echte Stunde · 72 % Chance auf 1,45× · sonst 0,55×' },
  startup: { name: 'Tech-Startup', icon: 'rocket', duration: 14400, min: 15000, success: 0.45, multiple: 2.8, recovery: 0.15, tier: 2, description: '4 echte Stunden · 45 % Chance auf 2,8× · sonst 0,15×' },
  frontier: { name: 'Tiefsee-Exploration', icon: 'waves', duration: 43200, min: 150000, success: 0.30, multiple: 4.5, recovery: 0.05, tier: 4, description: '12 echte Stunden · 30 % Chance auf 4,5× · sonst 0,05×' },
  orbital: { name: 'Asteroiden-Mission', icon: 'orbit', duration: 86400, min: 2000000, success: 0.18, multiple: 8, recovery: 0, tier: 5, description: '24 echte Stunden · 18 % Chance auf 8× · sonst Totalverlust' },
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
