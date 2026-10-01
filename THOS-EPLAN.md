# THOS-EPLAN v0.1

Editor local de plànols en català. Dibuix de parets amb gruix i mesures, portes i finestres vinculades a les parets, desplaçament d'elements, sentit d'obertura de portes, desfer/refés, quadrícula, zoom i centrat. Imatge de referència amb amplada real i opacitat. Importació/exportació JSON i exportació PNG de la vista actual.

No envia projectes ni imatges a cap servidor. Cal desar el fitxer JSON abans de tancar. La imatge queda inclosa en el fitxer de projecte.

Limitacions: parets independents sense unions constructives ni edició dels extrems; sense habitacions ni cotes editables; escala de la imatge definida per amplada total; sense instal·lació elèctrica ni simulació en aquesta primera fase.

## v0.2: circuits i elements elèctrics
Barra superior amb circuits numerats de llums, endolls normals i endolls de potència. Permet afegir diversos circuits del mateix tipus. Punt de llum, interruptor, commutador i endolls s’assignen al circuit actiu; número i color apareixen al plànol. Les caixes d’empalmes són independents. Els elements es poden seleccionar, moure i eliminar. Tot queda inclòs al JSON local; els projectes v0.1 continuen obrint-se.

La pertinença a un circuit no dibuixa connexions ni simula el cablejat. Els símbols són representacions educatives d’aquesta primera versió.

Verificat amb Edge: assignacions, múltiples circuits, caixes independents, moviment, desfer/refés, JSON, projectes antics, referències invàlides, mides petites i regressió de portes/finestres i mesures.

## Simbologia de referència
Interruptors, commutadors, preses 2P+T i caixes de registre redibuixats segons la columna unifilar de la captura aportada per l’usuari. Botons i plànol comparteixen la mateixa geometria. La P és una etiqueta del circuit de potència, no una indicació del nombre de pols. El punt de llum conserva el cercle amb creu; no s’ha verificat conformitat amb una norma IEC/UNE específica.

## v0.3: classificació ITC-BT-25
Projectes nous amb C1–C5: 10 A/1,5 mm²; 16 A/2,5 mm²; 25 A/6 mm²; 20 A/4 mm²; 16 A/2,5 mm². Catàleg d’addicionals C6–C11, C12 de tipus C3/C4/C5 i C13 per recàrrega amb dimensionament segons ITC-BT-52. Les repeticions conserven el codi reglamentari i un sufix d’instància; afegir un tipus bàsic existent crea el seu tipus addicional corresponent.

C4 utilitza bases de 16 A amb protecció individual. S’explica l’alternativa de desdoblament, però no s’implementa un assistent de desdoblament. Els valors són referències de la taula 1, no càlculs de dimensionament. Informació de diferencials per cada cinc circuits generals i exclusius de C13, IGA independent d’ICP i sobretensions segons ITC-BT-23. No dibuixa proteccions ni certifica compliment.

Migració de circuits antics per ús, conservant els identificadors i les assignacions dels elements. Comprovat amb Edge: valors, addicionals repetits, variants C12, C13, receptors, JSON, referències invàlides, desfer/refés i projectes antics. Font: https://www.boe.es/buscar/act.php?id=BOE-A-2002-18099#ib-25

## Eines de vista i filtre
Zoom +/−, centrat i PAN traslladats a la barra superior. PAN arrossega la vista sense modificar el projecte. Nou creuament (commutador doble) per a circuits d’il·luminació. Símbols elèctrics aproximadament un 30% més petits; dimensions constructives intactes.

Vista de tots els circuits o només de l’actiu. El filtre afecta el dibuix, la selecció i l’exportació PNG, però no elimina dades del JSON. Caixes d’empalmes i arquitectura sempre visibles. En canviar de circuit o de filtre es neteja la selecció. Verificat amb Edge: eines superiors, creuament, filtre de dibuix i selecció, PAN, zoom, mida, circuits, projectes antics i portes.
