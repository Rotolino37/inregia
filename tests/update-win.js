'use strict';

// su GitHub Actions i fallimenti diventano annotazioni, leggibili senza accesso ai log
const ghErr = m => { if (process.env.GITHUB_ACTIONS) console.log('::error::' + String(m).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A').slice(0, 900)); };
/* Test degli aggiornamenti con un click sull'app installata (solo Windows, in CI).
 *   node tests/update-win.js lo   -> aggiorna (reinstalla) LibreOffice dall'app, con richiesta di autorizzazione
 *   node tests/update-win.js app  -> l'app scarica e avvia il setup, si chiude, il setup la aggiorna e la riapre
 * Variabili: INREGIA_EXE, INREGIA_SETUP (setup con lo zip dell'app accanto, per l'installazione offline).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
const url = require('url');
const { _electron } = require(path.join(__dirname, '..', 'app', 'node_modules', 'playwright-core'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EXE = process.env.INREGIA_EXE;
const mode = process.argv[2];
let ok = true;
const check = (n, c, i) => { if (!c) ghErr('FAIL ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); console.log((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if (!c) ok = false; };
const running = () => { try { return /InRegia\.exe/i.test(cp.execSync('tasklist /FI "IMAGENAME eq InRegia.exe" /NH').toString()); } catch (e) { return false; } };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inregia-upd-'));
  const env = Object.assign({}, process.env, { INREGIA_DATA: path.join(tmp, 'data'), INREGIA_NO_UPDATE_CHECK: '1' });
  if (mode === 'lo') {
    env.INREGIA_FORCE_ELEVATE = '1';
    const app = await _electron.launch({ executablePath: EXE, env });
    const w = await app.firstWindow(); await w.waitForSelector('#v-decks', { timeout: 30000 });
    const before = await w.evaluate(() => DP.invoke('engine:check'));
    check('LibreOffice installato con versione', before.status.found && !!before.installed && !!before.latest, { installed: before.installed, latest: before.latest, path: before.status.path });
    const t0 = Date.now();
    const r = await w.evaluate(() => DP.invoke('engine:update', { force: true }));
    check('aggiornamento LibreOffice con un click', r.ok && r.info && r.info.status.found && r.info.installed === before.latest, { r: r.ok, err: r.error, after: r.info && r.info.installed, sec: Math.round((Date.now() - t0) / 1000) });
    const eng = path.dirname(r.info ? r.info.status.dir + path.sep + 'x' : before.status.path);
    check('nessuna cartella temporanea rimasta', !fs.existsSync(path.join(eng, 'libreoffice.new')) && !fs.existsSync(path.join(eng, 'libreoffice.old')), fs.readdirSync(eng));
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  } else if (mode === 'app') {
    const setup = process.env.INREGIA_SETUP;
    const sums = path.join(path.dirname(setup), 'SHA256SUMS.txt');
    const h = crypto.createHash('sha256').update(fs.readFileSync(setup)).digest('hex');
    fs.writeFileSync(sums, `${h}  ${path.basename(setup)}\n`);
    const feed = path.join(tmp, 'feed.json');
    fs.writeFileSync(feed, JSON.stringify([{ tag: 'v2099.1', name: 'InRegia v2099.1', prerelease: false, notes: 'Prova', assets: [
      { name: 'InRegia-Setup-v2099.1.exe', url: url.pathToFileURL(setup).href }, { name: 'SHA256SUMS.txt', url: url.pathToFileURL(sums).href }] }]));
    // il nome nel feed è diverso da quello del file: la riga di SHA256SUMS deve corrispondere al nome dell'asset
    fs.writeFileSync(sums, `${h}  InRegia-Setup-v2099.1.exe\n`);
    env.INREGIA_UPDATE_FEED = feed;
    const DAT = path.join(path.dirname(EXE), 'unins000.dat'); // riscritto da ogni installazione (tar conserva le date dei file)
    const exeT0 = fs.statSync(DAT).mtimeMs;
    const app = await _electron.launch({ executablePath: EXE, env });
    const w = await app.firstWindow(); await w.waitForSelector('#v-decks', { timeout: 30000 });
    const c = await w.evaluate(() => DP.invoke('update:check'));
    check('aggiornamento trovato', c.app.available && c.app.canInstall, { latest: c.app.latest && c.app.latest.tag, can: c.app.canInstall });
    const closed = new Promise(r => app.process().once('exit', () => r(true)));
    const r = await w.evaluate(() => DP.invoke('update:install'));
    check('setup avviato dall\'app', r.ok, r);
    check('InRegia si chiude per l\'aggiornamento', await Promise.race([closed, sleep(30000).then(() => false)]));
    let replaced = false, relaunched = false; const t0 = Date.now();
    while (Date.now() - t0 < 8 * 60000) {
      await sleep(3000);
      try { replaced = replaced || fs.statSync(DAT).mtimeMs > exeT0; } catch (e) {}
      if (replaced && running()) { relaunched = true; break; }
    }
    check('programma sostituito dal setup', replaced);
    check('InRegia riaperto dopo l\'aggiornamento', relaunched, Math.round((Date.now() - t0) / 1000) + ' s');
    try { cp.execSync('taskkill /IM InRegia.exe /F'); } catch (e) {}
  } else throw new Error('Uso: update-win.js lo|app');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  console.log(ok ? 'TEST AGGIORNAMENTO SUPERATI' : 'TEST AGGIORNAMENTO FALLITI');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('ERRORE', e); ghErr('ERRORE ' + (e && e.stack || e)); process.exit(1); });
