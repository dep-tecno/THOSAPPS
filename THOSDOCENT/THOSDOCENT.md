# THOSDOCENT — Especificació funcional i tècnica

**Projecte:** Tecno-Apps · **Repositori:** `dep-tecno/THOSAPPS` · **Versió:** 1.1 · **Idioma:** català

## 1. Propòsit i límits

THOSDOCENT és una aplicació web per organitzar i dinamitzar l'aula, pensada per a professorat de diferents centres, especialitats i nivells. No duplica iEduca ni Moodle.

**Inclou:** plànols d'aula editables, importació o introducció manual d'alumnes, àlies i privacitat en projecció, distribució de llocs, equips, sorteigs i temporitzadors.

**Exclou, de moment:** assistència, incidències, qualificacions, fitxes, exàmens, rúbriques, comunicació amb famílies i integració directa amb iEduca.

**Restriccions:** sense IA, sense servidor propi ni API comercial de pagament. HTML/CSS/JavaScript allotjats estàticament a GitHub Pages. Firebase és permès, però **NO és necessari ni s'ha d'implementar a la fase 1**.

## 2. Principi fonamental: projecte local primer

La via principal de desament és **descarregar i recuperar un fitxer de projecte**. Cap usuari ha de necessitar compte, Firebase o Internet per editar un projecte després de carregar l'aplicació i els seus recursos.

- **Projecte nou:** iniciar un projecte buit o des d'una plantilla.
- **Desar projecte:** descarregar un fitxer `.thosdocent` que contingui JSON UTF-8 versionat.
- **Obrir projecte:** seleccionar un fitxer `.thosdocent`, validar-lo, previsualitzar-ne les dades i recuperar-lo.
- **Desar com:** generar un fitxer nou amb nom triat pel professor.
- **Recuperació de sessió:** còpia de treball a IndexedDB, identificada clarament com a còpia local, no com a fitxer desat.
- **Canvis pendents:** indicador de modificacions i avís abans de perdre-les. No afirmar que el fitxer del disc s'ha actualitzat quan només s'ha descarregat una còpia nova.
- **Compatibilitat:** versió d'esquema, migracions explícites i missatges clars per a fitxers incompatibles.
- **Privacitat:** el fitxer pot contenir noms d'alumnes; avisar abans d'exportar i permetre utilitzar només àlies.

Estructura conceptual mínima del fitxer:
```json
{
  "format": "thosdocent",
  "schemaVersion": 1,
  "projectId": "uuid",
  "title": "Aula 2.14 - 3r ESO A",
  "rooms": [],
  "studentGroups": [],
  "layouts": [],
  "preferences": {},
  "updatedAt": "2026-11-17T00:00:00.000Z"
}
```
Els objectes interns tindran IDs estables. No usar noms com a clau primària. Cap codi executable, credencial o configuració secreta dins del fitxer. Validar tipus, mida, valors, IDs i referències abans d'aplicar una importació; no interpretar HTML dels camps de text.

## 3. Navegació i disseny

Interfície en català, coherent amb la resta de Tecno-Apps: capçalera compacta, logotip petit, títol enllaçat a la portada, menú lateral clar, fons neutre i editor central ampli. Adaptació a ordinadors i pissarres interactives tàctils. Menú:

1. Les meves aules
2. Distribució d'alumnes
3. Equips de treball
4. Sorteigs
5. Temporitzadors

Els mòduls 3-5 s'implementaran en fases posteriors. No crear controls aparentment funcionals que no facin res.

## 4. Aules i editor visual

Separar conceptualment **aula física**, **disposició de mobiliari**, **grup d'alumnes** i **assignació d'alumnes a llocs**. Una aula pot servir per a diversos grups, i un grup pot ocupar diferents aules.

### Plantilles inicials
- Files tradicionals
- Taules per parelles
- Illes de treball
- Aula buida

Totes les plantilles són editables; es poden guardar variants amb noms com «classe ordinària», «examen» o «treball cooperatiu».

### Editor 2D
Preferir SVG o tecnologia 2D equivalent, amb coordenades normalitzades o model espacial independent de la resolució. Permetre:
- Crear, reanomenar, duplicar i eliminar aules amb confirmació.
- Afegir taula individual, taula doble, taula del professor, cadira, pissarra, porta, armari i zona lliure.
- Arrossegar, girar, duplicar, eliminar i seleccionar múltiples elements.
- Desfer/refés, zoom, centrar, quadrícula opcional i ajust a quadrícula.
- Desar posició, mida, rotació, tipus i identificador estable de cada element.
- Funcionar amb ratolí i interacció tàctil.
- Assignar places d'alumne a seients concrets sense modificar el mobiliari.

## 5. Alumnes i importació

No és un gestor acadèmic. Dades mínimes: `id`, `fullName?`, `displayName`, `alias?`. El nom real és opcional.

### Introducció manual
- Afegir, editar i eliminar alumnes individualment.
- Enganxar diversos noms, un per línia.
- Poder crear una llista només amb àlies o inicials.
- Reordenar i detectar duplicats sense fusionar-los automàticament.

### Importació de fitxers
Acceptar `.xls`, `.xlsx` i `.csv` amb lectura **íntegrament local** mitjançant una llibreria JavaScript adequada, revisada i integrada al projecte; no enviar el fitxer original a cap servei.
- Seleccionar full, fila de capçalera i columnes.
- Acceptar noms i cognoms junts o separats.
- Detectar CSV amb coma o punt i coma i gestionar codificacions habituals.
- Previsualitzar, corregir i confirmar abans d'importar.
- Ometre files buides i advertir de duplicats.
- En reimportar, mostrar coincidències, nous i absents; conservar assignacions quan la coincidència sigui fiable; demanar confirmació en casos ambigus.

## 6. Privacitat i projecció

Modes de visualització: nom complet, nom de pila, abreujat, àlies i numeració. El professor pot canviar el mode.

**La projecció ha de mostrar per defecte àlies o noms abreujats**, mai noms complets sense elecció explícita. Separar vista d'edició i vista de projecció. No exposar en projecció dades internes, restriccions, notes o noms privats. Pantalla completa, contrast i tipografia adequada per a pissarres digitals.

## 7. Distribució d'alumnes

### Manual — fase 1
Arrossegar o assignar alumnes als llocs, intercanviar dos alumnes, deixar places buides, retirar una assignació i conservar IDs estables. No permetre dues ocupacions simultànies del mateix lloc ni del mateix alumne.

### Automàtica — fase 2
Generar distribucions aleatòries sense duplicats, respectant llocs i assignacions bloquejades. Mostrar previsualització i confirmar abans de substituir la distribució vigent.

### Restriccions — fase 2
Alumnes que han de seure davant, junts, separats, llocs reservats i assignacions fixes. Algoritme local de satisfacció de restriccions, sense IA. Definir «junts» i «separats» segons proximitat entre seients. Detectar impossibilitat, explicar conflictes i no ignorar restriccions silenciosament. Historial de distribucions amb nom/data, recuperació i exportació a PDF.

## 8. Equips de treball — fase 3

Parelles, equips de 3/4/5, nombre d'equips personalitzat; generació aleatòria, edició manual, alumnes fixats, incompatibilitats, regeneració, desament, projecció i exportació. No afegir perfils acadèmics ni classificacions de rendiment.

## 9. Sorteigs — fase 3

Seleccionar un o diversos alumnes; evitar repeticions fins a completar la ronda; reiniciar, excloure temporalment i projectar. Respectar sempre el mode de nom visible.

## 10. Temporitzadors — fase 4

Cronòmetre, compte enrere, durades predefinides, temporitzador per fases, iniciar/pausar/reiniciar, avisos visuals i so opcional, pantalla completa. Calcular amb temps real transcorregut, sense dependre del nombre d'execucions del temporitzador de JavaScript quan la pestanya perd el focus.

## 11. Persistència i Firebase

**Fase 1:** fitxers `.thosdocent` i IndexedDB. Sense Firebase ni autenticació obligatòria.

**Fase posterior opcional:** integrar el registre únic existent de Tecno-Apps i, si aporta valor, Firebase per desar/sincronitzar projectes. Mai substituir el desament local. No inventar configuracions ni activar facturació. Si s'incorpora Firebase, definir regles d'accés per usuari, minimització de dades i política de conservació abans de desar informació personal d'alumnes.

## 12. Fases i criteris d'acceptació

### Fase 1 — MVP complet i autònom
Implementar:
1. Entrada a THOSDOCENT i interfície integrada.
2. Creació d'aules i quatre plantilles.
3. Editor 2D de mobiliari amb moviment i rotació.
4. Introducció manual i importació XLS/XLSX/CSV.
5. Àlies i modes de visualització.
6. Assignació manual d'alumnes a llocs.
7. Descarregar i obrir projecte `.thosdocent`.
8. Recuperació local amb IndexedDB.
9. Projecció bàsica amb privacitat per defecte.

**Acceptació:** crear aula, editar mobiliari, importar/afegir alumnes, assignar-los, descarregar projecte, tancar/reobrir i importar el fitxer recuperant exactament aula, alumnes, àlies i assignacions; projectar sense noms complets per defecte. Verificar localment amb dades fictícies. La fase 1 no depèn de Firebase.

### Fase 2 — Distribució automàtica
Aleatorietat, bloquejos, restriccions, conflictes, previsualització i historial. Només després de validació de l'usuari.

### Fase 3 — Equips i sorteigs
Generadors, restriccions bàsiques, projecció i exportació. Només després de validació.

### Fase 4 — Temporitzadors i acabats
Temporitzadors, exportació PDF, millores tàctils, robustesa i accessibilitat. Només després de validació.

## 13. Instruccions estrictes per a Codex

1. Inspecciona primer l'estructura real del repositori `dep-tecno/THOSAPPS`, les convencions visuals, rutes i mecanismes d'integració. No pressuposis carpetes ni configuracions.
2. Implementa **només la fase 1**, sense avançar les següents.
3. Mantén intactes les altres aplicacions i evita dependències globals que puguin trencar-les.
4. No introdueixis IA, backend propi ni serveis de pagament.
5. No implementis Firebase a la fase 1: desament local descarregable i recuperable primer.
6. Pots fer comprovacions locals de codi, però **no obris navegador**, no consultis GitHub Pages, no consultis `tecno-apps.cat`, ni deleguis aquestes comprovacions. **La verificació pública la fa exclusivament l'usuari.**
7. Evita commits i desplegaments repetitius innecessaris.
8. En acabar, indica fitxers modificats, funcionalitats, comprovacions locals i limitacions. Espera la validació de l'usuari abans de la fase 2.

## 14. Primera ordre de treball

**Codex:** llegeix aquest document, revisa el repositori i implementa únicament la **fase 1 de THOSDOCENT**, prioritzant l'editor d'aules, l'entrada/importació d'alumnes, els àlies, l'assignació manual i el desament/recuperació de fitxers `.thosdocent`. No utilitzis Firebase en aquesta fase. No facis comprovacions al navegador ni del domini públic. Informa del resultat i espera l'OK de l'usuari.
