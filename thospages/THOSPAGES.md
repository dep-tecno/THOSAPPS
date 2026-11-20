# THOSPAGES — Especificació funcional i tècnica

**Projecte:** Tecno-Apps (`dep-tecno/THOSAPPS`)  
**Estat:** implementació publicada a GitHub; validacions locals documentades i revisió visual de la paginació/PDF pendent de l’usuari.  
**Versió del document:** 1.3 · dues columnes adaptatives · 20/11/2026  
**Llengua de la interfície:** català; castellà previst, encara pendent.  
**Propòsit:** transformar materials educatius digitals en documents PDF imprimibles sense ometre silenciosament contingut didàctic.

## Lectura conjunta i prioritat dels documents

`AGENTS-scorm.md` regeix el generador SCORM i el contracte de dades TAPP. `THOSPAGES.md` regeix l’aplicació lectora: interfície, importació segura, informe d’integritat, modalitats, maquetació i impressió. Les normes visuals i de navegació del SCORM no substitueixen la interfície aprovada de THOSPAGES. Treballar en aquest projecte no autoritza a modificar el generador.

Per als camps TAPP preval `AGENTS-scorm.md`; per al comportament de THOSPAGES preval aquest document. Si una contradicció afecta tots dos, documentar-la i resoldre-la abans d’implementar la part afectada. Les referències històriques a `AGENTS-SCORM-TAPP.md` i `AGENTS(1).md` designen el document que ara es conserva com a `AGENTS-scorm.md`, no contractes addicionals.

Els exemples JSON són il·lustratius. No inventar l’estructura dels camps pendents: consultar «Precisió del contracte i aspectes pendents» a `AGENTS-scorm.md`. Es pot avançar en les parts ja especificades sense declarar complet el suport dels casos pendents.

## 1. Objectiu i abast

THOSPAGES és una aplicació web de Tecno-Apps per convertir **temes, unitats didàctiques, capítols i llibres** en documents preparats per imprimir. No s'ha de limitar conceptualment a llibres ni a SCORM. La primera versió prioritzarà els paquets **SCORM 1.2 amb protocol TAPP 1.0** generats pel sistema de Codex. Les futures importacions es faran mitjançant adaptadors, sense canviar el motor de maquetació.

**Formats previstos i ordre de treball:**

1. **SCORM 1.2 + TAPP 1.0:** primera versió funcional, amb garantia de completitud condicionada a validació satisfactòria.
2. **Moodle Llibre:** HTML d'impressió i recursos locals; primer suport experimental després del nucli TAPP. L'HTML aïllat no garanteix la recuperació d'imatges protegides o remotes.
3. **eXeLearning:** importació de formats/exportacions concrets, a decidir amb mostres reals.
4. **H5P:** suport incremental per biblioteques i versions concretes, sense prometre compatibilitat universal.
5. **SCORM genèric sense TAPP:** exploració posterior amb advertiments d'integritat.

## 2. Requisits no negociables

- **100 % al navegador del client**: descompressió, lectura, normalització, vista prèvia i generació/impressió PDF locals.
- **Sense backend, APIs de conversió, comptes, registre ni Firebase**. Accés públic i anònim.
- **Cap document de l'usuari no s'envia a cap servidor**, ni s'emmagatzema remotament. Evitar analítica que capturi noms o contingut dels fitxers.
- Desplegable com a **aplicació estàtica a GitHub Pages** sota `tecno-apps.cat`.
- Dependències JS/CSS empaquetades localment, sense CDN necessari per funcionar; no executar scripts provinents dels paquets importats.
- Processament temporal en memòria; revocar URL d'objecte i netejar dades en carregar un altre paquet o reiniciar. Informar dels límits de memòria amb paquets grans.
- Conservar el disseny general de Tecno-Apps: capçalera compacta, logotip discret, títol enllaçat a portada i interfície clara. Adaptar-se a ordinador i tauleta.
- **La comprovació del desplegament públic i del domini la fa exclusivament l'usuari**. No obrir navegadors ni verificar Pages/desplegaments en nom seu; limitar-se a implementar i informar.

## 3. Contracte de dades: TAPP 1.0

El contracte de dades és el de la secció «Compatibilitat amb THOSPAGES — Protocol TAPP 1.0» del document `AGENTS-scorm.md`. **THOSPRINT és el nom antic; l'aplicació passa a dir-se THOSPAGES, però l'identificador del protocol continua sent `TAPP` per compatibilitat.** No renombrar rutes, claus ni versions existents només pel canvi de marca.

Dins del ZIP SCORM hi haurà, com a mínim:

```text
imsmanifest.xml
index.html
... recursos SCORM existents ...
tapp/manifest.json
tapp/content.json
tapp/solutions.json
[tapp/assets/...]
```

- `tapp/manifest.json`: `protocol: "TAPP"`, `version` compatible amb `1.0.x`, `bookId`, `title`, `language`, `source`, `files.content`, `files.solutions` i preferències d'impressió.
- `tapp/content.json`: `bookId`, `chapters[]`, `sections[]`, `blocks[]`, identificadors estables i ordre de lectura.
- `tapp/solutions.json`: `bookId`, `answers[]`, vinculats a les preguntes per `questionId`.
- Tipus mínims de bloc: `paragraph`, `heading`, `list`, `table`, `formula`, `figure`, `example`, `question`, `note`, `variant`.
- Les imatges i els SVG han de ser recursos locals empaquetats i les variants didàctiques s'han de representar explícitament.
- **No deduir respostes correctes** a partir de l'aspecte visual de les preguntes.

**Regla de compatibilitat:** implementar un validador que rebutgi versions majors desconegudes; tolerar camps addicionals sense executar-los. Les especificacions de camps del document `AGENTS-scorm.md` prevalen sobre exemples abreujats d'aquest fitxer. Si apareixen discrepàncies, aturar la implementació de la característica afectada i documentar-les; no inventar un esquema divergent.

## 4. Arquitectura de l'aplicació

```text
Fitxer local
   ↓
Detector de format + comprovacions de seguretat ZIP
   ↓
Adaptador d'entrada (primer: SCORM-TAPP)
   ↓
Model intern de document (TAPP normalitzat)
   ↓
Validador d'integritat i recursos
   ↓
Maquetador HTML/CSS d'impressió
   ↓
Vista prèvia + impressió / Desa com a PDF
```

**Estructura actual del projecte:**

```text
THOSPAGES/
├── index.html
├── styles.css
├── print.css               # estils del document paginat
├── js/
│   ├── app.mjs
│   ├── zip.mjs
│   ├── model.mjs
│   ├── resources.mjs
│   ├── render.mjs
│   ├── columns.mjs
│   └── pagination.mjs
├── vendor/pagedjs/          # Paged.js 0.4.3 i llicència MIT
├── assets/                 # icones i logotip propis
├── tests/                  # proves locals sense navegador
├── tools/serve.mjs          # servidor estàtic local opcional
├── Obre-THOSPAGES.cmd
├── VERIFICACIO-LOCAL.md
└── THOSPAGES.md
```

La ruta publicada és `thospages/` dins de `dep-tecno/THOSAPPS`. Reutilitzar els patrons visuals aprovats i preservar les funcionalitats existents en continuar el desenvolupament.

### 4.1 Seguretat d'importació

- Comprovar tipus real, mida i nombre d'entrades del ZIP; imposar límits configurables de mida descomprimida i ràtio de compressió (protecció contra ZIP bombs).
- Rebutjar rutes absolutes, travessies `../`, duplicats conflictius i referències a recursos externs essencials.
- Parsejar JSON com a dades i XML amb parser segur; no inserir HTML arbitrari amb `innerHTML` sense sanejament.
- **No executar JavaScript importat**, ni carregar iframes, scripts, formularis o recursos remots del material.
- Tractar SVG importats com a contingut potencialment actiu: sanejar-lo o convertir-lo amb una ruta segura abans de mostrar-lo; no confiar-hi per ser SVG.
- Alliberar recursos i donar errors comprensibles sense mostrar dades privades a serveis externs.

## 5. Interfície — primera versió

### 5.1 Capçalera

Icona pròpia de **llibre obert de 32 × 32 px** immediatament a l’esquerra de **THOSPAGES**, sense augmentar l’alçada de la capçalera. Subtítol exacte: **«Prepara el teu material per imprimir»**. Mostrar a la mateixa barra les etiquetes/píndoles **«SCORM + TAPP»**, **«LLIBRE HTML»** i **«eXeLearning»**; les dues darreres han de quedar visualment atenuades mentre no estiguin implementades, sense presentar-les com a operatives. El títol enllaça amb la portada de Tecno-Apps. **Mantenir el favicon general de Tecno-Apps: no substituir-lo per la icona del llibre.** No duplicar aquests textos a l’àrea principal.

### 5.2 Flux principal

1. **Importa:** àrea per arrossegar un `.zip` o seleccionar-lo localment. Detecció de `imsmanifest.xml` i `tapp/manifest.json`; si no hi ha TAPP, informar «Format encara no compatible» en lloc de simular conversió.
2. **Analitza:** mostrar títol, idioma, format, capítols, seccions, preguntes, figures i incidències.
3. **Configura:** mida A4 (inicial), orientació vertical, portada, índex, salts entre capítols, espai per respondre, mode de solucions i estil compacte/treball.
4. **Previsualitza:** fulls A4 separats i numerats, recompte total i accés a una pàgina concreta. Aplicar les comprovacions de conservació de contingut i els límits descrits a l’apartat 5.4.
5. **Imprimeix / desa PDF:** usar `window.print()` i full d'estils `@media print`, **sempre després de mostrar un avís explícit que recordi seleccionar «Desa com a PDF» al diàleg de Chrome**. No incorporar cap opció «No tornar a mostrar». No prometre descàrrega PDF directa fins que hi hagi un motor local provat.

### 5.3 Modalitats

- **Llibre sense solucions:** llibre complet, amb les activitats sense claus de correcció.
- **Llibre amb solucions al costat de cada exercici:** llibre complet, amb les correccions immediatament després de les activitats.
- **Llibre amb solucions en fulls al final:** llibre complet amb les activitats sense correccions al cos principal i un annex de solucions que comença en pàgina nova. L’annex conserva l’ordre dels capítols i seccions, els enunciats i el context necessari, incloses figures i taules. No és un solucionari separat que substitueixi el llibre.

Cap modalitat no ha de perdre activitats ni apartats. **Els exemples guiats sempre inclouen els passos i la solució**, en totes tres edicions. Aquesta nota apareix sota el selector. Les tres opcions s’apliquen a les activitats de pràctica i a les d’avaluació final. El nom «sense solucions» es refereix a les claus de les activitats, no als resultats dels exemples. No s’ofereix una quarta edició de solucionari independent que exclogui el llibre.

### 5.4 Previsualització paginada A4 — 20/11/2026

La previsualització ha de mostrar fulls A4 separats i numerats, amb recompte total i accés a una pàgina. Paged.js 0.4.3 s’empaqueta localment amb llicència MIT i processa només el DOM segur generat pel lector i el full d’estils propi `print.css`. S’executa dins d’un marc de previsualització controlat per THOSPAGES, sense executar iframes, scripts o CSS del material importat i sense enviar el contingut per xarxa.

La impressió del botó utilitza el mateix document paginat del marc (`window.print()` d’aquell document), després de l’avís obligatori. L’avís recorda seleccionar «Desa com a PDF», A4 vertical, escala 100 %, marges «Cap» i capçaleres/peus del navegador desactivats. Si l’usuari altera aquesta configuració, el resultat pot variar. No prometre identitat exacta fins que l’usuari hagi revisat visualment el PDF.

Esperar les imatges i les fonts abans de paginar. Una nova importació o canvi d’edició cancel·la la previsualització anterior. Comprovar que tots els blocs, textos i recursos gràfics han passat al resultat paginat; si falta contingut o falla el motor, bloquejar la impressió i informar de la incidència. Aquesta comprovació estructural no certifica la geometria ni la llegibilitat.

### 5.5 Una columna o dues columnes adaptatives

El selector «Maquetació» és independent de les tres edicions: **«Una columna»** conserva la distribució anterior i **«Dues columnes adaptatives»** permet provar una distribució més eficient del paper. No canviar automàticament l’edició ni ometre contingut per reduir el recompte de pàgines.

- El text i els blocs habituals flueixen en dues columnes de 86,5 mm separades per 7 mm, dins de l’amplada útil A4 de 180 mm. L’ordre és de dalt a baix a l’esquerra i després a la dreta. Portada i índex romanen a tota amplada.
- Els SVG validats es mesuren temporalment dins del document aïllat de previsualització. L’amplada es calcula a partir del `viewBox`, la mida de les etiquetes i les seves transformacions, amb una referència aproximada de 8,5 punts per a les etiquetes. Reservar espai per al padding dels blocs; si no hi cap, utilitzar tota l’amplada.
- Les figures que no es poden mesurar amb confiança, incloses les raster, conserven tota l’amplada. Les taules de més de tres columnes i les fórmules llargues també passen a tota amplada. Si una figura detallada és dins d’una pregunta, exemple o variant, ampliar el bloc que la conté per mantenir-ne el context.
- No retallar els SVG ni eliminar figures repetides en aquesta primera prova. Les proporcions, etiquetes i colors tècnics es conserven. L’ajust és una regla general: no depèn del nom del llibre, del capítol ni del fitxer gràfic.
- Les estimacions de llegibilitat són heurístiques, no una garantia de mida tipogràfica exacta en qualsevol SVG. La lectura, els salts i l’ordre efectiu de les columnes s’han de revisar al navegador i al PDF. Les comprovacions de conservació de blocs i figures continuen actives i bloquegen omissions detectades.

Objectiu: aprofitar millor el paper mantenint la llegibilitat. No fixar ni prometre un nombre final de pàgines abans de revisar el resultat imprès. L’usuari compara la mateixa edició i les mateixes opcions d’espai i salts entre les dues maquetacions.

## 6. Regles de maquetació i fidelitat

- Format A4 per defecte, marges aptes per impressió, Arial o font substituta local i contrast adequat. **Separar el tema de l’aplicació del tema del llibre imprès**: la interfície segueix THOSsCAN, mentre que el document imprès pot recuperar la paleta institucional del SCORM (granat #781e2d i vermell #a12c40), adaptada al paper i configurada sense alterar colors tècnics de figures.
- Portada opcional, títols jerarquitzats, índex i numeració de pàgines quan el motor ho permeti de manera fiable.
- Evitar títols orfes, retalls d'imatges i separacions inadequades amb `break-inside`, `break-before` i estils específics.
- Les taules amples s'han d'adaptar o dividir sense perdre columnes ni unitats; les fórmules han de conservar subíndexs, exponents i símbols.
- Reutilitzar figures originals; els SVG han de mantenir etiquetes, fletxes, llegendes i proporcions.
- Incloure tots els estats didàcticament rellevants de pestanyes i desplegables exportats a TAPP.
- Transformar activitats en representacions de paper equivalents, amb espai de resposta si escau.
- Si algun element no es pot representar amb fidelitat, mostrar-lo com a **incidència bloquejant** per a l'etiqueta «complet», mai ocultar-lo.
- No afirmar que l'exportació conserva el 100 % del contingut fins que la comparació d'inventaris i la revisió del render ho avalin.

## 7. Informe d'integritat

Mostrar com a mínim:

- Total de capítols, seccions, blocs, figures i preguntes.
- Recursos resolts, absents o incompatibles.
- Preguntes sense solució o amb referències inconsistents.
- Blocs o tipus no suportats i variants incompletes.
- Estat global: **apte**, **apte amb advertiments** o **no complet / conversió bloquejada**.

El recompte ha de venir dels fitxers importats, no de xifres simulades. La vista prèvia ha d'identificar les incidències al punt corresponent.

## 8. Compatibilitat amb Moodle

THOSPAGES **llegeix** el ZIP; no el modifica ni el torna a empaquetar. La compatibilitat SCORM/Moodle és responsabilitat del generador que incorpora TAPP. Per a proves de referència, usar el paquet «Tema 3 - Instal·lacions en els habitatges - SCORM 1.2.zip» i una còpia posterior enriquida amb TAPP. **El ZIP original sense TAPP no ha de presentar-se com a convertible amb fidelitat a la primera versió.**

## 9. Fases d'implementació

**Fase 0 — Disseny i estructura (interfície ja validada per l’usuari):** conservar la interfície existent, corregint només la icona de capçalera pendent; cap simulació enganyosa de conversió.

**Fase 1 — Importació TAPP:** lector ZIP local, detector, validació de `manifest/content/solutions`, inventari i missatges d'error.

**Fase 2 — Render imprimible:** motor de blocs, figures, fórmules, taules, activitats i tres modalitats de sortida; estils A4 i impressió local.

**Fase 3 — Qualitat:** prova amb un paquet real generat per Codex, comprovació d'integritat, recursos, solucionari, maquetació i memòria. No declarar complet el suport TAPP fins a superar-les.

**Fase 4 — Moodle Llibre:** prototip d'importació d'HTML imprimible amb recursos locals; definir com s'aporten fitxers associats abans de prometre fidelitat.

**Fases posteriors:** eXeLearning, H5P per biblioteques i SCORM genèric, amb adaptadors independents.

## 10. Criteris d'acceptació de la primera versió funcional

- [ ] Aplicació estàtica accessible sense iniciar sessió.
- [ ] Cap petició de xarxa amb contingut dels documents; totes les dependències necessàries són locals.
- [ ] Importa un ZIP SCORM-TAPP 1.0 real i n'identifica el títol i l'estructura.
- [ ] Mostra errors clars per a ZIP corrupte, absència de TAPP i versions incompatibles.
- [ ] Construeix la vista prèvia de tots els blocs suportats sense executar codi del ZIP.
- [ ] Conserva els recursos gràfics locals i les explicacions/variants.
- [ ] Ofereix les tres edicions de l’apartat 5.3; les claus de les activitats no apareixen al cos principal del llibre sense solucions ni del llibre amb annex final.
- [ ] Conserva els passos i resultats dels exemples guiats en totes tres edicions.
- [ ] Mostra fulls A4 separats i numerats; l’annex de solucions comença en pàgina nova.
- [ ] Genera una impressió A4 amb «Desa com a PDF» i sense controls de la interfície.
- [ ] Presenta informe d'integritat i no amaga omissions.
- [ ] Funciona amb teclat i en amplades de pantalla habituals.
- [ ] L'usuari valida personalment el desplegament públic; el desenvolupador no fa proves de Pages ni del domini.

## 11. Decisions pendents, no bloquejants per a la interfície

- Ubicació ja definida: `thospages/`. Limitar-hi les publicacions pròpies de l’aplicació; modificar la portada general només quan sigui necessari i s’hagin revisat els workflows que s’hi activen.
- Límits implementats: 60 MB de ZIP, 160 MB descomprimits, 1.500 entrades i ràtio màxima 200 per a entrades de més d’1 MB. Ajustar-los només amb evidència de proves; ZIP64, xifrat i multivolum no admesos.
- Lector ZIP propi i descompressió nativa del navegador; Paged.js 0.4.3 local amb llicència MIT. La geometria de la paginació i el PDF continuen pendents de revisió manual.
- Confirmar l'abast de l'índex amb números de pàgina segons capacitats reals del navegador.
- Disposar d’un ZIP pilot SCORM-TAPP real amb teoria, figures, taules, fórmules, exemples, variants, preguntes i solucions. Contrastar-lo amb la font i amb el contracte abans de declarar compatibilitat completa. Una mostra real no substitueix la definició escrita dels camps pendents.

---

**Instrucció de treball:** **no redissenyar la interfície validada**; començar per l’importador i el motor TAPP. No afegir compatibilitat fictícia amb eXeLearning, H5P o Moodle Llibre. No modificar el generador SCORM ni el repositori sense necessitat expressa. Comunicar els canvis realitzats i deixar la verificació pública a l'usuari.


## 12. Referència contractual SCORM — `AGENTS-scorm.md`

El document `AGENTS-scorm.md`, titulat «Normes generals per crear llibres a Moodle», conté la secció **«Compatibilitat amb THOSPAGES — Protocol TAPP 1.0»**. En aquesta especificació, **THOSPRINT és únicament el nom històric de THOSPAGES**: no canviar el nom de protocol `TAPP`, la versió `1.0.0`, les rutes JSON, els camps ni els identificadors. El generador SCORM i THOSPAGES són projectes independents. No modificar el generador ni les seves instruccions com a part d’una implementació de THOSPAGES sense encàrrec explícit.

### 12.1 Contracte d'origen i empaquetament

- Un sol ZIP **SCORM 1.2** amb `imsmanifest.xml` a l’arrel, un SCO i el seu punt d’entrada, sense alterar qualificació, navegació ni persistència Moodle.
- `tapp/manifest.json`, `tapp/content.json`, `tapp/solutions.json` i recursos locals opcionals a `tapp/assets/` o altres rutes relatives internes. Els fitxers TAPP afegits han de constar al manifest SCORM segons les regles del generador.
- TAPP és **dades**, mai scripts executats pel SCO ni per THOSPAGES. Sense recursos essencials externs, sense rutes que escapin del ZIP, sense col·lisions ni duplicació innecessària.
- El model interactiu i TAPP han de derivar de la mateixa font, amb IDs estables i únics, i conservar ordre, unitats, títols, explicacions, llegendes, notes, passos ocults i estats alternatius. No imprimir controls de navegació sense valor didàctic.
- Els tres JSON són UTF-8. `manifest.json` exigeix `protocol`, `version`, `bookId`, `title`, `language`, `source`, `files.content`, `files.solutions` i `print`. `content.json` exigeix `bookId`, `chapters[]`, `sections[]`, `blocks[]` amb `id` i `type`. `solutions.json` exigeix `bookId`, `answers[]` vinculats per `questionId`.
- Les definicions i exemples de JSON i els deu tipus de bloc de l’apartat 3 d’aquest document són el mínim interoperable; **no assumir** camps addicionals sense comprovar-los en un paquet real.

### 12.2 Semàntica didàctica que el motor ha de preservar

- **Teoria:** text complet, jerarquia, llistes, definicions, notes, taules amb capçaleres/unitats/notes i fórmules amb `latex` més `fallbackText` llegible sense scripts.
- **Exemples:** dades, desenvolupament ordenat, conversions, passos i resultats, fins i tot quan el SCORM els revela progressivament.
- **Figures:** SVG autònom amb `viewBox` i dependències internes, o imatge raster suficient; etiquetes, símbols normalitzats, fletxes, llegendes, colors significatius, `alt` i peu. Cada estat alternatiu rellevant s'ha de mostrar separadament i etiquetat. El motor no ha de capturar només l'estat inicial d'una interacció.
- **Activitats:** opció única i múltiple, numèrica (unitats, tolerància, coma decimal, puntuació i subapartats), resposta breu, completar, ordenar i relacionar. Quan el contracte real no defineixi encara els camps d'un tipus, **informar que manca especificació i bloquejar la declaració de conversió completa**; no inventar l'esquema.
- **Avaluació:** distingir pràctica guiada i avaluació final, conservar preguntes i puntuacions, però no reproduir al paper la lògica de registre de notes o la restricció temporal de mostrar correccions.
- **Solucions:** vincular totes les claus a `questionId`, amb respostes, justificació i feedback disponibles; no mostrar claus al llibre de l’alumnat. Cap resposta òrfena ni pregunta sense clau quan en requereixi.
- **Privacitat:** no importar ni imprimir dades personals de l'alumnat, notes reals ni estat de sessió.

### 12.3 Separació de responsabilitats

El generador SCORM **produeix i valida** el ZIP Moodle i l’inventari TAPP. THOSPAGES **llegeix, valida, transforma i imprimeix**, però **mai reescriu** el ZIP ni executa el seu SCO. THOSPAGES no ha de donar per demostrada la compatibilitat Moodle: aquesta prova correspon al projecte productor i al professorat. Per al pilot es recomana «Tema 3 · Instal·lacions en els habitatges», però el motor no ha de dependre de noms interns com `teoria.js`, `figures.js` o `avaluacio.js`.

## 13. Disseny d'interfície congelat (validació de l'usuari)

**No redissenyar la pantalla.** Prendre com a referència visual THOSsCAN i preservar la composició actual. Tokens de referència: font `Inter, system-ui, sans-serif`; text `#e8f5fa`, fons `#0d2635`; capçalera `#102c3e` amb línia inferior `2px solid #205267` i padding `10px 20px`; targetes `#163547`, vores `#35596b`, radi `15px`; títol de 22 px amb accent `#63d5e5`. Panell de configuració dret amb fons pissarra/blau diferenciat, aproximadament `#244657`. Conservar àrea d'importació i vista A4 gran.

La icona del llibre obert de **32 × 32 px** va **només** al costat del nom THOSPAGES. **El favicon és el general de Tecno-Apps i queda intacte.** Conservar exactament el subtítol «Prepara el teu material per imprimir» i les tres píndoles de formats a la capçalera. Els formats futurs no han d’activar controls ficticis.

## 14. Flux d'impressió i comportament obligatori

1. Seleccionar **Llibre sense solucions**, **Llibre amb solucions al costat de cada exercici** o **Llibre amb solucions en fulls al final**, en aquest ordre al selector. Conservar sempre els exemples resolts i mostrar les pàgines de l’edició seleccionada.
2. En prémer el control d'impressió, mostrar **sempre** un diàleg o avís previ clar: «Per generar el PDF, selecciona “Desa com a PDF” a la destinació d'impressió de Chrome». Oferir continuar o cancel·lar; no oferir «No tornar a mostrar».
3. Només després de confirmar, invocar `window.print()` del document de previsualització paginat des d’una acció d’usuari vàlida. Imprimir aquestes mateixes pàgines, sense controls de la interfície. L’avís ha d’indicar A4 vertical, escala 100 %, marges «Cap» i capçaleres/peus del navegador desactivats.
4. No prometre ni simular descàrrega PDF directa, desament automàtic, nom de fitxer forçat ni control del diàleg natiu. La numeració correspon a les pàgines calculades pel motor; la correspondència visual amb el PDF exigeix la configuració indicada i la revisió de l’usuari.
5. Estils específics per a portada, índex, capítols, notes, exemples, taules, figures, activitats i solucionari; minimitzar títols orfes, desbordaments i pàgines buides. Les capçaleres/peus natius de Chrome poden requerir desactivació manual.

## 15. Validacions, proves i criteris d'acceptació ampliats

**Validador d'importació:** ZIP real i límits contra bombes ZIP; XML SCORM ben format; `imsmanifest.xml` a l'arrel; TAPP 1.0 reconegut; `bookId` coherent; IDs únics; rutes normalitzades, internes i existents; absència de recursos essencials remots; referències entre contingut, figures i solucions resoltes. Els SVG s'han de tractar com a contingut no fiable, sense scripts, esdeveniments ni referències externes. No usar `innerHTML` amb material no sanejat ni executar scripts del paquet.

**Validador semàntic:** inventaris per capítol, secció, bloc, figura, variant, exemple, pregunta i subapartat; identificar omissions, tipus desconeguts, fórmules no representables, recursos absents, solucions òrfenes i preguntes sense solució. Mostrar estats **apte**, **apte amb advertiments**, **no complet / bloquejat**; les incidències que impliquen pèrdua de contingut han de bloquejar l'etiqueta «complet» i l'exportació presentada com a fidel.

**Proves locals sense navegador públic:** proves unitàries de parsers, validadors, normalització de rutes, representació dels tipus de bloc, aïllament de solucions, neteja de recursos i regressió amb ZIP pilot. Revisió visual del PDF final i la compatibilitat Moodle real **les fa l'usuari**; el desenvolupador informa què queda pendent. **No obrir navegador, no consultar GitHub Pages, no provar `tecno-apps.cat`, no fer verificacions remotes ni desplegaments automàtics.**

**Casos mínims:** ZIP corrupte; ZIP sense TAPP; versió major desconeguda; `bookId` diferent; fitxer absent; rutes `../`; SVG amb contingut actiu; IDs duplicats; pregunta sense clau; resposta òrfena; figura absent; bloc desconegut; variant múltiple; taula ampla; fórmula llarga; llibre d'alumne sense solucions; solucionari complet; cancel·lació de l'avís d'impressió; confirmació amb `window.print()`.

## 16. Ordre concret d'execució per a Codex

- **Pas 1.** Inspeccionar els fitxers actuals de THOSPAGES i identificar els punts d'extensió; **preservar la interfície aprovada** i el favicon. No començar de zero ni modificar altres apps.
- **Pas 2.** Implementar importador ZIP local, detecció SCORM + TAPP, parseig segur i validació estructural, amb missatges útils.
- **Pas 3.** Normalitzar el model de capítols, seccions, blocs, recursos i solucions; construir l'informe d'integritat a partir de dades reals.
- **Pas 4.** Implementar renderització A4 de tots els tipus mínims, incloses figures SVG segures, taules, fórmules, variants, exemples i activitats; documentar els tipus d'activitat que requereixin esquema addicional.
- **Pas 5.** Implementar les tres modalitats i comprovar que el mode alumne no mostra respostes ni en el DOM imprimible.
- **Pas 6.** Incorporar l'avís obligatori previ i `window.print()`, amb CSS d'impressió que exclogui la UI.
- **Pas 7.** Afegir proves automatitzables i casos de regressió; informar d'errors i limitacions reals sense marcar la feina com a acabada si falta cobertura.
- **Pas 8.** Lliurar resum breu de fitxers canviats, instruccions d'ús i comprovacions pendents per al professorat. **L'usuari és l'únic responsable de validar el desplegament públic.**

**Fora d'abast de la primera entrega:** extracció heurística d'un SCORM sense TAPP, importadors Moodle Llibre/eXeLearning/H5P, generació PDF silenciosa, backend, Firebase, registre d'usuaris i canvis al generador SCORM. No ampliar l'abast sense autorització.

## 17. Estat real del projecte

Aquesta especificació documenta el comportament requerit i l’estat contrastat; no certifica compatibilitat universal ni fidelitat visual completa. La interfície aprovada, la icona de llibre i el favicon general estan implementats. La importació del pilot real i les proves locals consten a continuació. La revisió visual de la paginació A4 i del PDF continua pendent de l’usuari.

### 17.1 Implementació contrastada amb el pilot — actualitzada el 20/11/2026

S’ha implementat el lector ZIP amb comprovació CRC i límits de descompressió, validació SCORM/TAPP, comprovació de context i solucions, preparació segura d’SVG i renderització de les tres modalitats. El perfil concret del pilot queda documentat a `AGENTS-scorm.md`. La capçalera recupera la icona de llibre de 32 × 32 i el favicon general de Tecno-Apps; es conserva la composició de la interfície.

El pilot proporciona 12 capítols (incloses portada, avaluació i fonts), 87 seccions, 52 preguntes, 52 solucions, 27 exemples i 82 recursos SVG diferents. Abans de paginar, el renderitzador conserva 97 aparicions de figures al llibre sense solucions, 123 al llibre amb solucions al costat de cada exercici i 147 al llibre amb solucions en fulls al final, que repeteix el context necessari a l’annex. Totes tres edicions conserven els 27 exemples complets. Aquests recomptes són comprovacions estructurals amb un adaptador DOM per a Node, no una revisió visual amb navegador.

**Incidència històrica corregida al pilot regenerat:** el 19/11 el bloc `joule-teoria-1-formules-4` contenia `[[0]]` sense resoldre. El ZIP rellegit el 20/11 ja representa `Q = V² · t / R`, sense aquest marcador, i supera la validació de dades i recursos del lector. El seu SHA-256 és `464C51F0F5638C59A788D897DAB2F8FDC573594F29F7BCA151913F6DFD30C6A2`. Les còpies antigues defectuoses continuen bloquejades. THOSPAGES no modifica ni repara el ZIP importat.

Les 17 proves locals passen amb el pilot regenerat. Inclouen errors de ZIP/JSON/XML, rutes insegures, recursos actius, referències i claus inconsistents, les tres edicions, conservació del context, cancel·lació/confirmació d’impressió i neteja de recursos. Una còpia defectuosa creada només en memòria comprova la regressió del marcador `[[0]]`. Les proves de paginació utilitzen un motor simulat per verificar els fluxos, la detecció d’omissions i el document que rep la crida d’impressió; **no executen la maquetació real de Paged.js en un navegador**. Vegeu `VERIFICACIO-LOCAL.md` per reproduir-les i conèixer-ne els límits.

El codi s’ha publicat a `dep-tecno/THOSAPPS`, branca `main`, ruta `thospages/`. El commit `930175cd62c8126d29c3ef555f5cebd72e4e17a2` incorpora la previsualització paginada i les tres edicions actuals. L’usuari ha informat que la versió anterior funcionava; la nova geometria de pàgina i el PDF encara necessiten la seva revisió. Continuen pendents també la cobertura completa respecte de les fonts i la prova real a Moodle. No s’ha obert cap navegador ni comprovat el domini o el desplegament públic per validar aquests canvis.

### 17.2 Correcció de càrrega del motor — 20/11/2026

Corregida la detecció de la llibreria local: el bundle `paged.min.js` 0.4.3 exposa `PagedModule.Previewer`, no `Paged.Previewer`. La referència antiga produïa «Motor de paginació local no disponible» després d’importar correctament el ZIP. Una prova executa ara el bundle real en Node i verifica aquest contracte d’exportació; les proves de geometria continuen pendents de l’usuari al navegador. La pàgina i el mòdul de paginació incorporen una versió a l’URL per evitar reutilitzar la integració antiga de la memòria cau.
