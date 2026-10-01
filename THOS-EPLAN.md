# THOS-EPLAN v0.1

Editor local de plànols en català. Dibuix de parets amb gruix i mesures, portes i finestres vinculades a les parets, desplaçament d'elements, sentit d'obertura de portes, desfer/refés, quadrícula, zoom i centrat. Imatge de referència amb amplada real i opacitat. Importació/exportació JSON i exportació PNG de la vista actual.

No envia projectes ni imatges a cap servidor. Cal desar el fitxer JSON abans de tancar. La imatge queda inclosa en el fitxer de projecte.

Limitacions: parets independents sense unions constructives ni edició dels extrems; sense habitacions ni cotes editables; escala de la imatge definida per amplada total; sense instal·lació elèctrica ni simulació en aquesta primera fase.

## v0.2: circuits i elements elèctrics
Barra superior amb circuits numerats de llums, endolls normals i endolls de potència. Permet afegir diversos circuits del mateix tipus. Punt de llum, interruptor, commutador i endolls s’assignen al circuit actiu; número i color apareixen al plànol. Les caixes d’empalmes són independents. Els elements es poden seleccionar, moure i eliminar. Tot queda inclòs al JSON local; els projectes v0.1 continuen obrint-se.

La pertinença a un circuit no dibuixa connexions ni simula el cablejat. Els símbols són representacions educatives d’aquesta primera versió.

Verificat amb Edge: assignacions, múltiples circuits, caixes independents, moviment, desfer/refés, JSON, projectes antics, referències invàlides, mides petites i regressió de portes/finestres i mesures.
