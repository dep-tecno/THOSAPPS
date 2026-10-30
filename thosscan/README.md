# THOSsCAN

Ruta oficial: https://tecno-apps.cat/thosscan/

## Fitxers font i publicació

- `src/index.html`: plantilla de la interfície. Editar aquest fitxer per
  canviar el disseny; el seu mòdul d'entrada és `../app.js`.
- `app.js`, `word-export.js`, `vite.config.mjs`: lògica i configuració.
- `index.html`, `assets/`, `models/`: distribució compilada a la ruta oficial.
  No editar manualment l'HTML compilat per fer canvis permanents al disseny.
- `live/index.html`: compatibilitat amb enllaços antics; redirigeix a la ruta
  oficial. No s'hi generen noves versions de l'aplicació.

Compilació, des de `thosscan/`:

```sh
npm install --no-audit --no-fund
node --test word-export.test.mjs
npx --yes vite@7.1.0 build src --outDir ../dist --emptyOutDir --base=./ --config vite.config.mjs
```

El workflow `.github/workflows/thosscan-browser-preview.yml` incorpora els
models i les llicències i publica l'HTML compilat, `assets/` i `models/`.
La sincronització amb esborrat es limita als dos directoris de recursos
generats: mai a la carpeta `thosscan/` sencera, que també conté el codi font.

Motor: [Scribe.js](https://github.com/scribeocr/scribe.js), versió 0.17.0.
Vegeu `THIRD_PARTY_NOTICES.md`, `licenses/` i `WORD_EXPORT.md`.
