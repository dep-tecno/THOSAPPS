# THOSMOTION

Simulador didàctic amb motor ideal, manovella manual, eixos, suports, transmissions i mecanismes de transformació. L’APP i tots els seus recursos són dins `thosmotion/`; `../thosmotion.html` conserva l’entrada pública i carrega `index.html`. No necessita dependències ni servidor per a l’ús local.

## Model

Coordenades del món en mm, X cap a la dreta i Y cap avall. Angles en radians, positius en sentit antihorari. El renderer inverteix l'angle SVG. Radi primitiu = mòdul × dents / 2. Contacte admès dins de 0,6 mm; snap dins de 9 mm. Motors i engranatges poden muntar-se coaxialment sobre un eix; tots els components del mateix eix comparteixen velocitat i sentit. Dos engranatges es connecten per contacte exterior amb mòdul igual.

La manovella manual es connecta a un eix o component rotatiu pel centre. Amb la simulació pausada, arrossegar-ne la nansa modifica l'angle i el propaga pel graf cinemàtic; la posició angular es conserva al projecte.

El suport o punt fix s'ajusta al centre d'un eix o component rotatiu i representa la seva unió al bastidor. La connexió és estructural: es desa i es revalida geomètricament, però no transmet moviment entre components.

Les politges defineixen el diàmetre en mm. La corretja oberta conserva el sentit; la creuada l'inverteix. El solver ideal aplica `n1 × D1 = n2 × D2`, sense lliscament. Les corretges són connexions serialitzades explícites i es poden crear entre dues politges separades: selecciona la primera, activa el tipus de corretja i clica la segona.

Els pinyons de cadena defineixen el nombre de dents i el pas en mm. Una cadena només pot unir dos pinyons del mateix pas que no se superposin. El solver ideal conserva el sentit i aplica `n1 × Z1 = n2 × Z2`. La cadena és una connexió serialitzada explícita que es conserva quan es mouen els pinyons mentre continuïn separats i compatibles.

Les rodes de fricció defineixen el diàmetre en mm i es connecten automàticament per contacte tangent. El solver ideal ignora el lliscament, inverteix el sentit i aplica `n2 = −n1 × D1 / D2`. Separar-les o fer-les interferir elimina el contacte.

El cargol sense fi defineix el nombre d'entrades i el mòdul; la corona defineix les dents i el mateix mòdul. El solver ideal aplica `n_corona = n_cargol × entrades / dents`. La connexió és explícita i es manté mentre les dues peces siguin compatibles i no se superposin.

La cremallera horitzontal es connecta a un engranatge del mateix mòdul quan la seva línia primitiva queda a una distància igual al radi primitiu. El solver transforma la velocitat angular en lineal amb `v = ω × r`; el signe depèn de si la cremallera és damunt o sota el pinyó. El moviment lineal s'expressa en mm/s i s'anima com una translació.

La biela-manovella és un conjunt funcional connectable a motor o eix. El radi de la manovella `R` i la longitud de la biela `L` són editables amb `L > R`. La corredera segueix la geometria ideal `x = R cos θ + √(L² − R² sin² θ)` i la cursa total és `2R`.

La lleva-seguidor utilitza una lleva circular excèntrica connectable a motor o eix. El radi base `R` i l'excentricitat `e` són editables amb `e ≤ R`. El seguidor vertical té un alçament ideal entre `0` i `2e`.

La biblioteca de components ocupa un panell dret plegable, agrupat per famílies. En seleccionar una peça, el mateix panell mostra les propietats contextuals; «← Components» torna al catàleg. En pantalles estretes el panell se superposa al llenç.

La barra superior agrupa els instruments en quatre icones amb submenús: rotació (tacòmetre i comptador de voltes), angle (mesurador angular), moviment lineal (velocitat i desplaçament) i temps (cronòmetre). Cal seleccionar un component compatible abans d’afegir una mesura, excepte el cronòmetre. Les lectures s’actualitzen en targetes compactes superposades al llenç que es poden arrossegar des de qualsevol zona lliure de botons sense moure el mecanisme. Cada família té una forma pròpia: circular per a rotació, falca per a angle, rectangular allargada per a moviment lineal i silueta de cronòmetre per a temps. Els instruments són estat temporal de la interfície i no formen part del JSON del projecte.

«Traça de moviment» registra fins a 800 mostres per recorregut i dibuixa una línia semitransparent darrere del mecanisme. Permet seguir el passador o la corredera de la biela-manovella, un punt de la cremallera i l’extrem del seguidor de la lleva. El menú permet aturar o reprendre el registre, canviar els colors i esborrar totes les traces. Les traces són temporals i no formen part del JSON.

Els exemples `Traça · biela-manovella` i `Traça · cremallera i lleva` carreguen els mecanismes amb les traces ja activades. Només cal prémer ▶: el primer compara el recorregut circular del passador amb el lineal de la corredera; el segon compara els desplaçaments lineals de la cremallera i del seguidor de la lleva.

«Exporta PNG» genera una imatge a doble resolució de la vista actual del llenç. Inclou el muntatge, les traces, les dades visibles i les formes dels instruments, però omet els botons de zero i tancament perquè la captura quedi neta.

## Noves famílies de components

La biblioteca incorpora vuit conjunts o components, cadascun amb un exemple al grup «Noves famílies» del selector:

| Família | Model i límits |
|---|---|
| Engranatge interior | Corona i engranatge recte del mateix mòdul; distància de centres `rCorona − rPinyó` i relació positiva `n2/n1 = Z1/Z2`. La corona ha de tenir més dents. El perfil és simplificat i no analitza interferències industrials de dentat. |
| Engranatge cònic | Parell amb mòdul igual, un eix a 0° i l’altre a 90°, i relació per dents; connexió per contacte en una projecció didàctica 2D. Els signes representen la convenció angular del model. No és un model geomètric 3D. |
| Quatre barres | Conjunt manovella-biela-balancí amb dos pivots fixos. La intersecció de dues circumferències determina l’articulació de sortida i conserva les quatre longituds. Exigeix volta completa de la manovella sense punts singulars; dimensions impossibles bloquegen només el conjunt connectat. |
| Palanca | Barra rígida amb fulcre, braços d’entrada i sortida editables. Relació de desplaçaments verticals `−braçSortida/braçEntrada` i avantatge mecànic ideal recíproc. L’exemple s’acciona arrossegant la nansa de la manovella manual. |
| Politja fixa | Conjunt amb torn ideal d’entrada i un tram portant: alçament de càrrega igual a la corda recollida, avantatge ideal 1. |
| Politja mòbil | Conjunt amb torn i politja mòbil; dos trams portants: la càrrega recorre la meitat de la corda recollida, avantatge ideal 2. |
| Polispast | Entre dues i quatre parelles de politges: `N = 2 × parelles`, càrrega `s/N`, avantatge ideal `N`. El nombre de politges dibuixades correspon a les parelles. |
| Diferencial simplificat | Entrada i dues sortides internes amb repartiment imposat: `nA = nEntrada × factorA`, `nB = nEntrada × (2 − factorA)`, amb factor entre 0 i 2. Conserva `(nA+nB)/2 = nEntrada`. No resol el repartiment segons càrregues i no permet connectar externament les dues sortides. |

Les politges d’elevació utilitzen corda ideal inextensible i un torn de radi `R` que recull `s = Rθ`. La separació inicial situa la càrrega; és un model de relacions sense topalls de recorregut, pesos, tensions ni col·lisions. Els exemples giren lentament i cal pausar o reiniciar en arribar a l’extrem de la representació. La politja de transmissió ja existent continua disponible a la família «Transmissió».

El menú de rotació afegeix tacòmetres per a les sortides A/B del diferencial i per al balancí de quatre barres; el menú d’angle permet mesurar el balancí respecte de la posició inicial o posar-lo a zero. Els instruments lineals mostren el desplaçament vertical del punt mig de la biela, l’extrem de sortida de la palanca i la càrrega de les politges. La traça permet seguir el punt mig de la biela, l’articulació del balancí, l’extrem de la palanca o la càrrega.

`families.js` registra les definicions, propietats, geometries i dibuixos de les noves famílies. Els projectes JSON anteriors continuen sent vàlids; les noves connexions interiors i còniques es revaliden amb les mateixes regles de contacte que el solver.

Referències de les relacions ideals: [engranatges interiors, KHK](https://khkgears.net/pdf/internal-tech.pdf) i [cinemàtica de quatre barres, Mechanical Reference](https://www.mechref.org/dyn/four_bar_linkages_applications/). El solver comprova les longituds geomètriques del conjunt concret, a més de les relacions de transmissió.

## Feedback, instruments i avisos

Durant l’arrossegament, el feedback ressalta les dues peces implicades i indica contacte correcte, ajust possible, interferència o mòdul incompatible. Les toleràncies són les mateixes que al snap. En preparar una corretja, cadena o connexió cargol-corona, passar el ratolí sobre la segona peça mostra si es pot connectar i què cal corregir.

El botó ⇄ activa les fletxes de rotació i moviment lineal instantani. Les fletxes de la corredera i del seguidor canvien de sentit amb el moviment alternatiu i desapareixen en els punts de velocitat zero. Un conjunt bloquejat no mostra fletxes de moviment. Les propietats i el hover identifiquen conductor o conduït respecte de la font, inclosa la manovella manual.

Els avisos del panell dret expliquen els conjunts sense font activa, motors desactivats i conflictes. Un petit símbol ! o × identifica les peces afectades. Clicar repetidament un avís selecciona les peces del seu conjunt. Els altres conjunts poden continuar funcionant. Les ajudes són temporals i no canvien el JSON del projecte; les fletxes visibles s’inclouen al PNG.

`education.js` concentra la lògica de feedback, rols i sentits de les ajudes, separada del solver. Executa `node --test thosmotion/solver.test.cjs thosmotion/education.test.cjs` per comprovar els dos blocs.

`model.js`: biblioteca, unitats i validació; `connections.js`: geometria, snap i revalidació; `solver.js`: graf, propagació i conflictes; `renderer.js`: SVG i fases de les dents; `app.js`: interacció, historial, persistència i animació.

El solver es recalcula en editar; l'animació només integra les velocitats amb requestAnimationFrame. Cada conjunt amb conflicte queda aturat; els altres poden funcionar. Les dents tenen perfil simplificat i fase inicial de contacte coherent; no són perfils industrials.

Desa/Obre utilitza JSON versionat local. La recuperació automàtica conserva una còpia local després de cada edició; restaurar-la requereix prémer Recupera. L'historial manté com a màxim 80 snapshots per a projectes limitats a 200 components. La simulació es pausa abans d'editar. Reinicia restaura les fases inicials.

## Verificació

Executa `node --test thosmotion/solver.test.cjs thosmotion/education.test.cjs thosmotion/families.test.cjs` des de la carpeta del repositori. Les proves cobreixen les transmissions, fonts, geometria, connexions, conflictes, importació, ajudes educatives i les noves famílies.

Comprovació manual: carrega el reductor, simula, observa 120 i −60 rpm; pausa; separa Z40 (0 rpm); desfés; canvia les dents; desa i torna a obrir. Roda per fer zoom, arrossega el fons per fer pan i prem Ajusta. Navega als components amb Tab i usa fletxes o Supr.

## Abast pendent

La fita de reptes encara no està implementada. No hi ha càlcul de forces, parell ni inèrcia.

Verificació tècnica: tests del model, solver i ajudes educatives, més comprovació de sintaxi dels fitxers JavaScript. La revisió visual i interactiva al navegador la fa l'usuari. El motor coaxial es representa desplaçat amb una línia discontínua fins al centre compartit per evitar superposicions.
