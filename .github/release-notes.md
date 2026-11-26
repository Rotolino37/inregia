## Installazione

1. Scarica **InRegia-Setup** (il file .exe qui sotto) e avvialo.
2. Scegli la cartella (predefinita: `C:\Program Files\InRegia`) e i componenti:
   - **Motore di conversione LibreOffice**: circa 350 MB da scaricare. Se sul PC c'è PowerPoint, è PowerPoint a convertire le slide; LibreOffice resta come riserva.
   - **Musica di sottofondo**: 7 generi, oltre un'ora ciascuno (Lofi Chill, Lounge, Ambient, Pianoforte, Acustico, Corporate, Cinematico), circa 37 MB per genere.
3. L'installer scarica tutto, crea il collegamento sul desktop e la voce nel menu Start. Disinstallazione da Impostazioni di Windows > App.

Chi ha una beta: dalla beta 2 in poi basta "Aggiorna" in Impostazioni > Aggiornamenti; dalla beta 1 si installa sopra. Presentazioni e musica aggiunta restano.

## Cosa fa InRegia

- **Presentazioni PowerPoint dal vivo**: importi il .pptx (trascinandolo o scegliendolo) e lo presenti con relatore e proiettore separati. Slide fedeli all'originale: con PowerPoint installato le converte PowerPoint stesso; con LibreOffice InRegia fornisce al motore i font del documento (font cloud di Microsoft 365, installati per utente, incorporati nel file, aggiunti a mano) e segnala quelli introvabili.
- **Transizioni e animazioni**: morph, transizioni (dissolvenza, spinta, ruota, veneziane, scacchiera, tende e altre), animazioni per paragrafo, percorsi di movimento, rotazione, ingrandimento, trasparenza. Tabella completa nel [README](https://github.com/Rotolino37/inregia#powerpoint-compatibility).
- **Proiettore**: si apre solo quando premi "Proietta" (F5), dopo aver scelto lo schermo; resta sempre in primo piano. Esc lo spegne. Lucchetto per bloccare lo schermo del pubblico.
- **Video e audio**: non partono mai da soli; Play con un clic, anteprima del video nel relatore, avviso se passi oltre un video non avviato.
- **Regia audio**: mixer con fader fino a +12 dB, VU meter, equalizzatore a 10 bande con 21 stili, musica di sottofondo con coda, dissolvenza incrociata e abbassamento automatico durante i video.
- **Musica**: predefinita (7 generi, filtro per genere), globale e per presentazione, con trascinamento dei file.
- **Aggiornamenti con un clic** per InRegia e LibreOffice, solo se acconsenti al controllo.

## Limiti noti

- Se i file non sono ancora firmati digitalmente, Windows può mostrare "PC protetto da Windows": scegli "Ulteriori informazioni" e poi "Esegui comunque".
- Senza PowerPoint, LibreOffice può impaginare in modo leggermente diverso testi molto lunghi o con adattamento automatico. Non supportati: cambi di colore nelle animazioni di enfasi, trigger (clic su una forma), animazioni per parola o lettera (animate come blocco unico).

Verifica dei file: `SHA256SUMS.txt`.

Code signing policy: [CODE_SIGNING_POLICY.md](https://github.com/Rotolino37/inregia/blob/main/CODE_SIGNING_POLICY.md). Privacy: InRegia non raccoglie né invia dati; si collega a internet solo per scaricare i componenti scelti e, se lo consenti, per controllare gli aggiornamenti (GitHub e The Document Foundation).
