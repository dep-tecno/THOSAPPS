# Integració del motor OCR — estat tècnic

## Dependència fixada
Scribe.js (`scribe.js-ocr`) versió **0.17.0**, segons el `package.json` oficial del projecte consultat el 29/10/2026.

```sh
cd thosscan
npm install
```

Aquest pas descarrega les dependències a `node_modules/`; **no** converteix automàticament la carpeta en una aplicació estàtica funcional a GitHub Pages.

## Bloqueig pendent
L'actual `app.js` intenta importar `./vendor/scribe/scribe.js`. Aquest fitxer **encara no existeix** al repositori. Cal preparar una distribució ESM completa de Scribe.js amb els seus imports, workers, WASM i fonts compatibles amb navegador. No s'ha de substituir per una importació CDN: la documentació oficial exigeix mateix origen.

A més, els models `cat.traineddata.gz`, `spa.traineddata.gz` i `eng.traineddata.gz` han d'estar disponibles a `thosscan/models/`. Cal verificar-ne les fonts, integritat i llicències.

## Comprovacions necessàries abans d'activar «Convertir»
1. Instal·lar les dependències de `package.json` en un entorn amb accés a npm.
2. Verificar la distribució navegador seguint l'exemple oficial `scribe.js-example-esm-browser` i documentar la versió utilitzada.
3. Comprovar que els recursos de workers/WASM/fonts i les importacions resolen en GitHub Pages, sense CDN.
4. Instal·lar els tres models OCR localment i comprovar-ne llicències.
5. Provar imatge PNG/JPG → DOCX i una taula → XLSX.
6. Provar PDF digital i escanejat.
7. Auditar peticions de xarxa, memòria i documents de 25/50 pàgines.
8. Incorporar text complet de les llicències, avisos i enllaç al codi font.
9. Només aleshores habilitar la conversió i anunciar la versió funcional.

## Estat real
- [x] Especificació, interfície i adaptador d'API.
- [x] Versió Scribe.js fixada.
- [ ] Recursos OCR distribuïts al mateix origen.
- [ ] Models lingüístics.
- [ ] Proves reals i validació legal.

**No confondre el codi preparat amb una conversió provada.**
