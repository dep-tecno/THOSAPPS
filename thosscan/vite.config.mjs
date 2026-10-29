import { builtinModules } from 'node:module';

// Scribe.js imports native Node canvas behind browser-only guards.
// Do not send the native .node binary to the browser bundle.
const nodeOnly = new Set([...builtinModules, '@scribe.js/canvas']);
const nodeOnlyStub = () => ({
  name: 'thosscan:node-only-stub',
  enforce: 'pre',
  resolveId(id) {
    return nodeOnly.has(id.startsWith('node:') ? id.slice(5) : id)
      ? '\0node-only:' + id
      : null;
  },
  load(id) {
    return id.startsWith('\0node-only:') ? 'export default {};' : null;
  },
});

// Scribe.js 0.17.0 defaults its worker to OEM 2 (legacy + LSTM), even
// when recognize({ modeAdv: 'lstm' }) requests only LSTM. Our local
// tessdata_fast models contain no legacy data. Keep this build-only patch
// restricted to that worker; fail if a dependency update changes the source.
const localLstmModels = () => ({
  name: 'thosscan:local-lstm-models',
  enforce: 'pre',
  transform(code, id) {
    const path = id.split('?')[0].replace(/\\/g, '/');
    if (!path.endsWith('/scribe.js-ocr/js/worker/generalWorker.js')) return null;
    const original = 'let oemCurrent = 2;';
    if (code.split(original).length !== 2) {
      throw new Error('THOSsCAN: cal revisar la compatibilitat LSTM de Scribe.js.');
    }
    return { code: code.replace(original, 'let oemCurrent = 1;'), map: null };
  },
});

export default {
  base: './',
  plugins: [nodeOnlyStub(), localLstmModels()],
  worker: {
    format: 'es',
    plugins: () => [nodeOnlyStub(), localLstmModels()],
  },
};
