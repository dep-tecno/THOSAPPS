"use strict";


// THOSFLUID MVP: simulació lògica pneumàtica, sense magnituds físiques.
const NS = "http://www.w3.org/2000/svg";
const FORMAT = "thosfluid-circuit";
const VERSION = 2;
const BACKUP_KEY = "thosfluid:last-circuit:v1";
const MAX_COMPONENTS = 80;
const MAX_CONNECTIONS = 160;

const TYPES = {
  source: { label: "Font d'aire", short: "FONT", hint: "Equivalent al compressor", glyph: "◉", family: "supply", w: 105, h: 100, ports: { P: [105, 50] } },
  note: { label: "Anotació", short: "TEXT", hint: "Afegeix una nota al circuit", glyph: "T", family: "connections", w: 190, h: 58, ports: {} },
  tee: { label: "Unió en T", short: "UNIÓ EN T", hint: "Deriva el conducte cap a una tercera branca", glyph: "┬", family: "connections", w: 100, h: 90, ports: { A: [0, 45], B: [100, 45], C: [50, 90] } },
  electricJunction: { label: "Unió elèctrica en T", short: "UNIÓ ELÈCTRICA", hint: "Reparteix un conductor en tres branques", glyph: "┬", family: "connections", w: 100, h: 90, ports: { A: [0, 45], B: [100, 45], C: [50, 90] } },
  receiver: { label: "Acumulador", short: "ACUMULADOR", hint: "Pas d'aire; sense acumulació calculada", glyph: "▱", family: "supply", w: 200, h: 120, ports: { P: [0, 60], A: [200, 60] } },
  maintenance: { label: "Unitat de manteniment", short: "FILTRE · REGULADOR · LUBRICADOR", hint: "Passa l'aire; sense regulació física", glyph: "⚙", family: "supply", w: 260, h: 140, ports: { P: [0, 70], A: [260, 70] } },
  checkValve: { label: "Vàlvula antiretorn", short: "ANTIRETORN", hint: "Deixa passar l'aire en un sentit", glyph: "▷", family: "regulation", w: 220, h: 120, ports: { P: [0, 60], A: [220, 60] } },
  flowRegulator: { label: "Regulador de cabal", short: "REGULADOR", hint: "Pas qualitatiu: tancat, poc, mitjà o obert", glyph: "↗", family: "regulation", w: 220, h: 120, ports: { P: [0, 60], A: [220, 60] } },
  flowRegulatorOneWay: { label: "Regulador unidireccional", short: "REGULADOR + ANTIRETORN", hint: "Regula un sentit i deixa lliure el retorn", glyph: "↗", family: "regulation", w: 240, h: 130, ports: { P: [0, 65], A: [240, 65] } },
  quickExhaust: { label: "Vàlvula d'escapament ràpid", short: "ESCAPAMENT RÀPID", hint: "Alimenta l'actuador i evacua l'aire directament", glyph: "↗", family: "regulation", w: 220, h: 130, ports: { P: [0, 60], A: [220, 60], R: [110, 130] } },
  valve2: { label: "Vàlvula 2/2 NC", short: "2/2 NC", hint: "Accionament manual", glyph: "⇄", family: "valves", w: 250, h: 155, ports: { P: [115, 155], A: [125, 0] } },
  valve3: { label: "Vàlvula 3/2 NC/NO", short: "3/2", hint: "Posició normal NC o NO configurable", glyph: "⇄", family: "valves", w: 250, h: 155, ports: { P: [115, 155], A: [125, 0], R: [145, 155] } },
  valve3Pilot: { label: "Vàlvula 3/2 pilotada pneumàticament", short: "3/2 PILOTADA", hint: "Connecta P–A quan rep pressió al pilot X; en repòs connecta A–R", glyph: "⇄", family: "valves", w: 280, h: 155, ports: { P: [115, 155], A: [125, 0], R: [145, 155], X: [0, 72] } },
  valve4: { label: "Vàlvula 4/2", short: "4/2", hint: "Palanca · enclavament", glyph: "⇅", family: "valves", w: 265, h: 155, ports: { P: [145, 155], A: [135, 0], B: [160, 0], R: [165, 155] } },
  valve5: { label: "Vàlvula 5/2", short: "5/2", hint: "Accionament manual", glyph: "⇅", family: "valves", w: 265, h: 155, ports: { P: [145, 155], A: [135, 0], B: [160, 0], R: [125, 155], S: [165, 155] } },
  valve53: { label: "Vàlvula 5/3", short: "5/3", hint: "Centre tancat, a escapament o a pressió", glyph: "⇅", family: "valves", w: 300, h: 155, ports: { P: [165, 155], A: [155, 0], B: [180, 0], R: [145, 155], S: [185, 155] } },
  valve5Pilot: { label: "Vàlvula 5/2 de doble pilotatge", short: "5/2 PILOTADA", hint: "Canvia amb un senyal pneumàtic", glyph: "⇄", family: "valves", w: 290, h: 155, ports: { P: [155, 155], A: [145, 0], B: [170, 0], R: [135, 155], S: [175, 155], X: [0, 72], Y: [290, 72] } },
  limitValve3: { label: "Final de cursa mecànic 3/2", short: "FINAL 3/2", hint: "S'acciona en arribar al cilindre", glyph: "⚙", family: "control", w: 250, h: 155, ports: { P: [115, 155], A: [125, 0], R: [145, 155] } },
  logicOr: { label: "Vàlvula lògica OR", short: "OR", hint: "La sortida s'activa amb qualsevol entrada", glyph: "∨", family: "logic", w: 220, h: 120, ports: { X: [0, 35], Y: [0, 85], A: [220, 60] } },
  logicAnd: { label: "Vàlvula lògica AND", short: "AND", hint: "La sortida s'activa amb dues entrades", glyph: "∧", family: "logic", w: 220, h: 120, ports: { X: [0, 35], Y: [0, 85], A: [220, 60] } },
  timer3: { label: "Temporitzador pneumàtic 3/2", short: "TEMPORITZADOR", hint: "Retard qualitatiu a l'activació", glyph: "◷", family: "logic", w: 220, h: 140, ports: { P: [0, 70], A: [220, 70], R: [110, 140], X: [110, 0] } },
  pressureSequence: { label: "Vàlvula seqüencial de pressió", short: "SEQÜÈNCIA", hint: "Activa P–A després d'un llindar qualitatiu al senyal X", glyph: "◷", family: "logic", w: 250, h: 145, ports: { P: [0, 72], A: [250, 72], R: [125, 145], X: [125, 0] } },
  single: { label: "Cilindre simple", short: "CILINDRE", hint: "Retorn per molla", glyph: "▣", family: "actuators", w: 215, h: 140, ports: { A: [40, 140] } },
  double: { label: "Cilindre doble", short: "CILINDRE", hint: "Doble efecte", glyph: "▤", family: "actuators", w: 215, h: 140, ports: { A: [40, 140], B: [130, 140] } },
  electricSource: { label: "Font elèctrica", short: "FONT ELÈCTRICA", hint: "Alimentació lògica, sense tensió calculada", glyph: "⏚", family: "electrical", w: 150, h: 100, ports: { plus: [150, 30], minus: [150, 70] } },
  electricPush: { label: "Polsador elèctric NO", short: "POLSADOR NO", hint: "Tanca el contacte mentre es prem", glyph: "○", family: "electrical", w: 155, h: 100, ports: { "1": [0, 50], "2": [155, 50] } },
  electricPushNC: { label: "Polsador elèctric NC", short: "POLSADOR NC", hint: "Obre el contacte mentre es prem", glyph: "○", family: "electrical", w: 155, h: 100, ports: { "1": [0, 50], "2": [155, 50] } },
  electricSwitch: { label: "Interruptor elèctric", short: "INTERRUPTOR", hint: "Canvia entre obert i tancat", glyph: "I", family: "electrical", w: 155, h: 100, ports: { "1": [0, 50], "2": [155, 50] } },
  electricLimit: { label: "Final de cursa elèctric", short: "FINAL ELÈCTRIC", hint: "Canvia amb la posició del cilindre", glyph: "FC", family: "electrical", w: 180, h: 100, ports: { "1": [0, 50], "2": [180, 50] } },
  magneticSensor: { label: "Sensor magnètic de cilindre", short: "SENSOR MAGNÈTIC", hint: "Tanca el contacte quan el cilindre arriba a l'extrem triat", glyph: "SM", family: "electrical", w: 190, h: 100, ports: { "1": [0, 50], "2": [190, 50] } },
  relayCoil: { label: "Bobina de relé", short: "RELÉ", hint: "Activa els contactes amb la mateixa referència", glyph: "K", family: "electrical", w: 160, h: 100, ports: { A1: [0, 35], A2: [0, 70] } },
  electricTimerRelay: { label: "Relé temporitzador elèctric", short: "RELÉ TEMPORITZAT", hint: "Després del retard qualitatiu, tanca el contacte 15–18", glyph: "KT", family: "electrical", w: 190, h: 115, ports: { A1: [0, 28], A2: [0, 78], "15": [0, 100], "18": [190, 100] } },
  relayContactNO: { label: "Contacte de relé NO", short: "RELÉ NO", hint: "Tanca quan s'activa el relé vinculat", glyph: "K", family: "electrical", w: 160, h: 100, ports: { "13": [0, 50], "14": [160, 50] } },
  relayContactNC: { label: "Contacte de relé NC", short: "RELÉ NC", hint: "Obre quan s'activa el relé vinculat", glyph: "K", family: "electrical", w: 160, h: 100, ports: { "21": [0, 50], "22": [160, 50] } },
  valve5Electric: { label: "Electrovàlvula 5/2 monoestable", short: "5/2 ELÈCTRICA", hint: "Bobina elèctrica i retorn per molla", glyph: "Y", family: "electrical", w: 290, h: 155, ports: { P: [155, 155], A: [145, 0], B: [170, 0], R: [135, 155], S: [175, 155], X1: [0, 55], X2: [0, 95] } },
  valve5ElectricBistable: { label: "Electrovàlvula 5/2 biestable", short: "5/2 BIESTABLE", hint: "Dues bobines; manté l'última posició", glyph: "Y Y", family: "electrical", w: 310, h: 155, ports: { P: [165, 155], A: [155, 0], B: [180, 0], R: [145, 155], S: [185, 155], X1: [0, 50], X2: [0, 105], common: [310, 78] } }
};
const FAMILY_ORDER = ["supply", "connections", "valves", "actuators", "control", "regulation", "logic", "electrical"];
const FAMILIES = {
  supply: "Alimentació i preparació de l'aire",
  connections: "Unions i derivacions",
  valves: "Vàlvules distribuïdores",
  actuators: "Actuadors",
  control: "Accionaments i sensors",
  regulation: "Regulació i pas",
  logic: "Lògica i temporització",
  electrical: "Electroneumàtica"
};
const collapsedFamilies = new Set();
const DISTRIBUTORS = new Set(["valve2", "valve3", "valve4", "valve5"]);
const ELECTRICAL_TYPES = new Set(["electricSource", "electricPush", "electricPushNC", "electricSwitch", "electricLimit", "magneticSensor", "relayCoil", "electricTimerRelay", "relayContactNO", "relayContactNC", "electricJunction"]);
function isElectricalPort(type, portId) { return ELECTRICAL_TYPES.has(type) || (type === "valve5Electric" && (portId === "X1" || portId === "X2")) || (type === "valve5ElectricBistable" && ["X1", "X2", "common"].includes(portId)); }
const DEFAULT_ACTUATOR = { valve2: "pushbutton", valve3: "pushbutton", valve4: "lever", valve5: "pushbutton" };
const defaultValveProperties = type => ({ actuator: DEFAULT_ACTUATOR[type], returnMode: type === "valve2" || type === "valve3" ? "spring" : "memory", ...(type === "valve3" ? { normallyOpen: false } : {}) });
function defaultProperties(type) {
  if (DISTRIBUTORS.has(type)) return defaultValveProperties(type);
  if (type === "valve53") return { center: "closed" };
  if (type === "flowRegulator") return { opening: "open" };
  if (type === "flowRegulatorOneWay") return { opening: "medium", regulatedDirection: "PtoA" };
  if (type === "checkValve") return { direction: "PtoA" };
  if (type === "limitValve3") return { targetCylinder: "", targetEnd: "extended", actuator: "roller" };
  if (type === "timer3") return { delay: "medium" };
  if (type === "pressureSequence" || type === "electricTimerRelay") return { delay: "medium" };
  if (type === "relayCoil" || type === "relayContactNO" || type === "relayContactNC") return { relay: "K1" };
  if (type === "note") return { text: "Escriu una nota" };
  if (type === "electricLimit") return { targetCylinder: "", targetEnd: "extended" };
  if (type === "magneticSensor") return { targetCylinder: "", targetEnd: "extended" };
  return {};
}
function normalizeProperties(type, properties = {}) {
  if (DISTRIBUTORS.has(type)) return { actuator: ["pushbutton", "lever", "pedal"].includes(properties.actuator) ? properties.actuator : DEFAULT_ACTUATOR[type], returnMode: ["spring", "memory"].includes(properties.returnMode) ? properties.returnMode : defaultValveProperties(type).returnMode, ...(type === "valve3" ? { normallyOpen: properties.normallyOpen === true } : {}) };
  if (type === "flowRegulator") return { opening: ["closed", "low", "medium", "open"].includes(properties.opening) ? properties.opening : "open" };
  if (type === "flowRegulatorOneWay") return { opening: ["closed", "low", "medium", "open"].includes(properties.opening) ? properties.opening : "medium", regulatedDirection: properties.regulatedDirection === "AtoP" ? "AtoP" : "PtoA" };
  if (type === "checkValve") return { direction: properties.direction === "AtoP" ? "AtoP" : "PtoA" };
  if (type === "valve53") return { center: ["closed", "exhaust", "pressure"].includes(properties.center) ? properties.center : "closed" };
  if (type === "limitValve3") return { targetCylinder: typeof properties.targetCylinder === "string" ? properties.targetCylinder : "", targetEnd: properties.targetEnd === "retracted" ? "retracted" : "extended", actuator: ["direct", "roller", "cam"].includes(properties.actuator) ? properties.actuator : "roller" };
  if (type === "timer3") return { delay: ["short", "medium", "long"].includes(properties.delay) ? properties.delay : "medium" };
  if (type === "pressureSequence" || type === "electricTimerRelay") return { delay: ["short", "medium", "long"].includes(properties.delay) ? properties.delay : "medium" };
  if (type === "relayCoil" || type === "relayContactNO" || type === "relayContactNC") return { relay: String(properties.relay || "K1").slice(0, 12) };
  if (type === "note") return { text: String(properties.text || "Escriu una nota").slice(0, 120) };
  if (type === "electricLimit") return { targetCylinder: typeof properties.targetCylinder === "string" ? properties.targetCylinder : "", targetEnd: properties.targetEnd === "retracted" ? "retracted" : "extended" };
  if (type === "magneticSensor") return { targetCylinder: typeof properties.targetCylinder === "string" ? properties.targetCylinder : "", targetEnd: properties.targetEnd === "retracted" ? "retracted" : "extended" };
  return {};
}

const $ = id => document.getElementById(id);
const svg = (tag, attrs = {}, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (parent) parent.appendChild(node);
  return node;
};
const svgText = (parent, x, y, value, cls, extra = {}) => {
  const node = svg("text", { x, y, class: cls, ...extra }, parent);
  node.textContent = value;
  return node;
};
const deepCopy = value => JSON.parse(JSON.stringify(value));
const makeId = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const key = (componentId, portId) => `${componentId}:${portId}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isCylinder = component => component?.type === "single" || component?.type === "double";
function targetCylinderFor(component) {
  return circuit.components.find(item => isCylinder(item) && item.id === component.properties?.targetCylinder) || circuit.components.find(isCylinder);
}

let circuit = { format: FORMAT, version: VERSION, metadata: { name: "Circuit nou" }, components: [], connections: [], view: { zoom: 1, pan: { x: 0, y: 0 } } };
let selected = null;
let selectedType = null;
let pendingPort = null;
let running = false;
// Keep every runtime group available before the library renders its symbol previews.
let runtime = { valves: {}, pressed: {}, cylinders: {}, cylinderProgress: {}, cylinderTargets: {}, cylinderStepRemainder: {}, timers: {}, timerTicks: {}, relays: {}, electrical: {}, stepCount: 0 };
let simulation = null;
const timerHandles = new Map();
let simulationRefreshPending = false;
let history = [];
let future = [];
let dirty = false;
let pointerAction = null;
let activeMomentaryId = null;
let panMode = false;
let stepMode = false;
let stepAdvancePending = false;
let clipboardComponent = null;
let cursorWorldPoint = null;

function status(message) { $("statusText").textContent = message; }
function snapshot() { return deepCopy(circuit); }
function serializableCircuit() {
  const data = snapshot(); data.format = FORMAT; data.version = VERSION;
  data.connections = data.connections.map(w => ({ ...w, route: Array.isArray(w.route) ? w.route : [] }));
  return data;
}
function remember() {
  history.push(snapshot());
  if (history.length > 50) history.shift();
  future = [];
}
function storeBackup() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(serializableCircuit()));
    $("restorePanel").hidden = true;
  } catch (_) { status("No s'ha pogut desar la còpia automàtica en aquest navegador. Descarrega el JSON."); }
}
function edit(action) {
  if (running) return;
  remember();
  action();
  dirty = true;
  storeBackup();
  render();
}
function resetRuntime() {
  stepAdvancePending = false;
  for (const handle of timerHandles.values()) clearTimeout(handle);
  timerHandles.clear();
  runtime = { valves: {}, pressed: {}, cylinders: {}, cylinderProgress: {}, cylinderTargets: {}, cylinderStepRemainder: {}, timers: {}, timerTicks: {}, relays: {}, electrical: {}, stepCount: 0 };
  for (const component of circuit.components) {
    if (DISTRIBUTORS.has(component.type)) runtime.valves[component.id] = false;
    if (component.type === "valve53") runtime.valves[component.id] = "center";
    if (component.type === "valve5Pilot") runtime.valves[component.id] = false;
    if (["timer3", "pressureSequence", "electricTimerRelay"].includes(component.type)) { runtime.timers[component.id] = false; runtime.timerTicks[component.id] = 0; }
    if (component.type === "valve5Electric") runtime.valves[component.id] = false;
    if (component.type === "valve5ElectricBistable") runtime.valves[component.id] = false;
    if (component.type === "electricSwitch") runtime.valves[component.id] = false;
    if (component.type === "single" || component.type === "double") { runtime.cylinders[component.id] = "retracted"; runtime.cylinderProgress[component.id] = 0; runtime.cylinderTargets[component.id] = "retracted"; runtime.cylinderStepRemainder[component.id] = 0; }
  }
  simulation = null;
}
function setRunning(next) {
  running = next;
  activeMomentaryId = null;
  stepAdvancePending = false;
  pendingPort = null;
  selectedType = null;
  panMode = false;
  resetRuntime();
  status(next ? stepMode ? "Simulació pas a pas activa. Acciona els comandaments i prem Avança." : "Simulació activa. Acciona una vàlvula i observa els conductes." : "Mode edició. Clica dos ports per connectar-los.");
  render();
}

function makeComponent(type, x, y) {
  const properties = defaultProperties(type);
  return { id: makeId("c"), type, x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10, properties };
}
function addComponent(type, x, y) {
  if (!TYPES[type] || circuit.components.length >= MAX_COMPONENTS) return status("No es poden afegir més components.");
  edit(() => {
    const def = TYPES[type];
    const comp = makeComponent(type, clamp(x, 5, 1200 - def.w - 5), clamp(y, 5, 700 - def.h - 5));
    circuit.components.push(comp);
    selected = { kind: "component", id: comp.id };
  });
  status(`${TYPES[type].label} afegit. Clica els ports per unir-los.`);
}
function deleteSelected() {
  if (!selected || running) return;
  edit(() => {
    if (selected.kind === "component") {
      circuit.components = circuit.components.filter(c => c.id !== selected.id);
      circuit.connections = circuit.connections.filter(w => w.from.componentId !== selected.id && w.to.componentId !== selected.id);
    } else circuit.connections = circuit.connections.filter(w => w.id !== selected.id);
    selected = null;
    pendingPort = null;
  });
  status("Element esborrat.");
}
function copySelected() {
  if (running || selected?.kind !== "component") return;
  const component = circuit.components.find(c => c.id === selected.id);
  if (!component) return;
  clipboardComponent = deepCopy(component);
  $("pasteBtn").disabled = false;
  status("Component copiat. Enganxa'l per crear-ne una còpia al llenç.");
}
function pasteSelected() {
  if (running || !clipboardComponent || circuit.components.length >= MAX_COMPONENTS) return;
  edit(() => {
    const copy = deepCopy(clipboardComponent);
    copy.id = makeId("c"); copy.x += 30; copy.y += 30;
    clipboardComponent = deepCopy(copy);
    circuit.components.push(copy); selected = { kind: "component", id: copy.id };
  });
  status("Còpia del component enganxada. Les connexions s'han de tornar a dibuixar.");
}
function undo() {
  if (running || !history.length) return;
  future.push(snapshot()); circuit = history.pop(); selected = null; pendingPort = null; dirty = true; storeBackup(); render(); status("Acció desfeta.");
}
function redo() {
  if (running || !future.length) return;
  history.push(snapshot()); circuit = future.pop(); selected = null; pendingPort = null; dirty = true; storeBackup(); render(); status("Acció refeta.");
}
function portUsed(componentId, portId) {
  return circuit.connections.some(w => (w.from.componentId === componentId && w.from.portId === portId) || (w.to.componentId === componentId && w.to.portId === portId));
}
function clickPort(componentId, portId) {
  if (running) return;
  const next = { componentId, portId };
  if (!pendingPort) { pendingPort = { ...next, route: [] }; if (!cursorWorldPoint) cursorWorldPoint = { x: 600, y: 350 }; status(`Port ${portId} triat. Clica punts del recorregut, o usa les fletxes i Retorn; acaba en un port compatible.`); render(); return; }
  if (pendingPort.componentId === componentId && pendingPort.portId === portId) { pendingPort = null; render(); return; }
  if (pendingPort.componentId === componentId) { status("Connecta components diferents."); return; }
  const fromType = circuit.components.find(c => c.id === pendingPort.componentId)?.type;
  const toType = circuit.components.find(c => c.id === componentId)?.type;
  if (isElectricalPort(fromType, pendingPort.portId) !== isElectricalPort(toType, portId)) { status("No es poden unir conductes pneumàtics i elèctrics."); return; }
  if (portUsed(pendingPort.componentId, pendingPort.portId) || portUsed(componentId, portId)) { status("Aquest port ja té una connexió."); return; }
  if (circuit.connections.length >= MAX_CONNECTIONS) { status("No es poden afegir més connexions."); return; }
  const from = { componentId: pendingPort.componentId, portId: pendingPort.portId }, route = deepCopy(pendingPort.route || []);
  edit(() => { circuit.connections.push({ id: makeId("w"), from, to: next, route }); pendingPort = null; });
  status(isElectricalPort(toType, portId) ? "Cable elèctric connectat." : "Conducte connectat.");
}
function addRoutePoint(point) {
  if (!pendingPort || running) return;
  pendingPort.route.push({ x: Math.round(point.x), y: Math.round(point.y) });
  status(`Punt de recorregut afegit (${pendingPort.route.length}). Acaba al port de destinació.`);
  render();
}

function validateCircuit(data) {
  if (!data || data.format !== FORMAT || ![1, VERSION].includes(data.version) || !Array.isArray(data.components) || !Array.isArray(data.connections)) throw new Error("El fitxer no és un circuit THOSFLUID compatible.");
  if (data.components.length > MAX_COMPONENTS || data.connections.length > MAX_CONNECTIONS) throw new Error("El circuit supera el límit de components o connexions.");
  const ids = new Set();
  const used = new Set();
  for (const c of data.components) {
    if (!c || typeof c.id !== "string" || ids.has(c.id) || !TYPES[c.type] || !Number.isFinite(c.x) || !Number.isFinite(c.y) || Math.abs(c.x) > 10000 || Math.abs(c.y) > 10000) throw new Error("Hi ha un component desconegut o mal format.");
    ids.add(c.id);
  }
  const wireIds = new Set();
  for (const w of data.connections) {
    if (!w || typeof w.id !== "string" || wireIds.has(w.id) || !w.from || !w.to || w.from.componentId === w.to.componentId) throw new Error("Hi ha una connexió mal formada.");
    wireIds.add(w.id);
    for (const end of [w.from, w.to]) {
      const c = data.components.find(item => item.id === end.componentId);
      if (!c || !Object.hasOwn(TYPES[c.type].ports, end.portId)) throw new Error("Una connexió apunta a un port inexistent.");
      if (isElectricalPort(data.components.find(item => item.id === w.from.componentId)?.type, w.from.portId) !== isElectricalPort(data.components.find(item => item.id === w.to.componentId)?.type, w.to.portId)) throw new Error("Una connexió barreja ports pneumàtics i elèctrics.");
      const portKey = key(end.componentId, end.portId);
      if (used.has(portKey)) throw new Error("Hi ha un port connectat més d'una vegada.");
      used.add(portKey);
    }
  }
  const name = String(data.metadata?.name || "Circuit nou").slice(0, 80);
  const zoom = Number.isFinite(data.view?.zoom) ? clamp(data.view.zoom, .55, 2.4) : 1;
  const pan = { x: Number.isFinite(data.view?.pan?.x) ? clamp(data.view.pan.x, -1500, 1500) : 0, y: Number.isFinite(data.view?.pan?.y) ? clamp(data.view.pan.y, -1000, 1000) : 0 };
  return { format: FORMAT, version: VERSION, metadata: { name }, components: data.components.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, properties: normalizeProperties(c.type, c.properties) })), connections: data.connections.map(w => ({ id: w.id, from: { componentId: w.from.componentId, portId: w.from.portId }, to: { componentId: w.to.componentId, portId: w.to.portId }, route: Array.isArray(w.route) ? w.route.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y) && Math.abs(p.x) <= 10000 && Math.abs(p.y) <= 10000).slice(0, 100).map(p => ({ x: p.x, y: p.y })) : [] })), view: { zoom, pan } };
}
function downloadCircuit() {
  const text = JSON.stringify(serializableCircuit(), null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stem = circuit.metadata.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "circuit";
  a.download = `${stem}.thosfluid.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  dirty = false;
  status("Circuit descarregat. Conserva el JSON per continuar més endavant.");
}
function downloadCanvasPng() {
  const source = $("circuitCanvas");
  const clone = source.cloneNode(true);
  clone.querySelectorAll(".preview-wire").forEach(node => node.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const viewBox = (source.getAttribute("viewBox") || "0 0 1200 700").split(/\s+/).map(Number);
  const width = Math.max(1, Math.round(viewBox[2] || 1200));
  const height = Math.max(1, Math.round(viewBox[3] || 700));
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  const styleProps = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline", "visibility", "display", "vector-effect", "paint-order"];
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((element, index) => {
    const copy = copies[index];
    if (!copy) return;
    const computed = getComputedStyle(element);
    styleProps.forEach(property => {
      const value = computed.getPropertyValue(property);
      if (value) copy.style.setProperty(property, value);
    });
  });
  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas no disponible");
      context.fillStyle = "#1a1a1a";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(svgUrl);
        if (!blob) return status("No s'ha pogut exportar el PNG.");
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const stem = circuit.metadata.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "circuit";
        link.href = pngUrl;
        link.download = `${stem}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
        status("Imatge PNG descarregada.");
      }, "image/png");
    } catch (error) {
      URL.revokeObjectURL(svgUrl);
      status("No s'ha pogut exportar el PNG.");
    }
  };
  image.onerror = () => { URL.revokeObjectURL(svgUrl); status("No s'ha pogut exportar el PNG."); };
  image.src = svgUrl;
}
async function openCircuit(file) {
  if (!file) return;
  if (file.size > 1024 * 1024) return status("El fitxer és massa gran (màxim 1 MB).");
  if (dirty && !confirm("Hi ha canvis no descarregats. Vols obrir un altre circuit?")) return;
  try {
    const parsed = JSON.parse(await file.text());
    circuit = validateCircuit(parsed);
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status(`Circuit «${circuit.metadata.name}» obert des del dispositiu.`);
  } catch (error) { status(error.message || "No s'ha pogut obrir el circuit."); }
}
function newCircuit() {
  if (dirty && !confirm("Hi ha canvis no descarregats. Vols crear un circuit nou?")) return;
  circuit = { format: FORMAT, version: VERSION, metadata: { name: "Circuit nou" }, components: [], connections: [], view: { zoom: 1, pan: { x: 0, y: 0 } } };
  selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render(); status("Circuit nou creat.");
}

function queueSimulationRefresh() {
  if (simulationRefreshPending) return;
  simulationRefreshPending = true;
  requestAnimationFrame(() => { simulationRefreshPending = false; if (running) render(); });
}
function advanceSimulationStep() {
  if (!running || !stepMode) return;
  runtime.stepCount += 1;
  stepAdvancePending = true;
  render();
  if (!simulation?.conflicts.size) status(`Pas ${runtime.stepCount}: s'han actualitzat el moviment i els retards actius.`);
}
function buildElectricalSimulation() {
  const relays = Object.create(null), energized = Object.create(null);
  const nodes = [];
  let plus = new Set(), minus = new Set(), graph = new Map();
  for (const c of circuit.components) if (ELECTRICAL_TYPES.has(c.type) || c.type === "valve5Electric" || c.type === "valve5ElectricBistable") {
    for (const p of Object.keys(TYPES[c.type].ports).filter(portId => isElectricalPort(c.type, portId))) nodes.push(key(c.id, p));
    if (c.type === "relayCoil") relays[c.properties?.relay || "K1"] = false;
  }
  const sources = circuit.components.filter(c => c.type === "electricSource");
  const isPlus = id => sources.some(c => id === key(c.id, "plus"));
  const isMinus = id => sources.some(c => id === key(c.id, "minus"));
  let stable = false;
  for (let pass = 0; pass < 8 && !stable; pass++) {
    graph = new Map(nodes.map(node => [node, new Set()]));
    const link = (a, b) => { if (graph.has(a) && graph.has(b)) { graph.get(a).add(b); graph.get(b).add(a); } };
    for (const w of circuit.connections) {
      const a = circuit.components.find(c => c.id === w.from.componentId), b = circuit.components.find(c => c.id === w.to.componentId);
      if (a && b && isElectricalPort(a.type, w.from.portId) && isElectricalPort(b.type, w.to.portId)) link(key(a.id, w.from.portId), key(b.id, w.to.portId));
    }
    for (const c of circuit.components) {
      if (c.type === "electricJunction") { link(key(c.id, "A"), key(c.id, "B")); link(key(c.id, "A"), key(c.id, "C")); }
      if (c.type === "electricPush" && runtime.pressed[c.id]) link(key(c.id, "1"), key(c.id, "2"));
      if (c.type === "electricPushNC" && !runtime.pressed[c.id]) link(key(c.id, "1"), key(c.id, "2"));
      if (c.type === "electricSwitch" && runtime.valves[c.id]) link(key(c.id, "1"), key(c.id, "2"));
      if (c.type === "electricLimit") { const target = targetCylinderFor(c); if (target && runtime.cylinders[target.id] === (c.properties?.targetEnd || "extended")) link(key(c.id, "1"), key(c.id, "2")); }
      if (c.type === "magneticSensor") { const target = targetCylinderFor(c); if (target && runtime.cylinders[target.id] === (c.properties?.targetEnd || "extended")) link(key(c.id, "1"), key(c.id, "2")); }
      if (c.type === "electricTimerRelay" && runtime.timers[c.id]) link(key(c.id, "15"), key(c.id, "18"));
      if (c.type === "relayContactNO" && relays[c.properties?.relay || "K1"]) link(key(c.id, "13"), key(c.id, "14"));
      if (c.type === "relayContactNC" && !relays[c.properties?.relay || "K1"]) link(key(c.id, "21"), key(c.id, "22"));
    }
    const flood = seeds => { const seen = new Set(seeds), queue = [...seeds]; for (let i = 0; i < queue.length; i++) for (const next of graph.get(queue[i]) || []) if (!seen.has(next)) { seen.add(next); queue.push(next); } return seen; };
    plus = flood(nodes.filter(isPlus)); minus = flood(nodes.filter(isMinus));
    const nextRelays = Object.create(null);
    for (const c of circuit.components) if (c.type === "relayCoil") nextRelays[c.properties?.relay || "K1"] = plus.has(key(c.id, "A1")) && minus.has(key(c.id, "A2"));
    stable = Object.keys(nextRelays).every(name => nextRelays[name] === relays[name]);
    Object.assign(relays, nextRelays);
    for (const c of circuit.components) {
      if (c.type === "valve5Electric") energized[c.id] = plus.has(key(c.id, "X1")) && minus.has(key(c.id, "X2"));
      if (c.type === "electricTimerRelay") energized[c.id] = plus.has(key(c.id, "A1")) && minus.has(key(c.id, "A2"));
      if (c.type === "valve5ElectricBistable") {
        energized[`${c.id}:A`] = plus.has(key(c.id, "X1")) && minus.has(key(c.id, "common"));
        energized[`${c.id}:B`] = plus.has(key(c.id, "X2")) && minus.has(key(c.id, "common"));
      }
    }
  }
  const activeWires = new Set();
  for (const w of circuit.connections) {
    const a = key(w.from.componentId, w.from.portId), b = key(w.to.componentId, w.to.portId);
    if (plus.has(a) || plus.has(b) || minus.has(a) || minus.has(b)) activeWires.add(w.id);
  }
  return { relays, energized, activeWires, activePorts: new Set([...plus, ...minus]) };
}
function buildSimulation(advanceTimeStep = false) {
  const electrical = buildElectricalSimulation();
  runtime.relays = electrical.relays;
  runtime.electrical = electrical.energized;
  for (const c of circuit.components) if (c.type === "valve5Electric") {
    runtime.valves[c.id] = !!runtime.electrical[c.id];
  }
  for (const c of circuit.components) if (c.type === "valve5ElectricBistable") {
    const coilA = !!runtime.electrical[`${c.id}:A`], coilB = !!runtime.electrical[`${c.id}:B`];
    if (coilA !== coilB) runtime.valves[c.id] = coilA;
  }
  const graph = new Map(), reverseGraph = new Map();
  const ensure = id => { if (!graph.has(id)) graph.set(id, new Map()); if (!reverseGraph.has(id)) reverseGraph.set(id, new Map()); };
  const direct = (a, b, rate = 3) => { if (rate <= 0) return; ensure(a); ensure(b); graph.get(a).set(b, rate); reverseGraph.get(b).set(a, rate); };
  const link = (a, b, rate = 3) => { direct(a, b, rate); direct(b, a, rate); };
  const linkRates = (a, b, ab, ba) => { direct(a, b, ab); direct(b, a, ba); };
  const pressureSeeds = [], exhaustSeeds = [];
  for (const c of circuit.components) {
    for (const portId of Object.keys(TYPES[c.type].ports)) if (!isElectricalPort(c.type, portId)) ensure(key(c.id, portId));
    const port = id => key(c.id, id);
    if (c.type === "source") pressureSeeds.push(port("P"));
    if (c.type === "tee") { link(port("A"), port("B")); link(port("B"), port("C")); }
    if (c.type === "receiver" || c.type === "maintenance") link(port("P"), port("A"));
    if (c.type === "flowRegulator") link(port("P"), port("A"), ({ closed: 0, low: 1, medium: 2, open: 3 })[c.properties?.opening] ?? 3);
    if (c.type === "checkValve") c.properties?.direction === "AtoP" ? direct(port("A"), port("P")) : direct(port("P"), port("A"));
    if (c.type === "flowRegulatorOneWay") {
      const rate = ({ closed: 0, low: 1, medium: 2, open: 3 })[c.properties?.opening] ?? 2;
      if (c.properties?.regulatedDirection === "AtoP") linkRates(port("P"), port("A"), 3, rate);
      else linkRates(port("P"), port("A"), rate, 3);
    }
    if (["valve3", "valve3Pilot", "valve4", "valve5", "valve53", "valve5Pilot", "valve5Electric", "valve5ElectricBistable", "limitValve3", "timer3", "pressureSequence", "quickExhaust"].includes(c.type)) exhaustSeeds.push(port("R"));
    if (["valve5", "valve53", "valve5Pilot", "valve5Electric", "valve5ElectricBistable"].includes(c.type)) exhaustSeeds.push(port("S"));
    const active = c.properties?.returnMode === "spring" ? !!runtime.pressed[c.id] : !!runtime.valves[c.id];
    if (c.type === "valve2" && active) link(port("P"), port("A"));
    if (c.type === "valve3" || c.type === "valve3Pilot") {
      const open = c.type === "valve3Pilot" ? !!runtime.valves[c.id] : active !== (c.properties?.normallyOpen === true);
      open ? link(port("P"), port("A")) : link(port("A"), port("R"));
    }
    if (c.type === "valve4") {
      if (active) { link(port("P"), port("A")); link(port("B"), port("R")); }
      else { link(port("P"), port("B")); link(port("A"), port("R")); }
    }
    if (c.type === "valve5" || c.type === "valve5Pilot" || c.type === "valve5Electric" || c.type === "valve5ElectricBistable") {
      const pilotActive = c.type === "valve5Pilot" || c.type === "valve5Electric" || c.type === "valve5ElectricBistable" ? !!runtime.valves[c.id] : active;
      if (pilotActive) { link(port("P"), port("A")); link(port("B"), port("S")); }
      else { link(port("P"), port("B")); link(port("A"), port("R")); }
    }
    if (c.type === "valve53") {
      if (runtime.valves[c.id] === "left") { link(port("P"), port("A")); link(port("B"), port("S")); }
      if (runtime.valves[c.id] === "right") { link(port("P"), port("B")); link(port("A"), port("R")); }
      if (runtime.valves[c.id] === "center" && c.properties?.center === "exhaust") { link(port("A"), port("R")); link(port("B"), port("S")); }
      if (runtime.valves[c.id] === "center" && c.properties?.center === "pressure") { link(port("P"), port("A")); link(port("P"), port("B")); }
    }
    if (c.type === "quickExhaust") direct(port("P"), port("A"));
    if (c.type === "limitValve3") {
      const targetId = targetCylinderFor(c)?.id;
      const triggered = !!targetId && runtime.cylinders[targetId] === (c.properties?.targetEnd || "extended");
      if (triggered) link(port("P"), port("A")); else link(port("A"), port("R"));
    }
    if (c.type === "timer3" || c.type === "pressureSequence") {
      if (runtime.timers[c.id]) link(port("P"), port("A")); else link(port("A"), port("R"));
    }
  }
  for (const w of circuit.connections) {
    const a = circuit.components.find(c => c.id === w.from.componentId), b = circuit.components.find(c => c.id === w.to.componentId);
    if (a && b && !isElectricalPort(a.type, w.from.portId) && !isElectricalPort(b.type, w.to.portId)) link(key(w.from.componentId, w.from.portId), key(w.to.componentId, w.to.portId));
  }
  const flood = (seeds, reverse = false) => {
    const adjacency = reverse ? reverseGraph : graph;
    const found = new Set(seeds), queue = [...seeds];
    for (let i = 0; i < queue.length; i++) for (const next of (adjacency.get(queue[i]) || new Map()).keys()) if (!found.has(next)) { found.add(next); queue.push(next); }
    return found;
  };
  let pressure = flood(pressureSeeds);
  // Pneumatic logic gates pass pressure only after their input conditions are met.
  for (let pass = 0; pass < circuit.components.length; pass++) {
    let changed = false;
    for (const c of circuit.components) {
      if (c.type !== "logicOr" && c.type !== "logicAnd") continue;
      const x = key(c.id, "X"), y = key(c.id, "Y"), out = key(c.id, "A");
      const enabled = c.type === "logicOr" ? pressure.has(x) || pressure.has(y) : pressure.has(x) && pressure.has(y);
      if (!enabled) continue;
      const before = graph.get(x).has(out) || graph.get(y).has(out);
      if (c.type === "logicOr") { if (pressure.has(x)) direct(x, out); if (pressure.has(y)) direct(y, out); }
      else { direct(x, out); direct(y, out); }
      if (!before) changed = true;
    }
    if (!changed) break;
    pressure = flood(pressureSeeds);
  }
  for (const c of circuit.components) if (c.type === "quickExhaust" && !pressure.has(key(c.id, "P"))) direct(key(c.id, "A"), key(c.id, "R"));
  const exhaust = flood(exhaustSeeds, true);
  const distancesFrom = (seeds, reverse = false) => {
    const adjacency = reverse ? reverseGraph : graph;
    const distances = new Map(seeds.map(node => [node, 0])), queue = [...seeds];
    for (let i = 0; i < queue.length; i++) for (const next of (adjacency.get(queue[i]) || new Map()).keys()) if (!distances.has(next)) { distances.set(next, distances.get(queue[i]) + 1); queue.push(next); }
    return distances;
  };
  const pressureDistances = distancesFrom(pressureSeeds), exhaustDistances = distancesFrom(exhaustSeeds, true);
  const speedFlood = (seeds, reverse = false) => {
    const adjacency = reverse ? reverseGraph : graph;
    const levels = new Map(seeds.map(node => [node, 3])), queue = [...seeds];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i], level = levels.get(node);
      for (const [next, edgeRate] of (adjacency.get(node) || new Map())) {
        const nextLevel = Math.min(level, edgeRate);
        if (nextLevel > (levels.get(next) || 0)) { levels.set(next, nextLevel); queue.push(next); }
      }
    }
    return levels;
  };
  const pressureSpeed = speedFlood(pressureSeeds), exhaustSpeed = speedFlood(exhaustSeeds, true);
  const conflicts = new Set([...pressure].filter(node => exhaust.has(node)));
  const flowDirections = {};
  for (const w of circuit.connections) {
    const from = key(w.from.componentId, w.from.portId), to = key(w.to.componentId, w.to.portId);
    if (conflicts.has(from) || conflicts.has(to)) continue;
    if (pressure.has(from) && pressure.has(to)) {
      const a = pressureDistances.get(from), b = pressureDistances.get(to);
      if (a < b) flowDirections[w.id] = "forward"; else if (b < a) flowDirections[w.id] = "reverse";
    } else if (exhaust.has(from) && exhaust.has(to)) {
      const a = exhaustDistances.get(from), b = exhaustDistances.get(to);
      if (a > b) flowDirections[w.id] = "forward"; else if (b > a) flowDirections[w.id] = "reverse";
    }
  }
  const cylinderSpeeds = {}, oldCylinders = { ...runtime.cylinders };
  const commandCylinder = (component, target, speed) => {
    const id = component.id;
    if (!stepMode) {
      runtime.cylinders[id] = target;
      runtime.cylinderProgress[id] = target === "extended" ? 4 : 0;
      runtime.cylinderTargets[id] = target;
      return;
    }
    if (runtime.cylinderTargets[id] !== target) {
      runtime.cylinderTargets[id] = target;
      runtime.cylinderStepRemainder[id] = 0;
    }
    if (!advanceTimeStep) return;
    const interval = Math.max(1, 4 - speed);
    const remainder = (runtime.cylinderStepRemainder[id] || 0) + 1;
    if (remainder < interval) { runtime.cylinderStepRemainder[id] = remainder; return; }
    runtime.cylinderStepRemainder[id] = 0;
    const current = runtime.cylinderProgress[id] || 0;
    const next = clamp(current + (target === "extended" ? 1 : -1), 0, 4);
    runtime.cylinderProgress[id] = next;
    runtime.cylinders[id] = next === 4 ? "extended" : next === 0 ? "retracted" : "moving";
  };
  for (const c of circuit.components) {
    if (c.type === "single") {
      const a = key(c.id, "A");
      if (pressure.has(a) && !conflicts.has(a)) { cylinderSpeeds[c.id] = pressureSpeed.get(a) || 3; commandCylinder(c, "extended", cylinderSpeeds[c.id]); }
      else if (exhaust.has(a) && !conflicts.has(a)) { cylinderSpeeds[c.id] = exhaustSpeed.get(a) || 3; commandCylinder(c, "retracted", cylinderSpeeds[c.id]); }
    }
    if (c.type === "double") {
      const a = key(c.id, "A"), b = key(c.id, "B");
      if (pressure.has(a) && exhaust.has(b) && !conflicts.has(a) && !conflicts.has(b)) { cylinderSpeeds[c.id] = Math.min(pressureSpeed.get(a) || 3, exhaustSpeed.get(b) || 3); commandCylinder(c, "extended", cylinderSpeeds[c.id]); }
      else if (pressure.has(b) && exhaust.has(a) && !conflicts.has(a) && !conflicts.has(b)) { cylinderSpeeds[c.id] = Math.min(pressureSpeed.get(b) || 3, exhaustSpeed.get(a) || 3); commandCylinder(c, "retracted", cylinderSpeeds[c.id]); }
    }
  }
  let cylinderChanged = false;
  for (const c of circuit.components) if ((c.type === "single" || c.type === "double") && oldCylinders[c.id] !== runtime.cylinders[c.id]) cylinderChanged = true;
  if (cylinderChanged && circuit.components.some(c => ["limitValve3", "electricLimit", "magneticSensor"].includes(c.type))) queueSimulationRefresh();
  for (const c of circuit.components.filter(item => item.type === "valve3Pilot")) {
    const signal = pressure.has(key(c.id, "X"));
    if (runtime.valves[c.id] !== signal) { runtime.valves[c.id] = signal; queueSimulationRefresh(); }
  }
  for (const c of circuit.components.filter(item => item.type === "valve5Pilot")) {
    const x = pressure.has(key(c.id, "X")), y = pressure.has(key(c.id, "Y"));
    if (x !== y && runtime.valves[c.id] !== x) { runtime.valves[c.id] = x; queueSimulationRefresh(); }
  }
  const timedComponents = circuit.components.filter(item => ["timer3", "pressureSequence"].includes(item.type));
  for (const c of timedComponents) {
    const signal = pressure.has(key(c.id, "X"));
    if (!signal) {
      const wasRunning = runtime.timers[c.id] || (runtime.timerTicks[c.id] || 0) > 0;
      const handle = timerHandles.get(c.id);
      if (handle) clearTimeout(handle);
      timerHandles.delete(c.id);
      runtime.timers[c.id] = false;
      runtime.timerTicks[c.id] = 0;
      if (wasRunning) queueSimulationRefresh();
    } else if (stepMode && !runtime.timers[c.id]) {
      if (advanceTimeStep) {
        runtime.timerTicks[c.id] = (runtime.timerTicks[c.id] || 0) + 1;
        const requiredTicks = ({ short: 1, medium: 2, long: 4 })[c.properties?.delay] || 2;
        if (runtime.timerTicks[c.id] >= requiredTicks) { runtime.timers[c.id] = true; queueSimulationRefresh(); }
      }
    } else if (!stepMode && !runtime.timers[c.id] && !timerHandles.has(c.id)) {
      const delay = ({ short: 700, medium: 1400, long: 2400 })[c.properties?.delay] || 1400;
      timerHandles.set(c.id, setTimeout(() => { timerHandles.delete(c.id); if (running) { runtime.timers[c.id] = true; render(); } }, delay));
    }
  }
  for (const c of circuit.components.filter(item => item.type === "electricTimerRelay")) {
    const signal = !!electrical.energized[c.id];
    const clearTimer = () => { const handle = timerHandles.get(c.id); if (handle) clearTimeout(handle); timerHandles.delete(c.id); };
    if (!signal) {
      const changed = runtime.timers[c.id] || (runtime.timerTicks[c.id] || 0) > 0;
      clearTimer(); runtime.timers[c.id] = false; runtime.timerTicks[c.id] = 0;
      if (changed) queueSimulationRefresh();
    } else if (stepMode && !runtime.timers[c.id]) {
      if (advanceTimeStep) {
        runtime.timerTicks[c.id] = (runtime.timerTicks[c.id] || 0) + 1;
        const requiredTicks = ({ short: 1, medium: 2, long: 4 })[c.properties?.delay] || 2;
        if (runtime.timerTicks[c.id] >= requiredTicks) { runtime.timers[c.id] = true; queueSimulationRefresh(); }
      }
    } else if (!stepMode && !runtime.timers[c.id] && !timerHandles.has(c.id)) {
      const delay = ({ short: 700, medium: 1400, long: 2400 })[c.properties?.delay] || 1400;
      timerHandles.set(c.id, setTimeout(() => { timerHandles.delete(c.id); if (running) { runtime.timers[c.id] = true; render(); } }, delay));
    }
  }
  return { pressure, exhaust, conflicts, cylinderSpeeds, flowDirections, activeWires: electrical.activeWires, activePorts: electrical.activePorts };
}
function portState(componentId, portId) {
  if (!running || !simulation) return "idle";
  const id = key(componentId, portId);
  if (simulation.conflicts.has(id)) return "conflict";
  if (simulation.pressure.has(id)) return "pressure";
  if (simulation.exhaust.has(id)) return "exhaust";
  return "idle";
}
function releaseMomentary() {
  if (stepMode) return;
  if (!activeMomentaryId) return;
  runtime.pressed[activeMomentaryId] = false;
  activeMomentaryId = null;
  if (running) render();
}

function pointOnComponent(c, portId) {
  const [dx, dy] = TYPES[c.type].ports[portId];
  return { x: c.x + dx, y: c.y + dy };
}
function renderWire(world, w) {
  const a = circuit.components.find(c => c.id === w.from.componentId);
  const b = circuit.components.find(c => c.id === w.to.componentId);
  if (!a || !b) return;
  const start = pointOnComponent(a, w.from.portId), end = pointOnComponent(b, w.to.portId);
  const direction = simulation?.flowDirections?.[w.id];
  const aComponent = circuit.components.find(c => c.id === w.from.componentId), bComponent = circuit.components.find(c => c.id === w.to.componentId);
  const electrical = isElectricalPort(aComponent.type, w.from.portId);
  const state = electrical ? (simulation?.activeWires?.has(w.id) ? "electric-active" : "idle") : portState(a.id, w.from.portId);
  const pathData = [start, ...(w.route || []), end].map((p, index) => `${index ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const flowClass = direction === "reverse" ? " flow-reverse" : direction === "forward" ? " flow-forward" : "";
  const electricState = simulation?.activeWires?.has(w.id) ? "electric-active" : "idle";
  const path = svg("path", { d: pathData, class: `wire ${electrical ? electricState : state}${electrical ? " electrical-wire" : flowClass}${selected?.kind === "wire" && selected.id === w.id ? " selected" : ""}`, tabindex: running ? "-1" : "0", role: "button", "aria-label": `${electrical ? "Cable" : "Conducte"} ${w.from.portId} a ${w.to.portId}: ${electrical ? (electricState === "electric-active" ? "circuit actiu" : "circuit obert") : state === "pressure" ? "amb pressió" : state === "exhaust" ? "escapament" : "sense pressió"}${direction ? direction === "forward" ? "; flux cap al segon port" : "; flux cap al primer port" : ""}` }, world);
  path.addEventListener("click", e => { e.stopPropagation(); if (!running) { selected = { kind: "wire", id: w.id }; render(); } });
  path.addEventListener("keydown", e => { if (e.key === "Enter" && !running) { selected = { kind: "wire", id: w.id }; render(); } });
}
function symbolArrow(group, x1, y1, x2, y2) {
  svg("line", { x1, y1, x2, y2, class: "symbol" }, group);
  const angle = Math.atan2(y2 - y1, x2 - x1), length = 9;
  const a = `${x2 - length * Math.cos(angle - .5)},${y2 - length * Math.sin(angle - .5)}`;
  const b = `${x2 - length * Math.cos(angle + .5)},${y2 - length * Math.sin(angle + .5)}`;
  svg("polyline", { points: `${a} ${x2},${y2} ${b}`, class: "symbol" }, group);
}
function symbolCap(group, x, y) {
  svg("path", { d: `M${x - 7} ${y}h14 M${x} ${y}v12`, class: "symbol" }, group);
}
function symbolSpring(group, x, y, width = 27) {
  const step = width / 6;
  svg("polyline", { points: `${x},${y} ${x + step},${y - 7} ${x + step * 2},${y + 7} ${x + step * 3},${y - 7} ${x + step * 4},${y + 7} ${x + step * 5},${y - 7} ${x + width},${y}`, class: "symbol" }, group);
}
function drawSymbol(group, c, previousCylinderState) {
  const def = TYPES[c.type];
  if (c.type === "source") {
    svg("circle", { cx: 48, cy: 50, r: 13, class: "symbol" }, group);
    svg("circle", { cx: 48, cy: 50, r: 3, class: "symbol-fill" }, group);
    svg("line", { x1: 61, y1: 50, x2: 105, y2: 50, class: "norm-port-line" }, group);
  } else if (c.type === "receiver") {
    svg("line", { x1: 0, y1: 60, x2: 38, y2: 60, class: "norm-port-line" }, group);
    svg("line", { x1: 162, y1: 60, x2: 200, y2: 60, class: "norm-port-line" }, group);
    svg("rect", { x: 38, y: 40, width: 124, height: 40, rx: 20, class: "symbol" }, group);
    svg("line", { x1: 100, y1: 80, x2: 100, y2: 96, class: "symbol" }, group);
    svg("path", { d: "M92 96h16l-8 9z", class: "symbol" }, group);
    svgText(group, 100, 115, "acumulador", "sub", { "text-anchor": "middle" });
  } else if (c.type === "note") {
    svgText(group, 10, 36, c.properties?.text || "Escriu una nota", "note-text");
  } else if (c.type === "electricSource") {
    svg("line", { x1: 0, y1: 30, x2: 85, y2: 30, class: "norm-port-line" }, group); svg("line", { x1: 0, y1: 70, x2: 85, y2: 70, class: "norm-port-line" }, group);
    svg("line", { x1: 48, y1: 17, x2: 48, y2: 43, class: "symbol" }, group); svg("line", { x1: 38, y1: 30, x2: 58, y2: 30, class: "symbol" }, group); svg("line", { x1: 42, y1: 70, x2: 54, y2: 70, class: "symbol" }, group);
    svgText(group, 93, 34, "+", "sub"); svgText(group, 93, 74, "−", "sub");
  } else if (["electricPush", "electricPushNC", "electricSwitch", "electricLimit", "magneticSensor"].includes(c.type)) {
    svg("line", { x1: 0, y1: 50, x2: 55, y2: 50, class: "norm-port-line" }, group); svg("line", { x1: 100, y1: 50, x2: 155, y2: 50, class: "norm-port-line" }, group);
    const momentary = c.type === "electricPush" || c.type === "electricPushNC";
    const target = targetCylinderFor(c);
    const closed = c.type === "electricPush" ? !!runtime.pressed[c.id] : c.type === "electricPushNC" ? !runtime.pressed[c.id] : c.type === "electricSwitch" ? !!runtime.valves[c.id] : !!target && runtime.cylinders[target.id] === (c.properties?.targetEnd || "extended");
    svg("circle", { cx: 65, cy: 50, r: 3, class: "symbol-fill" }, group); svg("circle", { cx: 90, cy: 50, r: 3, class: "symbol-fill" }, group);
    svg("line", { x1: 66, y1: 50, x2: closed ? 89 : 80, y2: closed ? 50 : 35, class: "symbol" }, group);
    if (momentary || c.type === "electricLimit" || c.type === "magneticSensor") { svg("line", { x1: 73, y1: 20, x2: 83, y2: 20, class: "symbol" }, group); svg("line", { x1: 78, y1: 20, x2: 78, y2: 32, class: "symbol" }, group); }
    if (c.type === "magneticSensor") svgText(group, 78, 14, "S", "sub", { "text-anchor": "middle" });
    if (momentary || c.type === "electricSwitch") {
      const button = svg("rect", { x: 55, y: 17, width: 47, height: 44, rx: 4, class: `actuator${closed ? " on" : ""}`, role: "button", tabindex: running ? "0" : "-1", "aria-label": momentary ? stepMode ? "Clica per activar o desactivar l'ordre elèctrica; prem Avança per continuar" : "Mantén premut el polsador elèctric" : "Commuta l'interruptor elèctric" }, group);
      const trigger = e => { e.stopPropagation(); if (!running) return; if (momentary && stepMode) runtime.pressed[c.id] = !runtime.pressed[c.id]; else if (momentary && activeMomentaryId !== c.id) { activeMomentaryId = c.id; runtime.pressed[c.id] = true; } else if (!momentary) runtime.valves[c.id] = !runtime.valves[c.id]; render(); };
      const release = e => { e.stopPropagation(); if (activeMomentaryId === c.id) releaseMomentary(); };
      button.addEventListener("pointerdown", trigger); button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release);
      button.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) trigger(e); } }); button.addEventListener("keyup", release);
    }
  } else if (c.type === "electricTimerRelay") {
    const on = !!runtime.electrical[c.id], done = !!runtime.timers[c.id];
    svg("path", { d: "M42 16q-13 12 0 24 M76 16q13 12 0 24 M42 16h34 M42 40h34", class: `symbol${on ? " norm-active" : ""}` }, group);
    svgText(group, 91, 34, "KT", "sub");
    svg("line", { x1: 0, y1: 100, x2: 50, y2: 100, class: "norm-port-line" }, group); svg("line", { x1: 140, y1: 100, x2: 190, y2: 100, class: "norm-port-line" }, group);
    svg("circle", { cx: 62, cy: 100, r: 3, class: "symbol-fill" }, group); svg("circle", { cx: 132, cy: 100, r: 3, class: "symbol-fill" }, group);
    svg("line", { x1: 63, y1: 100, x2: done ? 131 : 116, y2: done ? 100 : 83, class: "symbol" }, group);
    svgText(group, 98, 64, done ? "15–18 tancat" : on ? "retard en curs" : "15–18 obert", "sub", { "text-anchor": "middle" });
  } else if (["relayCoil", "relayContactNO", "relayContactNC"].includes(c.type)) {
    if (c.type === "relayCoil") { svg("path", { d: "M40 28q-15 22 0 44 M85 28q15 22 0 44 M40 28h45 M40 72h45", class: "symbol" }, group); svgText(group, 100, 55, c.properties?.relay || "K1", "sub"); }
    else { const nc = c.type === "relayContactNC", left = nc ? "21" : "13", right = nc ? "22" : "14", x1 = nc ? 53 : 53; svg("line", { x1: 0, y1: 50, x2: 52, y2: 50, class: "norm-port-line" }, group); svg("line", { x1: 108, y1: 50, x2: 160, y2: 50, class: "norm-port-line" }, group); const on = !!runtime.relays[c.properties?.relay || "K1"], closed = nc ? !on : on; svg("line", { x1, y1: 50, x2: closed ? 107 : 95, y2: closed ? 50 : 35, class: "symbol" }, group); svgText(group, 80, 84, `${c.properties?.relay || "K1"} ${nc ? "NC" : "NO"}`, "sub", { "text-anchor": "middle" }); }
  } else if (c.type === "valve5Electric") {
    const on = !!runtime.electrical[c.id];
    svg("rect", { x: 50, y: 42, width: 60, height: 60, class: `norm-box${on ? " norm-active" : ""}` }, group); svg("rect", { x: 110, y: 42, width: 60, height: 60, class: `norm-box${on ? "" : " norm-active"}` }, group);
    symbolArrow(group, 65, 91, 75, 53); symbolArrow(group, 80, 53, 85, 91); symbolArrow(group, 145, 91, 155, 53); symbolArrow(group, 135, 53, 125, 91);
    for (const x of [145, 170]) svg("line", { x1: x, y1: 0, x2: x, y2: 42, class: "norm-port-line" }, group); for (const x of [135, 155, 175]) svg("line", { x1: x, y1: 102, x2: x, y2: 155, class: "norm-port-line" }, group);
    svg("path", { d: "M25 55h15l8 8-8 8h-15 M25 95h15l8-8-8-8h-15", class: "symbol" }, group); svgText(group, 22, 52, "Y1", "sub");
  } else if (c.type === "valve5ElectricBistable") {
    const on = !!runtime.valves[c.id];
    svg("rect", { x: 60, y: 42, width: 60, height: 60, class: `norm-box${on ? " norm-active" : ""}` }, group);
    svg("rect", { x: 120, y: 42, width: 60, height: 60, class: `norm-box${on ? "" : " norm-active"}` }, group);
    symbolArrow(group, 75, 91, 85, 53); symbolArrow(group, 90, 53, 95, 91); symbolArrow(group, 155, 91, 165, 53); symbolArrow(group, 145, 53, 135, 91);
    for (const x of [155, 180]) svg("line", { x1: x, y1: 0, x2: x, y2: 42, class: "norm-port-line" }, group);
    for (const x of [145, 165, 185]) svg("line", { x1: x, y1: 102, x2: x, y2: 155, class: "norm-port-line" }, group);
    svg("path", { d: "M18 38h24v24H18z M18 94h24v24H18z M42 50h18 M42 106h18 M180 78h130", class: "symbol" }, group);
    svgText(group, 30, 54, "Y1", "sub", { "text-anchor": "middle" }); svgText(group, 30, 110, "Y2", "sub", { "text-anchor": "middle" });
  } else if (c.type === "tee") {
    svg("path", { d: "M0 45H100 M50 45V90", class: "norm-port-line" }, group);
    svg("circle", { cx: 50, cy: 45, r: 4, class: "symbol-fill" }, group);
  } else if (c.type === "electricJunction") {
    svg("path", { d: "M0 45H100 M50 45V90", class: "norm-port-line" }, group);
    svg("circle", { cx: 50, cy: 45, r: 5, class: "symbol-fill" }, group);
  } else if (c.type === "maintenance") {
    svg("line", { x1: 0, y1: 70, x2: 26, y2: 70, class: "norm-port-line" }, group);
    svg("line", { x1: 234, y1: 70, x2: 260, y2: 70, class: "norm-port-line" }, group);
    svg("line", { x1: 26, y1: 70, x2: 234, y2: 70, class: "symbol" }, group);
    svg("path", { d: "M64 48l22 22-22 22-22-22z M42 70h44 M64 92v12", class: "symbol" }, group);
    svg("rect", { x: 86, y: 48, width: 64, height: 44, class: "symbol" }, group);
    svg("path", { d: "M98 82l26-24 M118 70h25 M118 70v-20", class: "symbol" }, group);
    svg("circle", { cx: 126, cy: 34, r: 10, class: "symbol" }, group);
    svg("line", { x1: 126, y1: 34, x2: 130, y2: 29, class: "symbol" }, group);
    svg("path", { d: "M172 48l22 22-22 22-22-22z M150 70h44", class: "symbol" }, group);
    svgText(group, 64, 116, "filtre", "sub", { "text-anchor": "middle" });
    svgText(group, 118, 116, "regulador", "sub", { "text-anchor": "middle" });
    svgText(group, 172, 116, "lubricador", "sub", { "text-anchor": "middle" });
  } else if (c.type === "checkValve") {
    svg("line", { x1: 0, y1: 60, x2: 220, y2: 60, class: "norm-port-line" }, group);
    const reversed = c.properties?.direction === "AtoP";
    svg("path", { d: reversed ? "M142 48l-24 12 24 12z M112 45v30" : "M78 48l24 12-24 12z M108 45v30", class: "symbol" }, group);
    svgText(group, 110, 103, reversed ? "A → P" : "P → A", "sub", { "text-anchor": "middle" });
  } else if (c.type === "quickExhaust") {
    svg("line", { x1: 0, y1: 60, x2: 72, y2: 60, class: "norm-port-line" }, group);
    svg("path", { d: "M72 48l24 12-24 12z M100 45v30 M100 60h120 M110 60v45 M103 105h14", class: "symbol" }, group);
    svgText(group, 110, 124, "escapament local", "sub", { "text-anchor": "middle" });
  } else if (c.type === "flowRegulatorOneWay") {
    svg("path", { d: "M0 51h78l22 12-22 12H0 M162 51h78 M162 51l-22 12 22 12", class: "norm-port-line" }, group);
    svg("path", { d: "M78 51l22 12-22 12z M162 51l-22 12 22 12z", class: "symbol" }, group);
    symbolArrow(group, 104, 91, 135, 29);
    const opening = c.properties?.opening || "medium";
    const label = { closed: "tancat", low: "poc", medium: "mitjà", open: "obert" }[opening] || "mitjà";
    svgText(group, 120, 116, `${label} · retorn lliure`, "sub", { "text-anchor": "middle" });
  } else if (c.type === "limitValve3") {
    const targetId = targetCylinderFor(c)?.id;
    const active = !!targetId && runtime.cylinders[targetId] === (c.properties?.targetEnd || "extended");
    const left = svg("rect", { x: 40, y: 45, width: 60, height: 60, class: `norm-box${active ? " norm-active" : ""}` }, group);
    svg("rect", { x: 100, y: 45, width: 60, height: 60, class: `norm-box${active ? "" : " norm-active"}` }, group);
    symbolArrow(group, 55, 94, 65, 55); symbolCap(group, 84, 79);
    symbolArrow(group, 125, 55, 145, 94); symbolCap(group, 115, 79);
    for (const [x, y1, y2] of [[125, 0, 45], [115, 105, 155], [145, 105, 155]]) svg("line", { x1: x, y1, x2: x, y2, class: "norm-port-line" }, group);
    if (c.properties?.actuator === "direct") svg("path", { d: "M8 75h32 M22 61v28", class: "symbol" }, group);
    else if (c.properties?.actuator === "cam") svg("path", { d: "M8 83l20-22 14 19 M40 75h-8", class: "symbol" }, group);
    else svg("path", { d: "M9 75h23l9-16 M22 75a8 8 0 1 0 16 0a8 8 0 1 0-16 0", class: "symbol" }, group);
  } else if (c.type === "logicOr" || c.type === "logicAnd") {
    svg("line", { x1: 0, y1: 35, x2: 45, y2: 48, class: "norm-port-line" }, group);
    svg("line", { x1: 0, y1: 85, x2: 45, y2: 72, class: "norm-port-line" }, group);
    svg("line", { x1: 175, y1: 60, x2: 220, y2: 60, class: "norm-port-line" }, group);
    svg("path", { d: c.type === "logicOr" ? "M45 42h72a18 18 0 0 1 0 36H45z M117 60h58" : "M45 42h52a18 18 0 0 1 0 36H45z M115 60h60", class: "symbol" }, group);
    svgText(group, 110, 108, c.type === "logicOr" ? "passa X o Y" : "cal X i Y", "sub", { "text-anchor": "middle" });
  } else if (c.type === "timer3") {
    svg("line", { x1: 0, y1: 70, x2: 40, y2: 70, class: "norm-port-line" }, group);
    svg("line", { x1: 180, y1: 70, x2: 220, y2: 70, class: "norm-port-line" }, group);
    svg("rect", { x: 40, y: 45, width: 60, height: 50, class: `norm-box${runtime.timers[c.id] ? " norm-active" : ""}` }, group);
    svg("rect", { x: 100, y: 45, width: 60, height: 50, class: `norm-box${runtime.timers[c.id] ? "" : " norm-active"}` }, group);
    symbolArrow(group, 55, 86, 65, 55); symbolCap(group, 84, 73);
    symbolArrow(group, 125, 55, 145, 86); symbolCap(group, 115, 73);
    svg("line", { x1: 110, y1: 0, x2: 110, y2: 45, class: "norm-port-line" }, group);
    svg("path", { d: "M110 13v13l8-6z M110 102v18 M104 120h12", class: "symbol" }, group);
    svg("line", { x1: 110, y1: 95, x2: 110, y2: 140, class: "norm-port-line" }, group);
    svgText(group, 110, 134, { short: "retard curt", medium: "retard mitjà", long: "retard llarg" }[c.properties?.delay || "medium"], "sub", { "text-anchor": "middle" });
  } else if (c.type === "pressureSequence") {
    const active = !!runtime.timers[c.id];
    svg("line", { x1: 0, y1: 72, x2: 40, y2: 72, class: "norm-port-line" }, group); svg("line", { x1: 210, y1: 72, x2: 250, y2: 72, class: "norm-port-line" }, group);
    svg("rect", { x: 40, y: 47, width: 60, height: 50, class: `norm-box${active ? " norm-active" : ""}` }, group); svg("rect", { x: 100, y: 47, width: 60, height: 50, class: `norm-box${active ? "" : " norm-active"}` }, group);
    symbolArrow(group, 55, 88, 65, 57); symbolCap(group, 84, 72); symbolArrow(group, 125, 57, 145, 88); symbolCap(group, 115, 72);
    svg("line", { x1: 125, y1: 0, x2: 125, y2: 47, class: "norm-port-line" }, group); svg("line", { x1: 125, y1: 97, x2: 125, y2: 145, class: "norm-port-line" }, group); svg("path", { d: "M119 127h12l-6 9z", class: "symbol" }, group);
    svgText(group, 125, 122, { short: "llindar baix", medium: "llindar mitjà", long: "llindar alt" }[c.properties?.delay || "medium"], "sub", { "text-anchor": "middle" });
  } else if (c.type === "valve53") {
    const state = runtime.valves[c.id] || "center";
    const centerMode = c.properties?.center || "closed";
    for (let i = 0; i < 3; i++) svg("rect", { x: 30 + i * 60, y: 42, width: 60, height: 60, class: `norm-box${(state === "left" && i === 0) || (state === "center" && i === 1) || (state === "right" && i === 2) ? " norm-active" : ""}` }, group);
    symbolArrow(group, 45, 91, 55, 53); symbolCap(group, 74, 76); symbolArrow(group, 75, 53, 85, 91); symbolCap(group, 65, 76);
    if (centerMode === "closed") { symbolCap(group, 120, 53); symbolCap(group, 130, 53); symbolCap(group, 115, 84); symbolCap(group, 135, 84); }
    else if (centerMode === "exhaust") { symbolArrow(group, 118, 55, 118, 88); symbolArrow(group, 140, 55, 140, 88); }
    else { symbolArrow(group, 118, 88, 118, 55); symbolArrow(group, 140, 88, 140, 55); }
    symbolArrow(group, 165, 91, 155, 53); symbolArrow(group, 175, 53, 185, 91); symbolCap(group, 194, 76);
    for (const x of [155, 180]) svg("line", { x1: x, y1: 0, x2: x, y2: 42, class: "norm-port-line" }, group);
    for (const x of [145, 165, 185]) svg("line", { x1: x, y1: 102, x2: x, y2: 155, class: "norm-port-line" }, group);
    symbolSpring(group, 212, 72, 27); symbolSpring(group, 2, 72, 27);
    svgText(group, 120, 128, { closed: "centre tancat", exhaust: "centre a escapament", pressure: "centre a pressió" }[centerMode], "sub", { "text-anchor": "middle" });
  } else if (c.type === "valve5Pilot") {
    const active = !!runtime.valves[c.id];
    svg("rect", { x: 50, y: 42, width: 60, height: 60, class: `norm-box${active ? " norm-active" : ""}` }, group);
    svg("rect", { x: 110, y: 42, width: 60, height: 60, class: `norm-box${active ? "" : " norm-active"}` }, group);
    symbolArrow(group, 65, 91, 75, 53); symbolArrow(group, 80, 53, 85, 91); symbolArrow(group, 145, 91, 155, 53); symbolArrow(group, 135, 53, 125, 91);
    for (const x of [145, 170]) svg("line", { x1: x, y1: 0, x2: x, y2: 42, class: "norm-port-line" }, group);
    for (const x of [135, 155, 175]) svg("line", { x1: x, y1: 102, x2: x, y2: 155, class: "norm-port-line" }, group);
    svg("path", { d: "M2 58l12 14-12 14 M288 58l-12 14 12 14", class: "symbol" }, group);
  } else if (c.type === "flowRegulator") {
    svg("line", { x1: 0, y1: 60, x2: 220, y2: 60, class: "norm-port-line" }, group);
    svg("path", { d: "M78 48l22 12-22 12z M142 48l-22 12 22 12z", class: "symbol" }, group);
    symbolArrow(group, 104, 91, 135, 29);
    const opening = c.properties?.opening || "open";
    const label = { closed: "tancat", low: "poc", medium: "mitjà", open: "obert" }[opening] || "obert";
    svgText(group, 110, 108, label, "sub", { "text-anchor": "middle" });
  } else if (["valve2", "valve3", "valve3Pilot", "valve4", "valve5"].includes(c.type)) {
    const pilotValve = c.type === "valve3Pilot";
    const is2 = c.type === "valve2", is3 = c.type === "valve3" || pilotValve, is4 = c.type === "valve4";
    const properties = { ...defaultValveProperties(c.type), ...c.properties };
    const momentary = pilotValve || properties.returnMode === "spring";
    const active = pilotValve ? !!runtime.valves[c.id] : momentary ? !!runtime.pressed[c.id] : !!runtime.valves[c.id];
    const offset = active ? 60 : 0;
    const left = is2 || is3 ? 40 : 50;
    const leftSelected = is3 && properties.normallyOpen ? !active : active;
    const spool = svg("g", { transform: `translate(${offset} 0)` }, group);
    svg("rect", { x: left, y: 42, width: 60, height: 60, class: `norm-box${leftSelected ? " norm-active" : ""}` }, spool);
    svg("rect", { x: left + 60, y: 42, width: 60, height: 60, class: `norm-box${leftSelected ? "" : " norm-active"}` }, spool);
    if (is2) {
      symbolArrow(spool, 55, 91, 65, 53);
      symbolCap(spool, 125, 55); symbolCap(spool, 115, 84);
      svg("line", { x1: 125, y1: 0, x2: 125, y2: 42, class: "norm-port-line" }, group);
      svg("line", { x1: 115, y1: 102, x2: 115, y2: 155, class: "norm-port-line" }, group);
    } else if (is3) {
      symbolArrow(spool, 55, 91, 65, 53); symbolCap(spool, 84, 76);
      symbolArrow(spool, 125, 53, 145, 91); symbolCap(spool, 115, 76);
      for (const [x, top] of [[125, true], [115, false], [145, false]]) {
        svg("line", { x1: x, y1: top ? 0 : 102, x2: x, y2: top ? 42 : 155, class: "norm-port-line" }, group);
      }
    } else if (is4) {
      symbolArrow(spool, 85, 91, 75, 53); symbolArrow(spool, 100, 53, 105, 91);
      symbolArrow(spool, 145, 91, 160, 53); symbolArrow(spool, 135, 53, 165, 91);
      for (const x of [135, 160]) svg("line", { x1: x, y1: 0, x2: x, y2: 42, class: "norm-port-line" }, group);
      for (const x of [145, 165]) svg("line", { x1: x, y1: 102, x2: x, y2: 155, class: "norm-port-line" }, group);
    } else {
      symbolArrow(spool, 85, 91, 75, 53); symbolArrow(spool, 100, 53, 105, 91);
      symbolArrow(spool, 145, 91, 160, 53); symbolArrow(spool, 135, 53, 125, 91);
      for (const x of [135, 160]) svg("line", { x1: x, y1: 0, x2: x, y2: 42, class: "norm-port-line" }, group);
      for (const x of [125, 145, 165]) svg("line", { x1: x, y1: 102, x2: x, y2: 155, class: "norm-port-line" }, group);
    }
    // El triangle indica el port d'escapament, independentment del seu estat.
    for (const x of is3 ? [145] : is4 ? [165] : c.type === "valve5" ? [125, 165] : []) svg("path", { d: `M${x - 6} 134h12l-6 9z`, class: "symbol" }, group);
    if (is3) svgText(group, 120, 128, properties.normallyOpen ? "NO" : "NC", "sub", { "text-anchor": "middle" });
    if (pilotValve) { svg("path", { d: "M2 58l12 14-12 14", class: "symbol" }, group); symbolSpring(group, 205 + offset, 72, 27); }
    else if (momentary) symbolSpring(group, (is2 || is3 ? 164 : 174) + offset, 72, 27);
    let button;
    const actuator = properties.actuator || DEFAULT_ACTUATOR[c.type];
    const actuatorLabel = actuator === "lever" ? "palanca" : actuator === "pedal" ? "pedal" : "polsador";
    const article = actuator === "lever" ? "la" : "el";
    const ariaLabel = momentary ? stepMode ? `Clica per activar o desactivar ${article} ${actuatorLabel} de la vàlvula ${def.short}; prem Avança per continuar` : `Mantén premut ${article} ${actuatorLabel} de la vàlvula ${def.short}` : `Commuta la vàlvula ${def.short} amb ${article} ${actuatorLabel}`;
    if (pilotValve) {
      // X is the pneumatic pilot signal; there is no manual control.
    } else if (actuator === "lever") {
      button = svg("circle", { cx: 15, cy: 54, r: 6, class: `actuator${active ? " on" : ""}`, role: "button", tabindex: running ? "0" : "-1", "aria-label": ariaLabel }, group);
      svg("path", { d: `M15 54l15 -18 M29 72H${left + offset}`, class: "symbol" }, group);
    } else if (actuator === "pedal") {
      button = svg("path", { d: "M5 62h9l12 10-12 10H5z", class: `actuator${active ? " on" : ""}`, role: "button", tabindex: running ? "0" : "-1", "aria-label": ariaLabel }, group);
      svg("path", { d: `M26 72H${left + offset} M10 84l12 -7h8`, class: "symbol" }, group);
    } else {
      button = svg("rect", { x: 4, y: 56, width: 25, height: 32, rx: 2, class: `actuator${active ? " on" : ""}`, role: "button", tabindex: running ? "0" : "-1", "aria-label": ariaLabel }, group);
      svg("path", { d: `M29 72H${left + offset} M10 50h13 M16 50v6`, class: "symbol" }, group);
    }
    if (!button) return;
    const trigger = e => { e.stopPropagation(); if (!running) return; if (!momentary) { runtime.valves[c.id] = !runtime.valves[c.id]; render(); } else if (stepMode) { runtime.pressed[c.id] = !runtime.pressed[c.id]; render(); } else if (activeMomentaryId !== c.id) { activeMomentaryId = c.id; runtime.pressed[c.id] = true; render(); } };
    const release = e => { e.stopPropagation(); releaseMomentary(); };
    button.addEventListener("pointerdown", trigger);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) trigger(e); } });
    button.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") release(e); });
  } else if (c.type === "single" || c.type === "double") {
    svg("rect", { x: 20, y: 38, width: 130, height: 57, class: "norm-box" }, group);
    const extended = runtime.cylinders[c.id] === "extended";
    const progress = clamp(runtime.cylinderProgress[c.id] ?? (extended ? 4 : 0), 0, 4) / 4;
    const pistonX = 56 + 56 * progress;
    const rodEnd = 172 + 36 * progress;
    const piston = svg("rect", { x: pistonX, y: 41, width: 5, height: 51, class: "piston" }, group);
    const rod = svg("line", { x1: pistonX + 5, y1: 65, x2: rodEnd, y2: 65, class: "symbol" }, group);
    svg("path", { d: "M150 58v14", class: "symbol" }, group);
    svg("line", { x1: 40, y1: 95, x2: 40, y2: 140, class: "norm-port-line" }, group);
    if (c.type === "double") svg("line", { x1: 130, y1: 95, x2: 130, y2: 140, class: "norm-port-line" }, group);
    else symbolSpring(group, pistonX + 12, 82, Math.max(18, 140 - pistonX - 20));
    if (!stepMode && previousCylinderState && previousCylinderState !== runtime.cylinders[c.id] && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const oldX = previousCylinderState === "extended" ? 112 : 56;
      const oldEnd = previousCylinderState === "extended" ? 208 : 172;
      const speed = simulation?.cylinderSpeeds?.[c.id] || 3;
      const duration = speed === 1 ? "1.4s" : speed === 2 ? ".75s" : ".35s";
      svg("animate", { attributeName: "x", from: oldX, to: pistonX, dur: duration, fill: "freeze" }, piston);
      svg("animate", { attributeName: "x1", from: oldX + 5, to: pistonX + 5, dur: duration, fill: "freeze" }, rod);
      svg("animate", { attributeName: "x2", from: oldEnd, to: extended ? 208 : 172, dur: duration, fill: "freeze" }, rod);
    }
  }
}
function renderComponent(world, c, previousCylinderState) {
  const def = TYPES[c.type];
  const group = svg("g", { transform: `translate(${c.x} ${c.y})`, class: `component${c.type === "note" ? " annotation" : ""}${selected?.kind === "component" && selected.id === c.id ? " selected" : ""}`, role: "button", tabindex: "0", "aria-label": `${def.label}: ${c.id}` }, world);
  svg("rect", { x: 0, y: 0, width: def.w, height: def.h, rx: 10, class: "body" }, group);
  svgText(group, c.type === "source" ? 8 : 20, c.type === "source" ? 88 : 20, def.short, "label");
  drawSymbol(group, c, previousCylinderState);
  group.addEventListener("pointerdown", e => {
    if (e.target.classList.contains("port") || e.target.classList.contains("actuator")) return;
    if (panMode) return;
    e.stopPropagation(); selected = { kind: "component", id: c.id };
    if (!running) { remember(); pointerAction = { kind: "move", id: c.id, start: screenPoint(e), x: c.x, y: c.y, moved: false }; $("circuitCanvas").setPointerCapture(e.pointerId); }
    renderInspector();
  });
  group.addEventListener("keydown", e => {
    if (e.target !== group || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault(); selected = { kind: "component", id: c.id }; renderInspector();
  });
  for (const [portId, [x, y]] of Object.entries(def.ports)) {
    const electricActive = simulation?.activePorts?.has(key(c.id, portId));
    const circle = svg("circle", { cx: x, cy: y, r: 7, class: `port${isElectricalPort(c.type, portId) ? " electric-port" : ""}${electricActive ? " active" : ""}${pendingPort?.componentId === c.id && pendingPort?.portId === portId ? " pending" : ""}`, role: "button", tabindex: running ? "-1" : "0", "aria-label": `Port ${portId} de ${def.label}${isElectricalPort(c.type, portId) ? electricActive ? ", circuit elèctric actiu" : ", circuit elèctric obert" : ""}` }, group);
    svgText(group, x >= def.w ? x - 12 : x, y < 20 ? 31 : y > def.h - 15 ? def.h - 24 : y - 13, portId, "port-label", { "text-anchor": x >= def.w ? "end" : "middle" });
    circle.addEventListener("pointerdown", e => { if (panMode) return; e.stopPropagation(); clickPort(c.id, portId); });
    circle.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickPort(c.id, portId); } });
  }
}
function screenPoint(e) {
  const canvas = $("circuitCanvas");
  const p = canvas.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(canvas.getScreenCTM().inverse());
}
function worldPoint(e) {
  const p = screenPoint(e), view = circuit.view;
  return { x: (p.x - view.pan.x) / view.zoom, y: (p.y - view.pan.y) / view.zoom };
}
function renderInspector() {
  const panel = $("selectionPanel"); panel.replaceChildren();
  $("circuitCount").textContent = `${circuit.components.length} ${circuit.components.length === 1 ? "component" : "components"} · ${circuit.connections.length} ${circuit.connections.length === 1 ? "conducte" : "conductes"}`;
  $("componentInspector").hidden = !selected;
  if (!selected) return;
  if (selected.kind === "wire") { $("inspectorTitle").textContent = "Connexió"; const p = document.createElement("p"); p.textContent = "Pots seleccionar punts intermedis quan dibuixes la connexió. El recorregut queda desat al fitxer JSON."; panel.append(p); return; }
  const c = circuit.components.find(x => x.id === selected.id); if (!c) { $("componentInspector").hidden = true; return; }
  $("inspectorTitle").textContent = TYPES[c.type].label;
  for (const portId of Object.keys(TYPES[c.type].ports)) { const pill = document.createElement("span"); pill.className = "pill"; const state = isElectricalPort(c.type, portId) ? simulation?.activePorts?.has(key(c.id, portId)) ? "circuit actiu" : "circuit obert" : portState(c.id, portId) === "pressure" ? "pressió" : portState(c.id, portId) === "exhaust" ? "escapament" : "sense pressió"; pill.textContent = `${portId}: ${state}`; panel.append(pill); }
  if (c.type === "note") {
    const label = document.createElement("label"); label.className = "field-label"; label.htmlFor = "noteText"; label.textContent = "Text de l'anotació"; panel.append(label);
    const input = document.createElement("textarea"); input.id = "noteText"; input.className = "text-field"; input.maxLength = 120; input.value = c.properties.text || ""; input.disabled = running; input.addEventListener("change", () => edit(() => { c.properties.text = input.value.trim().slice(0, 120) || "Nota"; })); panel.append(input);
  }
  if (!running && ["relayCoil", "relayContactNO", "relayContactNC"].includes(c.type)) {
    const label = document.createElement("label"); label.className = "field-label"; label.htmlFor = "relayName"; label.textContent = "Referència del relé"; panel.append(label);
    const input = document.createElement("input"); input.id = "relayName"; input.className = "text-field"; input.maxLength = 12; input.value = c.properties.relay || "K1"; input.addEventListener("change", () => edit(() => { c.properties.relay = input.value.trim().slice(0, 12) || "K1"; })); panel.append(input);
  }
  if (c.type === "single" || c.type === "double") { const p = document.createElement("p"); const state = runtime.cylinders[c.id]; p.textContent = `Èmbol: ${state === "extended" ? "estès" : state === "retracted" ? "retret" : "en moviment"}`; panel.append(p); }
  if (DISTRIBUTORS.has(c.type) && !running) {
    const actuatorLabel = document.createElement("label"); actuatorLabel.className = "field-label"; actuatorLabel.textContent = "Accionament"; actuatorLabel.htmlFor = "actuatorMode"; panel.append(actuatorLabel);
    const actuatorSelect = document.createElement("select"); actuatorSelect.id = "actuatorMode"; actuatorSelect.className = "text-field";
    for (const [value, text] of [["pushbutton", "Polsador"], ["lever", "Palanca"], ["pedal", "Pedal"]]) { const opt = document.createElement("option"); opt.value = value; opt.textContent = text; actuatorSelect.append(opt); }
    actuatorSelect.value = c.properties.actuator || DEFAULT_ACTUATOR[c.type];
    actuatorSelect.addEventListener("change", () => edit(() => { c.properties.actuator = actuatorSelect.value; })); panel.append(actuatorSelect);
    const label = document.createElement("label"); label.className = "field-label"; label.textContent = "Retorn"; label.htmlFor = "returnMode"; panel.append(label);
    const select = document.createElement("select"); select.id = "returnMode"; select.className = "text-field";
    for (const [value, text] of [["spring", "Molla de retorn"], ["memory", "Posició mantinguda"]]) { const opt = document.createElement("option"); opt.value = value; opt.textContent = text; select.append(opt); }
    select.value = c.properties.returnMode || defaultValveProperties(c.type).returnMode;
    select.addEventListener("change", () => edit(() => { c.properties.returnMode = select.value; })); panel.append(select);
  }
  const addSelect = (id, title, options, value, onChange) => {
    const label = document.createElement("label"); label.className = "field-label"; label.textContent = title; label.htmlFor = id; panel.append(label);
    const select = document.createElement("select"); select.id = id; select.className = "text-field";
    for (const [optionValue, text] of options) { const opt = document.createElement("option"); opt.value = optionValue; opt.textContent = text; select.append(opt); }
    select.value = value; select.addEventListener("change", () => onChange(select.value)); panel.append(select);
  };
  const openingOptions = [["closed", "Tancat"], ["low", "Poc"], ["medium", "Mitjà"], ["open", "Obert"]];
  if (!running && c.type === "flowRegulator") addSelect("flowOpening", "Obertura qualitativa", openingOptions, c.properties.opening || "open", value => edit(() => { c.properties.opening = value; }));
  if (!running && c.type === "valve3") addSelect("valve3Rest", "Posició normal", [["closed", "NC: P tancat; A a escapament"], ["open", "NO: P connectat amb A"]], c.properties.normallyOpen ? "open" : "closed", value => edit(() => { c.properties.normallyOpen = value === "open"; }));
  if (!running && c.type === "valve53") addSelect("valve53Center", "Posició central", [["closed", "Centre tancat"], ["exhaust", "Centre a escapament"], ["pressure", "Centre a pressió"]], c.properties.center || "closed", value => edit(() => { c.properties.center = value; }));
  if (!running && c.type === "checkValve") addSelect("checkDirection", "Sentit permès", [["PtoA", "P → A"], ["AtoP", "A → P"]], c.properties.direction || "PtoA", value => edit(() => { c.properties.direction = value; }));
  if (!running && c.type === "flowRegulatorOneWay") {
    addSelect("oneWayOpening", "Obertura regulada", openingOptions, c.properties.opening || "medium", value => edit(() => { c.properties.opening = value; }));
    addSelect("oneWayDirection", "Sentit regulat", [["PtoA", "P → A (retorn lliure A → P)"], ["AtoP", "A → P (retorn lliure P → A)"]], c.properties.regulatedDirection || "PtoA", value => edit(() => { c.properties.regulatedDirection = value; }));
  }
  if (!running && c.type === "limitValve3") {
    const cylinders = circuit.components.filter(isCylinder);
    const currentTarget = cylinders.some(item => item.id === c.properties.targetCylinder) ? c.properties.targetCylinder : "";
    addSelect("limitActuator", "Accionament mecànic", [["direct", "Tija directa"], ["roller", "Corró"], ["cam", "Lleva"]], c.properties.actuator || "roller", value => edit(() => { c.properties.actuator = value; }));
    addSelect("limitCylinder", "Cilindre supervisat", [["", "Primer cilindre"], ...cylinders.map((item, index) => [item.id, `Cilindre ${index + 1}`])], currentTarget, value => edit(() => { c.properties.targetCylinder = value; }));
    addSelect("limitEnd", "Extrem d'accionament", [["extended", "Estès"], ["retracted", "Retret"]], c.properties.targetEnd || "extended", value => edit(() => { c.properties.targetEnd = value; }));
  }
  if (!running && ["timer3", "pressureSequence", "electricTimerRelay"].includes(c.type)) addSelect("timerDelay", c.type === "pressureSequence" ? "Llindar qualitatiu (abstracte)" : "Retard qualitatiu", [["short", c.type === "pressureSequence" ? "Baix" : "Curt"], ["medium", "Mitjà"], ["long", c.type === "pressureSequence" ? "Alt" : "Llarg"]], c.properties.delay || "medium", value => edit(() => { c.properties.delay = value; }));
  if (!running && ["electricLimit", "magneticSensor"].includes(c.type)) {
    const cylinders = circuit.components.filter(isCylinder);
    addSelect("electricLimitCylinder", "Cilindre supervisat", [["", "Primer cilindre"], ...cylinders.map((item, index) => [item.id, `Cilindre ${index + 1}`])], c.properties.targetCylinder || "", value => edit(() => { c.properties.targetCylinder = value; }));
    addSelect("electricLimitEnd", "Extrem d'accionament", [["extended", "Estès"], ["retracted", "Retret"]], c.properties.targetEnd || "extended", value => edit(() => { c.properties.targetEnd = value; }));
  }
  if (running && c.type === "valve53") {
    const label = document.createElement("p"); label.textContent = "Tria la posició del distribuïdor."; panel.append(label);
    const centerLabel = { closed: "Centre tancat", exhaust: "Centre a escapament", pressure: "Centre a pressió" }[c.properties.center] || "Centre tancat";
    for (const [position, text] of [["left", "Posició A"], ["center", centerLabel], ["right", "Posició B"]]) {
      const button = document.createElement("button"); button.className = "secondary wide"; button.textContent = text;
      button.addEventListener("click", () => { runtime.valves[c.id] = position; render(); }); panel.append(button);
    }
  }
  if (running && c.type === "limitValve3") { const target = targetCylinderFor(c); const p = document.createElement("p"); p.textContent = `Final mecànic ${target && runtime.cylinders[target.id] === (c.properties.targetEnd || "extended") ? "accionat" : "en repòs"}.`; panel.append(p); }
  if (running && c.type === "valve3Pilot") { const p = document.createElement("p"); p.textContent = runtime.valves[c.id] ? "Pilot X actiu; connexió P–A." : "Sense senyal de pilotatge; connexió A–R."; panel.append(p); }
  if (running && c.type === "magneticSensor") { const target = targetCylinderFor(c); const p = document.createElement("p"); p.textContent = target && runtime.cylinders[target.id] === (c.properties.targetEnd || "extended") ? "Sensor activat: contacte 1–2 tancat." : "Sensor en repòs: contacte 1–2 obert."; panel.append(p); }
  if (running && ["timer3", "pressureSequence", "electricTimerRelay"].includes(c.type)) { const p = document.createElement("p"); const needed = ({ short: 1, medium: 2, long: 4 })[c.properties?.delay] || 2; p.textContent = runtime.timers[c.id] ? "Retard completat; contacte/sortida activat." : stepMode ? `Passos qualitatius: ${runtime.timerTicks[c.id] || 0}/${needed}.` : timerHandles.has(c.id) ? "Retard qualitatiu en curs." : c.type === "electricTimerRelay" ? "En espera d'alimentació a A1–A2." : "En espera de senyal a X."; panel.append(p); }
  if (running && c.type === "valve5Pilot") { const p = document.createElement("p"); p.textContent = `Posició ${runtime.valves[c.id] ? "P–A / B–S" : "P–B / A–R"}. X commuta cap a A; Y commuta cap a B.`; panel.append(p); }
  if (running && c.type === "valve5Electric") { const p = document.createElement("p"); p.textContent = runtime.electrical[c.id] ? "Bobina energitzada; posició P–A / B–S." : "Bobina desenergitzada; retorn per molla a P–B / A–R."; panel.append(p); }
  if (running && c.type === "valve5ElectricBistable") { const p = document.createElement("p"); p.textContent = runtime.electrical[`${c.id}:A`] && runtime.electrical[`${c.id}:B`] ? "Avís: Y1 i Y2 estan activades alhora; es manté l'estat anterior." : runtime.valves[c.id] ? "Bobina Y1 activada; posició P–A / B–S. Manté la posició en deixar anar el comandament." : "Posició P–B / A–R. S'hi manté fins que s'activa Y1."; panel.append(p); }
  if (running && DISTRIBUTORS.has(c.type)) {
    const button = document.createElement("button"); button.className = "secondary wide";
    const properties = { ...defaultValveProperties(c.type), ...c.properties };
    const momentary = properties.returnMode === "spring";
    const actuator = properties.actuator;
    const actuatorLabel = actuator === "lever" ? "palanca" : actuator === "pedal" ? "pedal" : "polsador";
    const article = actuator === "lever" ? "la" : "el";
    button.textContent = momentary ? stepMode ? `${runtime.pressed[c.id] ? "Ordre activada" : "Activa l'ordre"}; prem Avança i clica de nou per deixar-la anar` : `Mantén premut ${article} ${actuatorLabel}` : `Commuta amb ${article} ${actuatorLabel}`;
    const trigger = e => { e.preventDefault(); if (!momentary) runtime.valves[c.id] = !runtime.valves[c.id]; else if (stepMode) runtime.pressed[c.id] = !runtime.pressed[c.id]; else if (activeMomentaryId !== c.id) { activeMomentaryId = c.id; runtime.pressed[c.id] = true; } render(); };
    const release = e => { e.preventDefault(); releaseMomentary(); };
    button.addEventListener("pointerdown", trigger); button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release);
    button.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!e.repeat) trigger(e); } });
    button.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") release(e); });
    panel.append(button);
  }
}
function render() {
  const previousCylinderStates = { ...runtime.cylinders };
  const advanceTimeStep = stepAdvancePending;
  stepAdvancePending = false;
  simulation = running ? buildSimulation(advanceTimeStep) : null;
  const world = $("world"); world.replaceChildren();
  world.setAttribute("transform", `translate(${circuit.view.pan.x} ${circuit.view.pan.y}) scale(${circuit.view.zoom})`);
  $("circuitCanvas").classList.toggle("pan", panMode);
  for (const wire of circuit.connections) renderWire(world, wire);
  for (const comp of circuit.components) renderComponent(world, comp, previousCylinderStates[comp.id]);
  if (pendingPort && cursorWorldPoint) {
    const source = circuit.components.find(c => c.id === pendingPort.componentId);
    if (source) { const points = [pointOnComponent(source, pendingPort.portId), ...(pendingPort.route || []), cursorWorldPoint]; svg("path", { d: points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" "), class: "wire preview-wire" }, world); }
  }
  $("circuitName").value = circuit.metadata.name;
  $("circuitName").disabled = running;
  $("simulateIcon").innerHTML = running ? '<path d="M6 6h12v12H6z" />' : '<path d="m7 4 14 8-14 8z" />';
  $("simulateLabel").textContent = running ? "Edita" : "Simula";
  $("simulateBtn").setAttribute("aria-label", running ? "Atura la simulació i torna a editar" : "Inicia la simulació");
  $("simulateBtn").title = running ? "Atura la simulació i torna a editar" : "Inicia la simulació";
  $("modeLabel").textContent = running ? stepMode ? "Simulació pas a pas" : "Mode simulació" : stepMode ? "Mode pas a pas preparat" : "Mode edició";
  $("canvasHint").textContent = running ? stepMode ? "Acciona un comandament i prem Avança per moure els cilindres i completar els temporitzadors." : "Acciona els comandaments i observa l'aire i els senyals elèctrics." : pendingPort ? "Clica per afegir girs; amb teclat usa fletxes i Retorn. Acaba en un port compatible." : panMode ? "Arrossega el llenç per moure la vista." : "Clica dos ports per connectar-los; afegeix girs amb clics al llenç.";
  $("stepModeBtn").disabled = running;
  $("stepModeBtn").setAttribute("aria-pressed", String(stepMode));
  $("stepModeBtn").title = stepMode ? "Desactiva el mode pas a pas" : "Activa el mode pas a pas";
  $("stepModeBtn").classList.toggle("active-tool", stepMode);
  $("stepBtn").disabled = !running || !stepMode;
  $("resetBtn").disabled = !running;
  $("deleteBtn").disabled = running || !selected;
  $("copyBtn").disabled = running || selected?.kind !== "component";
  $("pasteBtn").disabled = running || !clipboardComponent;
  $("clickToolBtn").disabled = running;
  $("panBtn").disabled = running;
  $("textBtn").disabled = running;
  $("panBtn").setAttribute("aria-pressed", String(panMode));
  $("panBtn").classList.toggle("active-tool", panMode);
  $("clickToolBtn").setAttribute("aria-pressed", String(!running && !panMode && !selectedType));
  $("clickToolBtn").classList.toggle("active-tool", !running && !panMode && !selectedType);
  $("undoBtn").disabled = running || !history.length;
  $("redoBtn").disabled = running || !future.length;
  $("zoomLabel").textContent = `${Math.round(circuit.view.zoom * 100)}%`;
  document.querySelectorAll(".library-item").forEach(node => node.classList.toggle("active", node.dataset.type === selectedType));
  if (simulation?.conflicts.size) status("Conflicte: una xarxa comunica pressió i escapament.");
  renderInspector();
}
function loadExample(kind) {
  if (dirty && !confirm("Hi ha canvis no descarregats. Vols obrir un exemple?")) return;
  if (["threeTwoNO", "quickExhaust", "electricBistable", "pilot3", "pressureSequence", "magneticSensor", "electricTimer"].includes(kind)) {
    let components, connections, name, message;
    if (kind === "threeTwoNO") {
      components = [
        { id: "font", type: "source", x: 90, y: 270, properties: {} },
        { id: "valvula", type: "valve3", x: 390, y: 250, properties: { ...defaultValveProperties("valve3"), normallyOpen: true } },
        { id: "cilindre", type: "single", x: 820, y: 260, properties: {} }
      ];
      connections = [
        { id: "p", from: { componentId: "font", portId: "P" }, to: { componentId: "valvula", portId: "P" } },
        { id: "a", from: { componentId: "valvula", portId: "A" }, to: { componentId: "cilindre", portId: "A" } }
      ];
      name = "Exemple: vàlvula 3/2 normalment oberta"; message = "La 3/2 NO deixa passar l'aire en repòs; acciona-la per connectar A amb escapament.";
    } else if (kind === "quickExhaust") {
      components = [
        { id: "font", type: "source", x: 50, y: 270, properties: {} },
        { id: "valvula", type: "valve3", x: 290, y: 245, properties: defaultValveProperties("valve3") },
        { id: "escapament", type: "quickExhaust", x: 620, y: 250, properties: {} },
        { id: "cilindre", type: "single", x: 930, y: 245, properties: {} }
      ];
      connections = [
        { id: "p", from: { componentId: "font", portId: "P" }, to: { componentId: "valvula", portId: "P" } },
        { id: "a", from: { componentId: "valvula", portId: "A" }, to: { componentId: "escapament", portId: "P" } },
        { id: "cilindre", from: { componentId: "escapament", portId: "A" }, to: { componentId: "cilindre", portId: "A" } }
      ];
      name = "Exemple: vàlvula d'escapament ràpid"; message = "En deixar anar la 3/2, l'aire del cilindre surt pel port R de l'escapament ràpid.";
    } else if (kind === "electricBistable") {
      components = [
        { id: "font_aire", type: "source", x: 45, y: 440, properties: {} },
        { id: "electrica", type: "electricSource", x: 40, y: 105, properties: {} },
        { id: "derivacio", type: "electricJunction", x: 245, y: 110, properties: {} },
        { id: "ordre_a", type: "electricPush", x: 405, y: 65, properties: {} },
        { id: "ordre_b", type: "electricPush", x: 405, y: 210, properties: {} },
        { id: "valvula", type: "valve5ElectricBistable", x: 600, y: 355, properties: {} },
        { id: "cilindre", type: "double", x: 935, y: 365, properties: {} }
      ];
      connections = [
        { id: "aire", from: { componentId: "font_aire", portId: "P" }, to: { componentId: "valvula", portId: "P" } },
        { id: "a", from: { componentId: "valvula", portId: "A" }, to: { componentId: "cilindre", portId: "A" } },
        { id: "b", from: { componentId: "valvula", portId: "B" }, to: { componentId: "cilindre", portId: "B" } },
        { id: "plus", from: { componentId: "electrica", portId: "plus" }, to: { componentId: "derivacio", portId: "A" } },
        { id: "branca_a", from: { componentId: "derivacio", portId: "B" }, to: { componentId: "ordre_a", portId: "1" } },
        { id: "branca_b", from: { componentId: "derivacio", portId: "C" }, to: { componentId: "ordre_b", portId: "1" } },
        { id: "y1", from: { componentId: "ordre_a", portId: "2" }, to: { componentId: "valvula", portId: "X1" } },
        { id: "y2", from: { componentId: "ordre_b", portId: "2" }, to: { componentId: "valvula", portId: "X2" } },
        { id: "comu", from: { componentId: "valvula", portId: "common" }, to: { componentId: "electrica", portId: "minus" } }
      ];
      name = "Exemple: electrovàlvula 5/2 biestable"; message = "Polsa Y1 o Y2 per canviar la 5/2. La vàlvula manté l'última posició quan deixes anar el polsador.";
    } else if (kind === "pilot3" || kind === "pressureSequence") {
      const sequenced = kind === "pressureSequence";
      components = [
        { id: "font", type: "source", x: 60, y: 305, properties: {} },
        { id: "derivacio", type: "tee", x: 240, y: 315, properties: {} },
        { id: "ordre", type: "valve3", x: 430, y: 465, properties: defaultValveProperties("valve3") },
        { id: "valvula", type: sequenced ? "pressureSequence" : "valve3Pilot", x: 470, y: 260, properties: sequenced ? { delay: "medium" } : {} },
        { id: "cilindre", type: "single", x: 850, y: 285, properties: {} }
      ];
      connections = [
        { id: "font_derivacio", from: { componentId: "font", portId: "P" }, to: { componentId: "derivacio", portId: "A" } },
        { id: "alimentacio", from: { componentId: "derivacio", portId: "B" }, to: { componentId: "valvula", portId: "P" } },
        { id: "ordre_p", from: { componentId: "derivacio", portId: "C" }, to: { componentId: "ordre", portId: "P" } },
        { id: "ordre_x", from: { componentId: "ordre", portId: "A" }, to: { componentId: "valvula", portId: "X" } },
        { id: "sortida", from: { componentId: "valvula", portId: "A" }, to: { componentId: "cilindre", portId: "A" } }
      ];
      name = sequenced ? "Exemple: vàlvula seqüencial de pressió" : "Exemple: vàlvula 3/2 pilotada";
      message = sequenced ? "Acciona l'ordre manual: X inicia un llindar qualitatiu i, després, la vàlvula alimenta el cilindre. No representa bar reals." : "Acciona la 3/2 manual: el senyal a X commuta la vàlvula pilotada i mou el cilindre.";
    } else if (kind === "magneticSensor") {
      components = [
        { id: "font_aire", type: "source", x: 35, y: 330, properties: {} },
        { id: "aire", type: "valve3", x: 295, y: 310, properties: defaultValveProperties("valve3") },
        { id: "cilindre", type: "single", x: 650, y: 300, properties: {} },
        { id: "font_el", type: "electricSource", x: 45, y: 95, properties: {} },
        { id: "sensor", type: "magneticSensor", x: 330, y: 110, properties: { targetCylinder: "cilindre", targetEnd: "extended" } },
        { id: "rele", type: "relayCoil", x: 640, y: 105, properties: { relay: "K1" } }
      ];
      connections = [
        { id: "aire_p", from: { componentId: "font_aire", portId: "P" }, to: { componentId: "aire", portId: "P" } },
        { id: "aire_a", from: { componentId: "aire", portId: "A" }, to: { componentId: "cilindre", portId: "A" } },
        { id: "el_plus", from: { componentId: "font_el", portId: "plus" }, to: { componentId: "sensor", portId: "1" } },
        { id: "sensor_rele", from: { componentId: "sensor", portId: "2" }, to: { componentId: "rele", portId: "A1" } },
        { id: "rele_retor", from: { componentId: "rele", portId: "A2" }, to: { componentId: "font_el", portId: "minus" } }
      ];
      name = "Exemple: sensor magnètic i relé"; message = "Acciona la 3/2 pneumàtica. Quan el cilindre arriba a l'extrem, el sensor tanca el circuit i activa K1.";
    } else {
      components = [
        { id: "font_aire", type: "source", x: 35, y: 420, properties: {} },
        { id: "electrovalvula", type: "valve5Electric", x: 685, y: 365, properties: {} },
        { id: "cilindre", type: "double", x: 1000, y: 370, properties: {} },
        { id: "font_el", type: "electricSource", x: 35, y: 100, properties: {} },
        { id: "derivacio", type: "electricJunction", x: 250, y: 125, properties: {} },
        { id: "ordre", type: "electricPush", x: 435, y: 60, properties: {} },
        { id: "temporitzador", type: "electricTimerRelay", x: 450, y: 200, properties: { delay: "medium" } }
      ];
      connections = [
        { id: "aire_p", from: { componentId: "font_aire", portId: "P" }, to: { componentId: "electrovalvula", portId: "P" } },
        { id: "aire_a", from: { componentId: "electrovalvula", portId: "A" }, to: { componentId: "cilindre", portId: "A" } },
        { id: "aire_b", from: { componentId: "electrovalvula", portId: "B" }, to: { componentId: "cilindre", portId: "B" } },
        { id: "plus", from: { componentId: "font_el", portId: "plus" }, to: { componentId: "derivacio", portId: "A" } },
        { id: "al_polsador", from: { componentId: "derivacio", portId: "B" }, to: { componentId: "ordre", portId: "1" } },
        { id: "ordre_timer", from: { componentId: "ordre", portId: "2" }, to: { componentId: "temporitzador", portId: "A1" } },
        { id: "retorn_timer", from: { componentId: "temporitzador", portId: "A2" }, to: { componentId: "font_el", portId: "minus" } },
        { id: "feed_contact", from: { componentId: "derivacio", portId: "C" }, to: { componentId: "temporitzador", portId: "15" } },
        { id: "sortida_timer", from: { componentId: "temporitzador", portId: "18" }, to: { componentId: "electrovalvula", portId: "X1" } },
        { id: "retorn_bobina", from: { componentId: "electrovalvula", portId: "X2" }, to: { componentId: "font_el", portId: "minus" } }
      ];
      name = "Exemple: relé temporitzador i electrovàlvula"; message = "Mantén premut el polsador: el relé tanca 15–18 després del retard qualitatiu i activa l'electrovàlvula.";
    }
    circuit = { format: FORMAT, version: VERSION, metadata: { name }, components, connections, view: { zoom: .82, pan: { x: 35, y: 10 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render(); status(message); return;
  }
  if (kind === "supply") {
    const source = { id: "compressor", type: "source", x: 80, y: 195, properties: {} };
    const receiver = { id: "diposit", type: "receiver", x: 230, y: 175, properties: {} };
    const maintenance = { id: "manteniment", type: "maintenance", x: 500, y: 155, properties: {} };
    const valve = { id: "valvula", type: "valve3", x: 405, y: 400, properties: defaultValveProperties("valve3") };
    const cylinder = { id: "cilindre", type: "single", x: 780, y: 395, properties: {} };
    circuit = { format: FORMAT, version: VERSION, metadata: { name: "Exemple: alimentació i preparació de l'aire" }, components: [source, receiver, maintenance, valve, cylinder], connections: [
      { id: "aire_font", from: { componentId: source.id, portId: "P" }, to: { componentId: receiver.id, portId: "P" } },
      { id: "aire_diposit", from: { componentId: receiver.id, portId: "A" }, to: { componentId: maintenance.id, portId: "P" } },
      { id: "aire_unitat", from: { componentId: maintenance.id, portId: "A" }, to: { componentId: valve.id, portId: "P" } },
      { id: "aire_valvula", from: { componentId: valve.id, portId: "A" }, to: { componentId: cylinder.id, portId: "A" } }
    ], view: { zoom: .86, pan: { x: 40, y: 10 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status("Exemple d'alimentació carregat. Simula'l i acciona la vàlvula 3/2.");
    return;
  }
  if (kind === "flow") {
    const source = { id: "font", type: "source", x: 90, y: 255, properties: {} };
    const regulator = { id: "regulador", type: "flowRegulator", x: 260, y: 245, properties: { opening: "low" } };
    const valve = { id: "valvula", type: "valve3", x: 535, y: 230, properties: defaultValveProperties("valve3") };
    const cylinder = { id: "cilindre", type: "single", x: 860, y: 245, properties: {} };
    circuit = { format: FORMAT, version: VERSION, metadata: { name: "Exemple: regulació qualitativa de cabal" }, components: [source, regulator, valve, cylinder], connections: [
      { id: "aire_font", from: { componentId: source.id, portId: "P" }, to: { componentId: regulator.id, portId: "P" } },
      { id: "aire_regulador", from: { componentId: regulator.id, portId: "A" }, to: { componentId: valve.id, portId: "P" } },
      { id: "aire_valvula", from: { componentId: valve.id, portId: "A" }, to: { componentId: cylinder.id, portId: "A" } }
    ], view: { zoom: .86, pan: { x: 30, y: 10 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status("Exemple de regulador carregat en obertura «poc». Simula'l i acciona la vàlvula.");
    return;
  }
  if (kind === "branch") {
    const source = { id: "font", type: "source", x: 100, y: 300, properties: {} };
    const valve = { id: "valvula", type: "valve3", x: 365, y: 255, properties: defaultValveProperties("valve3") };
    const tee = { id: "derivacio", type: "tee", x: 700, y: 275, properties: {} };
    const cylinderA = { id: "cilindre_a", type: "single", x: 930, y: 125, properties: {} };
    const cylinderB = { id: "cilindre_b", type: "single", x: 930, y: 435, properties: {} };
    circuit = { format: FORMAT, version: VERSION, metadata: { name: "Exemple: derivació en T i dos cilindres" }, components: [source, valve, tee, cylinderA, cylinderB], connections: [
      { id: "aire_font", from: { componentId: source.id, portId: "P" }, to: { componentId: valve.id, portId: "P" } },
      { id: "aire_valvula", from: { componentId: valve.id, portId: "A" }, to: { componentId: tee.id, portId: "A" } },
      { id: "branca_a", from: { componentId: tee.id, portId: "B" }, to: { componentId: cylinderA.id, portId: "A" } },
      { id: "branca_b", from: { componentId: tee.id, portId: "C" }, to: { componentId: cylinderB.id, portId: "A" } }
    ], view: { zoom: .82, pan: { x: 55, y: 12 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status("Exemple de derivació carregat. En prémer la 3/2, l'aire arriba als dos cilindres.");
    return;
  }
  if (kind === "electric") {
    const air = { id: "font_aire", type: "source", x: 80, y: 390, properties: {} };
    const electrical = { id: "font_electrica", type: "electricSource", x: 80, y: 130, properties: {} };
    const push = { id: "polsador", type: "electricPush", x: 330, y: 130, properties: {} };
    const valve = { id: "electrovalvula", type: "valve5Electric", x: 600, y: 335, properties: defaultProperties("valve5Electric") };
    const cylinder = { id: "cilindre", type: "double", x: 940, y: 340, properties: {} };
    circuit = { format: FORMAT, version: VERSION, metadata: { name: "Exemple: polsador elèctric i electrovàlvula 5/2" }, components: [air, electrical, push, valve, cylinder], connections: [
      { id: "aire_p", from: { componentId: air.id, portId: "P" }, to: { componentId: valve.id, portId: "P" }, route: [] },
      { id: "aire_a", from: { componentId: valve.id, portId: "A" }, to: { componentId: cylinder.id, portId: "A" }, route: [] },
      { id: "aire_b", from: { componentId: valve.id, portId: "B" }, to: { componentId: cylinder.id, portId: "B" }, route: [] },
      { id: "el_plus", from: { componentId: electrical.id, portId: "plus" }, to: { componentId: push.id, portId: "1" }, route: [{ x: 270, y: 160 }] },
      { id: "el_ordre", from: { componentId: push.id, portId: "2" }, to: { componentId: valve.id, portId: "X1" }, route: [{ x: 525, y: 180 }, { x: 525, y: 390 }] },
      { id: "el_retor", from: { componentId: valve.id, portId: "X2" }, to: { componentId: electrical.id, portId: "minus" }, route: [{ x: 520, y: 430 }, { x: 260, y: 200 }] }
    ], view: { zoom: .86, pan: { x: 35, y: 15 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status("Exemple d'electroneumàtica carregat. Simula'l i mantén premut el polsador elèctric.");
    return;
  }
  if (kind === "limit") {
    const source = { id: "font", type: "source", x: 70, y: 310, properties: {} };
    const tee = { id: "derivacio", type: "tee", x: 270, y: 315, properties: {} };
    const start = { id: "ordre_inicial", type: "valve3", x: 440, y: 175, properties: defaultValveProperties("valve3") };
    const limit = { id: "final_cursa", type: "limitValve3", x: 440, y: 420, properties: { targetCylinder: "cilindre_a", targetEnd: "extended" } };
    const cylinderA = { id: "cilindre_a", type: "single", x: 760, y: 130, properties: {} };
    const cylinderB = { id: "cilindre_b", type: "single", x: 760, y: 430, properties: {} };
    circuit = { format: FORMAT, version: VERSION, metadata: { name: "Exemple: final de cursa mecànic" }, components: [source, tee, start, limit, cylinderA, cylinderB], connections: [
      { id: "font_derivacio", from: { componentId: source.id, portId: "P" }, to: { componentId: tee.id, portId: "A" }, route: [] },
      { id: "alimentacio_inicial", from: { componentId: tee.id, portId: "B" }, to: { componentId: start.id, portId: "P" }, route: [] },
      { id: "alimentacio_final", from: { componentId: tee.id, portId: "C" }, to: { componentId: limit.id, portId: "P" }, route: [] },
      { id: "cilindre_inicial", from: { componentId: start.id, portId: "A" }, to: { componentId: cylinderA.id, portId: "A" }, route: [] },
      { id: "sortida_final", from: { componentId: limit.id, portId: "A" }, to: { componentId: cylinderB.id, portId: "A" }, route: [] }
    ], view: { zoom: .82, pan: { x: 50, y: 25 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status("Exemple de final de cursa carregat. Acciona la 3/2; quan el primer cilindre arribi al final, s'activarà el segon."); return;
  }
  if (kind === "timer") {
    const source = { id: "font", type: "source", x: 70, y: 300, properties: {} };
    const tee = { id: "derivacio", type: "tee", x: 280, y: 315, properties: {} };
    const timer = { id: "temporitzador", type: "timer3", x: 510, y: 285, properties: { delay: "medium" } };
    const cylinder = { id: "cilindre", type: "single", x: 850, y: 290, properties: {} };
    circuit = { format: FORMAT, version: VERSION, metadata: { name: "Exemple: temporitzador pneumàtic" }, components: [source, tee, timer, cylinder], connections: [
      { id: "font_derivacio", from: { componentId: source.id, portId: "P" }, to: { componentId: tee.id, portId: "A" }, route: [] },
      { id: "pressio_temporitzador", from: { componentId: tee.id, portId: "B" }, to: { componentId: timer.id, portId: "P" }, route: [] },
      { id: "senyal_temporitzador", from: { componentId: tee.id, portId: "C" }, to: { componentId: timer.id, portId: "X" }, route: [] },
      { id: "sortida_cilindre", from: { componentId: timer.id, portId: "A" }, to: { componentId: cylinder.id, portId: "A" }, route: [] }
    ], view: { zoom: .86, pan: { x: 30, y: 10 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status("Exemple de temporitzador carregat. Simula'l i observa el retard qualitatiu."); return;
  }
  if (kind === "logic") {
    const source = { id: "font", type: "source", x: 50, y: 280, properties: {} };
    const input = { id: "derivacio_entrades", type: "tee", x: 230, y: 285, properties: {} };
    const logic = { id: "and", type: "logicAnd", x: 430, y: 250, properties: {} };
    const output = { id: "derivacio_sortides", type: "tee", x: 740, y: 270, properties: {} };
    const cylinderA = { id: "cilindre_a", type: "single", x: 970, y: 130, properties: {} };
    const cylinderB = { id: "cilindre_b", type: "single", x: 970, y: 430, properties: {} };
    circuit = { format: FORMAT, version: VERSION, metadata: { name: "Exemple: vàlvula lògica AND" }, components: [source, input, logic, output, cylinderA, cylinderB], connections: [
      { id: "font_entrades", from: { componentId: source.id, portId: "P" }, to: { componentId: input.id, portId: "A" }, route: [] },
      { id: "entrada_x", from: { componentId: input.id, portId: "B" }, to: { componentId: logic.id, portId: "X" }, route: [] },
      { id: "entrada_y", from: { componentId: input.id, portId: "C" }, to: { componentId: logic.id, portId: "Y" }, route: [] },
      { id: "sortida_logica", from: { componentId: logic.id, portId: "A" }, to: { componentId: output.id, portId: "A" }, route: [] },
      { id: "sortida_a", from: { componentId: output.id, portId: "B" }, to: { componentId: cylinderA.id, portId: "A" }, route: [] },
      { id: "sortida_b", from: { componentId: output.id, portId: "C" }, to: { componentId: cylinderB.id, portId: "A" }, route: [] }
    ], view: { zoom: .8, pan: { x: 30, y: 15 } } };
    selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
    status("Exemple de vàlvula AND carregat. Prova també d'obrir una entrada per comparar-ho amb OR."); return;
  }
  const is2 = kind === "twoTwo", is3 = kind === "simple", is4 = kind === "fourTwo";
  const single = is2 || is3;
  const source = { id: "font", type: "source", x: 100, y: 270, properties: {} };
  const valveType = is2 ? "valve2" : is3 ? "valve3" : is4 ? "valve4" : "valve5";
  const valve = { id: "valvula", type: valveType, x: 395, y: 255, properties: defaultValveProperties(valveType) };
  const cylinder = { id: "cilindre", type: single ? "single" : "double", x: 800, y: 260, properties: {} };
  const connections = [
    { id: "conducte_p", from: { componentId: "font", portId: "P" }, to: { componentId: "valvula", portId: "P" } },
    { id: "conducte_a", from: { componentId: "valvula", portId: "A" }, to: { componentId: "cilindre", portId: "A" } }
  ];
  if (!single) connections.push({ id: "conducte_b", from: { componentId: "valvula", portId: "B" }, to: { componentId: "cilindre", portId: "B" } });
  const name = is2 ? "Exemple: cilindre simple i vàlvula 2/2 NC" : is3 ? "Exemple: cilindre simple i vàlvula 3/2" : is4 ? "Exemple: cilindre doble i vàlvula 4/2" : "Exemple: cilindre doble i vàlvula 5/2";
  circuit = { format: FORMAT, version: VERSION, metadata: { name }, components: [source, valve, cylinder], connections, view: { zoom: 1, pan: { x: 0, y: 0 } } };
  selected = null; pendingPort = null; history = []; future = []; running = false; dirty = false; resetRuntime(); storeBackup(); render();
  status(`Exemple ${is2 ? "2/2" : is3 ? "3/2" : is4 ? "4/2" : "5/2"} carregat. Prem Simula i acciona la vàlvula.`);
}
function setupLibrary() {
  const host = $("libraryItems"); host.replaceChildren();
  const typesByFamily = new Map();
  for (const [type, def] of Object.entries(TYPES)) {
    if (!typesByFamily.has(def.family)) typesByFamily.set(def.family, []);
    typesByFamily.get(def.family).push([type, def]);
  }
  const families = [...typesByFamily.keys()].sort((a, b) => FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b));
  for (const family of families) {
    const entries = typesByFamily.get(family), familyId = `family-${family}`;
    const section = document.createElement("section"); section.className = "library-family";
    const heading = document.createElement("button"); heading.type = "button"; heading.className = "family-toggle";
    heading.setAttribute("aria-controls", familyId); heading.setAttribute("aria-expanded", String(!collapsedFamilies.has(family)));
    const title = document.createElement("span"); title.textContent = FAMILIES[family] || family;
    const count = document.createElement("small"); count.textContent = String(entries.length);
    const chevron = document.createElement("span"); chevron.className = "family-chevron"; chevron.textContent = collapsedFamilies.has(family) ? "›" : "⌄"; chevron.setAttribute("aria-hidden", "true");
    heading.append(title, count, chevron);
    const items = document.createElement("div"); items.className = "family-components"; items.id = familyId; items.hidden = collapsedFamilies.has(family);
    heading.addEventListener("click", () => {
      if (collapsedFamilies.has(family)) collapsedFamilies.delete(family); else collapsedFamilies.add(family);
      const expanded = !collapsedFamilies.has(family); heading.setAttribute("aria-expanded", String(expanded)); items.hidden = !expanded; chevron.textContent = expanded ? "⌄" : "›";
    });
    section.append(heading, items);
    for (const [type, def] of entries) {
      const button = document.createElement("button"); button.className = "library-item"; button.type = "button"; button.draggable = true; button.dataset.type = type;
      const glyph = document.createElement("span"); glyph.className = "glyph"; glyph.setAttribute("aria-hidden", "true");
      const preview = svg("svg", { viewBox: `0 0 ${def.w} ${def.h}`, width: 48, height: 34 }, glyph);
      const previewGroup = svg("g", { class: "component" }, preview);
      drawSymbol(previewGroup, { id: `preview-${type}`, type, properties: type === "valve5" ? { returnMode: "memory" } : {} });
      preview.querySelectorAll("[role], [tabindex]").forEach(node => { node.removeAttribute("role"); node.removeAttribute("tabindex"); });
      const labels = document.createElement("span"); const itemTitle = document.createElement("strong"); itemTitle.textContent = def.label; const hint = document.createElement("small"); hint.textContent = def.hint; labels.append(itemTitle, hint); button.append(glyph, labels);
      button.addEventListener("click", () => { if (running) return; panMode = false; selectedType = selectedType === type ? null : type; render(); status(selectedType ? `Fes clic al llenç per col·locar ${def.label}.` : "Eina cancel·lada."); });
      button.addEventListener("dragstart", e => { if (running) { e.preventDefault(); return; } e.dataTransfer.setData("text/plain", type); });
      items.append(button);
    }
    host.append(section);
  }
}
function setupCanvas() {
  $("circuitCanvas").addEventListener("pointerdown", () => {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) document.activeElement.blur();
}, { capture: true });

  
  const canvas = $("circuitCanvas");
  canvas.addEventListener("keydown", e => {
    if (running || !pendingPort) return;
    const directions = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (directions[e.key]) { e.preventDefault(); const [dx, dy] = directions[e.key]; cursorWorldPoint = { x: (cursorWorldPoint?.x ?? 600) + dx, y: (cursorWorldPoint?.y ?? 350) + dy }; render(); }
    else if (e.key === "Enter") { e.preventDefault(); addRoutePoint(cursorWorldPoint || { x: 600, y: 350 }); }
  });
  canvas.addEventListener("pointerdown", e => {
    if (running) { selected = null; renderInspector(); return; }
    const p = worldPoint(e);
    if (panMode) {
      pointerAction = { kind: "pan", start: screenPoint(e), x: circuit.view.pan.x, y: circuit.view.pan.y };
      canvas.setPointerCapture(e.pointerId); canvas.classList.add("dragging"); return;
    }
    if (!e.target.hasAttribute("data-background")) return;
    if (pendingPort) { addRoutePoint(p); return; }
    if (selectedType) { addComponent(selectedType, p.x - TYPES[selectedType].w / 2, p.y - TYPES[selectedType].h / 2); return; }
    selected = null; renderInspector();
    pointerAction = { kind: "pan", start: screenPoint(e), x: circuit.view.pan.x, y: circuit.view.pan.y };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", e => {
    cursorWorldPoint = worldPoint(e);
    if (!pointerAction) { if (pendingPort) render(); return; }
    const p = screenPoint(e), dx = p.x - pointerAction.start.x, dy = p.y - pointerAction.start.y;
    if (pointerAction.kind === "pan") { circuit.view.pan = { x: pointerAction.x + dx, y: pointerAction.y + dy }; render(); }
    if (pointerAction.kind === "move") {
      const c = circuit.components.find(x => x.id === pointerAction.id);
      if (!c) return;
      c.x = Math.round((pointerAction.x + dx / circuit.view.zoom) / 10) * 10;
      c.y = Math.round((pointerAction.y + dy / circuit.view.zoom) / 10) * 10;
      pointerAction.moved = true;
      render();
    }
  });
  const endPointer = () => {
    if (pointerAction?.kind === "move" && pointerAction.moved) { dirty = true; storeBackup(); }
    if (pointerAction?.kind === "move" && !pointerAction.moved) history.pop();
    pointerAction = null; canvas.classList.remove("dragging"); render();
  };
  canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("dragover", e => { if (!running) e.preventDefault(); });
  canvas.addEventListener("drop", e => { e.preventDefault(); if (running) return; const type = e.dataTransfer.getData("text/plain"); if (!TYPES[type]) return; const p = worldPoint(e); addComponent(type, p.x - TYPES[type].w / 2, p.y - TYPES[type].h / 2); });
  canvas.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); circuit.view.zoom = clamp(circuit.view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), .55, 2.4); render(); }, { passive: false });
}
function setupControls() {
  window.addEventListener("pointerup", releaseMomentary);
  window.addEventListener("pointercancel", releaseMomentary);
  window.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") releaseMomentary(); });
  // Connect the core editor controls before optional file/panel controls. If
  // older cached markup is missing an optional element, editing and simulation
  // must remain available instead of being left with an inert canvas.
  $("deleteBtn").addEventListener("click", deleteSelected);
  $("panBtn").addEventListener("click", () => { panMode = !panMode; pendingPort = null; selectedType = null; render(); status(panMode ? "Eina PAN activada: arrossega el llenç." : "Eina PAN desactivada."); });
  $("clickToolBtn").addEventListener("click", () => { if (running) return; panMode = false; selectedType = null; pendingPort = null; render(); status("Eina Clic activa: selecciona, mou o connecta components."); });
  $("textBtn").addEventListener("click", () => { panMode = false; selectedType = selectedType === "note" ? null : "note"; render(); status(selectedType ? "Clica al llenç per afegir una anotació; edita'n el text al panell." : "Eina de text cancel·lada."); });
  $("copyBtn").addEventListener("click", copySelected);
  $("pasteBtn").addEventListener("click", pasteSelected);
  $("undoBtn").addEventListener("click", undo);
  $("redoBtn").addEventListener("click", redo);
  $("simulateBtn").addEventListener("click", () => setRunning(!running));
  $("stepModeBtn").addEventListener("click", () => { if (running) return; stepMode = !stepMode; resetRuntime(); render(); status(stepMode ? "Mode pas a pas activat. Inicia la simulació i avança amb Avança." : "Mode de simulació contínua activat."); });
  $("stepBtn").addEventListener("click", advanceSimulationStep);
  $("resetBtn").addEventListener("click", () => { resetRuntime(); render(); status("Simulació reiniciada."); });
  $("zoomInBtn").addEventListener("click", () => { circuit.view.zoom = clamp(circuit.view.zoom * 1.2, .55, 2.4); render(); });
  $("zoomOutBtn").addEventListener("click", () => { circuit.view.zoom = clamp(circuit.view.zoom / 1.2, .55, 2.4); render(); });
  $("fitBtn").addEventListener("click", () => { circuit.view = { zoom: 1, pan: { x: 0, y: 0 } }; render(); });
  $("exampleSupplyBtn").addEventListener("click", () => loadExample("supply"));
  $("exampleFlowBtn").addEventListener("click", () => loadExample("flow"));
  $("exampleBranchBtn").addEventListener("click", () => loadExample("branch"));
  $("exampleValve2Btn").addEventListener("click", () => loadExample("twoTwo"));
  $("exampleSimpleBtn").addEventListener("click", () => loadExample("simple"));
  $("exampleThreeTwoNoBtn").addEventListener("click", () => loadExample("threeTwoNO"));
  $("exampleValve4Btn").addEventListener("click", () => loadExample("fourTwo"));
  $("exampleDoubleBtn").addEventListener("click", () => loadExample("double"));
  $("exampleLimitBtn").addEventListener("click", () => loadExample("limit"));
  $("exampleLogicBtn").addEventListener("click", () => loadExample("logic"));
  $("exampleTimerBtn").addEventListener("click", () => loadExample("timer"));
  $("exampleElectricBtn").addEventListener("click", () => loadExample("electric"));
  $("exampleQuickExhaustBtn").addEventListener("click", () => loadExample("quickExhaust"));
  $("exampleElectricBistableBtn").addEventListener("click", () => loadExample("electricBistable"));
  $("examplePilot3Btn")?.addEventListener("click", () => loadExample("pilot3"));
  $("examplePressureSequenceBtn")?.addEventListener("click", () => loadExample("pressureSequence"));
  $("exampleMagneticSensorBtn")?.addEventListener("click", () => loadExample("magneticSensor"));
  $("exampleElectricTimerBtn")?.addEventListener("click", () => loadExample("electricTimer"));
  $("newBtn").addEventListener("click", newCircuit);
  $("openBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", e => { openCircuit(e.target.files[0]); e.target.value = ""; });
  $("saveBtn").addEventListener("click", downloadCircuit);
  $("exportPngBtn").addEventListener("click", downloadCanvasPng);
  $("circuitOptionsBtn").addEventListener("click", () => {
    const open = $("circuitOptions").hidden;
    $("circuitOptions").hidden = !open;
    $("circuitOptionsBtn").setAttribute("aria-expanded", String(open));
  });
  const closeCircuitOptionsBtn = $("closeCircuitOptionsBtn");
  if (closeCircuitOptionsBtn) closeCircuitOptionsBtn.addEventListener("click", () => { $("circuitOptions").hidden = true; $("circuitOptionsBtn").setAttribute("aria-expanded", "false"); });
  const closeInspectorBtn = $("closeInspectorBtn");
  if (closeInspectorBtn) closeInspectorBtn.addEventListener("click", () => { selected = null; render(); });
  const handle = $("inspectorHandle"), inspector = $("componentInspector");
  let panelDrag = null;
  if (handle && inspector) {
    handle.addEventListener("pointerdown", e => {
      if (e.target.closest("button")) return;
      const bounds = inspector.getBoundingClientRect(), parent = $("circuitCanvas").getBoundingClientRect();
      panelDrag = { x: e.clientX, y: e.clientY, left: bounds.left - parent.left, top: bounds.top - parent.top };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", e => {
      if (!panelDrag) return;
      const parent = $("circuitCanvas").getBoundingClientRect();
      inspector.style.right = "auto";
      inspector.style.left = `${clamp(panelDrag.left + e.clientX - panelDrag.x, 0, Math.max(0, parent.width - inspector.offsetWidth))}px`;
      inspector.style.top = `${clamp(panelDrag.top + e.clientY - panelDrag.y, 0, Math.max(0, parent.height - inspector.offsetHeight))}px`;
    });
    handle.addEventListener("pointerup", () => { panelDrag = null; });
    handle.addEventListener("pointercancel", () => { panelDrag = null; });
  }
  $("circuitName").addEventListener("change", e => { const value = e.target.value.trim().slice(0, 80) || "Circuit nou"; if (value !== circuit.metadata.name && !running) edit(() => { circuit.metadata.name = value; }); });
  $("clearBackupBtn").addEventListener("click", () => { try { localStorage.removeItem(BACKUP_KEY); $("restorePanel").hidden = true; status("Còpia de recuperació esborrada."); } catch (_) { status("No s'ha pogut esborrar la còpia."); } });
  $("restoreBtn").addEventListener("click", () => {
    try {
      const recovered = validateCircuit(JSON.parse(localStorage.getItem(BACKUP_KEY)));
      if (dirty && !confirm("Vols substituir el circuit actual per l'última còpia local?")) return;
      circuit = recovered; selected = null; pendingPort = null; history = []; future = []; running = false; dirty = true; resetRuntime(); $("restorePanel").hidden = true; render(); status("Últim circuit recuperat. Descarrega el JSON per conservar-lo.");
    } catch (_) { status("La còpia de recuperació no és vàlida."); }
  });
  document.addEventListener("keydown", e => {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (typing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { e.preventDefault(); copySelected(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") { e.preventDefault(); pasteSelected(); }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
    if (e.key === "Escape") { pendingPort = null; selectedType = null; panMode = false; render(); }
  });
  window.addEventListener("beforeunload", e => { if (!dirty) return; e.preventDefault(); e.returnValue = ""; });
}
function init() {
  setupLibrary(); setupCanvas(); setupControls();
  try {
    $("restorePanel").hidden = !localStorage.getItem(BACKUP_KEY);
    if (!$("restorePanel").hidden) { $("circuitOptions").hidden = false; $("circuitOptionsBtn").setAttribute("aria-expanded", "true"); }
  } catch (_) { $("restorePanel").hidden = true; }
  resetRuntime(); render();
}
init();

