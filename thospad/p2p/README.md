# Prova de Mur compartit

Obre `thospad/p2p/` per HTTPS o amb un servidor local a `localhost`. Els quatre dispositius necessiten una mateixa adreça HTTPS accessible. Aquesta pàgina és independent de l’editor publicat de THOSPAD.

1. Crea una targeta de text, prem **Comparteix** i copia l’enllaç als altres participants.
2. Proveu d’escriure alhora en una mateixa targeta, d’entrar tard, de desconnectar i reconnectar, i de continuar després que surti qui ha creat la sala.
3. Descarrega el fitxer `.thospad` amb **Desa**. A la mateixa pàgina de prova, **Obre** recupera una còpia editable i **Comparteix** genera una invitació nova.

Les dades es desen a IndexedDB. Trystero fa servir relés públics per establir les connexions i WebRTC per enviar els canvis. Els relés poden observar metadades de connexió. L’enllaç conté la clau de la sala i dona permís d’edició. **Surt de la sala** desconnecta aquest navegador. Per canviar qui té accés, inicia una sala nova i envia l’enllaç només als participants nous. Conserva una còpia del fitxer quan tothom marxi.

Prototip per a targetes de text. El fitxer d’aquesta prova s’obre en aquesta mateixa pàgina. La compatibilitat amb l’editor principal, les imatges i la prova de quatre dispositius a la xarxa del centre són pendents.

Per regenerar el paquet estàtic, executa `npm ci` i `npm run build` dins d’aquesta carpeta.
