export const TYPES = {
  pelton: { name: 'Pelton', head: 300, flow: 1, efficiency: 88, maxHead: 800, maxFlow: 5,
    description: 'Un raig d’aigua colpeja les cassoletes del rodet. Turbina d’acció, adequada per a salts elevats i cabals petits.',
    lesson: 'L’injector transforma l’energia de pressió en velocitat. El raig es desvia a les dues meitats de cada cassoleta i fa girar el rodet. La sortida queda a pressió atmosfèrica.',
    note: 'Observa el raig tangencial i les cassoletes dobles. L’aigua impulsa el rodet des de l’exterior.' },
  francis: { name: 'Francis', head: 80, flow: 10, efficiency: 90, maxHead: 300, maxFlow: 30,
    description: 'L’aigua entra radialment i surt en direcció axial. Turbina de reacció habitual en salts i cabals intermedis.',
    lesson: 'La cambra espiral reparteix l’aigua al voltant del distribuïdor. Els àleps fixos la dirigeixen cap al rodet; al seu interior disminueix la pressió i el flux gira cap a la sortida axial.',
    note: 'Blau: cambra espiral i entrada radial. L’aigua abandona el centre del rodet en direcció axial.' },
  kaplan: { name: 'Kaplan', head: 10, flow: 40, efficiency: 92, maxHead: 50, maxFlow: 100,
    description: 'L’aigua travessa una hèlix de pales orientables. Turbina de reacció adequada per a salts baixos i grans cabals.',
    lesson: 'El flux travessa el rodet en direcció axial. Les pales orientables permeten adaptar el funcionament al cabal. Aquí l’angle només modifica la geometria: el rendiment s’ajusta amb el seu propi control.',
    note: 'Canvia l’angle de les pales per explorar la geometria del rodet. El flux és axial.' }
};
export function power(head, flow, efficiency) {
  const hydraulic = 1000 * 9.81 * head * flow;
  const shaft = hydraulic * efficiency / 100;
  return { hydraulic, shaft, electric: shaft * 0.9 };
}
export function formatPower(watts) {
  const megawatts = watts >= 1e6;
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 2 }).format(watts / (megawatts ? 1e6 : 1e3)) + (megawatts ? ' MW' : ' kW');
}

/** Pelton idealitzat: velocitat de raig, velocitat òptima i parell.
 * Cv = 0.98; relació òptima u/v = 0.46; diàmetre nominal = 2.6 m.
 * L'obertura és proporcional al cabal de referència a cada salt;
 * el parell es deriva de P_eix/omega, sense duplicar rendiments.
 */
export function peltonPhysics(head, flow, efficiency, diameter = 2.6) {
  const g = 9.81, cv = 0.98, speedRatio = 0.46;
  const jetSpeed = cv * Math.sqrt(2 * g * Math.max(0, head));
  const peripheralSpeed = speedRatio * jetSpeed;
  const rpm = peripheralSpeed * 60 / (Math.PI * diameter);
  const omega = rpm * 2 * Math.PI / 60;
  const shaftPower = power(head, flow, efficiency).shaft;
  const torque = omega > 0 && flow > 0 ? shaftPower / omega : 0;
  return { jetSpeed: flow > 0 ? jetSpeed : 0, rpm: flow > 0 ? rpm : 0, torque, peripheralSpeed: flow > 0 ? peripheralSpeed : 0 };
}
