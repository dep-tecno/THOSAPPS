# Avisos de tercers — THOSsCAN

## Scribe.js 0.17.0

- Projecte i autors: Scribe.js / Scribe OCR, Balearica i col·laboradors.
- Codi font de la versió: https://github.com/scribeocr/scribe.js/tree/v0.17.0
- Llicència: GNU Affero General Public License v3.0 (AGPL-3.0).
- Text íntegre inclòs a `licenses/Scribe-AGPL-3.0.txt`.
- Motor ESM, workers, WASM i recursos empaquetats per a navegador.
- Codi de la integració THOSsCAN i configuració de compilació:
  https://github.com/dep-tecno/THOSAPPS/tree/main/thosscan

### Modificacions i integració de THOSsCAN

29/10/2026:

- `vite.config.mjs` substitueix durant la compilació el valor inicial
  `oemCurrent = 2` per `oemCurrent = 1` al worker general de Scribe.js 0.17.0.
  Permet inicialitzar els models locals `tessdata_fast`, que només contenen
  dades LSTM. La transformació comprova el fitxer i el text esperats; no
  modifica altres fitxers del motor ni el repositori original de Scribe.js.
- `app.js` conserva el text nadiu dels PDF amb el mode de selecció automàtica
  de pàgines de Scribe.js i mostra la fase i el detall dels errors.
- `word-export.js` és una capa de THOSsCAN que crea taules DOCX editables
  a partir de les mateixes dades de cel·les que utilitza Scribe.js per a Excel.
  Reutilitza les estructures de dades, els estils i zip.js; no incorpora
  un altre motor OCR. Limitacions i comprovacions: `WORD_EXPORT.md`.

30/10/2026: la capa Word incorpora també les regions d'imatge del PDF
identificades per Scribe.js, utilitzant el seu renderitzador i adaptador de
canvas. Les imatges es retallen i s'empaqueten localment com a PNG dins del
DOCX. No s'ha afegit cap dependència ni s'ha modificat el repositori original
de Scribe.js.

## zip.js inclòs a Scribe.js

- Autor: Copyright (c) 2022 Gildas Lormeau. All rights reserved.
- Origen: `lib/zip.js/` del paquet `scribe.js-ocr` 0.17.0.
- Avís íntegre de redistribució i exempció de responsabilitat:
  `licenses/zip.js-BSD.txt`, copiat de la capçalera del fitxer distribuït.
- S'utilitza per empaquetar el DOCX al navegador; no és una dependència nova.

## Altres recursos

Els models locals cat, spa i eng es descarreguen de
https://github.com/tesseract-ocr/tessdata_fast durant la compilació.
Es mantenen els recursos, fonts i avisos originals de Scribe.js.
Aquest document registra els components i els canvis anteriors; no
certifica una auditoria completa de totes les dependències transitives,
fonts i models. La validació visual i la verificació de xarxa amb documents
reals es tracten separadament de les comprovacions de compilació.
