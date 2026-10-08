# THOSMOTION — primera fita

Prototip del document THOSMOTION.md amb motor ideal, manovella manual, eixos i suports explícits, engranatges rectes, trens compostos, politges, corretges, rodes de fricció, pinyons de cadena, cadenes, cargol sense fi i corona, pinyó-cremallera, biela-manovella i lleva-seguidor. Obre `../thosmotion.html` en un navegador; no necessita dependències ni servidor. També es pot servir en un allotjament estàtic amb la carpeta `thosmotion/` al costat del fitxer HTML.

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

La barra superior agrupa els instruments en quatre icones amb submenús: rotació (tacòmetre i comptador de voltes), angle (mesurador angular), moviment lineal (velocitat i desplaçament) i temps (cronòmetre). Cal seleccionar un component compatible abans d’afegir una mesura, excepte el cronòmetre. Les lectures s’actualitzen en targetes compactes al panell dret i no afegeixen text al llenç. Els instruments són estat temporal de la interfície i no formen part del JSON del projecte.

`model.js`: biblioteca, unitats i validació; `connections.js`: geometria, snap i revalidació; `solver.js`: graf, propagació i conflictes; `renderer.js`: SVG i fases de les dents; `app.js`: interacció, historial, persistència i animació.

El solver es recalcula en editar; l'animació només integra les velocitats amb requestAnimationFrame. Cada conjunt amb conflicte queda aturat; els altres poden funcionar. Les dents tenen perfil simplificat i fase inicial de contacte coherent; no són perfils industrials.

Desa/Obre utilitza JSON versionat local. La recuperació automàtica conserva una còpia local després de cada edició; restaurar-la requereix prémer Recupera. L'historial manté com a màxim 80 snapshots per a projectes limitats a 200 components. La simulació es pausa abans d'editar. Reinicia restaura les fases inicials.

## Verificació

Executa `node --test thosmotion/solver.test.cjs` des de la carpeta principal. Els tests cobreixen relacions, eix motor, manovella manual, suport estructural, desconnexió, propietats, mòduls, conflictes, cicles, components independents, importació, politges i corretges, rodes de fricció, pinyons i cadenes, cargol sense fi i corona, pinyó-cremallera, biela-manovella i lleva-seguidor.

Comprovació manual: carrega el reductor, simula, observa 120 i −60 rpm; pausa; separa Z40 (0 rpm); desfés; canvia les dents; desa i torna a obrir. Roda per fer zoom, arrossega el fons per fer pan i prem Ajusta. Navega als components amb Tab i usa fletxes o Supr.

## Abast pendent

La fita de reptes encara no està implementada. No hi ha càlcul de forces, parell ni inèrcia.

Verificació tècnica actual: 41 tests del model i el solver superats, més comprovació de sintaxi dels fitxers JavaScript. La revisió visual i interactiva al navegador la fa l'usuari. El motor coaxial es representa desplaçat amb una línia discontínua fins al centre compartit per evitar superposicions.
