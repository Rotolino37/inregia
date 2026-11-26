## Installazione

1. Scarica **InRegia-Setup-v2026.12-beta.1.exe** e avvialo.
2. Scegli la cartella (predefinita: `C:\Program Files\InRegia`) e i componenti:
   - **Motore di conversione LibreOffice**: serve per importare i .pptx (circa 350 MB da scaricare).
   - **Musica di sottofondo predefinita**: 9 brani originali in 6 generi (circa 35 MB).
3. L'installer scarica tutto, crea il collegamento sul desktop e la voce nel menu Start. Disinstallazione da Impostazioni di Windows > App.

Installazione offline: metti accanto all'installer `InRegia-app-win-x64.zip`, `InRegia-music-default.zip` e il file `LibreOffice_*_Win_x86-64.msi`; verranno usati senza scaricare nulla.

## Novità di questa beta

- Libreria iniziale: importa presentazioni trascinando i file .pptx o scegliendoli dal computer.
- Musica su tre livelli: predefinita, globale (tutte le presentazioni), della singola presentazione. Aggiunta con trascinamento o selezione multipla.
- Video visibile in diretta nell'anteprima del relatore; proiezione anche su un solo schermo (Esc per tornare al relatore).
- Corretto: video che sembravano non partire con il proiettore chiuso; la finestra del proiettore non viene più sospesa.
- Nuova interfaccia, scorciatoie da tastiera, cursori del mixer anche con tastiera.

## Limiti noti della beta

- I file non sono ancora firmati digitalmente: Windows può mostrare "PC protetto da Windows". Scegli "Ulteriori informazioni" e poi "Esegui comunque". La firma tramite SignPath Foundation è in fase di richiesta.
- Le animazioni di PowerPoint sono riprodotte con effetti equivalenti; percorsi ed effetti di enfasi diventano una pulsazione.

Verifica dei file: `SHA256SUMS.txt`.

Code signing policy: [CODE_SIGNING_POLICY.md](https://github.com/Saggiaa/inregia/blob/main/CODE_SIGNING_POLICY.md). Privacy: InRegia non raccoglie né invia dati; si collega a internet solo per scaricare i componenti scelti.
