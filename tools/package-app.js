'use strict';
/*
 * Assembla InRegia per Windows x64:
 *   dist/win-unpacked/            InRegia.exe + runtime + resources/app
 *   dist/InRegia-app-win-x64.zip  pacchetto scaricato dall'installer
 * Uso: node tools/package-app.js [--electron-zip percorso.zip]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'win-unpacked');
const req = require('module').createRequire(path.join(APP, 'package.json'));
const yauzl = req('yauzl'), yazl = req('yazl'), RE = req('resedit'), PE = req('pe-library');

const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const EV = pkg.devDependencies.electron.replace(/^[^\d]*/, '');
const VERSION = pkg.version;                         // 2026.12.0-beta.1
const m = /^(\d+)\.(\d+)\.(\d+)(?:-[a-z]+\.(\d+))?/.exec(VERSION);
const FILEVER = [+m[1], +m[2], +m[3], +(m[4] || 0)];

function get(url, file) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'inregia-build' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(r.headers.location, file).then(res, rej); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode + ' ' + url)); }
      const w = fs.createWriteStream(file); r.pipe(w); w.on('close', res); w.on('error', rej);
    }).on('error', rej);
  });
}
function unzip(zip, dest) {
  return new Promise((res, rej) => yauzl.open(zip, { lazyEntries: true }, (e, z) => {
    if (e) return rej(e);
    z.on('entry', en => {
      const p = path.join(dest, en.fileName);
      if (/\/$/.test(en.fileName)) { fs.mkdirSync(p, { recursive: true }); return z.readEntry(); }
      fs.mkdirSync(path.dirname(p), { recursive: true });
      z.openReadStream(en, (er, s) => { if (er) return rej(er); const w = fs.createWriteStream(p); s.pipe(w); w.on('close', () => z.readEntry()); });
    });
    z.on('end', res); z.on('error', rej); z.readEntry();
  }));
}
function zipDir(dir, file) {
  return new Promise((res, rej) => {
    const z = new yazl.ZipFile(); const w = fs.createWriteStream(file);
    z.outputStream.pipe(w); w.on('close', res); w.on('error', rej);
    const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(p, r); else z.addFile(p, r, { compress: !/\.(png|jpg|pak|dat|bin|dll|exe|node)$/i.test(e.name) || /\.(exe|dll)$/i.test(e.name) }); } };
    walk(dir, ''); z.end();
  });
}
function copy(src, dst, filter) {
  const st = fs.statSync(src);
  if (st.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src)) { const s = path.join(src, e); if (!filter || filter(s)) copy(s, path.join(dst, e), filter); } }
  else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  let ez = process.argv.includes('--electron-zip') ? process.argv[process.argv.indexOf('--electron-zip') + 1] : null;
  if (!ez) {
    ez = path.join(DIST, `electron-v${EV}-win32-x64.zip`);
    if (!fs.existsSync(ez)) { console.log('Download Electron', EV); await get(`https://github.com/electron/electron/releases/download/v${EV}/electron-v${EV}-win32-x64.zip`, ez); }
  }
  console.log('Estrazione runtime'); await unzip(ez, OUT);
  fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'InRegia.exe'));
  fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true });
  for (const f of fs.readdirSync(path.join(OUT, 'locales'))) if (!/^(it|en-US)\.pak$/.test(f)) fs.unlinkSync(path.join(OUT, 'locales', f));

  console.log('Copia applicazione');
  const dst = path.join(OUT, 'resources', 'app');
  fs.mkdirSync(dst, { recursive: true });
  for (const e of ['main.js', 'preload.js', 'importer.js', 'ui', 'assets']) copy(path.join(APP, e), path.join(dst, e));
  fs.writeFileSync(path.join(dst, 'package.json'), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: VERSION, main: 'main.js', license: pkg.license }, null, 1));
  // dipendenze di produzione
  const list = cp.execSync('npm ls --omit=dev --parseable --all', { cwd: APP, encoding: 'utf8' }).split(/\r?\n/).filter(p => p && p !== APP && p.includes('node_modules'));
  for (const p of list) {
    const rel = path.relative(APP, p);
    if (/pdfjs-dist$/.test(p)) { // solo i file usati
      for (const f of ['package.json', 'LICENSE', 'build/pdf.min.js', 'build/pdf.worker.min.js']) { const s = path.join(p, f); if (fs.existsSync(s)) { fs.mkdirSync(path.dirname(path.join(dst, rel, f)), { recursive: true }); fs.copyFileSync(s, path.join(dst, rel, f)); } }
    } else copy(p, path.join(dst, rel), s => !/[\\/](test|tests|docs|\.github)$/.test(s));
  }
  // licenze
  fs.copyFileSync(path.join(ROOT, 'LICENSE.md'), path.join(OUT, 'LICENSE.InRegia.md'));

  console.log('Icona e informazioni di versione');
  const exeP = path.join(OUT, 'InRegia.exe');
  const exe = PE.NtExecutable.from(fs.readFileSync(exeP), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(exe);
  const ico = RE.Data.IconFile.from(fs.readFileSync(path.join(APP, 'assets', 'inregia.ico')));
  const g = RE.Resource.IconGroupEntry.fromEntries(res.entries)[0];
  RE.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map(i => i.data));
  const vi = RE.Resource.VersionInfo.fromEntries(res.entries)[0];
  const lang = vi.getAllLanguagesForStringValues()[0];
  vi.setStringValues(lang, { ProductName: 'InRegia', FileDescription: 'InRegia', CompanyName: 'InRegia', OriginalFilename: 'InRegia.exe', InternalName: 'InRegia',
    LegalCopyright: 'MIT License', ProductVersion: VERSION, FileVersion: FILEVER.join('.') });
  vi.setFileVersion(...FILEVER); vi.setProductVersion(...FILEVER);
  vi.outputToResourceEntries(res.entries); res.outputResource(exe);
  fs.writeFileSync(exeP, Buffer.from(exe.generate()));

  console.log('Creazione zip');
  const zipFile = path.join(DIST, 'InRegia-app-win-x64.zip');
  fs.rmSync(zipFile, { force: true }); await zipDir(OUT, zipFile);
  console.log('OK', zipFile, (fs.statSync(zipFile).size / 1048576).toFixed(1) + ' MB');
})().catch(e => { console.error(e); process.exit(1); });
