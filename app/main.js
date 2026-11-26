'use strict';
/* InRegia - processo principale */
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
const { app, BrowserWindow, ipcMain, screen, shell, dialog, powerSaveBlocker, nativeTheme, net, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const url = require('url');

/* ---------------------------------------------------------------- percorsi
 * INSTALL: cartella del programma (sola lettura se in Programmi)
 * DATA:    %LOCALAPPDATA%\InRegia (presentazioni importate, musica dell'utente, impostazioni)
 */
const APP_DIR = __dirname;
const INSTALL = process.env.INREGIA_INSTALL ? path.resolve(process.env.INREGIA_INSTALL)
  : (app.isPackaged ? path.dirname(process.execPath) : path.join(APP_DIR, '..', 'dist', 'dev-install'));
const DATA = process.env.INREGIA_DATA ? path.resolve(process.env.INREGIA_DATA)
  : path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'InRegia');
const DIR = {
  install: INSTALL, data: DATA,
  decks: path.join(DATA, 'presentations'),
  music: path.join(DATA, 'music'),
  global: path.join(DATA, 'music', 'global'),
  defInstall: path.join(INSTALL, 'music', 'default'),
  defUser: path.join(DATA, 'music', 'default'),
  engineInstall: path.join(INSTALL, 'engine'),
  engineUser: path.join(DATA, 'engine'),
};
const SETTINGS_FILE = path.join(DATA, 'settings.json');
const ICON = path.join(APP_DIR, 'assets', 'icon.png');
const MANIFEST_VERSION = 3;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|weba)$/i;
const MUSIC_PACK_URL = 'https://github.com/Rotolino37/inregia/releases/latest/download/InRegia-music-default.zip';
const RESERVED = new Set(['global', 'default']);

for (const d of [DIR.decks, DIR.global]) try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJson = (f, o) => { try { fs.writeFileSync(f + '.tmp', JSON.stringify(o, null, 1)); fs.renameSync(f + '.tmp', f); } catch (e) {} };
let SETTINGS = Object.assign({ renderWidth: 1920, compatGpu: false, autoProjector: true, lockOnOpen: false, videoMirror: true }, readJson(SETTINGS_FILE, {}));
const saveSettings = () => writeJson(SETTINGS_FILE, SETTINGS);

/* ---------------------------------------------------------------- Chromium
 * La finestra proiettore non deve mai essere sospesa (schermo singolo, proiettore chiuso).
 */
if (SETTINGS.compatGpu) app.disableHardwareAcceleration();
try { app.setPath('userData', path.join(DATA, 'userdata')); } catch (e) {}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService,CalculateNativeWinOcclusion,BackgroundVideoTrackOptimization,BackgroundMediaSuspend');
app.setAppUserModelId('it.inregia.app');
nativeTheme.themeSource = 'dark';
Menu.setApplicationMenu(null);

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { const w = pres || lib; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });

/* ---------------------------------------------------------------- presentazioni */
const winEq = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function safeName(n) {
  let s = n.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').trim() || 'presentazione';
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s) || RESERVED.has(s.toLowerCase())) s += '_';
  return s.slice(0, 80);
}
const deckDir = id => path.join(DIR.decks, id);
const QUEUE = []; // { id, src, state: 'queued'|'running'|'error', p, m, error }
function deckList() {
  let dirs = [];
  try { dirs = fs.readdirSync(DIR.decks, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch (e) {}
  const out = dirs.map(id => {
    const dir = deckDir(id), mf = readJson(path.join(dir, 'manifest.json'), null), src = readJson(path.join(dir, 'source.json'), {});
    let status = 'broken', srcInfo = null;
    if (src.path) try { const st = fs.statSync(src.path); srcInfo = { size: st.size, mtime: Math.round(st.mtimeMs) }; } catch (e) {}
    if (mf && mf.version === MANIFEST_VERSION) {
      if (!srcInfo) status = 'nosource';
      else status = (mf.sourceSize === srcInfo.size && Math.abs(mf.sourceMtime - srcInfo.mtime) < 2000) ? 'ready' : 'stale';
    } else if (mf) status = 'old';
    return {
      id, name: (mf && mf.name) || src.name || id, sourcePath: src.path || null, status,
      slides: mf ? mf.slides.length : 0, media: mf ? mf.slides.reduce((a, s) => a + s.media.length, 0) : 0,
      morphs: mf ? Object.keys(mf.morphs || {}).length : 0, animated: mf ? mf.slides.filter(s => s.anim).length : 0,
      thumb: mf ? url.pathToFileURL(path.join(dir, mf.slides[0].thumb)).href : null, imported: mf ? mf.imported : null,
      warnings: mf ? mf.warnings || [] : [], music: countAudio(path.join(DIR.music, id)),
    };
  });
  for (const q of QUEUE) {
    const d = out.find(x => x.id === q.id);
    if (d) Object.assign(d, { job: { state: q.state, p: q.p, m: q.m, error: q.error } });
    else out.push({ id: q.id, name: path.basename(q.src).replace(/\.pptx$/i, ''), sourcePath: q.src, status: 'importing', slides: 0, media: 0, music: 0, job: { state: q.state, p: q.p, m: q.m, error: q.error } });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }));
}
function countAudio(dir) { try { return fs.readdirSync(dir).filter(f => AUDIO_EXT.test(f)).length; } catch (e) { return 0; } }
function enqueue(paths) {
  const added = [], rejected = [];
  for (const p of paths) {
    if (!/\.pptx$/i.test(p) || !fs.existsSync(p)) { rejected.push(path.basename(p)); continue; }
    const existing = deckList().find(d => d.sourcePath && winEq(d.sourcePath, p));
    let id = existing ? existing.id : safeName(path.basename(p).replace(/\.pptx$/i, ''));
    if (!existing) { let k = 2; const base = id; while (fs.existsSync(deckDir(id)) || QUEUE.some(q => q.id === id)) id = `${base} (${k++})`; }
    if (QUEUE.some(q => q.id === id && q.state !== 'error')) continue;
    const old = QUEUE.findIndex(q => q.id === id); if (old >= 0) QUEUE.splice(old, 1);
    QUEUE.push({ id, src: p, state: 'queued', p: 0, m: 'In attesa' });
    added.push(id);
  }
  pump(); libNotify();
  return { added, rejected };
}
let running = false;
function libNotify() { if (lib && !lib.isDestroyed()) lib.webContents.send('lib:changed'); }
function pump() {
  if (running) return;
  const q = QUEUE.find(x => x.state === 'queued'); if (!q) return;
  const eng = engineStatus();
  if (!eng.found) { q.state = 'error'; q.error = 'Motore di conversione non installato'; libNotify(); return pump(); }
  running = true; q.state = 'running'; q.m = 'Avvio'; libNotify();
  const outDir = deckDir(q.id);
  fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(path.join(DIR.music, q.id), { recursive: true });
  writeJson(path.join(outDir, 'source.json'), { path: q.src, name: path.basename(q.src).replace(/\.pptx$/i, '') });
  const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  let last = 0;
  const done = (ok, err) => {
    ipcMain.removeListener('imp:msg', onMsg);
    if (!w.isDestroyed()) w.destroy();
    running = false;
    if (ok) QUEUE.splice(QUEUE.indexOf(q), 1); else { q.state = 'error'; q.error = err; }
    libNotify(); pump();
  };
  const onMsg = (ev, m) => {
    if (ev.sender !== w.webContents) return;
    if (m.t === 'progress') { q.p = m.p; q.m = m.m; if (Date.now() - last > 250) { last = Date.now(); if (lib && !lib.isDestroyed()) lib.webContents.send('imp:progress', { id: q.id, p: m.p, m: m.m }); } }
    else if (m.t === 'done') done(true);
    else if (m.t === 'error') done(false, m.error);
  };
  ipcMain.on('imp:msg', onMsg);
  w.webContents.on('render-process-gone', (e, d) => done(false, 'Importazione interrotta (' + d.reason + ')'));
  w.loadFile(path.join(APP_DIR, 'ui', 'worker.html'), { query: { job: JSON.stringify({ pptx: q.src, outDir, soffice: eng.path, width: SETTINGS.renderWidth || 1920, profile: path.join(DATA, 'engine-profile') }) } });
}

/* ---------------------------------------------------------------- motore LibreOffice */
function findFile(dir, names, depth) {
  if (depth < 0) return null;
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
  for (const n of names) { const f = ents.find(e => e.isFile() && e.name.toLowerCase() === n); if (f) return path.join(dir, f.name); }
  for (const e of ents) if (e.isDirectory() && e.name !== 'help' && e.name !== 'share') { const r = findFile(path.join(dir, e.name), names, depth - 1); if (r) return r; }
  return null;
}
function engineStatus() {
  const exe = process.platform === 'win32' ? ['soffice.com', 'soffice.exe'] : ['soffice'];
  for (const [d, kind] of [[DIR.engineInstall, 'bundled'], [DIR.engineUser, 'bundled']]) { const f = fs.existsSync(d) ? findFile(d, exe, 5) : null; if (f) return { found: true, kind, path: f }; }
  const cands = process.platform === 'win32'
    ? [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files'].filter(Boolean).map(b => path.join(b, 'LibreOffice', 'program', 'soffice.com'))
    : ['/usr/bin/soffice', '/usr/local/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'];
  const sys = cands.find(p => fs.existsSync(p));
  return sys ? { found: true, kind: 'system', path: sys } : { found: false };
}
function extractMsi(msi, onP) {
  return new Promise((res, rej) => {
    if (process.platform !== 'win32') return rej(new Error('Disponibile solo su Windows'));
    const target = path.join(DIR.engineUser, 'libreoffice'); fs.mkdirSync(target, { recursive: true });
    onP(-1, 'Installazione del motore (2-5 minuti)');
    const p = cp.spawn('msiexec', ['/a', `"${msi}"`, '/qn', `TARGETDIR="${target}"`], { windowsVerbatimArguments: true, windowsHide: true });
    p.on('error', rej);
    p.on('close', code => {
      if (code !== 0 && code !== 3010) return rej(new Error('msiexec: codice ' + code));
      const st = engineStatus(); if (!st.found || st.kind !== 'bundled') return rej(new Error('Motore non trovato dopo l\'installazione'));
      try { fs.unlinkSync(msi); } catch (e) {}
      res(st);
    });
  });
}
async function download(u, file, onP, label) {
  const resp = await net.fetch(u); if (!resp.ok) throw new Error('Download non riuscito (HTTP ' + resp.status + ')');
  const total = +resp.headers.get('content-length') || 0;
  const out = fs.createWriteStream(file + '.part'); const rd = resp.body.getReader(); let got = 0, last = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    got += value.length; if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
    if (Date.now() - last > 300) { last = Date.now(); onP(total ? got / total * 100 : -1, `${label}: ${(got / 1048576).toFixed(0)}${total ? ' di ' + (total / 1048576).toFixed(0) : ''} MB`); }
  }
  await new Promise(r => out.end(r)); fs.renameSync(file + '.part', file);
}
async function downloadEngine(onP) {
  fs.mkdirSync(DIR.engineUser, { recursive: true });
  const BASE = 'https://download.documentfoundation.org/libreoffice/stable/';
  onP(-1, 'Ricerca della versione più recente di LibreOffice');
  const html = await (await net.fetch(BASE)).text();
  const vers = [...new Set([...html.matchAll(/href="(\d+\.\d+\.\d+)\/"/g)].map(m => m[1]))]
    .sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; });
  if (!vers.length) throw new Error('Impossibile leggere le versioni disponibili');
  const v = vers[0], name = `LibreOffice_${v}_Win_x86-64.msi`, file = path.join(DIR.engineUser, name);
  await download(`${BASE}${v}/win/x86_64/${name}`, file, onP, 'Download LibreOffice ' + v);
  return extractMsi(file, onP);
}
function unzipTo(zip, dest) {
  return new Promise((res, rej) => {
    fs.mkdirSync(dest, { recursive: true });
    const p = process.platform === 'win32' ? cp.spawn('tar', ['-xf', zip, '-C', dest], { windowsHide: true }) : cp.spawn('unzip', ['-o', '-q', zip, '-d', dest]);
    p.on('error', rej); p.on('close', c => c === 0 ? res() : rej(new Error('Estrazione non riuscita (' + c + ')')));
  });
}

/* ---------------------------------------------------------------- musica */
function audioFiles(dir) {
  let f = []; try { f = fs.readdirSync(dir, { withFileTypes: true }).filter(x => x.isFile() && AUDIO_EXT.test(x.name)).map(x => x.name); } catch (e) {}
  return f.sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
}
const prettyName = f => f.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/^\d+\s*[-.]\s*/, '');
function musicSources(deckId) {
  const track = (file, src, id, cat) => ({ id, src, cat, name: prettyName(path.basename(file)), file, url: url.pathToFileURL(file).href });
  const def = new Map();
  for (const root of [DIR.defInstall, DIR.defUser]) {
    let ents = []; try { ents = fs.readdirSync(root, { withFileTypes: true }); } catch (e) {}
    for (const e of ents) {
      if (e.isDirectory()) for (const f of audioFiles(path.join(root, e.name))) { const k = e.name; if (!def.has(k)) def.set(k, []); if (!def.get(k).some(t => t.id === `d:${k}/${f}`)) def.get(k).push(track(path.join(root, e.name, f), 'default', `d:${k}/${f}`, k)); }
      else if (e.isFile() && AUDIO_EXT.test(e.name)) { const k = 'Varie'; if (!def.has(k)) def.set(k, []); def.get(k).push(track(path.join(root, e.name), 'default', `d:${k}/${e.name}`, k)); }
    }
  }
  const out = {
    default: [...def.entries()].sort((a, b) => a[0].localeCompare(b[0], 'it')).map(([cat, tracks]) => ({ cat, tracks })),
    global: audioFiles(DIR.global).map(f => track(path.join(DIR.global, f), 'global', 'g:' + f)),
    deck: deckId ? audioFiles(path.join(DIR.music, deckId)).map(f => track(path.join(DIR.music, deckId, f), 'deck', 'p:' + f)) : [],
    dirs: { global: DIR.global, deck: deckId ? path.join(DIR.music, deckId) : null },
  };
  return out;
}
function targetDir(target) {
  if (target === 'global') return DIR.global;
  if (target === 'default') return fs.existsSync(DIR.defInstall) ? DIR.defInstall : DIR.defUser;
  if (typeof target === 'string' && target.startsWith('deck:')) { const id = target.slice(5); if (fs.existsSync(deckDir(id))) return path.join(DIR.music, id); }
  throw new Error('Destinazione non valida');
}
function addMusic(target, files) {
  const dir = targetDir(target); if (target === 'default') throw new Error('La musica predefinita non si modifica');
  fs.mkdirSync(dir, { recursive: true });
  const added = [], skipped = [];
  for (const f of files) {
    if (!AUDIO_EXT.test(f) || !fs.existsSync(f)) { skipped.push(path.basename(f)); continue; }
    let name = path.basename(f), dst = path.join(dir, name);
    if (fs.existsSync(dst)) {
      if (fs.statSync(dst).size === fs.statSync(f).size) { skipped.push(name); continue; }
      const b = name.replace(/(\.[^.]+)$/, ''), x = path.extname(name); let k = 2;
      while (fs.existsSync(dst)) { name = `${b} (${k++})${x}`; dst = path.join(dir, name); }
    }
    fs.copyFileSync(f, dst); added.push(name);
  }
  return { added, skipped };
}
let watchers = [];
function watchMusic(deckId) {
  watchers.forEach(w => { try { w.close(); } catch (e) {} }); watchers = [];
  let t = null; const ping = () => { clearTimeout(t); t = setTimeout(() => { for (const w of [pres, lib]) if (w && !w.isDestroyed()) w.webContents.send('music:changed'); }, 500); };
  for (const d of [DIR.global, deckId ? path.join(DIR.music, deckId) : null, DIR.defInstall, DIR.defUser].filter(Boolean)) {
    try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
    try { watchers.push(fs.watch(d, { recursive: process.platform === 'win32' }, ping)); } catch (e) {}
  }
}

/* ---------------------------------------------------------------- finestre */
let lib = null, pres = null, aud = null, deck = null, quitting = false, psb = null;
let AUD = { open: false, locked: false, displayId: null };
const prefs = extra => Object.assign({ preload: path.join(APP_DIR, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false, backgroundThrottling: false, spellcheck: false }, extra || {});

function openLibrary() {
  lib = new BrowserWindow({ width: 1240, height: 800, minWidth: 980, minHeight: 640, show: false, backgroundColor: '#14171f', icon: ICON, title: 'InRegia', autoHideMenuBar: true, webPreferences: prefs() });
  lib.loadFile(path.join(APP_DIR, 'ui', 'library.html'));
  lib.once('ready-to-show', () => lib.show());
  lib.on('closed', () => { lib = null; if (!pres && !quitting) app.quit(); });
  watchMusic(null);
}
function displays() {
  const prim = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({ id: d.id, label: d.label || '', n: i + 1, w: d.size.width, h: d.size.height, primary: d.id === prim }));
}
const presenterDisplay = () => pres ? screen.getDisplayMatching(pres.getBounds()) : screen.getPrimaryDisplay();
function pickDisplay(id) {
  const all = screen.getAllDisplays();
  if (id != null) { const d = all.find(x => x.id === id); if (d) return d; }
  const pd = presenterDisplay(); return all.find(d => d.id !== pd.id) || pd;
}
function openPresenter(id) {
  const dir = deckDir(id), mf = readJson(path.join(dir, 'manifest.json'), null);
  if (!mf) throw new Error('Presentazione non importata');
  deck = { id, dir, manifest: mf, base: url.pathToFileURL(dir).href + '/' };
  fs.mkdirSync(path.join(DIR.music, id), { recursive: true });
  SETTINGS.lastDeck = id; saveSettings();
  const wa = screen.getPrimaryDisplay().workArea;
  pres = new BrowserWindow({ x: wa.x, y: wa.y, width: Math.min(1600, wa.width), height: Math.min(980, wa.height), minWidth: 1100, minHeight: 680, show: false, backgroundColor: '#14171f', icon: ICON, title: 'InRegia - ' + mf.name, autoHideMenuBar: true, webPreferences: prefs() });
  pres.loadFile(path.join(APP_DIR, 'ui', 'presenter.html'));
  pres.once('ready-to-show', () => { pres.maximize(); pres.show(); });
  pres.on('close', e => {
    if (quitting || pres._back) return;
    e.preventDefault();
    dialog.showMessageBox(pres, { type: 'question', buttons: ['Chiudi InRegia', 'Annulla'], defaultId: 1, cancelId: 1, title: 'InRegia', message: 'Chiudere la presentazione?', detail: 'Si chiude anche lo schermo del proiettore.' })
      .then(r => { if (r.response === 0) { quitting = true; app.quit(); } });
  });
  pres.on('closed', () => { pres = null; if (aud) { aud.destroy(); aud = null; } if (psb != null) { powerSaveBlocker.stop(psb); psb = null; } if (!lib && !quitting) app.quit(); });
  createAudience();
  psb = powerSaveBlocker.start('prevent-display-sleep');
  watchMusic(id);
}

/* Il proiettore "chiuso" resta una finestra attiva ma invisibile: audio e video non vengono mai sospesi. */
function createAudience() {
  aud = new BrowserWindow({ show: false, frame: false, transparent: false, backgroundColor: '#000000', icon: ICON, title: 'InRegia - Proiettore', skipTaskbar: true, focusable: false,
    fullscreenable: true, resizable: true, webPreferences: prefs() });
  aud.loadFile(path.join(APP_DIR, 'ui', 'audience.html'));
  aud.once('ready-to-show', () => park());
  aud.on('close', e => { if (!quitting && pres) { e.preventDefault(); hideAudience(); } });
  aud.on('closed', () => { aud = null; });
  aud.on('leave-full-screen', () => setTimeout(notifyAud, 50));
  aud.on('enter-full-screen', () => setTimeout(notifyAud, 50));
  aud.webContents.on('before-input-event', (e, inp) => {
    if (AUD.locked || !AUD.open) { e.preventDefault(); return; }
    if (inp.type !== 'keyDown') return;
    e.preventDefault();
    if (inp.key === 'Escape') { if (AUD.displayId === presenterDisplay().id) hideAudience(); else if (aud.isFullScreen()) aud.setFullScreen(false); }
    else if (inp.key === 'F11') aud.setFullScreen(!aud.isFullScreen());
    else if (pres) pres.webContents.send('key', { key: inp.key, shift: inp.shift, ctrl: inp.control });
  });
}
function park() {
  if (!aud) return;
  if (aud.isFullScreen()) aud.setFullScreen(false);
  const wa = presenterDisplay().workArea;
  aud.setOpacity(0); aud.setIgnoreMouseEvents(true); aud.setFocusable(false); aud.setSkipTaskbar(true); aud.setAlwaysOnTop(false);
  aud.setBounds({ x: wa.x + wa.width - 4, y: wa.y + wa.height - 4, width: 2, height: 2 });
  aud.showInactive();
}
function applyLock() {
  if (!aud || !AUD.open) return;
  const L = AUD.locked;
  aud.setFocusable(!L); aud.setMovable(!L); aud.setResizable(!L);
  aud.setIgnoreMouseEvents(false);
  const other = AUD.displayId !== presenterDisplay().id;
  aud.setAlwaysOnTop(L && other, 'screen-saver');
  aud.webContents.send('msg', { t: 'lock', on: L });
  if (L && pres && other) pres.focus();
}
function showAudience(displayId) {
  if (!aud) createAudience();
  const d = pickDisplay(displayId), same = d.id === presenterDisplay().id;
  AUD.displayId = d.id; AUD.open = true;
  aud.setOpacity(1); aud.setSkipTaskbar(false); aud.setIgnoreMouseEvents(false);
  aud.setBounds(d.bounds); aud.showInactive();
  setTimeout(() => { if (!aud || !AUD.open) return; aud.setBounds(d.bounds); aud.setFullScreen(true); if (same) { aud.setFocusable(true); aud.focus(); } }, 80);
  applyLock();
  if (!same && pres) setTimeout(() => pres && pres.focus(), 250);
  aud.webContents.send('msg', { t: 'onair', on: true, same });
  notifyAud();
}
function hideAudience() {
  AUD.open = false;
  if (aud) { aud.webContents.send('msg', { t: 'onair', on: false }); aud.webContents.send('msg', { t: 'lock', on: false }); park(); }
  AUD.locked = false;
  if (pres) pres.focus();
  notifyAud();
}
function notifyAud() {
  if (pres && !pres.isDestroyed()) pres.webContents.send('aud-state', Object.assign({}, AUD, { fullscreen: !!(aud && AUD.open && aud.isFullScreen()), displays: displays(), presenterDisplay: presenterDisplay().id }));
}

/* ---------------------------------------------------------------- IPC */
ipcMain.handle('lib:list', () => ({ decks: deckList(), engine: engineStatus(), settings: SETTINGS, version: app.getVersion(),
  defaultMusic: musicSources(null).default.reduce((a, c) => a + c.tracks.length, 0) }));
ipcMain.handle('lib:pick', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Importa presentazioni', filters: [{ name: 'Presentazioni PowerPoint', extensions: ['pptx'] }], properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('lib:import', (e, paths) => enqueue(paths || []));
ipcMain.handle('lib:reimport', (e, id) => { const s = readJson(path.join(deckDir(id), 'source.json'), {}); return s.path ? enqueue([s.path]) : { added: [], rejected: [id] }; });
ipcMain.handle('lib:retry', (e, id) => { const q = QUEUE.find(x => x.id === id); if (q) { q.state = 'queued'; q.error = null; pump(); libNotify(); } return true; });
ipcMain.handle('lib:dismiss', (e, id) => { const i = QUEUE.findIndex(x => x.id === id && x.state === 'error'); if (i >= 0) QUEUE.splice(i, 1); if (!fs.existsSync(path.join(deckDir(id), 'manifest.json'))) try { fs.rmSync(deckDir(id), { recursive: true, force: true }); } catch (er) {} libNotify(); return true; });
ipcMain.handle('lib:remove', (e, id, alsoMusic) => {
  if (QUEUE.some(q => q.id === id && q.state === 'running')) return false;
  try { fs.rmSync(deckDir(id), { recursive: true, force: true }); } catch (er) {}
  if (alsoMusic) try { fs.rmSync(path.join(DIR.music, id), { recursive: true, force: true }); } catch (er) {}
  libNotify(); return true;
});
ipcMain.handle('lib:reveal', (e, id) => { const s = readJson(path.join(deckDir(id), 'source.json'), {}); if (s.path && fs.existsSync(s.path)) shell.showItemInFolder(s.path); else shell.openPath(deckDir(id)); return true; });
ipcMain.handle('settings:set', (e, o) => { Object.assign(SETTINGS, o); saveSettings(); return SETTINGS; });
ipcMain.handle('open:data', () => shell.openPath(DATA));
ipcMain.handle('engine:download', async e => {
  try { const st = await downloadEngine((p, m) => e.sender.send('job:progress', { p, m })); return { ok: true, st }; }
  catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('engine:msi', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'File di installazione di LibreOffice (.msi)', filters: [{ name: 'LibreOffice MSI', extensions: ['msi'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  try {
    fs.mkdirSync(DIR.engineUser, { recursive: true });
    const dst = path.join(DIR.engineUser, path.basename(r.filePaths[0]));
    e.sender.send('job:progress', { p: -1, m: 'Copia del file' }); await fs.promises.copyFile(r.filePaths[0], dst);
    return { ok: true, st: await extractMsi(dst, (p, m) => e.sender.send('job:progress', { p, m })) };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('music:sources', (e, id) => musicSources(id || null));
ipcMain.handle('music:pick', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { title: 'Aggiungi musica', filters: [{ name: 'Audio', extensions: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'opus', 'weba'] }], properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('music:add', (e, target, files) => { try { return Object.assign({ ok: true }, addMusic(target, files || [])); } catch (err) { return { ok: false, error: String(err.message || err) }; } });
ipcMain.handle('music:remove', (e, target, name) => {
  try { if (target === 'default') throw new Error('no'); const f = path.join(targetDir(target), path.basename(name)); fs.unlinkSync(f); return true; } catch (err) { return false; }
});
ipcMain.handle('music:open', (e, target) => { try { const d = targetDir(target); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); } catch (er) { return ''; } });
ipcMain.handle('music:downloadDefault', async e => {
  try {
    const tmp = path.join(app.getPath('temp'), 'inregia-music.zip');
    await download(MUSIC_PACK_URL, tmp, (p, m) => e.sender.send('job:progress', { p, m }), 'Download musica predefinita');
    e.sender.send('job:progress', { p: -1, m: 'Estrazione' });
    await unzipTo(tmp, DIR.defUser); try { fs.unlinkSync(tmp); } catch (er) {}
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('deck:open', (e, id) => {
  try { openPresenter(id); if (lib) { const l = lib; lib = null; l.destroy(); } return { ok: true }; }
  catch (err) { return { ok: false, error: String(err.message || err) }; }
});
ipcMain.handle('deck:info', () => deck ? { manifest: deck.manifest, base: deck.base, id: deck.id, state: readJson(path.join(deck.dir, 'state.json'), {}), settings: SETTINGS } : null);
ipcMain.on('deck:state', (e, st) => { if (deck) writeJson(path.join(deck.dir, 'state.json'), st); });
ipcMain.handle('aud:show', (e, id) => { showAudience(id); return true; });
ipcMain.handle('aud:hide', () => { hideAudience(); return true; });
ipcMain.handle('aud:lock', (e, on) => { if (!AUD.open) return false; AUD.locked = !!on; applyLock(); notifyAud(); return AUD.locked; });
ipcMain.handle('aud:state', () => { notifyAud(); return true; });
ipcMain.handle('aud:fullscreen', () => { if (aud && AUD.open) { const d = pickDisplay(AUD.displayId); aud.setBounds(d.bounds); aud.setFullScreen(true); } setTimeout(notifyAud, 300); return true; });
ipcMain.on('p2a', (e, m) => { if (aud && !aud.isDestroyed()) aud.webContents.send('msg', m); });
ipcMain.on('a2p', (e, m) => { if (pres && !pres.isDestroyed()) pres.webContents.send('msg', m); });
ipcMain.handle('app:back', () => {
  if (!pres) return;
  const p = pres; p._back = true; if (aud) { aud.destroy(); aud = null; }
  AUD = { open: false, locked: false, displayId: null };
  openLibrary(); p.close();
});
ipcMain.handle('app:quit', () => { if (pres) pres.close(); else app.quit(); });

app.whenReady().then(() => {
  const ch = () => { if (aud && AUD.open && !screen.getAllDisplays().some(d => d.id === AUD.displayId)) hideAudience(); notifyAud(); };
  screen.on('display-added', ch); screen.on('display-removed', ch); screen.on('display-metrics-changed', ch);
  if (process.env.INREGIA_OPEN) { try { openPresenter(process.env.INREGIA_OPEN); return; } catch (e) {} }
  openLibrary();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
