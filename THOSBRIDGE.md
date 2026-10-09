# THOSBRIDGE

Especificació de la versió web educativa per a THOSAPPS. Revisió v6: 9 d’octubre de 2026.

## Origen i reconeixement del creador

**THOSBRIDGE està inspirat en Bridge Building Game, creat per Alex Austin (Cryptic Sea).**

Referència del joc original: [Bridge Building Game — Cryptic Sea](https://crypticsea.com/bridgebuilding/).

La carpeta aportada conté `bridge.exe`, identificat internament com a **Bridge Building Game 1.25**, amb la cadena `Bridge Building Game (c) 2006 Alex Austin`, la biblioteca SDL i dos paquets de 15 nivells. Aquesta autoria es reconeix al peu visible de l’app, a l’ajuda i en aquest document.

THOSBRIDGE és una adaptació educativa independent. La interfície, l’editor i el motor del navegador s’han escrit de nou. No s’ha recuperat el codi font original ni s’ha convertit l’executable a WebAssembly. No es presenta com un producte oficial de Cryptic Sea ni com una reproducció exacta del seu motor.

Els fitxers dels nivells aportats s’han llegit i convertit a dades web, mantenint-ne la procedència. Els executables, la DLL i les textures originals no formen part dels fitxers publicats. No s’ha trobat un fitxer de llicència dins la carpeta aportada; aquest document no atribueix una nova llicència al material original.

## Objectiu didàctic

Construir una estructura amb un pressupost limitat i comprovar si un tren pot travessar-la. L’alumnat ha de poder observar la diferència entre tauler i reforç, l’efecte de la triangulació, els esforços de tracció i compressió, la deformació i la ruptura dels trams.

Interfície en català, execució al navegador i projectes desats localment. La primera versió prioritza un camí senzill: triar nivell, construir el pont, prémer **▶ Tren**, observar i millorar.

## Nivells recuperats

- **Old**: `level/01-Old/Level01.lvl` a `Level15.lvl`.
- **New**: `level/02-New/01-Level.bgl` a `15-Level.bgl`.
- Els 30 nivells es poden seleccionar directament. Superar-los els marca amb un indicador i permet passar al següent.
- Cada nivell conserva el seu pressupost, l’obertura, el perfil del terreny, la cota de l’aigua i els ancoratges presents al fitxer.
- Es conserva una franja del relleu que cobreix tota l’obertura i 12 unitats addicionals de graella a cada costat. Els extrems del perfil es prolonguen per dibuixar el terreny fora d’aquesta franja.
- Les coordenades es normalitzen amb una graella de 4 unitats originals: centre de l’obertura a x = 0 i cota nominal del tauler a y = 0. La unitat de graella **no s’etiqueta com a metre**.
- Cada registre conserva ruta d’origen, mida i SHA-256 del fitxer aportat, així com la informació de normalització.

| Nivell | Pressupost Old | Ancoratges Old | Pressupost New | Ancoratges New |
| --- | ---: | ---: | ---: | ---: |
| 1 | 2.000 | 4 | 1.000 | 2 |
| 2 | 3.000 | 6 | 4.000 | 2 |
| 3 | 7.000 | 10 | 8.000 | 4 |
| 4 | 6.000 | 6 | 2.000 | 1 |
| 5 | 4.500 | 4 | 8.000 | 4 |
| 6 | 8.000 | 6 | 3.000 | 2 |
| 7 | 25.000 | 8 | 4.000 | 2 |
| 8 | 50.000 | 14 | 1.500 | 1 |
| 9 | 10.000 | 6 | 40.000 | 12 |
| 10 | 2.000 | 3 | 4.000 | 1 |
| 11 | 100.000 | 11 | 20.000 | 6 |
| 12 | 16.000 | 9 | 12.000 | 6 |
| 13 | 8.000 | 2 | 50.000 | 6 |
| 14 | 12.000 | 6 | 8.000 | 2 |
| 15 | 7.000 | 1 | 40.000 | 5 |

### Lectura dels formats

Els enters i els nombres de coma flotant es llegeixen en little-endian. El conversor comprova mides i estructura abans d’escriure les dades.

**LVL:** cota de l’aigua a l’offset 0, cota del tauler a 4, pressupost a 8, extrems de l’obertura a 12 i 16, 1.024 mostres de relleu a partir de 20 i recompte d’ancoratges a 4.116. Cada registre d’ancoratge ocupa 92 bytes; se’n recuperen les coordenades inicials. La resta del registre no es tracta com a propietats del motor web.

**BGL:** capçalera de 44 bytes, identificador enter 1.111.970.370 i versió 4; cota del tauler a 8, cota de l’aigua a 12, extrems a 16 i 20, pressupost a 24, valor de pes a 28, tres camps enters a 32, 36 i 40. Hi ha 512 mostres de relleu, recompte d’ancoratges a 2.092, un camp intermedi de 4 bytes i registres de coordenades de 12 bytes.

La capçalera BGL completa i els tres camps enters finals es conserven com a metadades. **No s’ha confirmat el significat de tots els camps ni de les possibles regles especials dels nivells.** No s’han inventat interpretacions per completar aquests camps. Les dades de càrrega s’utilitzen amb una escala pròpia del motor web, descrita a continuació.

## Editor

1. **Barra:** element de reforç estructural.
2. **Tauler:** element que també forma part del camí del tren.
3. **Seleccionar:** veure longitud i tipus d’un tram, canviar-lo entre barra i tauler o esborrar-lo.
4. **Esborrar:** eliminar trams i els nodes lliures que quedin sense connexions. Els ancoratges del nivell es conserven.

Els trams es creen clicant dos punts o arrossegant entre ells. Els punts nous s’ajusten a la graella; els ancoratges existents tenen prioritat en l’ajust. Cada tram costa **100 unitats de pressupost**, independentment de la longitud, i la longitud màxima web és de **4,5 unitats de graella**.

Amb l’eina **Tauler** es pot dibuixar directament d’una riba a l’altra. El traç es divideix en trams vàlids, reutilitza els nodes existents que hi coincideixen i mostra el nombre de trams i el cost abans de crear-los. A Old · Nivell 1, el traç de 8 unitats es divideix en dos trams de 4 unitats i costa 200. Repassar una cadena de barres amb Tauler les converteix en trams transitables sense duplicar-les ni tornar a cobrar-les. Si falta pressupost, tota l’operació es descarta.

Un tram no es crea si supera el pressupost, té longitud nul·la o duplica una unió del mateix tipus. Les barres individuals massa llargues es rebutgen; l’eina Tauler les subdivideix. Els ancoratges no es poden moure ni afegir arbitràriament. Aquesta versió no inclou l’arrossegament de nodes ja construïts; es poden esborrar i reconstruir els trams afectats.

Desfer i refer conserven fins a 80 estats per al nivell actual. Canviar de nivell manté el seu pont desat, però reinicia l’historial de desfer. Buidar el pont és reversible amb Desfer.

El tauler automàtic construeix trams horitzontals de fins a dues unitats a la cota nominal. Omet trams on el terreny arriba a aquesta cota. L’operació és atòmica: si falta pressupost, no deixa un tauler parcial. Als nivells amb desnivells cal ajustar o completar manualment el camí.

Al primer nivell de cadascun dels dos paquets hi ha un exemple triangular de cinc trams, carregable amb un sol botó i preparat per provar. És una ajuda inicial; no s’afegeixen solucions automàtiques per als altres nivells.

## Simulació pròpia

### Prova prèvia d’esforços

El botó **◈ Test d’esforços** mostra un mapa sobre el disseny quiet, sense animació ni esperes pel pas d’un tren. El càlcul es fa en una còpia aïllada: aplica el pes propi i una càrrega vertical repartida pel tauler, proporcional a la longitud de cada tram i repartida entre els seus extrems. També es pot provar una estructura que encara no tingui un camí continu.

Totes les barres i el centre dels trams de tauler es pinten amb una escala **groc → taronja → vermell**, segons el valor absolut del màxim esforç relatiu: groc a 0%, taronja a 50% i vermell a 100% o més. La tracció i la compressió comparteixen aquesta escala de càrrega; el seu signe es descriu a la targeta de prova. Es destaquen els tres trams més carregats amb identificador i percentatge del límit. Les vores turqueses del tauler es conserven.

Internament es reutilitza el motor numèric sobre la còpia, fins a 6 segons de temps de càlcul simulat, executats seguits sense animació: 0,8 segons de pes propi i 3 segons d’augment gradual de càrrega, seguits d’estabilització. No és un nou resolutor estàtic. Si supera el límit d’un tram o un node lliure baixa més de 0,7 unitats, el càlcul s’atura amb avís abans d’arribar necessàriament a tota la càrrega. Per presentar el mapa, es restitueixen les coordenades originals i es retenen els màxims d’esforç; no es dibuixen trams trencats ni una caiguda.

Completar el test no marca el nivell com a superat. Des del resultat es pot prémer **Fer passar el tren**, que inicia una prova nova sobre el disseny original, o **Millorar el pont**. La càrrega repartida és una aproximació didàctica pròpia: no equival al test del programa original i no garanteix resistir una càrrega mòbil. Una estructura formada només per barres es prova sota el seu pes propi, perquè no té tauler on repartir la càrrega.

### Targetes i controls

Els selectors de paquet i nivell i les accions de construcció se situen a la barra superior. El panell lateral desapareix i la graella ocupa tota l’amplada. El cost i el pressupost, els paràmetres i resultats de la prova i la llegenda es mostren en targetes sobre la graella, visibles durant el pas del tren.

Es poden arrossegar per la capçalera, moure amb les fletxes quan aquesta té el focus i plegar o ampliar independentment. La selecció d’un tram i el resultat també són targetes mòbils. **▣** amaga o mostra les targetes informatives; **⤢** restableix les posicions. Les posicions i l’estat plegat es desen amb la clau `thosbridge:cards:v1`, separats del projecte. Canviar-los no modifica el pont, el JSON ni l’historial. En redimensionar la pantalla, les targetes es mantenen dins de la graella.

### Prova amb tren

El motor web modela nodes amb massa i barres elàstiques articulades. Primer deixa actuar el pes propi durant 0,8 segons i després fa avançar una càrrega distribuïda en quatre punts, representada visualment com un tren.

| Paràmetre web | Valor inicial |
| --- | ---: |
| Pas de càlcul | 1/240 s |
| Rigidesa axial | 1.800 |
| Gravetat relativa | 10 |
| Resistència de referència | 260 |
| Massa base de node lliure | 0,35 |
| Massa afegida a cada extrem lliure | 0,08 × longitud del tram |
| Amortiment axial | 5 |
| Amortiment de velocitat | factor exp(−1,5 × dt) |
| Límit de descens del tauler per a la prova | 0,7 unitats sota el disseny |

La força axial depèn de l’allargament del tram i de la velocitat relativa dels seus extrems. El límit de resistència es redueix amb la longitud segons `260 / (1 + longitud² / 30)`. Un tram es trenca si el valor absolut de l’esforç relatiu supera 1.

Per als BGL, el valor recuperat a l’offset 28 s’escala com `pes / 5.000`, limitat entre 4 i 24 unitats de massa. Per als LVL, sense aquest camp, s’utilitza una referència de 40.000 i per tant una massa web base de 8. El selector de pes aplica factors del 50%, 100%, 150% o 200%. Aquest escalat és una decisió de THOSBRIDGE, **no una equivalència demostrada amb el tren original**.

Els nodes lliures construïts sobre el terreny poden recolzar-hi quan hi contacten. L’aigua es representa com a context del nivell i no aplica flotabilitat ni forces hidrodinàmiques. Les barres treballen axialment: no es modelen flexió de bigues, moments als nusos, vinclament específic ni propietats de materials reals.

### Recorregut i resultat

- El tren necessita un camí continu format per trams de **tauler** entre les ribes. Les barres de reforç no compten com a camí.
- El recorregut avança en x i admet taulers inclinats amb pendent absoluta màxima 1. El terreny que arriba a la cota nominal pot connectar els accessos i els trams separats per sòl sòlid.
- L’aproximació sobre terreny es representa a la cota nominal, sense calcular la circulació del tren sobre totes les irregularitats del relleu. Per aquest motiu cal revisar especialment els nivells amb desnivells i regles especials.
- La càrrega es reparteix entre els extrems del tram sota cada punt de càrrega.
- La prova falla si falta el camí, es trenca un tram sota el tren, el tauler baixa més de 0,7 unitats respecte del disseny o el càlcul esdevé inestable.
- La prova passa quan la part posterior del tren supera l’arribada. Pot haver-hi trams trencats que ja no impedeixin el pas; el resultat informa dels trencaments.
- Una prova al 50% de pes no marca el nivell com a superat. Cal superar-la com a mínim al 100%.
- Pausa atura l’avanç del càlcul. **Editar** recupera les coordenades originals del pont; la deformació i la ruptura de la prova no modifiquen el projecte.

Si el pont perd el suport del tren, entra en una fase de **col·lapse**. El càlcul de les barres, la gravetat i el contacte amb el terreny continuen durant 8 segons de simulació perquè es pugui observar la caiguda. Els vehicles sense suport cauen i els que encara recolzen al tauler continuen carregant l’estructura. **El missatge i el botó Millorar el pont apareixen immediatament en detectar la fallada**, mentre la caiguda continua. Es pot pausar el col·lapse o tornar a editar sense esperar que acabi. Una manca de camí inicial continua donant un avís immediat, sense simular un col·lapse.

El tauler es dibuixa amb **dues vores turqueses** que identifiquen el camí del tren i conserven el color durant la prova. Durant el pas del tren, els colors vermells indiquen compressió i els blaus tracció; al tauler es mostren al centre, entre les dues vores. El mapa previ utilitza l’escala groc-taronja-vermell descrita abans. La intensitat expressa la proximitat al límit relatiu del tram, no tensions en MPa ni una verificació de resistència d’un pont real.

Quan no hi ha camí continu, el resultat indica **Falta completar el tauler**. Quan el camí existeix però no aguanta la prova, indica **El pont necessita reforços**. Construir un tauler continu permet iniciar la prova; superar-la també requereix resistència estructural.

## Desament i privacitat del projecte

Els ponts es desen per nivell a `localStorage`, amb clau `thosbridge:projects:v1`. El navegador conserva el nivell seleccionat i els nivells superats. Si l’emmagatzematge falla, l’app informa que cal descarregar el pont.

El format JSON exportat inclou `app: "THOSBRIDGE"`, `version: 1`, `levelId` i `bridge`. La importació valida coordenades finites, identificadors, extrems de trams, tipus, longitud, pressupost i integritat dels ancoratges. No permet afegir punts fixos nous. Hi ha límits de 700 nodes, 1.500 trams i 2 MB per fitxer importat.

Els projectes de l’alumnat no s’envien a un servidor ni es publiquen al repositori. Es comparteixen només si l’usuari descarrega i distribueix el seu JSON.

## Integració a THOSAPPS

Ruta pública prevista: `thosbridge.html`. La targeta THOSBRIDGE existent s’activa per obrir aquesta ruta, mantenint el seu SVG. No es crea una segona targeta.

Fitxers de l’aplicació:

```text
thosbridge.html
thosbridge/app.css
thosbridge/app.js
thosbridge/core.js
thosbridge/cards.js
thosbridge/cards.js
thosbridge/levels.js
thosbridge/tests/core.test.js
thosbridge/tools/convert-levels.cjs
thosbridge/tools/serve.cjs
thosbridge/package.json
THOSBRIDGE.md
```

La publicació inicial inclou també l’enllaç de la targeta a `index.html` i la ruta al `sitemap.xml`. Les revisions posteriors només modifiquen fitxers de THOSBRIDGE. No incorpora biblioteques externes ni depèn d’un backend. Les importacions web utilitzen el marcador de versió `20261009-heat-map-v6`.

### Ordres tècniques

Des de l’arrel de la carpeta de l’app o del repositori:

```sh
node --test thosbridge/tests/core.test.js
node thosbridge/tools/serve.cjs
node thosbridge/tools/convert-levels.cjs "ruta/a/Bridge Building Game"
```

La prova que contrasta els fitxers originals requereix tenir-los accessibles. Al repositori, es pot indicar la carpeta original amb la variable d’entorn `BBG_SOURCE`; sense aquesta carpeta, aquesta prova específica queda omesa. La resta de proves funciona amb les dades web.

## Validació i límits d’aquesta primera versió

**Comprovacions tècniques realitzades:** 28 proves automàtiques aprovades a la carpeta original. Inclouen els hashes i la conversió dels 30 nivells, coordenades i pressupostos, recorreguts connectats i desconnectats, pressupost i longitud màxima, eliminació, importació JSON, càrregues diferents i estabilitat numèrica. La revisió v2 afegeix regressions per al traç directe entre les ribes d’Old · Nivell 1, el dibuix en els dos sentits, la reutilització de nodes, la conversió de barres a tauler, el pressupost atòmic i els trams inclinats. Els exemples dels dos primers nivells passen amb el tren estàndard; un tauler sense reforços falla a la mateixa prova.

Aquestes comprovacions **no demostren que tots els nivells tinguin una solució viable amb les regles del motor web** ni que el resultat coincideixi amb Bridge Building Game. La conversió preserva dades geomètriques i pressupostos; les regles especials i la fidelitat de la jugabilitat encara s’han de contrastar.

**Comprovacions visuals i d’interacció web: a càrrec de l’usuari**, segons la seva indicació. No s’han executat proves al navegador en aquesta fase.

Aspectes per a la seva revisió:

1. Crear i esborrar trams, desfer/refer i distingir barra de tauler.
2. Carregar l’exemple del primer nivell, provar, pausar i tornar a editar.
3. Comprovar colors, deformació i missatges de fallada.
4. Desar i reobrir un JSON; recarregar i recuperar els ponts de diversos nivells.
5. Recórrer els 30 escenaris, especialment els nivells amb desnivells, un sol ancoratge i obstacles alts.
6. Contrastar amb l’executable original la geometria visible i identificar les regles especials que calgui reproduir en una iteració posterior.
7. Moure i plegar les targetes, comprovar la barra superior i fer **Test d’esforços → Tren**. Contrastar els identificadors dels trams amb la targeta de prova.

Les millores posteriors s’han de decidir a partir d’aquesta revisió. No s’incorporen en aquesta primera versió un editor de nivells, materials addicionals, còpia/simetria d’estructures ni un motor professional de càlcul estructural.
