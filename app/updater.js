'use strict';
/* Aggiornamenti: app (release GitHub) e motore di conversione LibreOffice. */
const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const url = require('url');

const REPO = 'Rotolino37/inregia';
const LO_BASE = 'https://download.documentfoundation.org/libreoffice/stable/';

/* ------------------------------------------------------------ versioni */
// "v2026.12-beta.2", "2026.12.0-beta.2", "2026.12" -> [2026, 12, 0, rango, n]
const PRE = { alpha: 0, beta: 1, rc: 2 };
function parseVer(v) {
  const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-. ]?(alpha|beta|rc)[-. ]?(\d+)?)?/i);
  if (!m) return null;
  const pre = m[4] ? PRE[m[4].toLowerCase()] : 3;
  return [+m[1], +(m[2] || 0), +(m[3] || 0), pre, +(m[5] || 0)];
}
function cmpVer(a, b) {
  const x = parseVer(a), y = parseVer(b);
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let i = 0; i < 5; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
const isPre = v => { const p = parseVer(v); return !!p && p[3] < 3; };
// "v2026.12-beta.2" -> "v2026.12 beta 2"
const prettyTag = t => String(t).replace(/-(alpha|beta|rc)\.?(\d*)/i, (s, k, n) => ' ' + k.toLowerCase() + (n ? ' ' + n : ''));

/* ------------------------------------------------------------ rete */
async function getJson(u) {
  const r = await net.fetch(u, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'InRegia/' + app.getVersion() } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function getText(u) {
  if (/^file:/i.test(u)) return fs.readFileSync(url.fileURLToPath(u), 'utf8');
  const r = await net.fetch(u, { headers: { 'User-Agent': 'InRegia/' + app.getVersion() } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
async function download(u, file, onP, label) {
  if (/^file:/i.test(u)) { await fs.promises.copyFile(url.fileURLToPath(u), file); return; }
  const resp = await net.fetch(u); if (!resp.ok) throw new Error('Download non riuscito (HTTP ' + resp.status + ')');
  const total = +resp.headers.get('content-length') || 0;
  const out = fs.createWriteStream(file + '.part'); const rd = resp.body.getReader(); let got = 0, last = 0;
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    got += value.length; if (!out.write(Buffer.from(value))) await new Promise(r => out.once('drain', r));
    if (Date.now() - last > 250) { last = Date.now(); onP(total ? got / total * 100 : -1, `${label}: ${(got / 1048576).toFixed(0)}${total ? ' di ' + (total / 1048576).toFixed(0) : ''} MB`); }
  }
  await new Promise(r => out.end(r)); fs.renameSync(file + '.part', file);
}
const sha256 = f => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('error', rej).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))); });

/* ------------------------------------------------------------ app */
/* Feed: GitHub Releases. INREGIA_UPDATE_FEED (file JSON) sostituisce il feed nei test. */
async function releases() {
  const feed = process.env.INREGIA_UPDATE_FEED;
  if (feed) return JSON.parse(fs.readFileSync(feed, 'utf8'));
  const list = await getJson(`https://api.github.com/repos/${REPO}/releases?per_page=15`);
  return list.filter(r => !r.draft).map(r => ({
    tag: r.tag_name, name: r.name || prettyTag(r.tag_name), prerelease: !!r.prerelease, date: r.published_at, url: r.html_url, notes: r.body || '',
    assets: (r.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
  }));
}
async function checkApp(channel) {
  const cur = app.getVersion();
  const beta = channel !== 'stable';
  const all = (await releases()).filter(r => parseVer(r.tag) && (beta || (!r.prerelease && !isPre(r.tag))));
  all.sort((a, b) => cmpVer(b.tag, a.tag));
  const top = all[0];
  const setup = top && top.assets.find(a => /^InRegia-Setup-.*\.exe$/i.test(a.name));
  const sums = top && top.assets.find(a => /^SHA256SUMS\.txt$/i.test(a.name));
  const available = !!(top && setup && cmpVer(top.tag, cur) > 0);
  return {
    current: cur, currentName: prettyTag('v' + cur.replace(/^(\d+\.\d+)\.0(?=-|$)/, '$1')), channel: beta ? 'beta' : 'stable', checked: new Date().toISOString(), available,
    latest: top ? { tag: top.tag, name: top.name || prettyTag(top.tag), prerelease: top.prerelease, date: top.date, url: top.url, notes: summarize(top.notes), setup, sums } : null,
    canInstall: process.platform === 'win32' && app.isPackaged,
  };
}
// Note di rilascio in testo semplice, prime righe utili.
function summarize(md) {
  return String(md || '').split(/\r?\n/).map(l => l.replace(/^#+\s*/, '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim())
    .filter(l => l && !/^(code signing|privacy|sha256)/i.test(l)).slice(0, 14).join('\n');
}
/* Scarica il setup, verifica SHA-256 e lo avvia in modalità aggiornamento (chiede l'autorizzazione di Windows).
   Il setup chiude InRegia, sostituisce solo il programma e lo riapre. */
async function installApp(info, tmpDir, onP) {
  if (process.platform !== 'win32') throw new Error('Aggiornamento automatico disponibile solo su Windows');
  const L = info && info.latest; if (!L || !L.setup) throw new Error('Nessun aggiornamento disponibile');
  let file;
  if (/^file:/i.test(L.setup.url)) file = url.fileURLToPath(L.setup.url); // test: setup locale, usato sul posto
  else {
    fs.mkdirSync(tmpDir, { recursive: true });
    for (const f of fs.readdirSync(tmpDir)) try { fs.rmSync(path.join(tmpDir, f), { force: true, recursive: true }); } catch (e) {}
    file = path.join(tmpDir, L.setup.name);
    await download(L.setup.url, file, onP, 'Download ' + L.name);
  }
  if (L.sums) {
    onP(-1, 'Verifica del file');
    const txt = await getText(L.sums.url);
    const line = txt.split(/\r?\n/).find(l => l.trim().endsWith(L.setup.name));
    if (line) { const want = line.trim().split(/\s+/)[0].toLowerCase(); const got = await sha256(file); if (want !== got) throw new Error('File scaricato non valido (SHA-256 diverso)'); }
  }
  onP(-1, 'Avvio dell\'installazione');
  const p = cp.spawn(file, ['/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOCANCEL', '/COMPONENTS=app', '/UPDATE=1'], { detached: true, stdio: 'ignore', windowsHide: false });
  await new Promise((res, rej) => { p.once('error', rej); p.once('spawn', res); });
  p.unref();
  return true;
}

/* ------------------------------------------------------------ LibreOffice */
function loInstalledVersion(soffice) {
  if (!soffice) return null;
  const prog = path.dirname(soffice);
  for (const f of [path.join(prog, '..', 'inregia-version.txt'), path.join(prog, 'inregia-version.txt')]) {
    try { const v = fs.readFileSync(f, 'utf8').trim(); if (parseVer(v)) return v.split('.').slice(0, 3).join('.'); } catch (e) {}
  }
  for (const n of ['version.ini', 'versionrc']) {
    try {
      const t = fs.readFileSync(path.join(prog, n), 'utf8');
      const m = t.match(/MsiProductVersion=(\d+\.\d+\.\d+)/) || t.match(/ProductVersion=(\d+\.\d+\.\d+)/) || t.match(/\bVersion=(\d+\.\d+\.\d+)/i);
      if (m) return m[1];
    } catch (e) {}
  }
  return null;
}
async function loLatest() {
  if (process.env.INREGIA_LO_LATEST) return process.env.INREGIA_LO_LATEST;
  const html = await getText(LO_BASE);
  const vers = [...new Set([...html.matchAll(/href="(\d+\.\d+\.\d+)\/"/g)].map(m => m[1]))].sort((a, b) => cmpVer(b, a));
  if (!vers.length) throw new Error('Impossibile leggere le versioni di LibreOffice');
  return vers[0];
}
/* engineDir: cartella "engine" che contiene (o conterrà) "libreoffice". elevate: serve l'autorizzazione di Windows (Programmi). */
async function loUpdate({ version, engineDir, dlDir, elevate, onP }) {
  if (process.platform !== 'win32') throw new Error('Disponibile solo su Windows');
  fs.mkdirSync(dlDir, { recursive: true });
  const name = `LibreOffice_${version}_Win_x86-64.msi`, msi = path.join(dlDir, name);
  if (!fs.existsSync(msi)) await download(`${LO_BASE}${version}/win/x86_64/${name}`, msi, onP, 'Download LibreOffice ' + version);
  onP(-1, elevate ? 'Installazione di LibreOffice ' + version + ' (conferma l\'autorizzazione di Windows)' : 'Installazione di LibreOffice ' + version);
  const ps1 = path.join(dlDir, 'aggiorna-libreoffice.ps1');
  const q = s => "'" + String(s).replace(/'/g, "''") + "'";
  fs.writeFileSync(ps1, [
    "$ErrorActionPreference = 'Stop'",
    `$eng = ${q(engineDir)}; $msi = ${q(msi)}; $ver = ${q(version)}`,
    "$new = Join-Path $eng 'libreoffice.new'; $cur = Join-Path $eng 'libreoffice'; $old = Join-Path $eng 'libreoffice.old'",
    "New-Item -ItemType Directory -Force -Path $eng | Out-Null",
    "if (Test-Path $new) { Remove-Item $new -Recurse -Force }",
    "$p = Start-Process -FilePath msiexec.exe -ArgumentList @('/a', ('\"' + $msi + '\"'), '/qn', ('TARGETDIR=\"' + $new + '\"')) -Wait -PassThru -WindowStyle Hidden",
    "if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { exit 10 }",
    "if (-not (Get-ChildItem -Path $new -Recurse -Filter soffice.com -ErrorAction SilentlyContinue | Select-Object -First 1)) { exit 11 }",
    "Set-Content -Path (Join-Path $new 'inregia-version.txt') -Value $ver -Encoding ascii",
    "if (Test-Path $old) { Remove-Item $old -Recurse -Force -ErrorAction SilentlyContinue }",
    "if (Test-Path $cur) { Rename-Item -Path $cur -NewName 'libreoffice.old' }",
    "Rename-Item -Path $new -NewName 'libreoffice'",
    "$fd = Join-Path $cur 'share\\fonts\\truetype'; New-Item -ItemType Directory -Force -Path $fd | Out-Null",
    "& icacls.exe $fd /grant '*S-1-5-32-545:(OI)(CI)M' | Out-Null",
    "if (Test-Path $old) { Remove-Item $old -Recurse -Force -ErrorAction SilentlyContinue }",
    'exit 0',
  ].join('\r\n'), 'utf8');
  const inner = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1];
  const args = elevate
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `try { $p = Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList ${inner.map(x => q(x.includes(' ') ? '"' + x + '"' : x)).join(',')}; exit $p.ExitCode } catch { exit 20 }`]
    : inner;
  const code = await new Promise((res, rej) => { const p = cp.spawn('powershell.exe', args, { windowsHide: true }); p.on('error', rej); p.on('close', res); });
  if (code === 20) throw new Error('Autorizzazione di Windows non concessa');
  if (code !== 0) throw new Error('Installazione di LibreOffice non riuscita (codice ' + code + ')');
  try { fs.unlinkSync(msi); fs.unlinkSync(ps1); } catch (e) {}
  return true;
}

module.exports = { parseVer, cmpVer, prettyTag, checkApp, installApp, loInstalledVersion, loLatest, loUpdate };
