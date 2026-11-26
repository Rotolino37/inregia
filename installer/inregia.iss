; InRegia - installer web (Inno Setup 6.3+)
; Scarica il programma, il motore di conversione LibreOffice e la musica predefinita.
; Installazione offline: metti accanto al setup InRegia-app-win-x64.zip, i pacchetti InRegia-music-<genere>.zip
; e un file LibreOffice_*_Win_x86-64.msi; verranno usati senza scaricare nulla.
;
; Compilazione:  ISCC.exe /DAppVersion=2026.12.2 /DAppVerName="v2026.12.2" /DTag=v2026.12.2
;                /DFileVer=2026.12.2.1000 /DAppZipSha=<sha256> /DMusicSha_lofi=<sha256> ... installer\inregia.iss

#ifndef AppVersion
  #define AppVersion "2026.12.2"
#endif
#ifndef AppVerName
  #define AppVerName "v2026.12.2"
#endif
#ifndef Tag
  #define Tag "v2026.12.2"
#endif
#ifndef FileVer
  #define FileVer "2026.12.2.1000"
#endif
#ifndef AppZipSha
  #define AppZipSha ""
#endif
#ifndef MusicSha_lofi
  #define MusicSha_lofi ""
#endif
#ifndef MusicSha_lounge
  #define MusicSha_lounge ""
#endif
#ifndef MusicSha_ambient
  #define MusicSha_ambient ""
#endif
#ifndef MusicSha_pianoforte
  #define MusicSha_pianoforte ""
#endif
#ifndef MusicSha_acustico
  #define MusicSha_acustico ""
#endif
#ifndef MusicSha_corporate
  #define MusicSha_corporate ""
#endif
#ifndef MusicSha_cinematico
  #define MusicSha_cinematico ""
#endif
#define Repo "Rotolino37/inregia"
#define LOFallback "26.8.3"
#define AppZip "InRegia-app-win-x64.zip"

[Setup]
AppId={{6B1F2E4A-7C3D-4E59-9A1B-2D4C8E7F6A10}
AppName=InRegia
AppVersion={#AppVersion}
AppVerName=InRegia {#AppVerName}
AppPublisher=InRegia
AppPublisherURL=https://github.com/{#Repo}
AppSupportURL=https://github.com/{#Repo}/issues
AppUpdatesURL=https://github.com/{#Repo}/releases
DefaultDirName={autopf}\InRegia
DefaultGroupName=InRegia
DisableProgramGroupPage=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\dist
OutputBaseFilename=InRegia-Setup-{#Tag}
SetupIconFile=..\app\assets\inregia.ico
UninstallDisplayIcon={app}\InRegia.exe
UninstallDisplayName=InRegia
WizardStyle=modern
WizardImageFile=wizard.bmp
WizardSmallImageFile=wizard-small.bmp
LicenseFile=..\LICENSE.md
Compression=lzma2/max
SolidCompression=yes
VersionInfoVersion={#FileVer}
VersionInfoProductName=InRegia
VersionInfoProductVersion={#FileVer}
VersionInfoDescription=InRegia Setup
VersionInfoCompany=InRegia
CloseApplications=no
ShowLanguageDialog=no
DisableWelcomePage=no
ChangesAssociations=no

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "it"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "de"; MessagesFile: "compiler:Languages\German.isl"
Name: "fr"; MessagesFile: "compiler:Languages\French.isl"
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
en.WelcomeLabel2=This wizard installs InRegia {#AppVerName}: live PowerPoint presentations with presenter view, lockable projector, audio mixer and background music.%n%nThe components are downloaded from the internet during installation.
it.WelcomeLabel2=Questa procedura installa InRegia {#AppVerName}: presentazioni PowerPoint dal vivo con vista relatore, proiettore bloccabile, mixer audio e musica di sottofondo.%n%nI componenti vengono scaricati da internet durante l'installazione.
de.WelcomeLabel2=Dieser Assistent installiert InRegia {#AppVerName}: PowerPoint-Präsentationen live mit Referentenansicht, sperrbarem Projektor, Audiomischer und Hintergrundmusik.%n%nDie Komponenten werden während der Installation aus dem Internet heruntergeladen.
fr.WelcomeLabel2=Cet assistant installe InRegia {#AppVerName} : présentations PowerPoint en direct avec vue présentateur, projecteur verrouillable, mixeur audio et musique de fond.%n%nLes composants sont téléchargés depuis internet pendant l'installation.
es.WelcomeLabel2=Este asistente instala InRegia {#AppVerName}: presentaciones de PowerPoint en directo con vista del presentador, proyector bloqueable, mezclador de audio y música de fondo.%n%nLos componentes se descargan de internet durante la instalación.
en.SelectComponentsLabel2=Choose the components to download and install. You can also add them later from the app.%n%nPrivacy: InRegia does not collect or send any data. Only the selected components are downloaded, from GitHub (program and music) and from The Document Foundation (LibreOffice).
it.SelectComponentsLabel2=Scegli i componenti da scaricare e installare. Puoi aggiungerli anche in seguito dall'app.%n%nPrivacy: InRegia non raccoglie né invia dati. Vengono scaricati solo i componenti selezionati, da GitHub (programma e musica) e da The Document Foundation (LibreOffice).
de.SelectComponentsLabel2=Wähle die Komponenten zum Herunterladen und Installieren. Du kannst sie auch später in der App hinzufügen.%n%nDatenschutz: InRegia sammelt und sendet keine Daten. Es werden nur die ausgewählten Komponenten heruntergeladen, von GitHub (Programm und Musik) und von The Document Foundation (LibreOffice).
fr.SelectComponentsLabel2=Choisissez les composants à télécharger et installer. Vous pourrez aussi les ajouter plus tard depuis l'application.%n%nConfidentialité : InRegia ne collecte ni n'envoie aucune donnée. Seuls les composants sélectionnés sont téléchargés, depuis GitHub (programme et musique) et The Document Foundation (LibreOffice).
es.SelectComponentsLabel2=Elige los componentes que quieres descargar e instalar. También puedes añadirlos más tarde desde la aplicación.%n%nPrivacidad: InRegia no recopila ni envía datos. Solo se descargan los componentes seleccionados, desde GitHub (programa y música) y desde The Document Foundation (LibreOffice).

[CustomMessages]
en.TypeFull=Full (recommended)
it.TypeFull=Completa (consigliata)
de.TypeFull=Vollständig (empfohlen)
fr.TypeFull=Complète (recommandée)
es.TypeFull=Completa (recomendada)
en.TypeCustom=Custom
it.TypeCustom=Personalizzata
de.TypeCustom=Benutzerdefiniert
fr.TypeCustom=Personnalisée
es.TypeCustom=Personalizada
en.CompApp=InRegia (about 110 MB to download)
it.CompApp=InRegia (circa 110 MB da scaricare)
de.CompApp=InRegia (ca. 110 MB Download)
fr.CompApp=InRegia (environ 110 Mo à télécharger)
es.CompApp=InRegia (unos 110 MB de descarga)
en.CompEngine=LibreOffice conversion engine, needed to import .pptx files (about 350 MB)
it.CompEngine=Motore di conversione LibreOffice, serve per importare i .pptx (circa 350 MB)
de.CompEngine=LibreOffice-Konvertierungs-Engine, nötig zum Importieren von .pptx (ca. 350 MB)
fr.CompEngine=Moteur de conversion LibreOffice, nécessaire pour importer les .pptx (environ 350 Mo)
es.CompEngine=Motor de conversión LibreOffice, necesario para importar .pptx (unos 350 MB)
en.CompMusic=Built-in background music: over an hour per genre, Opus format
it.CompMusic=Musica di sottofondo predefinita: oltre un'ora per genere, formato Opus
de.CompMusic=Integrierte Hintergrundmusik: über eine Stunde pro Genre, Opus-Format
fr.CompMusic=Musique de fond intégrée : plus d'une heure par genre, format Opus
es.CompMusic=Música de fondo integrada: más de una hora por género, formato Opus
en.Genre=%1 (about %2 MB)
it.Genre=%1 (circa %2 MB)
de.Genre=%1 (ca. %2 MB)
fr.Genre=%1 (environ %2 Mo)
es.Genre=%1 (unos %2 MB)
en.GPiano=Piano (about 38 MB)
it.GPiano=Pianoforte (circa 38 MB)
de.GPiano=Klavier (ca. 38 MB)
fr.GPiano=Piano (environ 38 Mo)
es.GPiano=Piano (unos 38 MB)
en.GAcoustic=Acoustic (about 36 MB)
it.GAcoustic=Acustico (circa 36 MB)
de.GAcoustic=Akustik (ca. 36 MB)
fr.GAcoustic=Acoustique (environ 36 Mo)
es.GAcoustic=Acústico (unos 36 MB)
en.GCinematic=Cinematic (about 36 MB)
it.GCinematic=Cinematico (circa 36 MB)
de.GCinematic=Filmisch (ca. 36 MB)
fr.GCinematic=Cinématique (environ 36 Mo)
es.GCinematic=Cinematográfico (unos 36 MB)
en.TaskDesktop=Create a desktop shortcut
it.TaskDesktop=Crea un collegamento sul desktop
de.TaskDesktop=Verknüpfung auf dem Desktop erstellen
fr.TaskDesktop=Créer un raccourci sur le bureau
es.TaskDesktop=Crear un acceso directo en el escritorio
en.GroupShortcuts=Shortcuts:
it.GroupShortcuts=Collegamenti:
de.GroupShortcuts=Verknüpfungen:
fr.GroupShortcuts=Raccourcis :
es.GroupShortcuts=Accesos directos:
en.RunApp=Start InRegia
it.RunApp=Avvia InRegia
de.RunApp=InRegia starten
fr.RunApp=Lancer InRegia
es.RunApp=Iniciar InRegia
en.RestartApp=Restart InRegia
it.RestartApp=Riavvia InRegia
de.RestartApp=InRegia neu starten
fr.RestartApp=Redémarrer InRegia
es.RestartApp=Reiniciar InRegia
en.DlTitle=Downloading
it.DlTitle=Download in corso
de.DlTitle=Download läuft
fr.DlTitle=Téléchargement en cours
es.DlTitle=Descarga en curso
en.DlDesc=Downloading the InRegia components. The time depends on the connection.
it.DlDesc=Scaricamento dei componenti di InRegia. La durata dipende dalla connessione.
de.DlDesc=Die InRegia-Komponenten werden heruntergeladen. Die Dauer hängt von der Verbindung ab.
fr.DlDesc=Téléchargement des composants d'InRegia. La durée dépend de la connexion.
es.DlDesc=Descargando los componentes de InRegia. La duración depende de la conexión.
en.DlFailed=Download failed: %1%n%nCheck the connection and try again.
it.DlFailed=Download non riuscito: %1%n%nControlla la connessione e riprova.
de.DlFailed=Download fehlgeschlagen: %1%n%nPrüfe die Verbindung und versuche es erneut.
fr.DlFailed=Échec du téléchargement : %1%n%nVérifiez la connexion et réessayez.
es.DlFailed=La descarga ha fallado: %1%n%nComprueba la conexión y vuelve a intentarlo.
en.DlFailedShort=Component download failed.
it.DlFailedShort=Download dei componenti non riuscito.
de.DlFailedShort=Download der Komponenten fehlgeschlagen.
fr.DlFailedShort=Échec du téléchargement des composants.
es.DlFailedShort=La descarga de los componentes ha fallado.
en.AppRunning=InRegia is open. Close it and press OK to continue.
it.AppRunning=InRegia è aperto. Chiudilo e premi OK per continuare.
de.AppRunning=InRegia ist geöffnet. Schließe es und drücke OK, um fortzufahren.
fr.AppRunning=InRegia est ouvert. Fermez-le et appuyez sur OK pour continuer.
es.AppRunning=InRegia está abierto. Ciérralo y pulsa Aceptar para continuar.
en.StApp=Installing InRegia
it.StApp=Installazione di InRegia
de.StApp=InRegia wird installiert
fr.StApp=Installation d'InRegia
es.StApp=Instalando InRegia
en.StMusic=Installing music: %1
it.StMusic=Installazione della musica: %1
de.StMusic=Musik wird installiert: %1
fr.StMusic=Installation de la musique : %1
es.StMusic=Instalando la música: %1
en.StEngine=Installing the conversion engine: this may take a few minutes
it.StEngine=Installazione del motore di conversione: può richiedere alcuni minuti
de.StEngine=Die Konvertierungs-Engine wird installiert: das kann einige Minuten dauern
fr.StEngine=Installation du moteur de conversion : cela peut prendre quelques minutes
es.StEngine=Instalando el motor de conversión: puede tardar unos minutos
en.ExtractFailed=Extraction of %1 failed (code %2).
it.ExtractFailed=Estrazione di %1 non riuscita (codice %2).
de.ExtractFailed=Entpacken von %1 fehlgeschlagen (Code %2).
fr.ExtractFailed=Échec de l'extraction de %1 (code %2).
es.ExtractFailed=La extracción de %1 ha fallado (código %2).
en.EngineFailed=The conversion engine was not installed (code %1). You can install it later from the app, in the library.
it.EngineFailed=Il motore di conversione non è stato installato (codice %1). Potrai installarlo dall'app, nella libreria.
de.EngineFailed=Die Konvertierungs-Engine wurde nicht installiert (Code %1). Du kannst sie später in der App, in der Bibliothek, installieren.
fr.EngineFailed=Le moteur de conversion n'a pas été installé (code %1). Vous pourrez l'installer depuis l'application, dans la bibliothèque.
es.EngineFailed=El motor de conversión no se ha instalado (código %1). Podrás instalarlo desde la aplicación, en la biblioteca.
en.UninstData=Also delete the imported presentations, the music you added and the settings?%n%nFolder: %1%nThe original .pptx files are not touched.
it.UninstData=Vuoi eliminare anche le presentazioni importate, la musica che hai aggiunto e le impostazioni?%n%nCartella: %1%nI file .pptx originali non vengono toccati.
de.UninstData=Auch die importierten Präsentationen, die hinzugefügte Musik und die Einstellungen löschen?%n%nOrdner: %1%nDie ursprünglichen .pptx-Dateien bleiben unverändert.
fr.UninstData=Supprimer aussi les présentations importées, la musique ajoutée et les paramètres ?%n%nDossier : %1%nLes fichiers .pptx d'origine ne sont pas modifiés.
es.UninstData=¿Eliminar también las presentaciones importadas, la música que añadiste y los ajustes?%n%nCarpeta: %1%nLos archivos .pptx originales no se tocan.

[Types]
Name: "full"; Description: "{cm:TypeFull}"
Name: "custom"; Description: "{cm:TypeCustom}"; Flags: iscustom

[Components]
Name: "app"; Description: "{cm:CompApp}"; Types: full custom; Flags: fixed
Name: "engine"; Description: "{cm:CompEngine}"; Types: full
Name: "music"; Description: "{cm:CompMusic}"; Types: full
Name: "music\lofi"; Description: "{cm:Genre,Lofi Chill,38}"; Types: full
Name: "music\lounge"; Description: "{cm:Genre,Lounge,38}"; Types: full
Name: "music\ambient"; Description: "{cm:Genre,Ambient,36}"; Types: full
Name: "music\pianoforte"; Description: "{cm:GPiano}"; Types: full
Name: "music\acustico"; Description: "{cm:GAcoustic}"; Types: full
Name: "music\corporate"; Description: "{cm:Genre,Corporate,40}"; Types: full
Name: "music\cinematico"; Description: "{cm:GCinematic}"; Types: full

[Tasks]
Name: "desktopicon"; Description: "{cm:TaskDesktop}"; GroupDescription: "{cm:GroupShortcuts}"

[Icons]
Name: "{autoprograms}\InRegia"; Filename: "{app}\InRegia.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\InRegia"; Filename: "{app}\InRegia.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\InRegia.exe"; Description: "{cm:RunApp}"; Flags: nowait postinstall skipifsilent
; aggiornamento avviato dall'app (/UPDATE=1): riapre InRegia con l'utente originale, non come amministratore
Filename: "{app}\InRegia.exe"; Description: "{cm:RestartApp}"; Flags: nowait postinstall skipifnotsilent runasoriginaluser; Check: IsUpdate

[UninstallDelete]
Type: filesandordirs; Name: "{app}\resources"
Type: filesandordirs; Name: "{app}\locales"
Type: filesandordirs; Name: "{app}\engine"
Type: filesandordirs; Name: "{app}\music"
Type: files; Name: "{app}\*.dll"
Type: files; Name: "{app}\*.pak"
Type: files; Name: "{app}\*.bin"
Type: files; Name: "{app}\*.dat"
Type: files; Name: "{app}\*.json"
Type: files; Name: "{app}\*.html"
Type: files; Name: "{app}\*.md"
Type: files; Name: "{app}\LICENSE"
Type: files; Name: "{app}\version"
Type: files; Name: "{app}\InRegia.exe"
Type: dirifempty; Name: "{app}"

[Code]
var
  DownloadPage: TDownloadWizardPage;
  Downloaded: Boolean;
  LOVersion: String;

{ /UPDATE=1: aggiornamento lanciato dall'app, sostituisce solo il programma }
function IsUpdate: Boolean;
begin
  Result := ExpandConstant('{param:UPDATE|0}') = '1';
end;

function OnDownloadProgress(const Url, FileName: String; const Progress, ProgressMax: Int64): Boolean;
begin
  Result := True;
end;

procedure InitializeWizard;
begin
  DownloadPage := CreateDownloadPage(CustomMessage('DlTitle'), CustomMessage('DlDesc'), @OnDownloadProgress);
end;

{ ---------------- file locali per l'installazione offline ---------------- }
function LocalFile(const Name: String): String;
begin
  Result := ExpandConstant('{src}\') + Name;
  if not FileExists(Result) then Result := '';
end;

function LocalMsi: String;
var FR: TFindRec;
begin
  Result := '';
  if FindFirst(ExpandConstant('{src}\LibreOffice_*_Win_x86-64.msi'), FR) then begin
    Result := ExpandConstant('{src}\') + FR.Name;
    FindClose(FR);
  end;
end;

function Src(const Name: String): String;
begin
  Result := LocalFile(Name);
  if Result = '' then Result := ExpandConstant('{tmp}\') + Name;
end;

{ ---------------- musica per genere ---------------- }
const
  NGenres = 7;

function GSlug(I: Integer): String;
begin
  case I of
    0: Result := 'lofi';
    1: Result := 'lounge';
    2: Result := 'ambient';
    3: Result := 'pianoforte';
    4: Result := 'acustico';
    5: Result := 'corporate';
    6: Result := 'cinematico';
  end;
end;

function GFolder(I: Integer): String;
begin
  case I of
    0: Result := 'Lofi Chill';
    1: Result := 'Lounge';
    2: Result := 'Ambient';
    3: Result := 'Pianoforte';
    4: Result := 'Acustico';
    5: Result := 'Corporate';
    6: Result := 'Cinematico';
  end;
end;

function GSha(I: Integer): String;
begin
  case I of
    0: Result := '{#MusicSha_lofi}';
    1: Result := '{#MusicSha_lounge}';
    2: Result := '{#MusicSha_ambient}';
    3: Result := '{#MusicSha_pianoforte}';
    4: Result := '{#MusicSha_acustico}';
    5: Result := '{#MusicSha_corporate}';
    6: Result := '{#MusicSha_cinematico}';
  end;
end;

function GZip(I: Integer): String;
begin
  Result := 'InRegia-music-' + GSlug(I) + '.zip';
end;

function AnyMusic: Boolean;
var I: Integer;
begin
  Result := False;
  for I := 0 to NGenres - 1 do
    if WizardIsComponentSelected('music\' + GSlug(I)) then Result := True;
end;

{ ---------------- versione di LibreOffice ---------------- }
function IsDigits(const S: String): Boolean;
var I: Integer;
begin
  Result := Length(S) > 0;
  for I := 1 to Length(S) do
    if (S[I] < '0') or (S[I] > '9') then begin Result := False; Exit; end;
end;

function SplitVer(const V: String; var A, B, C: Integer): Boolean;
var P1, P2: Integer; S1, S2, S3, R: String;
begin
  Result := False;
  P1 := Pos('.', V); if P1 = 0 then Exit;
  S1 := Copy(V, 1, P1 - 1); R := Copy(V, P1 + 1, MaxInt);
  P2 := Pos('.', R); if P2 = 0 then Exit;
  S2 := Copy(R, 1, P2 - 1); S3 := Copy(R, P2 + 1, MaxInt);
  if not (IsDigits(S1) and IsDigits(S2) and IsDigits(S3)) then Exit;
  A := StrToInt(S1); B := StrToInt(S2); C := StrToInt(S3);
  Result := True;
end;

function NewerVer(const V, Than: String): Boolean;
var A1, B1, C1, A2, B2, C2: Integer;
begin
  Result := False;
  if not SplitVer(V, A1, B1, C1) then Exit;
  if not SplitVer(Than, A2, B2, C2) then begin Result := True; Exit; end;
  if A1 <> A2 then Result := A1 > A2
  else if B1 <> B2 then Result := B1 > B2
  else Result := C1 > C2;
end;

function LibreOfficeUrl: String;
var Raw: AnsiString; S, V, Best: String; P, Q, A, B, C: Integer;
begin
  Best := '';
  try
    DownloadTemporaryFile('https://download.documentfoundation.org/libreoffice/stable/', 'lo-stable.html', '', @OnDownloadProgress);
    if LoadStringFromFile(ExpandConstant('{tmp}\lo-stable.html'), Raw) then begin
      S := String(Raw);
      P := Pos('href="', S);
      while P > 0 do begin
        S := Copy(S, P + 6, MaxInt);
        Q := Pos('/"', S);
        if (Q > 0) and (Q < 16) then begin
          V := Copy(S, 1, Q - 1);
          if SplitVer(V, A, B, C) and ((Best = '') or NewerVer(V, Best)) then Best := V;
        end;
        P := Pos('href="', S);
      end;
    end;
  except
    Log('Elenco versioni LibreOffice non disponibile: ' + GetExceptionMessage);
  end;
  if Best = '' then Best := '{#LOFallback}';
  LOVersion := Best;
  Log('LibreOffice scelto: ' + Best);
  Result := 'https://download.documentfoundation.org/libreoffice/stable/' + Best + '/win/x86_64/LibreOffice_' + Best + '_Win_x86-64.msi';
end;

{ ---------------- download ---------------- }
function DoDownloads: Boolean;
var I: Integer;
begin
  Result := True;
  if Downloaded then Exit;
  DownloadPage.Clear;
  if LocalFile('{#AppZip}') = '' then
    DownloadPage.Add('https://github.com/{#Repo}/releases/download/{#Tag}/{#AppZip}', '{#AppZip}', '{#AppZipSha}');
  for I := 0 to NGenres - 1 do
    if WizardIsComponentSelected('music\' + GSlug(I)) and (LocalFile(GZip(I)) = '') then
      DownloadPage.Add('https://github.com/{#Repo}/releases/download/{#Tag}/' + GZip(I), GZip(I), GSha(I));
  if WizardIsComponentSelected('engine') and (LocalMsi = '') then
    DownloadPage.Add(LibreOfficeUrl, 'LibreOffice.msi', '');
  DownloadPage.Show;
  try
    try
      DownloadPage.Download;
      Downloaded := True;
    except
      if not DownloadPage.AbortedByUser then
        SuppressibleMsgBox(FmtMessage(CustomMessage('DlFailed'), [GetExceptionMessage]), mbCriticalError, MB_OK, IDOK);
      Result := False;
    end;
  finally
    DownloadPage.Hide;
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpReady then Result := DoDownloads;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not DoDownloads then Result := CustomMessage('DlFailedShort');
end;

{ ---------------- app in esecuzione ---------------- }
function AppRunning: Boolean;
var RC: Integer;
begin
  Result := Exec(ExpandConstant('{cmd}'), '/C tasklist /FI "IMAGENAME eq InRegia.exe" /NH | find /I "InRegia.exe" >NUL', '', SW_HIDE, ewWaitUntilTerminated, RC) and (RC = 0);
end;

function EnsureClosed(Silent: Boolean): Boolean;
var RC: Integer;
begin
  Result := True;
  while AppRunning do begin
    if Silent then begin
      Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM InRegia.exe /F', '', SW_HIDE, ewWaitUntilTerminated, RC);
      Sleep(800); Exit;
    end;
    if MsgBox(CustomMessage('AppRunning'), mbInformation, MB_OKCANCEL) = IDCANCEL then begin Result := False; Exit; end;
  end;
end;

function InitializeSetup: Boolean;
begin
  Result := EnsureClosed(WizardSilent);
end;

function InitializeUninstall: Boolean;
begin
  Result := EnsureClosed(UninstallSilent);
end;

{ ---------------- installazione ---------------- }
procedure SetStatus(const S: String);
begin
  WizardForm.StatusLabel.Caption := S;
  WizardForm.FilenameLabel.Caption := '';
end;

function RunHidden(const Exe, Params: String): Integer;
var RC: Integer;
begin
  Log('Esecuzione: ' + Exe + ' ' + Params);
  if not Exec(Exe, Params, '', SW_HIDE, ewWaitUntilTerminated, RC) then RC := -1;
  Log('Codice: ' + IntToStr(RC));
  Result := RC;
end;

procedure Extract(const Zip, Dest: String);
var RC: Integer;
begin
  ForceDirectories(Dest);
  RC := RunHidden(ExpandConstant('{sys}\tar.exe'), '-xf "' + Zip + '" -C "' + Dest + '"');
  if RC <> 0 then RaiseException(FmtMessage(CustomMessage('ExtractFailed'), [ExtractFileName(Zip), IntToStr(RC)]));
end;

procedure CurStepChanged(CurStep: TSetupStep);
var Msi: String; RC, I: Integer;
begin
  { anche negli aggiornamenti: cartella dei font del motore scrivibile dagli utenti (font dei documenti) }
  if (CurStep = ssPostInstall) and DirExists(ExpandConstant('{app}\engine\libreoffice\share\fonts\truetype')) then
    Exec(ExpandConstant('{sys}\icacls.exe'), '"' + ExpandConstant('{app}\engine\libreoffice\share\fonts\truetype') + '" /grant *S-1-5-32-545:(OI)(CI)M', '', SW_HIDE, ewWaitUntilTerminated, RC);
  if CurStep = ssInstall then begin
    DelTree(ExpandConstant('{app}\resources'), True, True, True);
    DelTree(ExpandConstant('{app}\locales'), True, True, True);
  end;
  if CurStep = ssPostInstall then begin
    WizardForm.ProgressGauge.Style := npbstMarquee;
    SetStatus(CustomMessage('StApp'));
    Extract(Src('{#AppZip}'), ExpandConstant('{app}'));
    if AnyMusic then begin
      DelTree(ExpandConstant('{app}\music\default'), True, True, True);
      for I := 0 to NGenres - 1 do
        if WizardIsComponentSelected('music\' + GSlug(I)) then begin
          SetStatus(FmtMessage(CustomMessage('StMusic'), [GFolder(I)]));
          Extract(Src(GZip(I)), ExpandConstant('{app}\music\default'));
        end;
    end;
    if WizardIsComponentSelected('engine') then begin
      SetStatus(CustomMessage('StEngine'));
      Msi := LocalMsi;
      if Msi = '' then Msi := ExpandConstant('{tmp}\LibreOffice.msi');
      DelTree(ExpandConstant('{app}\engine'), True, True, True);
      ForceDirectories(ExpandConstant('{app}\engine\libreoffice'));
      RC := RunHidden(ExpandConstant('{sys}\msiexec.exe'), '/a "' + Msi + '" /qn TARGETDIR="' + ExpandConstant('{app}\engine\libreoffice') + '"');
      if (LOVersion = '') and (Pos('LibreOffice_', ExtractFileName(Msi)) = 1) then begin
        LOVersion := Copy(ExtractFileName(Msi), 13, MaxInt);
        LOVersion := Copy(LOVersion, 1, Pos('_', LOVersion) - 1);
      end;
      if ((RC = 0) or (RC = 3010)) and (LOVersion <> '') then
        SaveStringToFile(ExpandConstant('{app}\engine\libreoffice\inregia-version.txt'), LOVersion, False);
      { i font dei documenti (font cloud di Office, incorporati, aggiunti) vengono forniti al motore qui }
      if (RC = 0) or (RC = 3010) then begin
        ForceDirectories(ExpandConstant('{app}\engine\libreoffice\share\fonts\truetype'));
        Exec(ExpandConstant('{sys}\icacls.exe'), '"' + ExpandConstant('{app}\engine\libreoffice\share\fonts\truetype') + '" /grant *S-1-5-32-545:(OI)(CI)M', '', SW_HIDE, ewWaitUntilTerminated, RC);
        RC := 0;
      end;
      if (RC <> 0) and (RC <> 3010) then
        SuppressibleMsgBox(FmtMessage(CustomMessage('EngineFailed'), [IntToStr(RC)]), mbError, MB_OK, IDOK);
    end;
    WizardForm.ProgressGauge.Style := npbstNormal;
  end;
end;

{ ---------------- disinstallazione ---------------- }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var Data: String;
begin
  if CurUninstallStep = usPostUninstall then begin
    Data := ExpandConstant('{localappdata}\InRegia');
    if DirExists(Data) and not UninstallSilent then
      if MsgBox(FmtMessage(CustomMessage('UninstData'), [Data]), mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(Data, True, True, True);
  end;
end;
