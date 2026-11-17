# THOSBOARD

El professor crea una sessió, mostra el codi de sis xifres a la pissarra i obre un PDF. L’alumne entra automàticament amb aquest codi. La pàgina actual s’envia també als alumnes que arriben tard.

## Descoberta en mode WebRTC

Trystero 0.27.0 usa relés públics de Nostr per descobrir els participants. L’alumnat entra en mode passiu i els professors anuncien la sessió. El codi és el nom del grup de descoberta i té 1.000.000 de valors possibles. Qualsevol persona que el conegui o l’endevini pot intentar connectar-se o interferir en la descoberta.

Quan troba el primer professor, l’alumne espera dos segons per detectar possibles coincidències abans de seguir-lo. Si l’aplicació detecta una coincidència, atura la visualització i el professor pot generar un altre codi sense reobrir el PDF. La detecció depèn de les connexions que s’estableixin i pot arribar tard. En reconnectar, l’alumne conserva la identitat de Trystero que havia seleccionat. El codi per si sol no acredita la identitat del professor.

## PDF i capacitat

El professor controla el zoom, el desplaçament i el gir de la pàgina per a tota l’aula. L’alumnat segueix el mateix detall amb un ajust a la seva pantalla. Els gestos envien només els ajustos de vista sobre la imatge que ja s’ha compartit.

Es reutilitza el PDF.js de THOSPDF. La lectura es fa localment per blocs, sense límit fix de mida del fitxer. El cost depèn de la memòria disponible i de la complexitat del document. El PDF original queda al dispositiu del professor. Només s’envia la pàgina renderitzada i comprimida, amb un màxim d’1 MiB per imatge. Els receptors poden desar o capturar la pàgina que veuen.

Una aula de 30 alumnes és la referència per a les proves de rendiment. Es poden connectar més alumnes i la capacitat efectiva depèn del dispositiu, de la xarxa i de la quota de Firebase. La capacitat i la latència requereixen una prova amb l’aula. En mode WebRTC el trànsit de pàgina és directe i l’aïllament de clients, les VLAN o el bloqueig dels relés poden impedir la connexió.

## Compilació

El paquet de transport està inclòs per servir el repositori com a web estàtica. Per reconstruir-lo, executa `npm ci` i `npm run build` dins de `thosboard/`. L’aplicació requereix HTTPS o localhost.

Les anotacions i el llenç compartit es poden afegir en una fase posterior amb Yjs, usant una via de sincronització de traços independent de les imatges i definint qui pot editar el llenç.
## Connexió per defecte amb Firebase

L’adreça habitual de THOSBOARD fa servir Realtime Database amb HTTPS i peticions amb espera. Necessita Firebase Authentication amb el proveïdor anònim activat i les regles de `database.rules.json`. En un projecte amb altres dades cal integrar el bloc `thosboard` amb les regles existents. Per fer una prova comparativa amb WebRTC, obre `?transport=webrtc` tant al professor com a l’alumnat.

El codi de sis xifres dona accés de lectura a la sala a qui el conegui o l’endevini. Només qui crea la sala pot publicar-ne les pàgines, la vista i els traços. El servidor conserva només la imatge actual de cada sala. En sortir o en detectar la desconnexió del professor, Firebase elimina la sala. Mentre la pestanya del professor està oberta i connectada, renova cada cinc minuts la reserva del codi per tres hores. Si el professor perd la connexió i la sala s’elimina, ha de crear-ne una de nova.

### Neteja diària de sales

La tasca GitHub Actions «THOSBOARD · Neteja de sales» comprova cada dia a les 03.23 UTC si hi ha sales caducades des de fa almenys quinze minuts. Només actua sobre `thosboard/rooms`. Abans d’esborrar cada sala comprova que encara està caducada i condiciona l’esborrat a que Firebase conservi la mateixa versió.

Per activar-la, configura Workload Identity Federation al projecte de THOSBOARD. Restringeix el proveïdor a `dep-tecno/THOSAPPS`, `refs/heads/main` i el fitxer `.github/workflows/thosboard-cleanup.yml`. Autoritza aquesta identitat de GitHub a fer servir un compte de servei dedicat amb accés d’escriptura a Realtime Database només al projecte de THOSBOARD. Al repositori, crea les variables `THOSBOARD_WIF_PROVIDER` (nom complet del proveïdor) i `THOSBOARD_CLEANUP_SERVICE_ACCOUNT` (correu del compte de servei). Ambdues són necessàries perquè s’executi la tasca.

A GitHub Actions, usa «Run workflow» amb `dry_run` activat per veure el recompte abans d’executar una neteja real. GitHub pot desactivar els horaris dels repositoris públics després de 60 dies sense activitat.
