; InRegia - installer web (Inno Setup 6.3+)
; Scarica il programma, il motore di conversione LibreOffice e la musica predefinita.
; Installazione offline: metti accanto al setup InRegia-app-win-x64.zip, i pacchetti InRegia-music-<genere>.zip
; e un file LibreOffice_*_Win_x86-64.msi; verranno usati senza scaricare nulla.
;
; Compilazione:  ISCC.exe /DAppVersion=2026.12.0-beta.3 /DAppVerName="v2026.12 beta 3" /DTag=v2026.12-beta.3
;                /DFileVer=2026.12.0.3 /DAppZipSha=<sha256> /DMusicSha_lofi=<sha256> ... installer\inregia.iss

#ifndef AppVersion
  #define AppVersion "2026.12.0-beta.3"
#endif
#ifndef AppVerName
  #define AppVerName "v2026.12 beta 3"
#endif
#ifndef Tag
  #define Tag "v2026.12-beta.3"
#endif
#ifndef FileVer
  #define FileVer "2026.12.0.3"
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
VersionInfoDescription=Installazione di InRegia
VersionInfoCompany=InRegia
CloseApplications=no
ShowLanguageDialog=no
DisableWelcomePage=no
ChangesAssociations=no

[Languages]
Name: "it"; MessagesFile: "compiler:Languages\Italian.isl"

[Messages]
it.WelcomeLabel2=Questa procedura installa InRegia {#AppVerName}: presentazioni PowerPoint dal vivo con vista relatore, proiettore bloccabile, mixer audio e musica di sottofondo.%n%nI componenti vengono scaricati da internet durante l'installazione.
it.SelectComponentsLabel2=Scegli i componenti da scaricare e installare. Puoi aggiungerli anche in seguito dall'app.%n%nPrivacy: InRegia non raccoglie né invia dati. Vengono scaricati solo i componenti selezionati, da GitHub (programma e musica) e da The Document Foundation (LibreOffice).

[Types]
Name: "full"; Description: "Completa (consigliata)"
Name: "custom"; Description: "Personalizzata"; Flags: iscustom

[Components]
Name: "app"; Description: "InRegia (circa 110 MB da scaricare)"; Types: full custom; Flags: fixed
Name: "engine"; Description: "Motore di conversione LibreOffice, serve per importare i .pptx (circa 350 MB)"; Types: full
Name: "music"; Description: "Musica di sottofondo predefinita: oltre un'ora per genere, formato Opus"; Types: full
Name: "music\lofi"; Description: "Lofi Chill (circa 38 MB)"; Types: full
Name: "music\lounge"; Description: "Lounge (circa 38 MB)"; Types: full
Name: "music\ambient"; Description: "Ambient (circa 36 MB)"; Types: full
Name: "music\pianoforte"; Description: "Pianoforte (circa 38 MB)"; Types: full
Name: "music\acustico"; Description: "Acustico (circa 36 MB)"; Types: full
Name: "music\corporate"; Description: "Corporate (circa 40 MB)"; Types: full
Name: "music\cinematico"; Description: "Cinematico (circa 36 MB)"; Types: full

[Tasks]
Name: "desktopicon"; Description: "Crea un collegamento sul desktop"; GroupDescription: "Collegamenti:"

[Icons]
Name: "{autoprograms}\InRegia"; Filename: "{app}\InRegia.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\InRegia"; Filename: "{app}\InRegia.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\InRegia.exe"; Description: "Avvia InRegia"; Flags: nowait postinstall skipifsilent
; aggiornamento avviato dall'app (/UPDATE=1): riapre InRegia con l'utente originale, non come amministratore
Filename: "{app}\InRegia.exe"; Description: "Riavvia InRegia"; Flags: nowait postinstall skipifnotsilent runasoriginaluser; Check: IsUpdate

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
  DownloadPage := CreateDownloadPage('Download in corso', 'Scaricamento dei componenti di InRegia. La durata dipende dalla connessione.', @OnDownloadProgress);
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
        SuppressibleMsgBox('Download non riuscito: ' + GetExceptionMessage + #13#10#13#10 + 'Controlla la connessione e riprova.', mbCriticalError, MB_OK, IDOK);
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
  if not DoDownloads then Result := 'Download dei componenti non riuscito.';
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
    if MsgBox('InRegia è aperto. Chiudilo e premi OK per continuare.', mbInformation, MB_OKCANCEL) = IDCANCEL then begin Result := False; Exit; end;
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
  if RC <> 0 then RaiseException('Estrazione di ' + ExtractFileName(Zip) + ' non riuscita (codice ' + IntToStr(RC) + ').');
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
    SetStatus('Installazione di InRegia');
    Extract(Src('{#AppZip}'), ExpandConstant('{app}'));
    if AnyMusic then begin
      DelTree(ExpandConstant('{app}\music\default'), True, True, True);
      for I := 0 to NGenres - 1 do
        if WizardIsComponentSelected('music\' + GSlug(I)) then begin
          SetStatus('Installazione della musica: ' + GFolder(I));
          Extract(Src(GZip(I)), ExpandConstant('{app}\music\default'));
        end;
    end;
    if WizardIsComponentSelected('engine') then begin
      SetStatus('Installazione del motore di conversione: può richiedere alcuni minuti');
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
        SuppressibleMsgBox('Il motore di conversione non è stato installato (codice ' + IntToStr(RC) + '). Potrai installarlo dall''app, nella libreria.', mbError, MB_OK, IDOK);
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
      if MsgBox('Vuoi eliminare anche le presentazioni importate, la musica che hai aggiunto e le impostazioni?' + #13#10#13#10 + 'Cartella: ' + Data + #13#10 + 'I file .pptx originali non vengono toccati.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(Data, True, True, True);
  end;
end;
