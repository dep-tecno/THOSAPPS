# THOSPDF

Aplicació estàtica en català per unir PDF i extreure pàgines. Obre `index.html` mitjançant un servidor HTTP local. No requereix compilació ni serveis de Google.

## Funcions

- Unió de dos PDF o més, amb ordenació alfabètica natural, reordenació manual i eliminació de documents de la llista.
- Extracció d’intervals en un document, o separació d’un document en un PDF per pàgina.
- Miniatures locals amb PDF.js sota cada interval: només les pàgines incloses, amb navegació pròpia en grups de sis. Cada interval es previsualitza de manera independent.
- Descàrregues explícites, originals intactes i processament en memòria. No envia fitxers ni registra noms o contingut.
- Si falla un document, no ofereix un resultat parcial com si fos complet.

## Procedència i límits

Adaptació del Google Apps Script facilitat per l’usuari el 29/10/2026. L’original recorria una carpeta de Drive i unia documents alfabèticament amb PDF-LIB. S’ha substituït Drive per selecció local i descàrrega; no es conserva l’identificador privat de carpeta ni el nom específic dels contractes. S’ha afegit la separació, absent del fragment original.

Motor: PDF-LIB 1.17.1, d’Andrew Dillon, MIT. Distribució i llicència a `vendor/`. Referència: https://pdf-lib.js.org/. No s’utilitza `eval` ni es descarrega codi en temps d’execució.

Visor: PDF.js 6.4.299, de Mozilla i col·laboradors, Apache 2.0. Motor i worker locals a `vendor/pdfjs/`, amb versió i llicència. La previsualització no impedeix extreure pàgines si un document no es pot representar. Les pàgines amb recursos tipogràfics especials poden tenir diferències visuals; el PDF exportat copia les pàgines originals, no les imatges del visor.

Comprovació del visor per intervals: PDF de vuit pàgines, interval 1–2 amb les miniatures 1 i 2, i interval 5–6 amb les miniatures 5 i 6 sota els camps corresponents. Revisió visual i consola sense errors ni avisos.

No admet PDF xifrats. La capacitat depèn de la memòria del navegador; PDF-LIB carrega els documents complets. No és una eina d’OCR, compressió o edició de text. La còpia de pàgines no garanteix signatures digitals, marcadors, adjunts o camps interactius. Per molts resultats individuals cal descarregar cada enllaç.

## Integració a Tecno-apps

Ruta pública: https://tecno-apps.cat/thospdf/. Targeta al catàleg principal i entrada al sitemap. El logotip i el nom de la capçalera tornen a la pàgina principal amb `target="_top"`. Interfície fosca i avís de processament local en blau amb pulsació suau, desactivada quan el dispositiu demana moviment reduït.
