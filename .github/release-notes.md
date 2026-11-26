## Installazione

1. Scarica **InRegia-Setup** (il file .exe qui sotto) e avvialo.
2. Scegli la cartella (predefinita: `C:\Program Files\InRegia`) e i componenti:
   - **Motore di conversione LibreOffice**: serve per importare i .pptx (circa 350 MB da scaricare).
   - **Musica di sottofondo**: 7 generi, oltre un'ora ciascuno (Lofi Chill, Lounge, Ambient, Pianoforte, Acustico, Corporate, Cinematico), circa 37 MB per genere. Puoi sceglierli uno per uno.
3. L'installer scarica tutto, crea il collegamento sul desktop e la voce nel menu Start. Disinstallazione da Impostazioni di Windows > App.

Chi ha la beta 1: installa sopra, presentazioni e musica aggiunta restano. Dalla beta 2 gli aggiornamenti successivi si installano dall'app con un pulsante.

Installazione offline: metti accanto all'installer `InRegia-app-win-x64.zip`, i file `InRegia-music-<genere>.zip` e il file `LibreOffice_*_Win_x86-64.msi`; verranno usati senza scaricare nulla.

## Novità

- **Proiettore**: non si apre più da solo. "Proietta" (o F5) chiede su quale schermo proiettare, con un numero grande su ogni schermo; la proiezione resta sempre in primo piano. Esc spegne il proiettore e resti sul relatore.
- **Play con un clic**: il pulsante Play del video e della musica partiva solo al secondo clic; corretto.
- **Aggiornamenti con un clic**: all'apertura la libreria controlla se c'è una nuova versione di InRegia (canale beta o stabile, a scelta) e di LibreOffice; "Aggiorna ora" scarica, verifica e installa, poi riapre InRegia.
- **Musica**: 7 generi con oltre un'ora ciascuno, nuovo genere Lofi Chill, formato Opus (stessa qualità percepita con un terzo dello spazio), filtro per genere; nel relatore i generi scelti sono quelli che entrano in coda. I generi mancanti si scaricano dalla scheda Musica.
- **Animazioni**: nuovo motore. Testo per paragrafo, percorsi di movimento, rotazione, ingrandimento, trasparenza, impulso (lo stato finale resta), ingressi e uscite con le formule originali di PowerPoint (galleggia, cresci e ruota, zoom, entrata), maschere ruota, veneziane, scacchiera, rombo, più, barre casuali, strisce.
- **Transizioni**: ruota, spicchio, veneziane, scacchiera, barre casuali, strisce, rombo, più, tende.

Le presentazioni importate con la beta 1 funzionano; con "Aggiorna" sulla scheda della presentazione ottieni le nuove animazioni. Tabella di compatibilità completa nel [README](https://github.com/Rotolino37/inregia#powerpoint-compatibility).

## Limiti noti della beta

- Se i file non sono ancora firmati digitalmente, Windows può mostrare "PC protetto da Windows": scegli "Ulteriori informazioni" e poi "Esegui comunque".
- Non supportati: cambi di colore nelle animazioni di enfasi, trigger (clic su una forma), animazioni per parola o lettera (animate come blocco unico).

Verifica dei file: `SHA256SUMS.txt`.

Code signing policy: [CODE_SIGNING_POLICY.md](https://github.com/Rotolino37/inregia/blob/main/CODE_SIGNING_POLICY.md). Privacy: InRegia non raccoglie né invia dati; si collega a internet solo per scaricare i componenti scelti e per controllare gli aggiornamenti (GitHub e The Document Foundation).
