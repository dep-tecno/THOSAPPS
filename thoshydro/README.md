# THOSHYDRO

Simulador didàctic per a THOS APPS, projecte de J.Yerga (Institut Thos i Codina). Interfície en català. Entrada: `thoshydro/index.html`.

## Procedència

Reconstrucció nova a partir de la petició de turbines Pelton, Francis i Kaplan i alternador didàctic. La conversa «Moldear turbina hidráulica» no ha proporcionat codi ni fitxers recuperables a través de la lectura disponible. Aquesta versió no es presenta com una recuperació exacta del prototip anterior.

Visualització amb **Three.js 0.169.0**, de mrdoob i col·laboradors, i OrbitControls, sota llicència MIT. Es carreguen des de jsDelivr; cal connexió a Internet. Font i llicència: https://github.com/mrdoob/three.js/tree/r169 i https://github.com/mrdoob/three.js/blob/r169/LICENSE . La biblioteca és externa i conserva la seva llicència. El contingut propi s'integra sota les condicions generals del repositori THOSAPPS.

## Ús

1. Obre la carpeta publicada `https://tecno-apps.cat/thoshydro/` o serveix aquests fitxers amb un servidor HTTP estàtic. No cal compilació. No s'ha de fer servir `file://`, perquè es carreguen mòduls JavaScript.
2. Tria una turbina. Cada tipus carrega un exemple de salt, cabal i rendiment.
3. Canvia els controls; observa les tres potències i el moviment de l'aigua.
4. Tria «Alternador 3D» per veure l'imant giratori, la bobina fixa i l'ona de tensió normalitzada. Arrossega per orbitar i fes servir la roda per ampliar. «Centra la vista» recupera la càmera.
5. «Pausa» atura l'animació. «Reinicia» recupera l'exemple del tipus seleccionat. Amb preferència de moviment reduït s'inicia en pausa.

## Abast i limitacions

- Pelton: raig tangencial i cassoletes dobles esquemàtiques. Francis: cambra espiral, distribuïdor i canvi de flux radial a axial. Kaplan: hèlix amb angle de pales ajustable i flux axial.
- Potència hidràulica: `P = 1000 · 9,81 · Q · H`, en watts, amb Q en m³/s i H en metres. Potència a l'eix: `P · ηt`. Potència elèctrica estimada: `P · ηt · 0,90`.
- Salt i cabal són entrades independents; no es calcula una instal·lació ni una corba real de rendiment. Els intervals són exemples de classe, no límits universals de les turbines.
- L'angle Kaplan canvia la geometria però no recalcula el rendiment. Aquest s'ajusta de manera independent i explícita.
- La velocitat visual depèn de salt i cabal relatius a l'exemple i està alentida. No representa rpm reals ni una xarxa de 50 Hz. No hi ha inèrcia, regulador, càrrega, cavitació ni simulació de fluids.
- Alternador d'una parella de pols amb imant permanent i bobina fixa. El flux és proporcional a `cos(θ)` i la tensió induïda a `sin(θ)`. Ona normalitzada, sense escala en volts; no és un model elèctric de circuit. Amb cabal nul, el model s'atura i mostra tensió nul·la. La pausa conserva la fase de l'ona com una congelació de la visualització.
- No es recullen dades, no hi ha persistència ni autenticació pròpia. No s'han modificat l'índex, les altres aplicacions, les rutes existents ni la configuració del repositori.
- Comprovacions de sintaxi, càlcul i estructura fetes sense navegador. La revisió visual i interactiva correspon a l'usuari.
