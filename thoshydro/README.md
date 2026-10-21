# THOSHYDRO

**Simulador didàctic de centrals hidroelèctriques i turbines Pelton, Francis i Kaplan.** Aplicació de THOS APPS, projecte de **J.Yerga (Institut Thos i Codina)**. Interfície en català.

- **Aplicació:** https://tecno-apps.cat/thoshydro/
- **Entrada:** `thoshydro/index.html`
- **Versió de referència de la interfície:** v44, amb el tema visual «Blau pissarra suau».

## Objectiu didàctic

Explorar els fonaments físics de l'aprofitament hidroelèctric, observar el funcionament de diferents turbines, interpretar els balanços de potència i comparar els seus camps d'aplicació. Els models són **simplificacions per a l'aprenentatge**, no simulacions d'enginyeria ni corbes certificades de fabricants.

## Les tres seccions

### 1. Fonaments físics

Dues activitats interactives independents de la vista 3D:

- **Pressió hidrostàtica:** columna d'aigua representada gràficament; controls d'altura (0–150 m) i densitat (800–1.200 kg/m³); càlcul de pressió manomètrica en MPa i bars amb `p = ρ · g · h`. Inclou un botó «Recupera els valors inicials», que restaura els valors didàctics predefinits `h = 129 m` i `ρ = 1.000 kg/m³`. L'altura representa la **columna d'aigua sobre el punt de mesura**, no la capacitat ni necessàriament la profunditat real d'un embassament.
- **Cadena de conversió energètica:** targetes amb símbols per a energia potencial, cinètica, mecànica i elèctrica. Controls de salt (10–200 m), cabal (1–50 m³/s), rendiment de turbina (50–100 %) i rendiment d'alternador (70–100 %). Mostra potència hidràulica, mecànica i elèctrica, rendiment global i pèrdues.

L'activitat de conversió suposa **absència de pèrdues a les canonades** i utilitza `g = 9,807 m/s²`. La representació de les etapes és conceptual; no resol la distribució real de velocitats i pressions.

### 2. Simulació 3D

- **Pelton (acció):** raig tangencial, injector regulable i cassoletes dobles.
- **Francis (reacció):** cambra espiral, vàlvula d'entrada, distribuïdor regulable i flux radial cap a axial.
- **Kaplan (reacció):** flux axial, distribuïdor regulable i angle de pales modificable.

Controls principals: tipus de turbina, salt, cabal i rendiment de la turbina. Les opcions de visualització són **Completa**, **Transparent** i **Especejament**, amb control orbital de la càmera i botó **Centra la vista**. Els botons **Pausa** i **Reinicia** controlen l'animació i restauren l'exemple seleccionat.

Resultats de la simulació:

- Potència hidràulica, potència a l'eix i potència elèctrica.
- Indicadors de velocitat del raig, revolucions i parell per a Pelton; cabal efectiu, revolucions estimades i parell estimat per a Francis i Kaplan.
- Gràfiques de telemetria dels **últims 30 segons**: potència elèctrica, velocitat del rodet i parell.
- Visualització didàctica de la tensió alterna de l'alternador acoblat.
- **Panell lateral «De la turbina a l'electricitat»**, connectat als resultats del simulador: tres etapes amb les seves potències, rendiment de turbina, rendiment d'alternador fix del 90 %, rendiment global i explicació desplegable de les pèrdues i el transport d'electricitat.

### 3. Corbes característiques

Comparador didàctic de **Pelton, Francis i Kaplan**, amb controls de salt i cabal i tres pestanyes:

1. **Rendiment:** corbes d'eficiència estimades, amb un model simplificat dependent de les condicions de funcionament.
2. **Potència:** corbes estimades de potència en funció del cabal relatiu.
3. **Selecció de turbina:** matriu orientativa inspirada en el material de classe, amb eix de cabal de **0 a 1.000 m³/s** i eix de salt de **0 a 1.500 m**. Les zones Pelton, Francis i Kaplan es diferencien cromàticament. Les àrees sense assignació directa es mostren com a **«FORA DE LES ZONES»** i indiquen que cal estudiar alternatives o configuracions específiques.

La matriu és una **aproximació esquemàtica** al document de classe; les fronteres no són una digitalització exacta ni límits universals. Les corbes de rendiment i potència tampoc no són dades de fabricants.

La guia lateral adapta les explicacions, les fórmules i les preguntes d'observació a la pestanya activa. El resultat de la selecció es mostra en un panell destacat.

## Càlculs i hipòtesis

Per a la simulació 3D:

- **Potència hidràulica:** `P_h = ρ · g · Q · H`, amb `ρ = 1.000 kg/m³`, `g = 9,81 m/s²`, `Q` en m³/s i `H` en m.
- **Potència a l'eix:** `P_eix = P_h · η_t`.
- **Potència elèctrica:** `P_el = P_eix · 0,90`, amb rendiment de l'alternador fix del **90 %**.
- **Rendiment global:** `η_global = η_t · 0,90`.

Els controls d'obertura afecten el **cabal efectiu**. El rendiment de la turbina és un control independent. L'angle de les pales Kaplan canvia la geometria, però **no recalcula automàticament el rendiment**.

La velocitat visual està alentida per facilitar l'observació i no equival directament a una xarxa de 50 Hz. El model no simula CFD, cavitació, regulació industrial, inèrcia de la instal·lació ni pèrdues de càrrega reals. L'ona de tensió és **normalitzada**, sense escala real en volts. Amb cabal nul, el model representa l'aturada i tensió induïda nul·la.

Els rangs, les geometries, les potències i les característiques són **orientatius i educatius**.

## Disseny i accessibilitat

El tema visual **Blau pissarra suau** redueix l'ús de blanc pur mitjançant superfícies gris blavoses, targetes diferenciades i accents turquesa. Les tres seccions comparteixen la navegació principal. Els missatges d'interpretació i els avisos fora de zona disposen de panells destacats.

## Estructura tècnica

- `index.html`: estructura de les tres seccions, controls i panells.
- `styles.css`: disposició, adaptació a pantalles petites i tema visual.
- `app.js`: simulació 3D, interacció, càmera, modes de visualització i actualització dels indicadors.
- `model.mjs`: exemples de turbines, potències i aproximació física Pelton.
- `fundamentals.js`: activitats independents de pressió i conversió energètica.
- `characteristics.mjs`: corbes didàctiques i matriu de selecció.
- `charts.mjs`: gràfiques de telemetria.

La visualització 3D fa servir **Three.js 0.169.0** i **OrbitControls**, de mrdoob i col·laboradors, sota llicència **MIT**. Es carreguen des de jsDelivr i necessiten connexió a Internet. Codi i llicència: https://github.com/mrdoob/three.js/tree/r169 i https://github.com/mrdoob/three.js/blob/r169/LICENSE. La biblioteca externa conserva la seva pròpia llicència; el codi del projecte queda subjecte a les condicions generals del repositori THOSAPPS.

## Execució

1. Obre https://tecno-apps.cat/thoshydro/ o serveix el directori amb un **servidor HTTP estàtic**.
2. No obris `index.html` directament amb `file://`: l'aplicació utilitza mòduls JavaScript.
3. Per a la simulació 3D, cal un navegador compatible amb **WebGL** i connexió per carregar Three.js.
4. No cal procés de compilació.

No hi ha autenticació pròpia, recollida de dades d'usuari ni persistència de les simulacions.

## Procedència

THOSHYDRO és una implementació didàctica desenvolupada dins de THOSAPPS a partir de la petició de simulació de turbines Pelton, Francis i Kaplan i de les ampliacions posteriors. No es presenta com una recuperació exacta de cap prototip anterior.

## Estat de la documentació

Aquest README descriu el codi de la branca `main` corresponent a la interfície de referència **v44**. La comprovació visual i funcional de la publicació web s'ha de fer al navegador; aquesta actualització de documentació **no implica una validació automàtica del desplegament**.
