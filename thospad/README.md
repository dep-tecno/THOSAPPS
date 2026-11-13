# THOSPAD

Taulers d’aula en català per recollir idees, agrupar aportacions, comparar informació, ordenar fets i situar llocs. El mateix tauler pot canviar de modalitat i conserva totes les publicacions.

En crear un PAD es tria una de cinc tipologies. Als PADS creats com a Mur, el selector **Format** ofereix Mur, Taula, Files, Llista, Columnes i Forma lliure. Les altres tipologies obren la seva vista pròpia. En Forma lliure, arrossega les targetes amb el botó **Mou** o selecciona’l i prem les fletxes. Les posicions es desen al navegador.

## Primera versió

`thospad/index.html` és el punt d’entrada, amb CSS i JavaScript estàtic. Obre directament `thospad/index.html` o serveix el repositori per HTTP. El tauler d’exemple inclou contingut per provar les cinc vistes. El mapa actual situa punts en una graella de coordenades sense cartografia de base.

`store.js` concentra el model inicial i la persistència. El prototip desa títol, descripció i modalitat del tauler, i text, columna, data i coordenades de cada publicació. El desament usa un únic document JSON versionat a `localStorage`. Es manté entre recàrregues al mateix navegador i origen. Les pestanyes amb el mateix tauler obert poden sobreescriure els canvis de les altres. Les dades de la prova són accessibles al perfil local del navegador. Fes servir dades fictícies si el dispositiu és compartit.

## Col·laboració i identitat

El frontend pot continuar essent estàtic. Quan estigui disponible el registre comú de THOSAPPS, THOSPAD consumirà la seva sessió. El servidor de THOSPAD haurà de verificar la identitat amb el mecanisme que defineixi aquest registre i obtenir-ne un identificador estable. El prototip actual no demana cap compte ni credencial.

Professorat i alumnat podran crear taulers i participar segons els permisos de cadascun. El rol de propietari, editor, col·laborador o lector serà propi del tauler. Els taulers compartits començaran amb accés privat, amb invitacions revocables i validació de permisos al servidor en cada lectura i escriptura. El rol de col·laborador permetrà publicar i comentar. Cal concretar amb el registre comú qui pot convidar altres persones i quins controls de moderació necessita el centre.

## Persistència i sincronització compartides

- Separar taulers, membres, publicacions i comentaris en entitats amb identificadors estables. Afegir autor i revisió per entitat, amb índex per tauler. Desar el mínim d’identitat necessari per atribuir i moderar aportacions.
- Evolucionar el contracte asíncron de desament cap a una API d’operacions individuals. El servidor assignarà un cursor als canvis de cada tauler. El client recuperarà deltes en obrir-lo, recuperar el focus o reconnectar, i podrà fer consultes espaiades mentre sigui visible. Paginació i índexs limitaran les lectures. Les connexions en temps real es poden valorar quan es conegui la concurrència real.
- Validar revisions per detectar edicions simultànies. Fer servir identificadors d’operació per repetir escriptures sense duplicar-les. Els esborrats s’han d’incloure als deltes. Si cal oferir edició sense connexió, afegir una cua local a IndexedDB amb política de neteja i amb conflictes visibles.
- Comparar una API petita amb SQL gestionat i un servei documental, inclòs Firebase si encaixa amb el registre i els requisits. Estimar lectures i escriptures amb un pilot d’aula, volum d’emmagatzematge i trànsit, còpies, límits i cost mensual amb càrrega normal i de pic. La identitat i la base de dades es poden triar per separat.
- Abans d’obrir un pilot amb alumnat, acordar ubicació de les dades, retenció, eliminació, exportació i còpies. Limitar la telemetria al mínim operatiu i evitar text de publicacions als registres del servidor. Si s’afegeix cartografia de tercers, valorar llicència, cost i dades de connexió exposades. Evitar cercar o desar la ubicació personal de l’alumnat.

## Decisions pendents

Contracte de sessió compartida, permisos i moderació, proveïdor i pressupost, política de retenció, cartografia de base i incorporació al catàleg del portal. L’edició i l’esborrat de publicacions, els comentaris i les invitacions formen part dels increments següents.
