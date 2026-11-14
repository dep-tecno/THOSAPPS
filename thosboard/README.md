# THOSBOARD

El professor crea una sessió, mostra el codi de sis xifres a la pissarra i obre un PDF. L’alumne entra automàticament amb aquest codi. La pàgina actual s’envia també als alumnes que arriben tard.

## Descoberta i identificació

Trystero 0.27.0 usa relés públics de Nostr per descobrir els participants. L’alumnat entra en mode passiu i els professors anuncien la sessió. El codi és el nom del grup de descoberta i té 1.000.000 de valors possibles. Qualsevol persona que el conegui o l’endevini pot intentar connectar-se o interferir en la descoberta.

Quan troba el primer professor, l’alumne espera dos segons per detectar possibles coincidències abans de seguir-lo. Si l’aplicació detecta una coincidència, atura la visualització i el professor pot generar un altre codi sense reobrir el PDF. La detecció depèn de les connexions que s’estableixin i pot arribar tard. En reconnectar, l’alumne conserva la identitat de Trystero que havia seleccionat. El codi per si sol no acredita la identitat del professor.

## PDF i capacitat

El professor controla el zoom, el desplaçament i el gir de la pàgina per a tota l’aula. L’alumnat segueix el mateix detall amb un ajust a la seva pantalla. Els gestos envien només els ajustos de vista sobre la imatge que ja s’ha compartit.

Es reutilitza el PDF.js de THOSPDF. La lectura es fa localment per blocs, sense límit fix de mida del fitxer. El cost depèn de la memòria disponible i de la complexitat del document. El PDF original queda al dispositiu del professor. Només s’envia la pàgina renderitzada i comprimida, amb un màxim d’1 MiB per imatge. Els receptors poden desar o capturar la pàgina que veuen.

Una aula de 30 alumnes és la referència per a les proves de rendiment. Es poden connectar més alumnes i la capacitat efectiva depèn del dispositiu i de la xarxa. Cada alumne pot tenir un enviament en curs i rep la versió més recent quan aquest acaba. La capacitat i la latència requereixen una prova amb l’aula. El trànsit de pàgina va per WebRTC directe, sense TURN ni servidor propi. L’aïllament de clients, les VLAN o el bloqueig dels relés poden impedir la connexió.

## Compilació

El paquet de transport està inclòs per servir el repositori com a web estàtica. Per reconstruir-lo, executa `npm ci` i `npm run build` dins de `thosboard/`. L’aplicació requereix HTTPS o localhost.

Les anotacions i el llenç compartit es poden afegir en una fase posterior amb Yjs, usant una via de sincronització de traços independent de les imatges i definint qui pot editar el llenç.
