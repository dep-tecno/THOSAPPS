# THOSBOARD

El professor crea una sessió, mostra el codi de quatre xifres i el seu identificador a la pissarra i obre un PDF. L’alumne entra amb el codi, confirma l’identificador que veu a la pissarra i es connecta automàticament. La pàgina actual s’envia també als alumnes que arriben tard.

## Descoberta i identificació

Trystero 0.27.0 usa relés públics de Nostr per descobrir els participants. L’alumnat entra en mode passiu i els professors anuncien la sessió. El codi és el nom del grup de descoberta i té 10.000 valors possibles. Qualsevol persona que el conegui o l’endevini pot intentar connectar-se o interferir en la descoberta.

Si es detecten dos professors amb el mateix codi, es mostra un avís. Cada professor pot generar un altre codi sortint i creant una sessió nova. L’alumne selecciona el professor amb els primers 14 caràcters de la identitat efímera que verifica Trystero. En connectar-se, es conserva la identitat completa mentre dura la sessió de l’alumne. La confirmació visual és necessària perquè el navegador pugui associar la clau amb el professor de l’aula. L’identificador permet seleccionar la sessió correcta. Amb la connexió automàtica, els participants que la puguin localitzar i identificar poden rebre les pàgines. La detecció de col·lisions depèn de les connexions que efectivament s’estableixin i no reserva globalment el codi.

## PDF i capacitat

Es reutilitza el PDF.js de THOSPDF. La lectura es fa localment per blocs, sense límit fix de mida del fitxer. El cost depèn de la memòria disponible i de la complexitat del document. El PDF original queda al dispositiu del professor. Només s’envia la pàgina renderitzada i comprimida, amb un màxim d’1 MiB per imatge. Els receptors poden desar o capturar la pàgina que veuen.

Una aula de 30 alumnes és la referència per a les proves de rendiment. Es poden connectar més alumnes i la capacitat efectiva depèn del dispositiu i de la xarxa. Cada alumne pot tenir un enviament en curs i rep la versió més recent quan aquest acaba. La capacitat i la latència requereixen una prova amb l’aula. El trànsit de pàgina va per WebRTC directe, sense TURN ni servidor propi. L’aïllament de clients, les VLAN o el bloqueig dels relés poden impedir la connexió.

## Compilació

El paquet de transport està inclòs per servir el repositori com a web estàtica. Per reconstruir-lo, executa `npm ci` i `npm run build` dins de `thosboard/`. L’aplicació requereix HTTPS o localhost.

Les anotacions i el llenç compartit es poden afegir en una fase posterior amb Yjs, usant una via de sincronització de traços independent de les imatges i definint qui pot editar el llenç.
