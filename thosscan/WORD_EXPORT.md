# Exportació Word de THOSsCAN

29/10/2026. Scribe.js 0.17.0 continua sent el motor de lectura i OCR.
`word-export.js` és una capa de THOSsCAN que reconstrueix el DOCX amb les
dades de Scribe.js. No modifica l'exportador Excel ni afegeix dependències.

## Com funciona

- `recognize({ ocrPages: 'auto', modeAdv: 'lstm' })` conserva el text nadiu
  dels PDF i utilitza OCR a les pàgines que Scribe.js considera necessari.
- Les taules s'obtenen de `doc.layoutDataTables` amb
  `scribe.utils.extractSingleTableContent`, igual que l'exportador Excel.
- Les cel·les contenen text editable; s'exporten les amplades de columna,
  les files, les vores i els salts de línia. Les alçades són mínimes, mai
  fixes: Word pot ampliar les files quan s'edita el text.
- El text de les cel·les no es duplica fora de la taula. El text no assignat
  a cap cel·la es conserva com a paràgraf.
- Es conserven les fonts declarades, les mides, negretes, cursives, subratllats,
  colors i superíndexs disponibles. El text i les taules s'ordenen per posició.
- Les dimensions PDF de Scribe.js es converteixen de 300 dpi a punts Word.
  Les imatges s'ajusten proporcionalment dins d'una pàgina A4.
- Es reutilitza zip.js, ja inclòs a Scribe.js, per empaquetar el DOCX al navegador.
  Els documents no s'envien a cap servei de conversió.
- Imatges PDF (30/10/2026): es recuperen les zones d'imatge identificades per
  Scribe.js, es renderitzen localment a 150 dpi i s'incorporen com a PNG al
  DOCX amb la seva mida i posició aproximades. Cada pàgina es renderitza una
  sola vegada i s'alliberen els recursos. El text fora de les imatges i les
  taules es mantenen editables. El text que forma part d'una imatge queda
  dins de la imatge i no es duplica com a text OCR.

## Verificació

- Prova local amb el PDF d'exemple de l'usuari: una taula de 5 files per
  3 columnes; 237 paraules conservades exactament una vegada; fletxes i
  símbol d'aturada originals; negretes, cursives i títol vermell.
- El PDF es reconeix com a digital i no s'hi aplica OCR.
- Relectura independent amb python-docx i comprovació de totes les parts XML.
- Proves automàtiques: cel·les buides i amb diverses línies, taules
  superposades, text anterior i posterior, documents sense taules,
  múltiples pàgines i dades de taula procedents d'imatges.
- Compilació Vite local correcta. El PDF privat d'exemple no s'incorpora al repositori.
- PDF d'exemple amb imatges: cinc PNG incorporats, dues seccions de pàgina,
  285 paraules natives conservades; relectura independent amb python-docx.
  S'han inspeccionat visualment les dues capçaleres i les tres figures
  recuperades. La prova completa del resultat a Word correspon a l'usuari.
- Proves d'imatges: vinculació dels fitxers PNG, deduplicació de posicions,
  text OCR dins de la figura, conservació de la taula editable, exclusió
  d'escanejos de pàgina completa i errors de renderització explícits.
- La prova visual a Word i la comprovació a la web corresponen a l'usuari.
  Les proves de dades d'imatges són sintètiques; no equivalen a una nova
  prova OCR real amb una imatge de l'usuari.

## Límits

No és una reproducció exacta de la maquetació. La detecció de taules depèn
de Scribe.js; no s'inventen taules quan no hi ha dades de cel·les. No es
reconstrueixen cel·les combinades, dibuixos vectorials sense imatge raster,
la disposició exacta d'imatges superposades o dins de cel·les, capçaleres/peus
vinculats, enllaços o notes a peu amb referències automàtiques. Les llistes
conserven el text i els marcadors, però no es converteixen en numeració Word
automàtica. Les fonts han d'estar disponibles al dispositiu que obre el DOCX.
Word pot redistribuir línies i pàgines, especialment després d'editar.
Les imatges grans que ocupen almenys el 80% de la pàgina no s'insereixen
com una fotografia de tota la pàgina: es manté el resultat OCR editable.
No s'afegeix detecció de figures dins d'una fotografia o d'un escaneig.

## Autoria i llicències

Motor i estructures de dades: Scribe.js, Balearica i col·laboradors,
https://github.com/scribeocr/scribe.js/tree/v0.17.0 (GNU AGPL-3.0).
La capa Word i l'ajust LSTM durant la compilació es distingeixen del motor
original. Vegeu `THIRD_PARTY_NOTICES.md` i `licenses/`.
El codi de la integració és públic a
https://github.com/dep-tecno/THOSAPPS/tree/main/thosscan.
