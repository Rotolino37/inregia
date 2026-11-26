; InRegia - installer web (Inno Setup 6.3+)
; Scarica il programma, il motore di conversione LibreOffice e la musica predefinita.
; Installazione offline: metti accanto al setup InRegia-app-win-x64.zip, InRegia-music-default.zip
; e un file LibreOffice_*_Win_x86-64.msi; verranno usati senza scaricare nulla.
;
; Compilazione:  ISCC.exe /DAppVersion=2026.12.0-beta.1 /DAppVerName="v2026.12 beta 1" /DTag=v2026.12-beta.1
;                /DFileVer=2026.12.0.1 /DAppZipSha=<sha256> /DMusicZipSha=<sha256> installer\inregia.iss

#ifndef AppVersion
  #define AppVersion "2026.12.0-beta.1"
#endif
#ifndef AppVerName
  #define AppVerName "v2026.12 beta 1"
#endif
#ifndef Tag
  #define Tag "v2026.12-beta.1"
#endif
#ifndef FileVer
  #define FileVer "2026.12.0.1"
#endif
#ifndef AppZipSha
  #define AppZipSha ""
#endif
#ifndef MusicZipSha
  #define MusicZipSha ""
#endif
#define Repo "Saggiaa/inregia"
#define LOFallback "26.8.3"
#define AppZip "InRegia-app-win-x64.zip"
#define MusicZip "InRegia-music-default.zip"

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
Name: "music"; Description: "Musica di sottofondo predefinita (circa 35 MB)"; Types: full

[Tasks]
Name: "desktopicon"; Description: "Crea un collegamento sul desktop"; GroupDescription: "Collegamenti:"

[Icons]
Name: "{autoprograms}\InRegia"; Filename: "{app}\InRegia.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\InRegia"; Filename: "{app}\InRegia.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\InRegia.exe"; Description: "Avvia InRegia"; Flags: nowait postinstall skipifsilent

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
  Log('LibreOffice scelto: ' + Best);
  Result := 'https://download.documentfoundation.org/libreoffice/stable/' + Best + '/win/x86_64/LibreOffice_' + Best + '_Win_x86-64.msi';
end;

{ ---------------- download ---------------- }
function DoDownloads: Boolean;
begin
  Result := True;
  if Downloaded then Exit;
  DownloadPage.Clear;
  if LocalFile('{#AppZip}') = '' then
    DownloadPage.Add('https://github.com/{#Repo}/releases/download/{#Tag}/{#AppZip}', '{#AppZip}', '{#AppZipSha}');
  if WizardIsComponentSelected('music') and (LocalFile('{#MusicZip}') = '') then
    DownloadPage.Add('https://github.com/{#Repo}/releases/download/{#Tag}/{#MusicZip}', '{#MusicZip}', '{#MusicZipSha}');
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
var Msi: String; RC: Integer;
begin
  if CurStep = ssInstall then begin
    DelTree(ExpandConstant('{app}\resources'), True, True, True);
    DelTree(ExpandConstant('{app}\locales'), True, True, True);
  end;
  if CurStep = ssPostInstall then begin
    WizardForm.ProgressGauge.Style := npbstMarquee;
    SetStatus('Installazione di InRegia');
    Extract(Src('{#AppZip}'), ExpandConstant('{app}'));
    if WizardIsComponentSelected('music') then begin
      SetStatus('Installazione della musica predefinita');
      Extract(Src('{#MusicZip}'), ExpandConstant('{app}\music\default'));
    end;
    if WizardIsComponentSelected('engine') then begin
      SetStatus('Installazione del motore di conversione: può richiedere alcuni minuti');
      Msi := LocalMsi;
      if Msi = '' then Msi := ExpandConstant('{tmp}\LibreOffice.msi');
      DelTree(ExpandConstant('{app}\engine'), True, True, True);
      ForceDirectories(ExpandConstant('{app}\engine\libreoffice'));
      RC := RunHidden(ExpandConstant('{sys}\msiexec.exe'), '/a "' + Msi + '" /qn TARGETDIR="' + ExpandConstant('{app}\engine\libreoffice') + '"');
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
