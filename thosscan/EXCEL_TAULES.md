# Excel amb una taula per pestanya

31/10/2026. Opció voluntària, desmarcada per defecte i visible només per a
la sortida Excel. La conversió habitual i la sortida Word es mantenen.

`excel-export.js` reutilitza `scribe.tableChains`,
`scribe.utils.extractSingleTableContent` i `scribe.utils.writeXlsxFromSheets`
de Scribe.js 0.17.0, sense dependències noves ni modificar el motor original.

- Una taula detectada independent genera una pestanya «Taula 1», «Taula 2»…
  Les pestanyes tenen noms únics i vàlids per a Excel.
- Només s'agrupen fragments que Scribe.js marca com a continuacions. No es
  fusionen taules independents només perquè tinguin les mateixes columnes.
- Les capçaleres repetides d'una continuació es retiren quan coincideixen
  amb les de l'inici de la mateixa taula.
- Les cel·les conserven l'ordre de lectura, els salts de línia, els estils
  disponibles i les posicions buides. Els textos numèrics amb zeros inicials
  no es converteixen automàticament en números; els textos que comencen amb
  un signe igual no es converteixen en fórmules.
- S'informa de les taules revisades i del nombre de pestanyes generades.
- La cancel·lació s'atén entre taules i fragments. Durant l'escriptura final
  del llibre s'espera l'operació en curs i se'n descarta el resultat si s'ha
  cancel·lat. No s'ofereixen fitxers parcials.
- Si no hi ha taules amb contingut, es mostra un missatge que permet tornar
  a la conversió habitual; no es genera un llibre buit ni un bolcat de text
  que es presenti com una taula reconeguda.

La detecció i els enllaços de continuació depenen de Scribe.js. No es promet
separació perfecta en escanejos difícils ni reconstrucció de cel·les combinades.
La comprovació visual amb documents reals a la web correspon a l'usuari.

Proves: `node --test app.test.mjs excel-export.test.mjs word-export.test.mjs`.
