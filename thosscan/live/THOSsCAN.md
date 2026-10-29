# THOSsCAN — Especificació del projecte
Versió 1.0 · 29/10/2026

## Objectiu
Aplicació web pròpia de Tecno-Apps per convertir PDF digitals o escanejats i imatges JPG/PNG a DOCX o XLSX editables, conservant tant com sigui possible el format i l'estructura. Nom visible: **THOSsCAN**. Ruta: `/thosscan/`.

## Principis
- Processament **100% local al navegador**, sense servidor OCR, registre, subscripció ni enviament de documents.
- Publicació estàtica a GitHub Pages, recursos i models OCR servits des de tecno-apps.cat.
- Reutilitzar biblioteques existents, sense reinventar l'OCR.
- Interfície mínima, coherent amb Tecno-Apps; **sense editor visual ni correcció intermèdia**.
- No modificar altres aplicacions del repositori.

## Entrades i sortides
Entrades: PDF digital, PDF escanejat, PDF mixt, JPG/JPEG, PNG. PDF xifrat: només amb credencials/permisos vàlids.
Sortides:
- **DOCX:** text, paràgrafs, títols, taules i imatges recuperats en la mesura possible.
- **XLSX:** taules detectades reconstruïdes com a cel·les editables; no acceptar un bolcat de text en una sola columna com a conversió satisfactòria.
La fidelitat perfecta no està garantida.

## Motor i arquitectura
Motor candidat principal: [Scribe.js](https://github.com/scribeocr/scribe.js), integrat a l'aplicació pròpia; no redirigir ni cridar el servei scribeocr.com. Verificar la versió i l'API real abans d'implementar (lectura, OCR, dades de disposició, DOCX, XLSX, gestió de recursos). Evitar dependències duplicades; afegir PDF.js, ExcelJS o OpenCV.js només si les proves demostren que calen. Comprovar disponibilitat dels models català, castellà i anglès i empaquetar els recursos necessaris al mateix domini.

## Flux d'usuari
1. Carregar/arrossegar fitxer.
2. Seleccionar idioma (català, castellà, anglès) i destinació (WORD / EXCEL).
3. Prémer **Convertir**; mostrar estat i progrés real, amb pàgines completades si l'API ho permet.
4. Mostrar **Descarregar** i **Obrir Google Drive**.
El botó Drive només obre Drive en una pestanya nova; l'usuari hi importa manualment el fitxer. Sense OAuth ni API de Google.

## Reconstrucció i qualitat
- PDF digital: prioritzar extracció directa de text; OCR només quan calgui.
- Imatges i escanejos: OCR amb idioma seleccionat.
- DOCX: reconstruir contingut i estils tant com permetin les dades disponibles.
- XLSX: validar files, columnes, capçaleres, valors i cel·les combinades.
- Fotografies inclinades o de baix contrast: estudiar preprocessament només si millora la precisió.
- No prometre que la simple exportació DOCX/XLSX conserva automàticament taules, imatges i maquetació.

## Documents llargs i rendiment
Proves de 1, 5, 25 i 50 pàgines. Limitar concurrència i memòria; estudiar processament per pàgines/lots, alliberament de recursos i recuperació d'errors segons les capacitats verificades de l'API. Mostrar errors reals i evitar percentatges simulats. No afirmar compatibilitat amb 50 pàgines sense provar-la.

## Seguretat, autoria i llicències
- No pujar ni conservar documents al servidor; validar fitxers i alliberar memòria.
- Reconeixement visible de **Scribe.js** i dels seus autors/col·laboradors, amb enllaç al [repositori oficial](https://github.com/scribeocr/scribe.js).
- Scribe.js es distribueix sota **GNU AGPL-3.0**. Abans de publicar, revisar la compatibilitat de l'aplicació combinada, conservar avisos de copyright, incloure el text de llicència, facilitar el codi font corresponent i identificar modificacions del codi original si n'hi ha.
- Revisar també llicències de models OCR i altres dependències.
- Peu de pàgina previst: **© Tecno-Apps · THOSsCAN · Codi obert i llicències**, amb accés als avisos, repositoris i llicències.
- Fitxers previstos: `LICENSE` (llicència aplicable un cop validada) i `THIRD_PARTY_NOTICES.md` (atribucions i llicències de tercers).
- **No publicar** fins a verificar el compliment de totes les llicències.

## Fases i criteris d'acceptació
1. **Integració:** estructura, Scribe.js, models locals, OCR real amb JPG/PNG.
2. **Word:** PDF digital/escanejat a DOCX editable; verificar text, paràgrafs i imatges.
3. **Excel:** taula escanejada a XLSX amb files/columnes/cel·les correctes.
4. **Rendiment:** provar documents de 25 pàgines sense bloquejos a l'entorn de referència; estudiar 50 pàgines.
5. **Publicació:** disseny Tecno-Apps, enllaç a la portada, comprovació de privacitat i llicències.

## Proves mínimes
JPG amb text català; PNG escanejat; PDF digital; PDF escanejat; PDF amb taula; PDF de 25 pàgines; prova de 50 pàgines; importació DOCX a Google Docs i XLSX a Google Sheets; verificació de xarxa per comprovar que els documents no s'envien fora.

## Regles de desenvolupament
No reinventar OCR. No afegir editor. No modificar altres apps. No incorporar funcions no acordades. No donar per verificades API o funcionalitats sense proves. Documentar limitacions i errors. Prioritzar simplicitat, qualitat de conversió i privacitat.
