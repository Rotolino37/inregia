## Installazione

1. Scarica **InRegia-Setup** (il file .exe qui sotto) e avvialo.
2. Scegli la cartella (predefinita: `C:\Program Files\InRegia`) e i componenti:
   - **Motore di conversione LibreOffice**: circa 350 MB da scaricare. Se sul PC c'è PowerPoint, è quest'ultimo a convertire le slide; LibreOffice resta come riserva.
   - **Musica di sottofondo**: 7 generi, oltre un'ora ciascuno (Lofi Chill, Lounge, Ambient, Pianoforte, Acustico, Corporate, Cinematico), circa 37 MB per genere.
3. L'installer scarica tutto, crea il collegamento sul desktop e la voce nel menu Start.

Chi ha la beta 2: in Impostazioni > Aggiornamenti premi "Aggiorna", oppure installa sopra. Chi ha la beta 1: installa sopra. Presentazioni e musica aggiunta restano.

## Novità della beta 3

- **Fedeltà delle slide**: se PowerPoint è installato, le slide vengono convertite da PowerPoint stesso, identiche a come le vedi in PowerPoint. Se qualcosa non va, subentra LibreOffice in automatico.
- **Font corretti anche con LibreOffice**: InRegia fornisce al motore i font del documento che Windows non ha installati: font cloud di Microsoft 365 (per esempio Aptos e Montserrat), font installati solo per l'utente, font incorporati nel .pptx, font aggiunti in Impostazioni > Font. Prima LibreOffice li sostituiva (per esempio il tag #MMNRT appariva con un altro carattere).
- **Font mancanti segnalati**: se un font non si trova da nessuna parte, la scheda della presentazione lo dice e offre "Aggiungi font".

Le presentazioni già importate vanno aggiornate: premi "Importa di nuovo" (menu della scheda) per rigenerarle con i font corretti.

Novità della beta 2 (proiettore con scelta dello schermo, Play con un clic, aggiornamenti con un clic, musica in 7 generi, nuovo motore delle animazioni): vedi la [release v2026.12 beta 2](https://github.com/Rotolino37/inregia/releases/tag/v2026.12-beta.2). Tabella di compatibilità nel [README](https://github.com/Rotolino37/inregia#powerpoint-compatibility).

## Limiti noti della beta

- Se i file non sono ancora firmati digitalmente, Windows può mostrare "PC protetto da Windows": scegli "Ulteriori informazioni" e poi "Esegui comunque".
- Senza PowerPoint, LibreOffice può impaginare in modo leggermente diverso testi molto lunghi o con adattamento automatico.

Verifica dei file: `SHA256SUMS.txt`.

Code signing policy: [CODE_SIGNING_POLICY.md](https://github.com/Rotolino37/inregia/blob/main/CODE_SIGNING_POLICY.md). Privacy: InRegia non raccoglie né invia dati; si collega a internet solo per scaricare i componenti scelti e, se lo consenti, per controllare gli aggiornamenti (GitHub e The Document Foundation).
