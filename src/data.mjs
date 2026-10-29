export const VERSION = 1;
export const RELEASE = '2.1.0';
export const STEP = 1; // One simulated step is one real second; production rates stay unchanged.
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
  polymers: { name:'Spezialpolymere',icon:'flask',base:800,tier:7,sector:'industry',depth:6000 },
  alloys: { name:'Hochleistungslegierungen',icon:'beam',base:3200,tier:7,sector:'industry',depth:6000 },
  robots: { name:'Industrieroboter',icon:'gear',base:9000,tier:7,sector:'tech',depth:6000 },
  cells: { name:'Fusionszellen',icon:'bolt',base:32000,tier:8,sector:'tech',depth:6000 },
  quantum: { name:'Quantenkerne',icon:'cpu',base:65000,tier:8,sector:'tech',depth:4000 },
  biotech: { name:'Biokomponenten',icon:'cross',base:24000,tier:8,sector:'tech',depth:6000 },
  nano: { name:'Nanomaterialien',icon:'hexagon',base:120000,tier:9,sector:'tech',depth:3000 },
  climate: { name:'Klimamodule',icon:'leaf',base:400000,tier:9,sector:'industry',depth:2000 },
  starships: { name:'Raumfrachter',icon:'rocket',base:3000000,tier:10,sector:'tech',depth:1500 },
  habitats: { name:'Wirtschaftshabitate',icon:'globe',base:6000000,tier:10,sector:'tech',depth:1500 },
  biospheres:{name:'Biosphären',icon:'leaf',base:18000000,tier:11,sector:'food',depth:1500},
  knowledge:{name:'Wissensarchive',icon:'book',base:24000000,tier:11,sector:'tech',depth:1500},
  colonies:{name:'Autonome Kolonien',icon:'globe',base:120000000,tier:11,sector:'tech',depth:1000},
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
  polymerworks:{name:'Polymerraffinerie',icon:'flask',tier:7,cost:12000000,staff:70,wage:4200,output:{polymers:40},input:{chemicals:80,coal:35,water:100},energy:60,freight:22,pollution:4.5,materials:{machines:80,steel:200}},
  alloyworks:{name:'Präzisionsmetallurgie',icon:'beam',tier:7,cost:25000000,staff:120,wage:7200,output:{alloys:20},input:{steel:180,chemicals:80,coal:50,water:100},energy:90,freight:35,pollution:7.5,materials:{machines:120,steel:500}},
  robotics:{name:'Robotikmanufaktur',icon:'gear',tier:7,cost:35000000,staff:100,wage:6000,output:{robots:8},input:{chips:10,machines:12,alloys:4,polymers:10},energy:80,freight:25,pollution:2,materials:{alloys:50,machines:100}},
  fusionworks:{name:'Fusionsfertigung',icon:'bolt',tier:8,cost:90000000,staff:180,wage:16000,output:{cells:6},input:{alloys:15,polymers:50,chemicals:160,water:300},energy:180,freight:50,pollution:2.2,materials:{alloys:150,robots:30}},
  quantumworks:{name:'Quantenfabrik',icon:'cpu',tier:8,cost:130000000,staff:160,wage:20000,output:{quantum:4},input:{chips:60,robots:6,glass:100,cells:1},energy:220,freight:35,pollution:1.8,materials:{robots:60,machines:300,glass:500}},
  bioreactor:{name:'Biokomplex',icon:'cross',tier:8,cost:100000000,staff:170,wage:18000,output:{biotech:12},input:{medicine:200,chemicals:200,cells:2,polymers:60,water:500},energy:160,freight:45,pollution:1.4,materials:{robots:40,glass:500}},
  nanoforge:{name:'Nanofertigung',icon:'hexagon',tier:9,cost:350000000,staff:300,wage:42000,output:{nano:5},input:{alloys:50,quantum:2,chemicals:300,cells:3},energy:400,freight:80,pollution:2.8,materials:{quantum:20,alloys:400}},
  climateworks:{name:'Klimasystembau',icon:'leaf',tier:9,cost:650000000,staff:420,wage:70000,output:{climate:3},input:{nano:4,robots:20,cells:6,machines:80,steel:300},energy:550,freight:120,pollution:1,materials:{robots:100,alloys:500}},
  shipyard:{name:'Interstellare Werft',icon:'rocket',tier:10,cost:2000000000,staff:800,wage:180000,output:{starships:1},input:{nano:8,quantum:6,robots:20,satellites:10,cells:10},energy:900,freight:220,pollution:3.5,materials:{nano:80,robots:100}},
  habitatworks:{name:'Habitatkonstruktion',icon:'globe',tier:10,cost:3000000000,staff:1000,wage:240000,output:{habitats:1},input:{starships:1,climate:2,nano:5,robots:20,steel:600,polymers:100},energy:1400,freight:350,pollution:4.5,materials:{starships:2,nano:100,robots:200}},
  biosphereworks:{name:'Biosphärengestaltung',icon:'leaf',tier:11,cost:12000000000,staff:2000,wage:900000,output:{biospheres:2},input:{habitats:1,climate:20,biotech:200,cells:60,water:3000},energy:2200,freight:600,pollution:1,materials:{habitats:8,climate:80,nano:500}},
  memoryworks:{name:'Wissensmanufaktur',icon:'book',tier:11,cost:18000000000,staff:1500,wage:1200000,output:{knowledge:1},input:{quantum:80,nano:40,cells:100,robots:200},energy:2800,freight:500,pollution:2,materials:{quantum:500,robots:1000,starships:5}},
  colonyworks:{name:'Koloniegründung',icon:'globe',tier:11,cost:35000000000,staff:4000,wage:4000000,output:{colonies:1},input:{habitats:4,biospheres:2,knowledge:1,starships:2,biotech:300},energy:4500,freight:1000,pollution:4,materials:{habitats:20,biospheres:4,knowledge:10}},
};

export const TIERS = [
  { name: 'Gründung', wealth: 0, icon: 'seed' },
  { name: 'Handwerk', wealth: 2000, icon: 'tool' },
  { name: 'Industrie', wealth: 15000, icon: 'factory' },
  { name: 'Expansion', wealth: 90000, icon: 'globe' },
  { name: 'Technologie', wealth: 600000, icon: 'chip' },
  { name: 'Konzern', wealth: 4000000, icon: 'building' },
  { name: 'Orbitalwirtschaft', wealth: 30000000, icon: 'orbit' },
  {name:'Systemindustrie',wealth:100000000,icon:'gear'},
  {name:'Fusionswirtschaft',wealth:400000000,icon:'bolt'},
  {name:'Planetare Wirtschaft',wealth:1500000000,icon:'globe'},
  {name:'Interstellare Wirtschaft',wealth:5000000000,icon:'rocket'},
  {name:'Autonome Ökonomien',wealth:25000000000,icon:'globe'},
];

export const INFRA = {
  housing: { name: 'Wohnquartier', icon: 'home', cost: 600, growth: 1.2, description: '+20 Arbeitskräfte', tier: 0,provides:{workers:20} },
  warehouse: { name: 'Lagerhalle', icon: 'archive', cost: 750, growth: 1.24, description: '+500 Lagerplätze je Ressource', tier: 0,provides:{storage:500} },
  transport: { name: 'Logistikzentrum', icon: 'truck', cost: 1600, growth: 1.23, description: '+20 Transportkapazität', tier: 1,provides:{transport:20} },
  power: { name: 'Kraftwerk', icon: 'bolt', cost: 1800, growth: 1.22, description: '+25 Energie · benötigt 4 Kohle/h', tier: 1,provides:{energy:25},fuel:true },
  solar: { name: 'Solarpark', icon: 'sun', cost: 18000, growth: 1.2, description: '+20 Energie · keine Brennstoffe', tier: 2,provides:{energy:20},renewable:true },
  lab: { name: 'Forschungsinstitut', icon: 'flask', cost: 5000, growth: 1.28, description: '+1 Forschungspunkt/h · kostet 10 €/h', tier: 1,provides:{research:1} },
  park: { name: 'Grüngürtel', icon: 'leaf', cost: 5000, growth: 1.2, description: '−8 Umweltbelastung', tier: 2,provides:{cleanup:8} },
  city:{name:'Metropolregion',icon:'building',cost:5000000,growth:1.18,description:'+500 Arbeitskräfte',tier:7,provides:{workers:500},materials:{steel:500,glass:300}},
  archive:{name:'Zentrallager',icon:'archive',cost:2000000,growth:1.18,description:'+20.000 Lagerplätze je Ressource',tier:7,provides:{storage:20000},materials:{machines:30,steel:200}},
  orbital:{name:'Orbitaler Solarverbund',icon:'sun',cost:12000000,growth:1.2,description:'+500 Energie ohne Brennstoffe',tier:7,provides:{energy:500},renewable:true,materials:{satellites:10,electronics:50,steel:100}},
  hub:{name:'Interkontinentalhafen',icon:'truck',cost:8000000,growth:1.18,description:'+500 Transportkapazität',tier:8,provides:{transport:500},materials:{robots:20,machines:100}},
  university:{name:'Forschungsuniversität',icon:'flask',cost:30000000,growth:1.22,description:'+25 Forschungspunkte/h · kostet 250 €/h',tier:8,provides:{research:25},materials:{quantum:5,robots:10}},
  reserve:{name:'Biosphärenreservat',icon:'leaf',cost:25000000,growth:1.18,description:'−200 Umweltbelastung',tier:8,provides:{cleanup:200}},
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
  systems:{name:'Supraleitende Netze',description:'+12 % Energieertrag je Stufe, zusätzlich zur Energietechnik.',cost:14000,money:8000000,max:5,tier:7,icon:'bolt'},
  science:{name:'Forschungsverbund',description:'+15 % Forschungspunkt-Erzeugung je Stufe.',cost:18000,money:40000000,max:5,tier:8,icon:'flask'},
};

export const STOCKS = {
  sylva: { name: 'SYLVA', full: 'Sylva Rohstoffe', sector: 'raw', base: 42, volatility: 0.025, dividend: 0.0008, description: 'Holz, Erz und Kohle. Zyklisch.' },
  terra: { name: 'TERRA', full: 'Terra Lebensmittel', sector: 'food', base: 65, volatility: 0.015, dividend: 0.001, description: 'Defensive Grundversorgung.' },
  ferrum: { name: 'FERRUM', full: 'Ferrum Industrie', sector: 'industry', base: 120, volatility: 0.028, dividend: 0.0007, description: 'Industrie und Infrastruktur.' },
  forma: { name: 'FORMA', full: 'Forma Konsum', sector: 'consumer', base: 85, volatility: 0.022, dividend: 0.0009, description: 'Konsumgüter und Mobilität.' },
  nova: { name: 'NOVA', full: 'Nova Technologies', sector: 'tech', base: 210, volatility: 0.045, dividend: 0.00025, description: 'Innovation mit großen Schwankungen.' },
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

export const PROPERTIES = {
  apartments: { name: 'Vermietetes Wohnhaus', icon: 'building', tier: 2, cost: 22000, rent: 190, maintenance: 35, sector: 'consumer', description: 'Externe Vermietung. Stetige Mieten, konjunkturabhängiger Leerstand.' },
  farmland: { name: 'Pachtland', icon: 'wheat', tier: 2, cost: 60000, rent: 430, maintenance: 30, sector: 'food', description: 'Langfristige Pacht. Geringere Rendite, stabilere Auslastung.' },
  industrial: { name: 'Gewerbepark', icon: 'factory', tier: 3, cost: 125000, rent: 1120, maintenance: 180, sector: 'industry', description: 'Gewerbemieter reagieren stärker auf die Konjunktur.' },
  datacenter: { name: 'Vermietetes Rechenzentrum', icon: 'cpu', tier: 4, cost: 950000, rent: 8500, maintenance: 1600, sector: 'tech', description: 'Technologiemieten mit hohen Betriebskosten und schwankenden Bewertungen.' },
};

export const PROGRAMME_CHOICES={
  production:{name:'Produktion',icon:'factory',description:'Dauerhaft mehr Produktion in allen Betrieben. Vorproduktverbrauch steigt im selben Verhältnis.'},
  finance:{name:'Finanzen',icon:'bank',description:'Dauerhafter Zinsbonus auf Reservekonto und Tagesgeld. Maximal 0,25 % vor Steuer pro Spieltag.'},
  logistics:{name:'Logistik',icon:'truck',description:'Dauerhaft mehr Transport und Lagerplatz aus sämtlichen Infrastrukturtypen.'},
};
const REAL_HOUR=3600;
export const PROGRAMMES=[
  {id:'identity',name:'Die eigene Handschrift',tier:3,wealth:90000,cash:25000,points:20,materials:{planks:60,tools:20},duration:6*REAL_HOUR,bonus:{production:4,finance:10,logistics:8},brief:'Dein Unternehmen wird größer als sein Gründer. Lege fest, welche Stärke es langfristig prägt.'},
  {id:'reliability',name:'Verlässliche Versorgung',tier:4,wealth:600000,cash:120000,points:150,materials:{iron:150,glass:100,food:200},duration:12*REAL_HOUR,bonus:{production:5,finance:10,logistics:8},brief:'Wachstum braucht verlässliche Systeme. Entscheide, wo du den nächsten dauerhaften Vorteil aufbaust.'},
  {id:'borders',name:'Über Grenzen hinweg',tier:5,wealth:4000000,cash:750000,points:500,materials:{machines:40,electronics:100,fabric:200},duration:24*REAL_HOUR,bonus:{production:6,finance:12,logistics:10},brief:'Aus einzelnen Standorten wird ein zusammenhängender Konzern. Deine Spezialisierung entscheidet über seine Stärke.'},
  {id:'connections',name:'Eine verbundene Welt',tier:6,wealth:30000000,cash:5000000,points:2000,materials:{satellites:20,vehicles:40,medicine:200},duration:36*REAL_HOUR,bonus:{production:7,finance:12,logistics:10},brief:'Deine Lieferketten erreichen eine neue Größenordnung. Investiere in einen Vorteil, der auch nach einer Neugründung bleibt.'},
  {id:'systems',name:'Neue Grundlagen',tier:7,wealth:100000000,cash:20000000,points:8000,materials:{robots:30,alloys:100,polymers:200},duration:60*REAL_HOUR,bonus:{production:8,finance:15,logistics:12},brief:'Vernetzte Systeme verändern deine Wirtschaft. Entscheide, welche Fähigkeit den nächsten Entwicklungssprung trägt.'},
  {id:'networks',name:'Wirtschaft ohne Reibung',tier:8,wealth:400000000,cash:90000000,points:20000,materials:{cells:50,quantum:20,biotech:100},duration:84*REAL_HOUR,bonus:{production:9,finance:15,logistics:12},brief:'Technologie allein reicht nicht. Richte das ganze Unternehmen auf seine nächste Entwicklungsphase aus.'},
  {id:'planet',name:'Verantwortung im großen Maßstab',tier:9,wealth:1500000000,cash:300000000,points:60000,materials:{nano:60,climate:15,robots:200},duration:96*REAL_HOUR,bonus:{production:10,finance:20,logistics:15},brief:'Deine Entscheidungen wirken über einzelne Branchen hinaus. Wähle einen dauerhaften Schwerpunkt für deine Holding.'},
  {id:'legacy',name:'Ein dauerhafter Wert',tier:10,wealth:5000000000,cash:1000000000,points:150000,materials:{starships:5,habitats:2,nano:200},duration:120*REAL_HOUR,bonus:{production:12,finance:25,logistics:20},brief:'Aus einem kleinen Betrieb ist eine eigene Wirtschaftsordnung geworden. Gestalte das Vermächtnis, mit dem sie weiterwächst.'},
  {id:'autonomy',name:'Was aus deinem Anfang geworden ist',tier:11,wealth:25000000000,cash:4000000000,points:600000,materials:{biospheres:4,knowledge:10,colonies:1},duration:168*REAL_HOUR,bonus:{production:15,finance:30,logistics:25},brief:'Deine Betriebe versorgen ganze eigenständige Wirtschaftsräume. Gib ihnen die Stärke mit, die dein Imperium dauerhaft prägen soll.'},
];
