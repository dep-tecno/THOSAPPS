# THOSLAB AC — Especificació funcional i tècnica v1.0

**Estat:** especificació inicial per al desenvolupament  
**Producte:** aplicació web didàctica nova, construïda des de zero  
**Públic:** Batxillerat i cicles formatius (CF)

## 1. Propòsit

THOSLAB AC és un simulador didàctic de circuits de corrent altern sinusoidal en règim permanent. Ha de permetre construir un circuit, simular-lo i explorar-ne les magnituds elèctriques amb instruments i representacions coordinades.

És una aplicació nova. Només hereta de THOSLAB el llenguatge visual i les pautes d’interacció que aquesta especificació esmenta. No hereta el seu model de circuit, codi, comportaments no descrits ni arquitectura.

La prioritat és fer comprensibles les relacions entre tensió, intensitat, impedància, fase i potència. La interfície ha de servir tant per muntar el circuit com per interpretar-ne el resultat sense convertir-se en un entorn professional de disseny o simulació.

## 2. Objectius

- Construir circuits AC connectant lliurement resistències, inductàncies i capacitats.
- Mostrar el comportament sinusoidal en règim permanent mitjançant valors RMS, fasors i representacions temporals derivades.
- Fer servir un model elèctric coherent, validat i compartit per tota l’aplicació.
- Separar clarament la construcció del circuit de l’experimentació amb valors i interruptors.
- Oferir informació contextual sobre nodes, cables i components, i tres eines inferiors: Scope, Fasors i Anàlisi.
- Mantenir una sola interfície amb un espai central de treball i eines integrades.

## 3. No-objectius i límits

- No és SPICE, Multisim ni un simulador professional.
- No calcula transitoris, arrencades, règims transitoris, formes d’ona no sinusoidals ni circuits en règim no permanent.
- No incorpora models reals amb toleràncies, paràsits, saturació, temperatura o dependència de freqüència.
- No incorpora semiconductors, transformadors, fonts múltiples, fonts dependents, amplificadors ni components que no figuren a l’apartat 5.
- No pretén ser una eina de disseny de PCB, captura d’esquemes professional ni laboratori virtual configurable.
- No afegir funcions, components, modes o eines per inferència. Qualsevol ampliació queda fora de l’abast d’aquesta v1.0.

## 4. Principis de producte

1. **Una font de veritat:** el model de circuit defineix topologia i valors; una execució del solver produeix un únic conjunt de resultats.
2. **Validar abans de resoldre:** un circuit incomplet o invàlid no arriba al solver.
3. **Una sola interfície:** editar i simular són modes de la mateixa aplicació, no pantalles o productes diferents.
4. **Construir i experimentar:** EDITAR permet canvis estructurals; SIMULAR permet canvis de valors i d’estat dels interruptors.
5. **Representacions derivades:** instruments, hover, Scope, Fasors i Anàlisi consulten els mateixos resultats. No calculen solucions independents.
6. **Ensenyar sense sobrecarregar:** les vistes presenten primer magnituds i relacions comprensibles per al públic objectiu.

## 5. Abast de components

Tots els components són ideals. Els components de dos terminals es poden connectar en qualsevol topologia RLC sèrie, paral·lel o mixta, subjecta a les validacions elèctriques.

| Component | Model i valors | Terminals / comportament |
|---|---|---|
| Font AC sinusoidal ideal | Valor RMS \(V_s\), freqüència \(f\), fase fixada a \(0^\circ\) | Una font per circuit. Impedància interna zero. |
| Resistència R | \(R>0\), en ohms | Dos terminals; \(Z_R=R\). |
| Inductància L | \(L>0\), en henrys | Dos terminals; \(Z_L=j\omega L\). |
| Capacitat C | \(C>0\), en farads | Dos terminals; \(Z_C=1/(j\omega C)\). |
| Interruptor | Estat obert o tancat | Dos terminals. Obert equival a branca interrompuda; tancat a connexió ideal. Tots dos estats són vàlids. |
| Voltímetre ideal | Sense paràmetre d’usuari | Dos terminals, impedància d’entrada infinita; mesura tensió entre terminals i no carrega el circuit. |
| Amperímetre ideal | Sense paràmetre d’usuari | Dos terminals, impedància zero; mesura el corrent de branca. |
| Cable i node | Sense valor elèctric | Connecten terminals i nodes ideals. Un cable pot acabar en un node intermedi on s’uneixen tres o més branques; els trams gràfics d’una mateixa xarxa comparteixen node elèctric. |

La freqüència ha de ser positiva i comuna a tot el circuit, fixada per l’única font AC. El domini numèric admissible i els límits de rang de la interfície no s’especifiquen aquí: no s’han d’inventar restriccions didàctiques addicionals. Les entrades han de ser finites i respectar les unitats i els valors estrictament positius indicats.

## 6. Interfície i interacció

### 6.1 Estructura de pantalla

- **Barra superior estil THOSLAB, en una sola fila:** identitat, paleta de components i accions en aquest ordre: Connectar; Nou, Obrir i Desar; Desfer i Refer; zoom menys, percentatge de zoom, zoom més i Pan; Baixar PNG; mode i acció Simular/Aturar. Reutilitza només el llenguatge visual general de THOSLAB.
- **Workspace central:** àrea principal per afegir, col·locar, moure i girar components i per dibuixar, editar i esborrar cables/nodes.
- **Terminals visibles:** els dos punts de connexió de cada component es mantenen visibles com a marques petites vermelles; s’intensifiquen en mode Connectar, en passar-hi el cursor i en seleccionar l’inici d’un cable.
- **Fitxers locals:** Obrir llegeix un circuit JSON seleccionat per l’usuari; Desar baixa el circuit actual com a JSON. No s’envien circuits a cap servidor.
- **Vista del workspace:** zoom i desplaçament Pan canvien només la vista, no la geometria relativa ni la topologia del circuit. Baixar PNG exporta la vista actual del workspace.
- **Historial:** Desfer i Refer recuperen canvis de circuit; no alteren zoom, desplaçament ni selecció de vista.
- **Informació contextual hover:** en passar sobre node, cable o component es mostra informació relacionada amb l’element i, quan hi ha una simulació vàlida, les magnituds pertinents del resultat actual.
- **Targetes de simulació:** Scope, Fasors i Anàlisi es presenten com tres targetes compactes superposades a la part inferior del workspace. No divideixen la pantalla ni reserven una franja fixa. Cada targeta es pot ampliar temporalment i el conjunt es pot plegar per recuperar tot l’espai de treball.

No cal fer desaparèixer les eines durant SIMULAR. Les accions estructurals continuen visibles però desactivades, perquè es vegi què existeix i que cal aturar la simulació per modificar l’estructura.

### 6.2 Selecció i consulta

- **Hover** consulta informació contextual. No canvia la selecció ni recalcula.
- **Clic en un component** el selecciona; les vistes inferiors passen a mostrar aquell component quan la vista admet contextualització.
- **Connexions:** en mode Connectar, es poden unir dos terminals; després d’iniciar un cable, clicar damunt d’un altre cable el divideix en aquell punt i hi crea un node per continuar la connexió. Clicar l’espai buit crea un extrem de cable en un node lliure. Es pot iniciar una connexió des d’un node existent per afegir-hi una altra branca.
- En apropar el cursor a un cable mentre hi ha una connexió iniciada, el cable objectiu es ressalta i es mostra el punt exacte d’unió i una previsualització discontínua de la branca. En confirmar-la, es mostra un avís de connexió; si el cable ja pertany al node d’inici, s’indica que cal triar-ne un altre.
- Els indicadors dels terminals són punts d’unió petits i no han de tapar ni ocultar els extrems gràfics dels símbols. Els nodes amb branques addicionals es distingeixen visualment.
- Els cables surten dels terminals segons l’orientació actual del component i el recorregut ortogonal evita travessar el cos dels components quan hi ha un traçat lliure alternatiu. El botó «Gira 90°» i la tecla `R` giren el component seleccionat 90°; el gir és una acció d’historial.
- En mode Seleccionar, clicar un cable o node el selecciona i obre les seves accions contextuals; el cable queda ressaltat.
- Un cable seleccionat es pot eliminar o dividir en un node d’edició. Arrossegar aquest node allarga o redistribueix els trams connectats sense desfer-ne la continuïtat elèctrica.
- Arrossegar un node existent mou el punt d’unió i actualitza el recorregut dels cables que hi arriben. Eliminar un node elimina també els trams connectats a aquell node; l’acció es pot desfer.
- El component seleccionat es pot eliminar des de les seves propietats. La tecla `Supr` o `Backspace` elimina l’element seleccionat (component, cable o node); `Desfer` recupera les modificacions.
- Els canvis de connexió, nodes i eliminacions es tracten com una sola acció d’historial per gest.
- **Clic en una zona buida** treu la selecció i retorna les vistes al circuit global.
- El hover no fa canviar el contingut de Scope, Fasors o Anàlisi. Això evita canvis de vista accidentals en moure el cursor.
- La posició o rotació gràfica, per si soles, no canvien la topologia ni requereixen un nou càlcul.

**Animació del corrent als cables:** durant SIMULAR, els cables amb corrent mostren punts grocs lluminosos com a THOSLAB. El moviment alterna el sentit segons la fase del corrent de cada tram; la velocitat augmenta amb I RMS amb una escala visual logarítmica limitada. Una fase comuna recorre un cicle visual cada 2,4 s, alentit i independent de la freqüència real. El peu del workspace ho indica. Els punts s’alenteixen fins a aturar-se en els passos per zero; els trams amb corrent nul no mostren punts. Els canvis de R/L/C, font i interruptors actualitzen els corrents animats immediatament, mantenint la fase visual comuna. Aturar elimina l’animació, que també es pausa quan la pàgina és oculta.

Els corrents de cable es deriven dels corrents complexos dels components aplicant Kirchhoff a la xarxa de terminals i nodes. En una xarxa de cables sense bucles redundants, cada tram té un corrent únic, inclosa la suma de corrents en un tronc de branques paral·leles. Un bucle format només per cables ideals no determina un repartiment únic: aquests trams no s’animen i el hover ho explica; els trams amb corrent determinat continuen animats. El fasor del tram segueix l’orientació de l’extrem `a` cap a `b`. És una representació didàctica derivada del resultat fasorial, sense solver de transitoris ni impedància afegida als cables.

### 6.3 Eines inferiors

Les tres targetes compactes poden aparèixer simultàniament mentre hi ha resultats de simulació. L’usuari pot ampliar-ne una per consultar més detall; ampliar una targeta no canvia ni redimensiona el workspace. Es pot plegar el conjunt de targetes.

**〰 Scope**  
Representació temporal didàctica directa de sinusoides derivades dels fasors RMS i la freqüència del resultat. No és un oscil·loscopi configurable ni un solver temporal. Sense component seleccionat mostra automàticament \(v(t)\) i \(i(t)\) globals amb la mateixa escala temporal, perquè sigui visible el desfasament. Presenta les dades essencials globals, com ara V RMS, I RMS, freqüència i angle de fase. Amb un component seleccionat mostra la tensió i el corrent d’aquell component (per exemple, \(v_L(t)\), \(i_L(t)\)). No hi ha selecció de canals; l’escala vertical s’ajusta automàticament al pic de cada senyal, amb marge perquè no es retalli. V i I tenen unitats diferents i escales verticals pròpies, indicades explícitament; la tensió és turquesa i el corrent taronja discontinu per distingir-los també quan coincideixen.

El Scope té zoom temporal intern amb botons **− / + / Auto**, independent del zoom del circuit. Els nivells són 0,5×, 1×, 2×, 4× i 8×; es mostra la durada visible en ms. **Auto** torna a dos períodes (1×) i l’escala vertical continua automàtica a qualsevol nivell. El zoom no modifica el circuit ni els resultats, es conserva en ampliar/plegar la targeta i en canviar el component seleccionat, i la finestra temporal es recalcula amb la freqüència actual. L’ampliació o el canvi de mida redibuixa el gràfic per ajustar-lo a l’espai disponible.

**↗ Fasors**  
Sense selecció mostra automàticament el fasor de la font i el del corrent total, amb l’angle de fase. Amb un component seleccionat mostra els fasors rellevants d’aquell component. Per a un circuit RLC sèrie, la vista global mostra automàticament \(V_R\), \(V_L\), \(V_C\) i \(V\), una construcció fasorial didàctica. No hi ha configuració manual dels fasors que es mostren.

Els vectors tenen fletxes i etiquetes, amb els colors del Scope: V turquesa i I taronja discontinu. Les tensions comparteixen una escala proporcional entre elles; els corrents tenen una escala pròpia, perquè V i A són unitats diferents. L’ajust és automàtic i la targeta indica explícitament les escales pròpies. Es preserven les proporcions entre les tensions \(V_R\), \(V_L\), \(V_C\) i \(V\).

Un arc representa el desfasament \(\phi=\arg(V)-\arg(I)\), reduït a l’interval \([-180^\circ,180^\circ]\). La targeta indica «Corrent endarrerit» si \(\phi>0\), «Corrent avançat» si \(\phi<0\), «Corrent en fase» a zero i «Corrent en oposició» a 180°. Si V o I és nul, el desfasament no està definit: s’explica l’estat i no es dibuixa l’arc. La targeta compacta mostra els valors RMS de V i I; l’ampliada mostra mòduls, unitats i angles de tots els fasors pertinents. Les fletxes, les etiquetes i el gràfic s’ajusten a l’espai disponible, també després d’ampliar, plegar o redimensionar la vista.

**Σ Anàlisi**  
Vista numèrica dels resultats. Sense selecció mostra les magnituds globals pertinents: font, freqüència, intensitat, impedància equivalent, fase, factor de potència i potències activa \(P\), reactiva \(Q\) i aparent \(S\), segons siguin definides per a l’estat actual. Amb un component seleccionat mostra les magnituds calculades per a aquest component. La presentació per defecte prioritza mòduls, unitats i angles (per exemple, \(Z=|Z|\angle\phi\)); no exposa la forma complexa rectangular com a requisit de v1.0. No s’afegeix una opció «Veure càlculs» en aquesta especificació.

### 6.4 Estat sense resultat

Abans d’una simulació vàlida, o després d’una fallada de validació/solució, les eines i el hover no han de mostrar resultats antics com si corresponguessin al circuit actual. Poden indicar que cal simular o que el resultat no està disponible; no es prescriu cap disseny concret del missatge.

## 7. Modes i fluxos d’estat

### 7.1 EDITAR

És el mode inicial. L’usuari pot:

- afegir o eliminar components;
- moure i girar components;
- crear, modificar i eliminar cables i connexions;
- canviar valors de R, L, C i de la font (Vrms i f);
- obrir o tancar interruptors;
- crear un circuit nou, obrir-ne un de JSON local o baixar el circuit actual com a JSON;
- desfer i refer canvis del circuit;
- fer zoom, desplaçar el workspace i baixar-ne una imatge PNG;
- iniciar SIMULAR.

Nou i Obrir demanen confirmació abans de substituir un circuit que ja conté components. Desar i Baixar PNG no modifiquen el circuit.

### 7.2 Inici de SIMULAR

En prémer **▶ SIMULAR**:

1. Validar el model de circuit.
2. Si és incomplet o invàlid, no executar el solver; informar de la validació fallida i continuar en EDITAR.
3. Si és vàlid, resoldre el circuit fasorial.
4. Si la solució és definida, publicar el conjunt únic de resultats i entrar en SIMULAR.
5. Bloquejar els canvis estructurals: afegir/eliminar components, editar connexions, cables o nodes.

L’estat obert d’un interruptor continua sent admissible i no és, per si mateix, un error de circuit incomplet.

### 7.3 SIMULAR

En aquest mode:

- Es permet modificar \(R\), \(L\), \(C\), \(V_s\), \(f\) i l’estat dels interruptors.
- Cada canvi es valida i provoca recàlcul immediat. El resultat s’actualitza conjuntament a instruments, hover i les tres eines inferiors.
- L’edició estructural roman desactivada i visible.
- Si un valor canviat deixa el circuit invàlid o sense solució definida, no s’han de conservar resultats antics com si fossin actuals; es comunica l’estat no resolt fins que un canvi permès torni a donar una solució vàlida.
- La selecció, el hover i els canvis de visualització no alteren el circuit ni activen un càlcul nou.

En prémer **■ ATURAR**, tornar a EDITAR i desbloquejar l’edició completa. Aturar no modifica per si sol el circuit.

Resum:

```text
EDITAR --SIMULAR vàlid--> SIMULAR
EDITAR --SIMULAR invàlid--> EDITAR amb errors de validació
SIMULAR --canvi de valor/interruptor--> validar → resoldre → actualitzar resultat
SIMULAR --ATURAR--> EDITAR
```

## 8. Arquitectura funcional i tècnica

Separar les responsabilitats en blocs lògics. La tecnologia concreta, el framework i l’organització en fitxers queden a decisió d’implementació i no són requisits d’aquesta especificació.

```text
Interfície (barra, workspace, interaccions, eines)
             ↕ accions / lectures
Model de circuit (components, terminals, nodes, valors, geometria)
             ↓ snapshot elèctric
Validador de topologia i valors
             ↓ model validat
Solver fasorial nodal complex
             ↓ solució única
Resultats normalitzats
   ├─ instruments
   ├─ hover contextual
   ├─ Scope
   ├─ Fasors
   └─ Anàlisi
```

- **Model de circuit:** font única de veritat persistent durant la sessió. Separa la geometria del canvas de la connectivitat elèctrica.
- **Validador:** comprèn regles de construcció i de valors; rebutja models incorrectes abans del solver.
- **Solver:** rep dades elèctriques validades; no coneix píxels, canvas, estils ni estat de selecció.
- **Resultats:** objecte de sortida únic identificat amb la revisió o snapshot del circuit que s’ha resolt. Conté les magnituds necessàries per a l’app, inclosos els fasors de corrent dels cables determinats per Kirchhoff; els corrents no únics dels bucles de cables ideals es marquen com a indeterminats.
- **Presentació:** les vistes només llegeixen l’objecte de resultats i apliquen formats/un­itats visuals; no resolen el circuit.

Un canvi només gràfic (moure o girar sense canviar terminals connectats) redibuixa sense resoldre. Un canvi de topologia o de paràmetres elèctrics invalida el resultat anterior. En SIMULAR, els únics canvis elèctrics admesos són els de valors permesos i interruptors.

## 9. Model de dades conceptual

Representació conceptual orientativa del model en memòria.

```text
Circuit
 ├─ mode: EDITAR | SIMULAR
 ├─ components: Component[id, tipus, posició, rotació, terminals, valor?, estat?]
 ├─ terminals: Terminal[id, componentId, nodeId]
 ├─ nodes: Node[id, posició?, terminalIds, connexions gràfiques]
 └─ cables: Wire[id, extremA, extremB], on cada extrem és un terminal o un node

Resultat
 ├─ circuitRevision
 ├─ source: V RMS, fase, freqüència
 ├─ nodes[nodeId]: tensió fasorial RMS
 ├─ components[componentId]: tensió, corrent i potències pertinents
 ├─ instruments[instrumentId]: lectura
 └─ totals: magnituds equivalents i potències del circuit
```

Cada component té identificador estable i terminals explícits. Els cables uneixen terminals amb terminals, terminals amb nodes o nodes amb nodes. Un node intermedi permet connectar branques paral·leles i mixtes sense superposar el terminal del component amb el traç del cable. La geometria del cable pot contenir diversos trams ortogonals, però cada extrem d’unió comparteix una sola identitat elèctrica. La identitat del node permet consultar una tensió des de qualsevol terminal o node associat.

El fitxer portable de circuit és JSON UTF-8 v1 i conté `format: "THOSLAB-AC"`, `schemaVersion: 1`, una llista `components` amb tipus, identificador, posició, rotació i valors/estat necessaris, `junctions` amb identificador i posició de cada node gràfic i `wires` amb els extrems `a` i `b` (terminals o nodes) de cada connexió. Per compatibilitat, un fitxer v1 sense `junctions` es pot llegir com una llista buida. Obrir valida estructura, tipus, identificadors, valors i referències abans de substituir el model. El fitxer es llegeix i es baixa al dispositiu de l’usuari; no es desa al servidor.

Els resultats han d’estar vinculats a la revisió de circuit resolta. La UI no ha de combinar dades de revisions diferents.

## 10. Model matemàtic i solver

### 10.1 Conveni fasorial

- Règim sinusoidal permanent; freqüència comuna \(f>0\), \(\omega=2\pi f\).
- Fasors expressats en valors RMS.
- Referència de fase: tensió de la font amb angle \(0^\circ\).
- \(j=\sqrt{-1}\).

### 10.2 Impedàncies i magnituds

\[
Z_R=R,\qquad Z_L=j\omega L,\qquad Z_C=\frac{1}{j\omega C}
\]

Per a cada component, \(\underline V=\underline I Z\), segons l’orientació dels terminals escollida pel model. La font imposa \(\underline V_s=V_s\angle 0^\circ\) RMS. S’han de respectar consistentment els signes de corrent/tensió i la convenció passiva en els resultats dels components.

El nucli de solució de xarxa és un solver fasorial nodal amb nombres complexos. Amb una única font ideal, es pot prendre un terminal de la font com a referència i imposar la tensió de l’altre. Les branques R, L i C aporten admitàncies nodals; es resol el sistema lineal complex per obtenir tensions de nodes. Després es deriven corrents de branques, tensions de components, corrent de font i mesures dels instruments.

Els voltímetres ideals no carreguen el circuit. Els amperímetres ideals són curtcircuits en sèrie i mesuren el corrent de la branca on s’insereixen. Una connexió que faci que el resultat elèctric sigui indeterminat, contradictori o no finit s’ha de rebutjar com a no resoluble abans de publicar resultats vàlids.

### 10.3 Sinusoides, fasors i potència

Per a un fasor RMS \(\underline X=X_{RMS}\angle\phi_X\), la representació temporal és:

\[
x(t)=\sqrt{2}\,X_{RMS}\sin(\omega t+\phi_X)
\]

Aquesta expressió genera la representació del Scope; no implica una simulació temporal ni transitoris.

Per a magnituds RMS de tensió i corrent:

\[
\underline S=\underline V\,\underline I^{*}=P+jQ,\qquad
P=\Re(\underline S),\quad Q=\Im(\underline S),\quad |S|=|\underline V||\underline I|
\]

El factor de potència és \(P/|S|\) quan \(|S|\ne0\). L’angle entre els fasors globals de tensió i corrent és \(\phi=\arg(\underline V)-\arg(\underline I)\). Els signes i etiquetes de potència han de seguir una convenció coherent. Per al circuit obert o una magnitud nul·la, mostrar el valor definit matemàticament (per exemple \(I=0\)) i no dividir per zero; ometre o marcar com a no definida una magnitud derivada que no es pugui calcular.

## 11. Validació abans del solver

La validació mínima cobreix:

- Hi ha exactament una font AC al circuit.
- La font té \(V_s>0\), \(f>0\), finits; la seva fase és fixa a zero i no es pot configurar.
- Tots els valors R, L i C són finits i estrictament positius.
- Els components i terminals tenen identitat i connexions coherents.
- No hi ha terminals/cables deixats en un estat gràficment connectat però elèctricament indeterminat.
- El circuit presenta un camí elèctric complet entre els terminals de la font per al model actual; una branca oberta és admissible sempre que la resta del circuit compleixi les regles.
- No existeix un curtcircuit directe ideal que contradigui la font ideal de tensió.
- La topologia és resoluble i dóna una solució finita; casos degenerats, contradictoris o singulars no es passen com a resultats vàlids.
- Els instruments respecten el seu model ideal. Un amperímetre és un element sèrie ideal; una configuració que introdueixi curtcircuit contradictori o indeterminació es rebutja.

Els circuits incomplets no se simulen. Un interruptor obert, per si mateix, és un estat vàlid i el solver ha de calcular les conseqüències d’aquest estat quan la xarxa continua ben definida. La validació ha de distingir una branca oberta intencional d’una connexió accidentalment incompleta.

Errors de validació han d’identificar de manera útil l’element o condició que cal corregir, sempre que es pugui. No s’especifica aquí un catàleg textual concret.

## 12. Criteris d’acceptació v1.0

La implementació compleix aquesta especificació quan es pot verificar que:

1. L’aplicació és nova, amb una sola interfície i llenguatge visual inspirat en THOSLAB, i presenta barra superior d’una fila, workspace central i targetes compactes de simulació superposades, sense dividir la pantalla.
2. Només existeixen els components i la font de l’apartat 5; els elements passius es poden connectar en topologies RLC sèrie, paral·lel i mixtes.
3. Cada component té terminals explícits; els terminals queden visibles com a punts petits vermells sense tapar el símbol, i es ressalten en mode Connectar, en passar-hi el cursor i en seleccionar l’inici del cable. Els nodes intermedis permeten derivar branques paral·leles i topologies mixtes. En apropar-se a un cable es ressalten el cable objectiu i el punt d’ancoratge, i es veu la previsualització de la branca; en confirmar-la apareix una indicació clara. La connectivitat elèctrica queda separada de la geometria dels segments.
4. Una font AC és obligatòria, només n’hi ha una, és sinusoidal ideal, i exposa Vrms i f amb fase fixa a zero.
5. Valors no finits/no positius, connexions incompletes, curt circuit incompatible o sistemes no resolubles impedeixen arribar al solver o publicar una solució vàlida.
6. Un interruptor obert no és rebutjat només pel fet d’estar obert; el circuit obert es resol quan la xarxa resultant és definida.
7. El solver nodal complex calcula el règim sinusoidal permanent RMS i produeix un conjunt únic de resultats amb tensions de nodes i magnituds de components pertinents.
8. Voltímetre ideal no carrega la xarxa i amperímetre ideal mesura un corrent de branca amb impedància zero.
9. Instruments, hover, Scope, Fasors i Anàlisi reflecteixen el mateix snapshot de resultats i no fan càlculs independents de xarxa.
10. Sense selecció, les eines mostren la representació global automàtica; una selecció de component contextualitza les vistes compatibles; clicar l’espai buit torna a la vista global; hover no canvia la selecció ni la vista inferior.
11. Scope mostra sinusoides didàctiques derivades de fasors RMS i freqüència; Fasors mostra els valors acordats automàticament; cap de les dues eines requereix canals o configuració de visualització.
12. Anàlisi mostra valors globals i de component pertinents, incloses magnituds d’impedància, fase, factor de potència i potències quan estiguin definides, amb unitats coherents.
13. En EDITAR, l’usuari pot fer tots els canvis estructurals i paramètrics descrits.
14. SIMULAR només comença després de validació i solució satisfactòries; un error deixa el circuit en EDITAR i evita mostrar resultats obsolets.
15. En SIMULAR, afegir/eliminar components i editar topologia estan desactivats; R/L/C, Vrms, f i interruptors continuen editables i cada canvi vàlid actualitza immediatament les mateixes vistes.
16. ATURAR retorna a EDITAR i desbloqueja l’edició estructural.
17. Moure o girar gràficament un component sense modificar-ne la connectivitat no canvia el resultat elèctric; els terminals i els cables es mantenen alineats amb el símbol en totes les orientacions disponibles.
18. No s’han afegit solver SPICE, transitoris, components o funcionalitats fora d’aquesta especificació.
19. La barra superior conté, després de Connectar i en ordre, Nou/Obrir/Desar, Desfer/Refer, zoom/Pan i Baixar PNG; Simular o Aturar queda com a acció principal al final.
20. Desar baixa un JSON v1 local que es pot tornar a obrir; l’obertura rebutja fitxers malformats i no transmet circuits a cap servidor.
21. Nou i Obrir protegeixen contra la substitució accidental d’un circuit amb components; Desfer/Refer recupera els canvis del circuit.
22. Zoom i Pan afecten només la vista del workspace, i Baixar PNG produeix una imatge del workspace en la vista actual.
23. Components, cables i nodes es poden seleccionar i eliminar amb Supr/Backspace; les eliminacions es poden recuperar amb Desfer. Eliminar un node elimina els seus trams incidents.
24. Es pot seleccionar un cable, afegir-hi un node d’edició i arrossegar aquest node o un node existent per allargar o redistribuir els cables sense perdre la continuïtat de les branques.
25. Durant SIMULAR, els punts dels cables alternen el sentit segons la fase del seu corrent i es mouen més ràpid quan augmenta la intensitat. Les branques paral·leles mostren els seus propis corrents i el cable comú representa la suma fasorial. El ritme visual alentit queda indicat a la interfície.
26. Els cables amb corrent nul no mostren punts; canviar valors o interruptors actualitza el moviment immediatament i ATURAR elimina l’animació. En bucles redundants de cables ideals, els trams amb corrent no únic no s’animen i el hover explica la indeterminació.
27. El Scope mostra els pics sencers tant a la targeta compacta com ampliada. El zoom temporal − / + / Auto canvia la durada visible sense afectar el circuit, indica la finestra en ms i Auto restaura dos períodes; tensió i corrent es distingeixen també en fase i les seves escales verticals pròpies queden identificades.
28. Fasors mostra fletxes i etiquetes, escala comuna per a les tensions i escala pròpia per als corrents, arc φ i la relació avançat/endarrerit/en fase. Els casos amb V o I nul no mostren un angle fictici. Els colors coincideixen amb el Scope, els valors es deriven del mateix resultat i el gràfic s’ajusta a la targeta compacta o ampliada.

## 13. Regla d’interpretació per al desenvolupament

Quan un detall d’implementació no estigui especificat, triar la solució més simple que preservi els objectius, els límits, les fórmules i els criteris d’acceptació d’aquest document. No convertir els exemples de presentació en nous requisits funcionals. No afegir funcionalitats perquè siguin habituals en altres simuladors. Si una decisió imprescindible no es pot deduir sense ampliar l’abast, deixar-la assenyalada perquè es decideixi explícitament.
