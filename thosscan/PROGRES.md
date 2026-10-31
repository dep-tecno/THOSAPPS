# Progrés i cancel·lació de THOSsCAN

31/10/2026. Es manté Scribe.js 0.17.0 i el processament local al navegador.

## Progrés real

- Obertura: indicador indeterminat; no s'inventa un percentatge de lectura.
- OCR: els esdeveniments `convert` de Scribe.js indiquen la pàgina completada
  pel model LSTM. S'ignoren repeticions i es mostra el número de pàgina i
  el recompte real. El mode automàtic pot ometre pàgines amb text nadiu;
  per això no es divideix el recompte OCR pel total com si totes requerissin OCR.
- Word: `onProgress` informa de les pàgines revisades per recuperar imatges
  i de les pàgines incorporades al DOCX. La barra correspon a la fase actual.
- Excel: els esdeveniments `export` informen de les pàgines incorporades.
- Empaquetament: indicador indeterminat. Només es mostra la conversió
  completada quan el resultat està preparat i s'han tancat els recursos.

## Cancel·lació

- Es bloqueja la selecció de fitxer, idioma i format mentre hi ha una operació.
  No s'inicia una segona conversió ni s'accepta un fitxer arrossegat durant l'espera.
- El botó activa un `AbortController` i mostra «Cancel·lant…».
- OCR: `doc.recognize({ signal })` utilitza la cancel·lació nativa de Scribe.js.
  Deixa d'enviar treball nou, espera el treball iniciat i retorna un AbortError.
- Word: es comprova el senyal entre pàgines i imatges i durant l'escriptura ZIP.
  Es cedeix el control al navegador entre operacions perquè el botó respongui.
- Obertura de PDF, renderització d'una imatge i exportació Excel: no es força
  la destrucció dels workers. S'espera l'operació en curs i se'n descarta el
  resultat. La cancel·lació no és instantània durant aquestes operacions.
- Sempre es tanca el document abans de permetre un nou intent. No s'ofereixen
  fitxers parcials ni apareix un error tècnic quan l'usuari ha cancel·lat.
- Es conserva el fitxer seleccionat per poder repetir la conversió.

## Verificació

`node --test app.test.mjs word-export.test.mjs` cobreix progrés real,
esdeveniments duplicats, cancel·lació durant obertura, OCR, Word, Excel,
renderització, empaquetament i tancament, nou intent i errors reals.
També es mantenen les proves de taules i imatges. La interacció visual a
la web i els documents llargs continuen pendents de la comprovació de l'usuari.
