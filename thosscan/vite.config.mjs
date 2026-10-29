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

export default {
  base: './',
  plugins: [nodeOnlyStub()],
  worker: {
    format: 'es',
    plugins: () => [nodeOnlyStub()],
  },
};
