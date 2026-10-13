# THOSFLUID — Especificació funcional i tècnica

**Projecte:** aplicació independent de la suite Tecno-Apps  
**Repositori de destinació:** [dep-tecno/THOSAPPS](https://github.com/dep-tecno/THOSAPPS)  
**Web de destinació:** [tecno-apps.cat](https://tecno-apps.cat/)  
**Idioma:** català a tota la interfície i la documentació funcional  
**Públic:** ESO, batxillerat i formació professional  
**Estat:** el simulador publicat incorpora la biblioteca per famílies, els recorreguts de conductes, la unió en T, eines d'edició, la simulació pneumàtica i una primera família electroneumàtica. La barra segueix el patró d'icones de THOSLAB i permet descarregar una imatge PNG. El mode pas a pas s'ha incorporat al codi; resta la comprovació interactiva i docent abans de considerar-lo acceptat.

**Font única del projecte:** el repositori `dep-tecno/THOSAPPS` a GitHub. L'especificació `THOSFLUID.md`, el codi, els símbols propis, els circuits d'exemple i les versions lliurades han de quedar versionats en aquest repositori.

## 1. Propòsit i decisió de producte

THOSFLUID és un simulador educatiu web de **pneumàtica i electropneumàtica**. L'alumne col·loca components en un llenç, connecta conductes i cables, prem **Simula** i observa què passa: quines línies tenen pressió, quines descarreguen, quines vàlvules canvien de posició, quins cilindres es mouen i quan s'activen els finals de cursa.

El motor resol **estats lògics i funcionals**, sense calcular magnituds físiques. L'objectiu és muntar un circuit dels apunts, comprovar-ne el funcionament i entendre la cadena de causes. THOSFLUID és una aplicació autònoma dins de Tecno-Apps, amb la mateixa manera d'accedir-hi i navegar-hi que la resta de la suite.

### Objectius

- Construir i modificar esquemes amb símbols funcionals, ports i connexions.
- Simular accionaments manuals, mecànics, pneumàtics i elèctrics, incloses seqüències automàtiques senzilles.
- Fer visible l'estat de cada connexió i component, amb explicacions breus dels canvis i dels errors.
- Permetre que cada alumne descarregui el seu circuit en un JSON versionat i l'obri de nou des del dispositiu per continuar treballant. Desar automàticament una única còpia local de recuperació de l'últim circuit després de cada canvi.
- Separar el motor de la interfície i preparar-lo per a nous dominis de fluids en el futur.

### Fora de l'abast

No s'hi calculen bar, cabals reals, forces, diàmetres, velocitats físiques, pèrdues de càrrega, consum, termodinàmica ni dinàmica de fluids (CFD). La regulació de cabal només modifica la **categoria visual** de moviment: tancat, poc, mitjà o obert. Tampoc s'implementen inicialment hidràulica, motors pneumàtics, buit, compressió, avaries físiques, PLC avançats, circuits industrials complexos ni una plataforma de teoria o avaluació.

## 2. Integració concreta amb Tecno-Apps

### Referència visual: THOSLAB

THOSFLUID ha de seguir el disseny de treball de **THOSLAB v2.0**: capçalera pròpia de la suite, barra d'eines compacta amb accions agrupades, fons fosc, llenç central amb quadrícula discreta, components dibuixats sobre l'esquema i controls clars de zoom, fitxer i simulació. La biblioteca ocupa el costat esquerre i agrupa els components en famílies plegables: alimentació i preparació de l'aire, distribuïdors, actuadors, accionaments i sensors, regulació i pas, lògica i temporització, i electroneumàtica. Les famílies apareixen quan hi ha almenys un component disponible. **No hi ha un inspector fix a la dreta:** en seleccionar un component apareix una finestra petita de propietats sobre el llenç, que es pot moure i tancar; les opcions generals del circuit s'obren amb el botó «Circuit». Mantenir la jerarquia visual, la mida dels controls i el llenguatge de la resta de Tecno-Apps. La semblança és d'interfície; el motor de THOSFLUID continua sent lògic i no adopta els càlculs elèctrics de THOSLAB.

La portada ha d'incloure una **targeta activa THOSFLUID** amb el mateix format 16:9, etiqueta de categoria, títol, descripció i botó «Obrir aplicació» que les altres targetes. La imatge pròpia `thosfluid.svg` ha de mostrar visualment una font, una vàlvula, conductes i un cilindre sobre un fons fosc, d'acord amb les imatges de la suite. La targeta obre `thosfluid.html` i aquesta ruta ha d'oferir una app funcional.

### MVP incorporat al repositori

La versió publicada inclou `thosfluid.html`, `thosfluid-app.html`, `thosfluid/app.css`, `thosfluid/refinements.css`, `thosfluid/app.js` i `thosfluid.svg`. L'editor ofereix famílies de components, recorreguts manuals, unió en T, anotacions, copiar/enganxar, simulació pneumàtica qualitativa, una primera xarxa electroneumàtica, exportació PNG i un mode pas a pas per moure cilindres i avançar retards amb passos lògics. Els circuits de l'alumnat continuen guardant-se al dispositiu. La comprovació visual i didàctica del mode pas a pas continua pendent.

**Límits actuals:** cada port admet una connexió; per repartir una xarxa cal inserir una unió en T amb tres ports. Els creuaments visuals dels recorreguts no creen connexió. No hi ha rotació. El mode pas a pas representa el moviment del cilindre i els retards amb passos lògics; les fuites, senyals i cabals continuen sent qualitatius. L'electrovàlvula inclosa és monoestable; encara cal ampliar i revisar els circuits de referència, incloses les variants elèctriques, amb criteri docent.

El repositori actual publica pàgines HTML a l'arrel. `index.html` conté la navegació i les targetes de les eines; `thosdruino.html` és la pàgina d'entrada que carrega `thosdruino/index.html` en un `iframe`; `thosvincle.html` és una pàgina d'entrada que integra `thosvincle-app.html` en un `iframe`. `sitemap.xml` enumera URL públiques. **Abans de programar, Codex ha de tornar a inspeccionar el repositori**, perquè la seva estructura pot haver canviat.

La ruta pública publicada és **[tecno-apps.cat/thosfluid.html](https://tecno-apps.cat/thosfluid.html)**. `thosfluid.html` és la pàgina d'entrada amb la capçalera i la navegació compartides. L'editor viu a `thosfluid-app.html`, amb CSS i JavaScript propis i camins relatius compatibles amb l'allotjament estàtic. Conservar aquesta ruta en futures ampliacions.

Integració publicada, que cal conservar en les versions següents:

1. Afegir una targeta **activa** de THOSFLUID a `index.html`, amb imatge o SVG propi, descripció en català i enllaç a `thosfluid.html`.
2. Afegir THOSFLUID als menús compartits de les pàgines que el repositori mantingui sincronitzades, amb l'estat actiu a la seva pàgina.
3. Afegir `https://tecno-apps.cat/thosfluid.html` a `sitemap.xml`, d'acord amb el domini públic vigent.
4. Respectar els estils, la identitat visual, l'autoria i la llicència del repositori. Crear símbols originals o comprovar-ne les llicències abans d'incorporar recursos externs.
5. Comprovar al navegador els enllaços, l'obertura directa de la ruta pública i la càrrega dels recursos després de cada publicació.

No afegir una targeta «Pròximament» com a substitut de l'app funcional. No reescriure altres simuladors per integrar THOSFLUID.

### Còpies i historial a GitHub

- Incorporar aquest document com a `THOSFLUID.md` al repositori, perquè Codex i qualsevol col·laborador parteixin de la mateixa especificació.
- Mantenir al repositori tots els fitxers necessaris per reproduir l'app i tots els circuits de referència. Cap còpia local ha de ser l'única versió d'una entrega acabada.
- Fer servir l'historial de commits de GitHub per conservar les versions. Per a canvis grans, treballar en una branca i obrir una sol·licitud de canvis; crear etiquetes de versió quan hi hagi una entrega estable.
- Tecno-Apps es publica des del mateix projecte de GitHub. Després de cada publicació, comprovar que la versió visible a `tecno-apps.cat` correspon al contingut versionat.
- Els circuits personals que l'alumnat creï amb l'editor són dades d'usuari, diferents de les còpies del projecte. Cada alumne se'n descarrega el fitxer JSON i el conserva al seu dispositiu per continuar més endavant. El navegador desa automàticament una sola còpia local de recuperació de l'últim circuit després de cada canvi. L'app no els desa en cap servidor ni els puja a GitHub. Només els circuits d'exemple preparats per a l'app formen part del projecte versionat.

## 3. Ús educatiu

| Nivell | Circuits i idees principals |
| --- | --- |
| ESO | Font, vàlvula 3/2, polsador i cilindre de simple efecte; pressió, escapament, avançament i retorn. |
| Batxillerat | Cilindres de doble efecte, distribuïdors 4/2 i 5/2, regulació qualitativa, lògica pneumàtica i automatismes senzills. |
| FP | Pilotatge, finals de cursa, temporitzadors, relés, sensors, electrovàlvules i seqüències. |

Els nivells orienten filtres i exemples, però no han de bloquejar components. Es poden oferir circuits d'exemple petits, amb opció de començar des d'un llenç buit. Les explicacions han de ser contextuals i breus.

## 4. Biblioteca de components

### Pneumàtica V1

| Família | Components i comportament necessari |
| --- | --- |
| Alimentació | Font d'aire (compressor simplificat), acumulador i unitat de manteniment. Aquests dos últims són elements de pas lògic, sense càlcul de pressió ni model físic. |
| Actuadors | Cilindre de simple efecte amb retorn per molla i de doble efecte, amb posicions extremes i moviment visible. |
| Distribució | Vàlvules 2/2 NC, 3/2 NC/NO seleccionable, 4/2 i 5/2; posició de repòs i connexions internes per posició. Vàlvula 5/3 amb centre tancat, a escapament o a pressió. |
| Accionaments | Manuals: polsador, palanca i pedal, amb retorn per molla o posició mantinguda. Final de cursa mecànic 3/2 amb tija directa, corró o lleva i cilindre supervisat configurable. Vàlvula 5/2 de doble pilotatge X/Y amb memòria de posició. |
| Regulació | Regulador de cabal qualitatiu bidireccional i regulador unidireccional amb antiretorn intern. La posició regulada limita la categoria de velocitat visual; el sentit contrari passa lliurement. Vàlvula d'escapament ràpid amb alimentació P–A i evacuació local A–R quan P queda sense pressió. |
| Pas i lògica | Vàlvula antiretorn configurable P→A o A→P; vàlvules AND i OR amb dues entrades X/Y i una sortida A. |
| Seqüència | Temporitzador pneumàtic 3/2 amb entrada de senyal X i retard curt/mitjà/llarg. Distribuïdor manual 5/3 amb centre tancat, a escapament o a pressió. |
| Connexions | Unió pneumàtica en T i unió elèctrica en T, totes dues explícites i de tres ports. Cada tram es dibuixa amb clics intermedis; un simple creuament de recorreguts no connecta xarxes. |

Els símbols s'han de dibuixar de manera coherent amb la simbologia pneumàtica convencional de la família ISO 1219: una casella per posició del distribuïdor, fletxes per als passos oberts, topalls per als ports tancats, accionament i molla als costats, i èmbol, tija i molla als cilindres que correspongui. La [làmina de referència facilitada](https://i0.wp.com/www.joucomatic.com.es/wp-content/uploads/2018/05/simbologia-neumatica2.jpg) orienta la forma dels símbols. Cal revisar cada variant de la biblioteca abans d'afirmar una conformitat formal amb la norma. El funcionament prové de la definició de ports i posicions, mai de la geometria del dibuix.

### Electricitat i electropneumàtica V1

La implementació cobreix font lògica, unió elèctrica en T, polsador NO/NC, interruptor, bobina i contactes de relé associats per nom, final de cursa elèctric, electrovàlvula 5/2 monoestable i biestable de dues bobines Y1/Y2. La biestable conserva l'última posició i la unió elèctrica permet repartir ordres. El senyal es resol com a continuïtat, sense calcular volts, corrents, resistències o potència. La xarxa elèctrica i la pneumàtica es dibuixen i s'avaluen separadament.

- Font i retorn de control elèctric, representats com a estat de continuïtat binari.
- Polsadors normalment oberts i normalment tancats, i interruptors mantinguts.
- Bobines i contactes de relé associats per referència.
- Sensors i finals de cursa elèctrics vinculats als actuadors.
- Solenoides i electrovàlvules monoestables o biestables, segons el model concret.
- Cables elèctrics visualment diferents dels conductes pneumàtics.

Queden pendents sensors addicionals, circuits de relé amb variants d'automanteniment i la revisió docent dels símbols elèctrics i dels exemples.

L'electrovàlvula té una part elèctrica que determina l'accionament i una part pneumàtica que comunica els ports de treball. Els dominis no s'han de barrejar en una mateixa connexió.

## 5. Editor i modes

### Mode **Edita**

- Llenç amb quadrícula discreta, desplaçament, zoom i ajust al contingut.
- Eina PAN explícita per arrossegar la vista des de qualsevol punt del llenç.
- Eina Text per inserir anotacions i editar-les al panell contextual.
- Copiar/enganxar un component amb les seves propietats; les connexions es tornen a dibuixar després d'enganxar.
- Biblioteca amb cerca i categories; arrossegar o inserir un component amb teclat.
- Seleccionar, moure, duplicar, girar quan el símbol ho admeti i esborrar.
- Crear connexions des d'un port fins a un altre amb punts de gir marcats amb clics al llenç; la línia provisional segueix el ratolí. La connexió conserva el recorregut en el JSON. Un port no pot barrejar conductes pneumàtics amb cables elèctrics.
- Desfés/refés per a totes les operacions d'edició.
- Panell de propietats: variant del component, configuració de repòs, sentit d'un regulador, referències de bobina/relé i nom opcional.
- **Desa** descarrega un fitxer JSON al dispositiu de l'alumne. **Obre** selecciona un fitxer JSON del dispositiu i el carrega directament al navegador; no l'envia a cap servidor. Si és viable amb la tecnologia escollida, permetre també exportar l'esquema com a SVG o PNG.
- **Còpia automàtica de recuperació:** l'app actualitza **una única còpia de l'últim circuit** a l'emmagatzematge local d'aquell navegador després de cada operació d'edició confirmada. La còpia nova substitueix l'anterior; no es crea un historial. En reobrir la pàgina després d'un tancament accidental, oferir **Recupera l'últim circuit** abans de substituir el circuit actual. Incloure **Esborra la còpia de recuperació**.
- Avisar abans de perdre canvis no desats.

**Flux per reprendre la feina:** l'alumne munta el circuit → prem **Desa** → conserva el JSON descarregat → en una altra sessió obre THOSFLUID → prem **Obre** i selecciona aquell JSON → continua editant-lo. En tornar a desar, es descarrega una nova còpia actualitzada. La còpia de recuperació és una ajuda per al tancament accidental en el mateix navegador i dispositiu; es pot perdre si s'esborren les dades del navegador i no substitueix el JSON descarregat. Aquest flux no depèn de comptes, servidors ni sincronització amb GitHub.

### Mode **Simula**

- Iniciar, aturar, reiniciar i avançar pas a pas.
- Prémer i deixar anar comandaments momentanis; commutar interruptors mantinguts.
- Ressaltar conductes amb pressió, conductes que descarreguen i cables energitzats; animar els cilindres.
- Mostrar la posició actual de cada vàlvula, el motiu de l'accionament i els finals de cursa actius.
- Mostrar un avís comprensible si el circuit no convergeix o té connexions incompatibles.
- Evitar edicions involuntàries mentre s'executa; el canvi de mode no ha d'alterar silenciosament el fitxer desat.

**Textos visibles inicials:** `Edita`, `Simula`, `Atura`, `Reinicia`, `Pas a pas`, `Desa`, `Obre`, `Exporta`, `Desfés`, `Refés`, `Còpia automàtica de recuperació`, `Recupera l'últim circuit`, `Esborra la còpia de recuperació`, `Sense pressió`, `Amb pressió`, `Escapament`, `Circuit incomplet`. Els identificadors interns del codi poden ser en anglès, però tota la interfície, els errors, la biblioteca, els exemples i l'ajuda han de ser en català. Centralitzar les cadenes per facilitar una traducció futura, sense afegir un selector d'idioma al MVP.

## 6. Model de dades i persistència

El **circuit desat** conté components, connexions, propietats i vista. L'**estat de simulació** és temporal: posicions, senyals, línies actives, pas actual i avisos. Reiniciar la simulació no modifica el circuit.

```json
{
  "format": "thosfluid-circuit",
  "version": 2,
  "metadata": { "name": "Exemple: cilindre simple i vàlvula 3/2" },
  "components": [
    {
      "id": "c1",
      "type": "source",
      "x": 100,
      "y": 270,
      "properties": {}
    },
    {
      "id": "c2",
      "type": "valve3",
      "x": 395,
      "y": 255,
      "properties": { "actuator": "pushbutton", "returnMode": "spring" }
    },
    {
      "id": "c3",
      "type": "single",
      "x": 800,
      "y": 260,
      "properties": {}
    }
  ],
  "connections": [
    {
      "id": "n1",
      "from": { "componentId": "c1", "portId": "P" },
      "to": { "componentId": "c2", "portId": "P" },
      "route": []
    },
    {
      "id": "n2",
      "from": { "componentId": "c2", "portId": "A" },
      "to": { "componentId": "c3", "portId": "A" },
      "route": []
    }
  ],
  "view": { "zoom": 1, "pan": { "x": 0, "y": 0 } }
}
```

El format actual és **v2**; el validador també accepta fitxers v1 i completa les propietats noves amb valors per defecte. Els tipus acceptats inclouen `source`, `note`, `tee`, `electricJunction`, `receiver`, `maintenance`, `checkValve`, `flowRegulator`, `flowRegulatorOneWay`, `quickExhaust`, `valve2`, `valve3`, `valve4`, `valve5`, `valve53`, `valve5Pilot`, `limitValve3`, `logicOr`, `logicAnd`, `timer3`, `single`, `double`, `electricSource`, `electricPush`, `electricPushNC`, `electricSwitch`, `electricLimit`, `relayCoil`, `relayContactNO`, `relayContactNC`, `valve5Electric` i `valve5ElectricBistable`. Els components nous guarden propietats qualitatives (`direction`, `opening`, `regulatedDirection`, `targetCylinder`, `targetEnd`, `delay`); els validadors completen per defecte les propietats absents en fitxers anteriors. `receiver` i `maintenance` comuniquen passivament `P–A`; `quickExhaust` alimenta `P–A` i comunica `A–R` per a l'escapament quan P no rep pressió. `electricJunction` comunica les tres branques només dins de la xarxa elèctrica. Els distribuïdors manuals admeten `actuator` i `returnMode`; `valve3` també desa `normallyOpen`; `valve53` desa el centre seleccionat (`closed`, `exhaust` o `pressure`). `valve5Pilot` rep ordres a X/Y i conserva l'última posició. `timer3` rep l'ordre a X; els retards curt/mitjà/llarg són només una espera visual. `from` i `to` identifiquen extrems, mentre que el motor aplica la direcció definida pels elements interns. El medi és implícitament pneumàtic. Els ports `R` i `S` són escapaments a l'ambient segons el component. El validador limita els fitxers a 80 components i 160 connexions; l'obertura rebutja fitxers de més d'1 MB.

Afegir medis explícits, rotació, recorreguts o nous contractes requereix una migració documentada i compatibilitat amb els circuits v1 descarregats. No canviar silenciosament els noms ni la forma dels camps mantenint el mateix número de versió.

### Contractes objectiu per a l'ampliació

- `ComponentDefinition`: identificador de tipus estable, versió, família, ports, propietats permeses, posicions de vàlvula, regla de transició i representació visual.
- `ComponentInstance`: identificador únic, tipus, posició, rotació i propietats validades.
- `PortDefinition`: identificador, medi (`pneumatic` o `electrical`), funció (`P`, `A`, `B`, `R`, `S`, pilotatge, bobina, contacte…), tipus d'unió i capacitat.
- `Connection`: identificador, medi, extrems i recorregut dibuixat. En una intersecció de línies **no** hi ha connexió si no s'ha creat un node/unió explícit.
- `RuntimeState`: posicions de vàlvules i cilindres, pressió/escapament per xarxa i port, electricitat activa, entrades manuals, temporitzadors, pas lògic i avisos.

Els valors de codi poden ser `none/present`, `none/exhaust`, `retracted/moving_forward/extended/moving_backward` i `deenergized/energized`. Són categories discretes. Les etiquetes que veu l'alumne han de ser en català i no han de suggerir mesures físiques.

El JSON necessita un `version` explícit, validador d'importació i migracions quan s'ampliï l'esquema. No serialitzar funcions, referències al DOM ni objectes circulars. El circuit obert viu en la memòria de la sessió del navegador; **Desa** genera una descàrrega local i **Obre** llegeix un fitxer local. La recuperació fa servir un únic registre `localStorage`, `thosfluid:last-circuit:v1`, que s'actualitza automàticament després de cada canvi; no desa l'estat temporal de la simulació. En obrir la pàgina, oferir la restauració, sense fer-la silenciosament. Cap circuit de l'alumnat no es desa en un servidor ni es transmet al repositori.

## 7. Arquitectura del motor

1. **Model:** circuit immutable i definicions de components.
2. **Registre:** catàleg de tipus i regles de cada component; evita un únic bloc de condicionals extens.
3. **Graf de connexions:** agrupa ports comunicats, separa medi pneumàtic i elèctric, i distingeix unions reals dels creuaments visuals.
4. **Avaluadors de domini:** regles pures per a electricitat i pneumàtica. Definir una interfície extensible per a futurs dominis; no implementar hidràulica ara.
5. **Planificador:** avança en passos discrets fins a un punt estable o fins a detectar oscil·lació/límit.
6. **Adaptador d'esdeveniments:** converteix gestos de l'usuari i ticks lògics en entrades de simulació.
7. **Vista:** dibuixa una instantània de l'estat; l'animació visual no decideix el comportament del circuit.

Per a cada posició d'un distribuïdor, una taula explícita de parelles de ports indica les comunicacions internes. Exemple d'una 5/2: una posició pot comunicar `P–A` i `B–S`; l'altra, `P–B` i `A–R`. Els noms dels dos escapaments i l'orientació del símbol s'han de mantenir coherents a la definició concreta. Un port de pilotatge és de control, no és una cambra de treball.

### Algoritme de referència

Algoritme objectiu de les fases 2–3. El MVP només resol l'accessibilitat dels ports a font i escapament després d'un accionament manual. Per a automatismes, separar l'estabilització instantània de l'avanç del temps: un temporitzador i un cilindre només avancen una vegada per tick extern, mai una vegada per iteració interna.

```text
tick(circuit, entrades, estatAnterior):
    graf = construeixGrafTipat(circuit)
    problemes = valida(graf, circuit)
    estat = iniciaOCopia(estatAnterior, entrades)
    actualitzaFinalsDeCursaDesDePosicionsConfirmades(estat)
    congelaPosicionsITemporitzadorsDurantLaResolucio(estat)
    signaturesVistes = conjuntBuit()

    per iteracio de 1 fins a MAX_ITERACIONS_PER_TICK:
        signatura = serialitzaEstatCanonic(estat)
        si signatura pertany a signaturesVistes:
            pausaSimulacio()
            retorna avisa(estat, "El circuit oscil·la dins d'un pas", problemes)
        afegeix(signatura, signaturesVistes)

        # Tots els avaluadors llegeixen la mateixa instantània anterior.
        propostes = avaluaDominisIRelesValvulesPilotatges(graf, estat)
        seguent = aplicaPropostesSimultaniament(estat, propostes)

        si estatsEquivalents(seguent, estat):
            # Una única transició temporal per tick.
            futur = avancaCilindresITemporitzadorsUnTick(seguent)
            programaFinalsDeCursaPerAlTickSeguent(futur)
            retorna instantania(futur, problemes)
        estat = seguent

    pausaSimulacio()
    retorna avisa(estat, "No s'ha assolit un estat estable", problemes)
```

La signatura ha de tenir un ordre estable per identificador i contenir tots els estats que afecten les regles. Limitar les iteracions (per exemple, 64 per tick) i detectar signatures repetides per impedir bucles infinits i bloquejos de la interfície. Un circuit amb oscil·lació instantània s'atura amb un avís i conserva una instantània inspeccionable. Una seqüència automàtica que es repeteix entre ticks és vàlida: no confondre-la amb manca de convergència dins d'un tick. Els temporitzadors es representen amb ticks lògics reproduïbles; la durada de l'animació és independent. Els avaluadors han de resoldre explícitament les arestes dirigides d'antiretorns i elements lògics; no convertir totes les connexions internes en unions bidireccionals.

### Semàntica funcional mínima

- Una font activa posa pressió a la xarxa compatible; una línia sense font no la crea.
- El pas a escapament descarrega; si una xarxa queda simultàniament alimentada i comunicada a escapament, el motor ha de marcar un **conflicte de model** i explicar-lo, en lloc de fingir un resultat físic.
- Una vàlvula només comunica els ports definits per la seva posició actual. Una 3/2 NC tanca P en repòs; una 3/2 NO comunica P–A en repòs. Una molla porta a la posició de repòs quan cessa l'ordre; una vàlvula biestable conserva la darrera posició fins a l'ordre contrària.
- El cilindre de simple efecte avança amb pressió a la cambra i retorna per molla quan descarrega. El de doble efecte avança si una cambra rep pressió i l'altra pot descarregar; retrocedeix amb les condicions inverses. En altres casos manté l'estat o aplica la regla de repòs definida pel model.
- Un final de cursa canvia d'estat només quan s'arriba a l'extrem corresponent; no durant la interpolació visual.
- AND activa la sortida amb les dues entrades; OR amb qualsevol de les dues.
- Un regulador `tancat` impedeix el pas en el sentit configurat. `poc`, `mitjà` i `obert` permeten el pas i ajusten només l'animació qualitativa. El regulador unidireccional deixa passar lliurement el sentit contrari.
- Una antiretorn només deixa passar el sentit configurat. L'escapament ràpid connecta P–A per alimentar i evacua A–R quan P queda sense pressió. El final de cursa mecànic commuta quan el cilindre supervisat arriba a l'extrem seleccionat; tija directa, corró i lleva en són les variants d'accionament. El pilotatge X/Y commuta una 5/2 i en conserva la posició.
- La vàlvula OR comunica una entrada pressuritzada amb A; la AND ho fa quan X i Y tenen pressió. El temporitzador 3/2, mentre rep pressió a X, obre P–A després del retard seleccionat; si desapareix el senyal, retorna A–R.
- Un contacte NO/NC modifica la continuïtat elèctrica. La bobina d'un relé governa els contactes amb la mateixa referència; un solenoide actiu governa la posició de l'electrovàlvula vinculada.
- Si hi ha ordres oposades simultànies i el model de vàlvula no defineix prioritat, avisar del conflicte i aplicar una regla documentada i determinista.

## 8. Validació i tractament d'errors

L'editor pot contenir esquemes incomplets; la validació no ha de destruir la feina. Comprovar identificadors duplicats, tipus desconeguts, components o ports inexistents, medis incompatibles, ports ocupats indegudament, extrems insuficients, referències de relé/bobina sense parella i fonts inexistents. Avisar de connexions obertes rellevants i de circuits que no arribin a un estat estable. Cada avís ha d'indicar el component o port afectat i permetre localitzar-lo al llenç.

La validació d'importació ha de rebutjar JSON malformat o amb versió no compatible amb un missatge clar, sense executar codi ni modificar el circuit obert. Els canvis de fitxer i l'esborrament de tot el circuit requereixen confirmació si hi ha modificacions no desades.

## 9. Accessibilitat i disposició

La disposició de referència és una barra superior amb controls, una biblioteca lateral esquerra, el llenç central i una finestra contextual petita de propietats/estat que només apareix en seleccionar un element. La finestra es pot moure i tancar. Les opcions de nom i recuperació del circuit s'obren amb un botó de la barra. El treball de dibuix es prioritza en ordinador d'aula; en pantalles petites s'ha de poder consultar l'esquema, operar la simulació i fer edicions bàsiques sense exigir un arrossegament precís.

Fer servir colors **i també** patrons, icones o text per diferenciar pressió, escapament, línia sense pressió, cable actiu i components accionats. Els traços animats dins dels conductes indiquen el sentit de l'aire en pressió i d'escapament, i han de respectar `prefers-reduced-motion`. El moviment del cilindre també ha de respectar aquesta preferència. Proporcionar navegació per teclat, ordre de focus coherent, botons amb nom accessible, contrast suficient i avisos de simulació llegibles pels lectors de pantalla.

## 10. Deu circuits de referència i criteris d'acceptació

Cada cas ha de tenir un circuit JSON complet i l'estat esperat abans i després de cada acció. Han de servir de referència durant el desenvolupament del motor i de revisió visual de l'app.

**Cobertura d'exemples preparada:** alimentació, regulació, derivació en T, 2/2, 3/2 NC i NO, 4/2, 5/2, final de cursa, lògica AND, temporitzador, escapament ràpid i electropneumàtica monoestable i biestable. Són exemples editables per orientar l'alumnat; encara cal revisar-ne cada resultat al navegador i amb criteri docent.

| Núm. | Circuit | Resultat esperat |
| --- | --- | --- |
| 1 | Font → 3/2 NC/NO amb polsador i molla → cilindre simple; variant 2/2 NC | Comprovar les dues posicions normals de la 3/2: NC tanca P en repòs i NO comunica P–A en repòs; accionar inverteix cada estat. Amb 3/2: prémer avança i deixar anar connecta `A–R`, descarrega i retorna. Amb 2/2: prémer avança i deixar anar tanca el pas; la cambra conserva qualitativament l'estat estès. Polsador, palanca i pedal canvien la icona i l'accionament; el retorn per molla actua mentre es manté l'ordre, i la posició mantinguda conserva l'estat fins a la següent commutació. |
| 2 | Font → 5/2 biestable → cilindre de doble efecte; variants de centre 5/3 | Ordre A: avançament; ordre B: retrocés; en cada estat es mostren les comunicacions internes correctes. A la 5/3, comprovar centre tancat, a escapament i a pressió. |
| 3 | 5/2 monoestable i cilindre de doble efecte | L'accionament canvia la posició; en deixar-lo anar la molla retorna la vàlvula i el cilindre segons els ports connectats. |
| 4 | 4/2 i cilindre de doble efecte | Les dues posicions inverteixen alimentació i descàrrega de les cambres. |
| 5 | Cilindre i final de cursa mecànic | El final de cursa s'activa només en arribar a l'extrem configurat i es desactiva en sortir-ne. |
| 6 | Seqüència pneumàtica `A+ → B+ → B− → A−` amb pilotatges/finals | Es compleix l'ordre previst sense avançaments anticipats ni oscil·lació persistent. |
| 7 | Regulador de cabal en un sentit | Tancat bloqueja; poc/mitjà/obert canvien només la categoria de l'animació. |
| 8 | Vàlvules pneumàtiques AND i OR | AND exigeix dues entrades; OR en necessita una. L'estat visual coincideix amb el motor. |
| 9 | Polsador elèctric → relé/solenoide → electrovàlvula → cilindre | La continuïtat elèctrica acciona la vàlvula i després la xarxa pneumàtica; en treure el senyal s'aplica el retorn o la memòria definits. Incloure la biestable de dues bobines: Y1/Y2 commuten sentits oposats i la vàlvula conserva la posició sense senyal. |
| 10 | Inici manual, temporitzador i fase automàtica | L'ordre inicial desencadena una única transició després dels ticks previstos; aturar/reiniciar restaura l'estat inicial. |

**Criteri comú:** resultat determinista, connexions i símbols visualment coherents amb l'estat intern, avís explícit davant d'un conflicte o bucle, cap bloqueig de la pàgina, i conservació exacta de components, propietats, connexions i vista en descarregar el JSON i tornar-lo a obrir en una sessió nova. La còpia automàtica ofereix l'últim circuit en reobrir la pàgina; esborrar-la la fa desaparèixer fins que hi hagi un canvi nou. La prova del flux ha de confirmar que no hi ha cap petició de xarxa que enviï el circuit a un servidor. Les comprovacions del motor no substitueixen la revisió visual ni la verificació de la ruta pública quan es publiqui.

## 11. Pla de desenvolupament

### Fase 0 — Integració i editor

Base publicada: entrada, portada, navegació, biblioteca per famílies i editor. Inclou connexions amb recorregut, anotacions, eines Clic/PAN/Text, desfer/refés, copiar/enganxar i exportació PNG. La verificació de cada flux d'edició i de l'obertura d'arxius locals en navegadors d'aula continua pendent.

Integració publicada: entrada THOSFLUID i llenç independent, biblioteca per famílies, selecció, connexions, desfer/refés i JSON versionat. Mantenir la ruta `thosfluid.html` i la targeta activa de l'índex.

### Fase 1 — MVP pneumàtic

Nucli publicat amb font d'aire, acumulador i unitat de manteniment passius, regulació qualitativa, distribuïdors 2/2 NC, 3/2 NC/NO, 4/2, 5/2 i 5/3 amb tres centres, escapament ràpid, exemples i recuperació local. Accionament configurable amb polsador, palanca o pedal i retorn per molla o posició mantinguda. El mode pas a pas ja permet avançar els cilindres i els temporitzadors de forma controlada. Resten pendents la comprovació interactiva dels deu circuits de referència i la revisió del flux d'importació en navegadors d'aula.

 Font d'aire, acumulador i unitat de manteniment, regulador de cabal qualitatiu, cilindres simple i doble, 2/2 NC, 3/2, 4/2 i 5/2, polsador, palanca, pedal, molla, posició mantinguda, motor discret i pressió/escapament visibles. Cobrir els circuits 1–4 i 7.

### Fase 2 — Lògica i seqüències

Disponibles: antiretorn, regulador unidireccional, escapament ràpid, final de cursa mecànic 3/2 amb tija/corró/lleva, pilotatge doble X/Y, lògica AND/OR, temporitzador pneumàtic qualitatiu i distribuïdor 5/3 amb tres opcions de centre. Resta pendent revisar els circuits compostos i completar la verificació dels casos 5–8 i 10.

### Fase 3 — Electropneumàtica

Base disponible: font, unió elèctrica en T, polsadors NO/NC, interruptor, relé i contactes NO/NC, final de cursa i electrovàlvules 5/2 monoestable i biestable. Pendents: circuits compostos i acceptació docent de símbols i exemples.

### Fase 4 — Acabat

Revisar símbols i ajudes contextuals amb criteri docent, completar accessibilitat i pantalles petites, documentar migracions de JSON i revisar el rendiment amb desenes de components. L'exportació PNG ja està incorporada. Decidir una eventual especificació d'hidràulica en una fase posterior.

## 12. Estructura suggerida de fitxers

Adaptar els noms i el sistema de mòduls a l'estat del repositori. Aquesta proposta manté els punts d'entrada a l'arrel, com les aplicacions actuals:

En el MVP, el codi és a `thosfluid/app.js` i els estils a `thosfluid/app.css`; les carpetes següents descriuen la modularització prevista, encara no implementada.

```text
THOSAPPS/
  index.html                 # navegació i targeta THOSFLUID
  sitemap.xml                # URL pública de THOSFLUID
  thosfluid.html             # entrada pròpia i capçalera compartida
  thosfluid-app.html         # editor i vista de simulació
  thosfluid.svg              # imatge de la targeta, si s'escull SVG
  thosfluid/
    ui/                      # llenç, biblioteca, propietats, controls
    model/                   # components, ports, connexions i serialització
    engine/                  # graf, planificador, pneumàtica i electricitat
    fixtures/                # deu circuits de referència en JSON
    styles/                  # estils propis compatibles amb la suite
```

Si el repositori continua fent servir pàgines HTML autònomes, THOSFLUID pot tenir mòduls JavaScript carregats amb camins relatius sense exigir un servidor d'aplicacions. Cal inspeccionar les dependències reals abans de triar una llibreria d'editor o afegir un procés de compilació.

## 13. Instruccions de partida per a Codex

1. Obre el repositori `dep-tecno/THOSAPPS` i comprova l'estat actual d'`index.html`, la navegació de `thosdruino/index.html` i `thosvincle.html`, `sitemap.xml`, els estils i els requisits de desplegament.
2. Parteix del MVP publicat. Extreu el motor de `app.js` mantenint compatibles els JSON v1 i resol els pendents de la fase 1 abans d'ampliar el catàleg.
3. Fes que l'editor i la simulació comparteixin només el model de circuit; el motor no ha de dependre del DOM ni dels dibuixos SVG.
4. Documenta la posició de repòs, les connexions internes, la memòria i les ordres simultànies de cada vàlvula concreta. En cas de dubte, deixa una decisió explícita al registre del component.
5. Mantén en català tot el text visible i tots els exemples; revisa els accents i l'ús coherent de «vàlvula», «cilindre», «conducte», «escapament» i «final de cursa».
6. Verifica per separat la lògica dels circuits, la visualització al navegador i, quan s'autoritzi la publicació, la ruta pública de Tecno-Apps. Informa de què s'ha comprovat en cada etapa.

## 14. Fonts de l'estructura de la suite

- [Repositori THOSAPPS](https://github.com/dep-tecno/THOSAPPS)
- [Índex i targetes](https://github.com/dep-tecno/THOSAPPS/blob/main/index.html)
- [THOSDRUINO](https://github.com/dep-tecno/THOSAPPS/blob/main/thosdruino/index.html)
- [THOSLAB, referència visual](https://github.com/dep-tecno/THOSAPPS/blob/main/thoslab.html)
- [Patró de pàgina d'entrada de THOSVINCLE](https://github.com/dep-tecno/THOSAPPS/blob/main/thosvincle.html)
- [Mapa del web](https://github.com/dep-tecno/THOSAPPS/blob/main/sitemap.xml)

Estructura consultada el **28 de setembre de 2026**; document actualitzat el **29 de setembre de 2026**. Cal tornar-la a comprovar en començar una nova ampliació.

## 15. Evidències de la primera publicació

- Comprovació de sintaxi de JavaScript i lectura estructural dels XML/SVG completades.
- Revisió al navegador local: muntatge d'una connexió, exemples 3/2 i 5/2, retorn del polsador, descàrrega iniciada i recuperació de l'últim circuit després de recarregar.
- Revisió del web públic: targeta amb imatge a la portada, accés a l'app, commutació de la 5/2 i estat estès del cilindre.
- Pendent: completar l'obertura d'un JSON descarregat mitjançant el selector de fitxers, la matriu d'accessibilitat i dispositius, i els circuits de fases futures. Aquestes comprovacions parcials no equivalen a l'acceptació completa de V1.

## Estat de l'ampliació del 29 de setembre de 2026

- Afegit a la còpia de treball: eina PAN, anotacions, copiar/enganxar components i connexions amb recorreguts de clics desats al JSON v2. El validador continua acceptant circuits JSON v1 i els converteix al model nou amb recorreguts buits.
- Afegides unions en T i exemples editables de derivació, final de cursa, lògica, temporització i electroneumàtica.
- Afegida una primera xarxa elèctrica binària amb polsadors, interruptors, relés, contactes, final elèctric i una electrovàlvula 5/2 monoestable. No hi ha càlculs elèctrics ni pneumàtics.
- La connexió de ports incompatibles i els encreuaments sense unió explícita es tracten separadament.
- Estat de revisió: cal fer una passada de navegador per verificar la interacció i l'aspecte, i completar la revisió docent dels exemples i símbols. No s'ha d'interpretar l'edició de codi com a acceptació final.

## Ampliació de components — 29 de setembre de 2026

S'incorporen quatre elements comuns a la biblioteca, mantenint la simulació qualitativa i sense magnituds físiques:

- **Vàlvula 3/2 pilotada pneumàticament:** ports P, A, R i X. Sense senyal a X connecta A amb R; amb senyal de pressió a X connecta P amb A. Retorn per molla representat al símbol.
- **Sensor magnètic de cilindre:** contacte elèctric 1–2 que tanca quan el cilindre supervisat arriba a l'extrem seleccionat (estès o retret). La selecció del cilindre i extrem es desa amb el component.
- **Relé temporitzador elèctric:** bobina A1–A2 i contacte normalment obert 15–18. Quan la bobina rep alimentació, el contacte tanca després d'un retard curt, mitjà o llarg. En retirar l'alimentació, es reinicia.
- **Vàlvula seqüencial de pressió:** ports P, A, R i X. El senyal a X inicia un llindar qualitatiu baix, mitjà o alt; en completar-se, s'obre P–A. La selecció és una abstracció de passos/retard per ensenyar seqüències, no una lectura o càlcul de pressió real.

En mode pas a pas, els retards i el llindar avancen amb els passos lògics. En mode continu, s'animen amb retards qualitatius. El circuit elèctric conserva el mateix model de continuïtat booleana de la versió actual. Els quatre elements tenen circuits d'exemple a la biblioteca.


## Còpia automàtica de recuperació

S'ha retirat l'activació manual: cada operació d'edició desa automàticament l'últim circuit a `localStorage` del mateix navegador. Es conserva només una còpia i es pot esborrar des del menú Circuit. No s'envia cap dada a un servidor i la recuperació continua sent manual després de reobrir la pàgina.
