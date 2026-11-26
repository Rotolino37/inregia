'use strict';
/* Font del documento: quali usa, dove si trovano, come renderli visibili al motore di conversione.
 *
 * LibreOffice su Windows vede solo i font di sistema e quelli nella propria cartella share/fonts/truetype.
 * PowerPoint invece usa anche i font cloud di Microsoft 365 (Aptos, Montserrat...) e i font incorporati nel
 * file: senza questo modulo LibreOffice li sostituirebbe con un altro font.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const FONT_EXT = /\.(ttf|otf|ttc|otc)$/i;

/* ------------------------------------------------------------ lettura dei file font */
function readName(buf, off) {
  // tabella 'name': preferisce Windows Unicode inglese, poi qualsiasi Windows, poi Mac Roman
  const count = buf.readUInt16BE(off + 2), strOff = off + buf.readUInt16BE(off + 4);
  const best = {};
  for (let i = 0; i < count; i++) {
    const r = off + 6 + i * 12;
    const pid = buf.readUInt16BE(r), eid = buf.readUInt16BE(r + 2), lang = buf.readUInt16BE(r + 4), nid = buf.readUInt16BE(r + 6);
    const len = buf.readUInt16BE(r + 8), o = strOff + buf.readUInt16BE(r + 10);
    if (![1, 2, 4, 6, 16, 17].includes(nid) || o + len > buf.length) continue;
    let score, str;
    if (pid === 3 && (eid === 1 || eid === 10 || eid === 0)) {
      score = lang === 0x0409 ? 3 : 2;
      const b = Buffer.from(buf.subarray(o, o + len)); if (b.length % 2) continue;
      b.swap16(); str = b.toString('utf16le');
    } else if (pid === 1 && eid === 0) { score = 1; str = buf.subarray(o, o + len).toString('latin1'); }
    else if (pid === 0) { score = 1.5; const b = Buffer.from(buf.subarray(o, o + len)); if (b.length % 2) continue; b.swap16(); str = b.toString('utf16le'); }
    else continue;
    if (!best[nid] || best[nid].score < score) best[nid] = { score, str: str.replace(/\0/g, '').trim() };
  }
  const g = k => best[k] ? best[k].str : '';
  return { family: g(1), sub: g(2), full: g(4), ps: g(6), tfamily: g(16), tsub: g(17) };
}
function readFace(buf, base) {
  const tag = buf.toString('latin1', base, base + 4);
  const ok = tag === '\0\x01\0\0' || tag === 'OTTO' || tag === 'true';
  if (!ok) return null;
  const n = buf.readUInt16BE(base + 4); const T = {};
  for (let i = 0; i < n; i++) { const r = base + 12 + i * 16; T[buf.toString('latin1', r, r + 4)] = { off: buf.readUInt32BE(r + 8), len: buf.readUInt32BE(r + 12) }; }
  if (!T.name) return null;
  const nm = readName(buf, T.name.off);
  let weight = 400, italic = false, fsType = 0;
  if (T['OS/2'] && T['OS/2'].len >= 64) { const o = T['OS/2'].off; weight = buf.readUInt16BE(o + 4); fsType = buf.readUInt16BE(o + 8); italic = !!(buf.readUInt16BE(o + 62) & 1); }
  if (!italic && /italic|oblique/i.test(nm.sub + ' ' + nm.tsub)) italic = true;
  return Object.assign(nm, { weight, italic, fsType, variable: !!T.fvar });
}
// facce contenute in un file (TTC/OTC: più di una)
function fontFaces(buf) {
  try {
    if (buf.toString('latin1', 0, 4) === 'ttcf') {
      const n = buf.readUInt32BE(8), out = [];
      for (let i = 0; i < n && i < 64; i++) { const f = readFace(buf, buf.readUInt32BE(12 + i * 4)); if (f) out.push(Object.assign(f, { index: i })); }
      return out;
    }
    const f = readFace(buf, 0); return f ? [Object.assign(f, { index: 0 })] : [];
  } catch (e) { return []; }
}
/* Lettura veloce da file: solo directory delle tabelle, 'name', 'OS/2' (i font di Windows pesano centinaia di MB). */
function facesFromFile(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const rd = (pos, len) => { len = Math.max(0, Math.min(len, size - pos)); const b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, pos); return b; };
    const one = base => {
      const hd = rd(base, 12); if (hd.length < 12) return null;
      const tag = hd.toString('latin1', 0, 4); if (!(tag === '\0\x01\0\0' || tag === 'OTTO' || tag === 'true')) return null;
      const n = hd.readUInt16BE(4); const dir = rd(base + 12, n * 16); const T = {};
      for (let i = 0; i < n && (i + 1) * 16 <= dir.length; i++) T[dir.toString('latin1', i * 16, i * 16 + 4)] = { off: dir.readUInt32BE(i * 16 + 8), len: dir.readUInt32BE(i * 16 + 12) };
      if (!T.name || T.name.len > 4 * 1048576) return null;
      // buffer sintetico: tabella name e OS/2 alle stesse posizioni relative
      const nameB = rd(T.name.off, T.name.len); const nm = readName(nameB, 0);
      let weight = 400, italic = false, fsType = 0;
      if (T['OS/2'] && T['OS/2'].len >= 64) { const o = rd(T['OS/2'].off, 64); weight = o.readUInt16BE(4); fsType = o.readUInt16BE(8); italic = !!(o.readUInt16BE(62) & 1); }
      if (!italic && /italic|oblique/i.test(nm.sub + ' ' + nm.tsub)) italic = true;
      return Object.assign(nm, { weight, italic, fsType, variable: !!T.fvar });
    };
    const h = rd(0, 12);
    if (h.toString('latin1', 0, 4) === 'ttcf') {
      const n = Math.min(64, h.readUInt32BE(8)); const offs = rd(12, n * 4); const out = [];
      for (let i = 0; i < n; i++) { const f = one(offs.readUInt32BE(i * 4)); if (f) out.push(Object.assign(f, { index: i })); }
      return out;
    }
    const f = one(0); return f ? [Object.assign(f, { index: 0 })] : [];
  } catch (e) { return []; } finally { fs.closeSync(fd); }
}

/* Font incorporati da PowerPoint (.fntdata, formato Embedded OpenType). Supporta i dati non compressi,
   anche cifrati con XOR; la compressione MicroType Express non è supportata (restituisce null). */
function eotToFont(buf) {
  try {
    if (buf.length < 82) return null;
    const tag = buf.toString('latin1', 0, 4);
    if (tag === '\0\x01\0\0' || tag === 'OTTO' || tag === 'true') return buf; // già TrueType/OpenType
    const eotSize = buf.readUInt32LE(0), dataSize = buf.readUInt32LE(4), version = buf.readUInt32LE(8), flags = buf.readUInt32LE(12);
    if (![0x00010000, 0x00020001, 0x00020002].includes(version) || buf.readUInt16LE(34) !== 0x504C) return null;
    if (flags & 0x4) return null; // MTX compresso
    const end = Math.min(buf.length, eotSize || buf.length), start = end - dataSize;
    if (start < 82 || dataSize <= 0) return null;
    const out = Buffer.from(buf.subarray(start, end));
    if (flags & 0x10000000) for (let i = 0; i < out.length; i++) out[i] ^= 0x50;
    return fontFaces(out).length ? out : null;
  } catch (e) { return null; }
}

/* ------------------------------------------------------------ dove cercare */
function sourceDirs(dataDir) {
  const L = [];
  const env = process.env;
  if (process.platform === 'win32') {
    const win = env.WINDIR || 'C:\\Windows', local = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    L.push({ dir: path.join(win, 'Fonts'), kind: 'system', deep: false });
    L.push({ dir: path.join(local, 'Microsoft', 'Windows', 'Fonts'), kind: 'user', deep: false });
    // font cloud di Microsoft 365: %LOCALAPPDATA%\Microsoft\FontCache\<n>\CloudFonts\<Famiglia>\<numero>.ttf
    if (env.INREGIA_CLOUDFONTS) L.push({ dir: env.INREGIA_CLOUDFONTS, kind: 'cloud', deep: true });
    else {
      const fc = path.join(local, 'Microsoft', 'FontCache');
      let vers = []; try { vers = fs.readdirSync(fc).filter(n => /^\d+$/.test(n)); } catch (e) {}
      for (const v of vers.length ? vers : ['4']) L.push({ dir: path.join(fc, v, 'CloudFonts'), kind: 'cloud', deep: true });
    }
  } else {
    for (const d of ['/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.local/share/fonts'), path.join(os.homedir(), '.fonts')]) L.push({ dir: d, kind: 'system', deep: true });
    if (env.INREGIA_CLOUDFONTS) L.push({ dir: env.INREGIA_CLOUDFONTS, kind: 'cloud', deep: true });
  }
  if (dataDir) L.push({ dir: path.join(dataDir, 'fonts'), kind: 'inregia', deep: true });
  return L;
}
function listFonts(dir, deep, out, depth = 0) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (deep && depth < 4) listFonts(p, deep, out, depth + 1); }
    else if (FONT_EXT.test(e.name) || /CloudFonts/i.test(dir)) out.push(p); // i font cloud hanno nomi numerici
  }
  return out;
}

/* Indice dei font disponibili, con cache per percorso, dimensione e data. */
function buildIndex(dataDir, cacheFile) {
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
  const next = {}, faces = [];
  for (const src of sourceDirs(dataDir)) {
    for (const f of listFonts(src.dir, src.deep, [])) {
      let st; try { st = fs.statSync(f); } catch (e) { continue; }
      if (st.size < 100 || st.size > 80 * 1048576) continue;
      const key = f + '|' + st.size + '|' + Math.round(st.mtimeMs);
      let fc = cache[key];
      if (!fc) { try { fc = facesFromFile(f).map(x => ({ family: x.family, tfamily: x.tfamily, full: x.full, ps: x.ps, sub: x.sub, weight: x.weight, italic: x.italic, variable: x.variable, index: x.index })); } catch (e) { fc = []; } }
      next[key] = fc;
      for (const x of fc) faces.push(Object.assign({ file: f, kind: src.kind }, x));
    }
  }
  if (cacheFile) try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(next)); } catch (e) {}
  return faces;
}

/* ------------------------------------------------------------ font usati dal documento */
const norm = s => String(s || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
// typeface di PowerPoint -> nomi da cercare (es. "Montserrat Black" è anche famiglia Montserrat, peso Black)
function matches(face, name) {
  const n = norm(name);
  return norm(face.family) === n || norm(face.tfamily) === n || norm(face.full) === n || norm(face.ps) === n;
}
const IGNORE = new Set(['', '+mj-lt', '+mn-lt', '+mj-ea', '+mn-ea', '+mj-cs', '+mn-cs', 'symbol']);
function usedTypefaces(xmlParts) {
  // xmlParts: testi XML di tema, master, layout e slide
  const set = new Set(); let major = '', minor = '';
  for (const x of xmlParts) {
    const mj = /<a:majorFont>\s*<a:latin typeface="([^"]*)"/.exec(x); if (mj && mj[1]) major = major || mj[1];
    const mn = /<a:minorFont>\s*<a:latin typeface="([^"]*)"/.exec(x); if (mn && mn[1]) minor = minor || mn[1];
    for (const m of x.matchAll(/<a:(latin|ea|cs|sym)\s[^>]*typeface="([^"]*)"/g)) {
      const t = m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
      if (t.startsWith('+mj')) { if (m[1] === 'latin') set.add('\u0001major'); continue; }
      if (t.startsWith('+mn')) { if (m[1] === 'latin') set.add('\u0001minor'); continue; }
      if (!IGNORE.has(t.toLowerCase()) && !/^@/.test(t)) set.add(t);
    }
  }
  // font del tema, solo se qualcosa li richiama (+mj-lt / +mn-lt)
  if (set.delete('\u0001major') && major) set.add(major);
  if (set.delete('\u0001minor') && minor) set.add(minor);
  return [...set].sort();
}

// sostituti con le stesse metriche, inclusi in LibreOffice (il testo resta impaginato identico)
const COMPAT = { calibri: 'carlito', 'calibri light': 'carlito', cambria: 'caladea', arial: 'liberation sans', helvetica: 'liberation sans', 'arial narrow': 'liberation sans narrow',
  'times new roman': 'liberation serif', times: 'liberation serif', 'courier new': 'liberation mono', courier: 'liberation mono' };
/* Risoluzione: per ogni typeface, se il motore lo vede già (font di sistema) o quali file fornirgli. */
function resolve(typefaces, faces, embedded) {
  const out = { system: [], provided: [], missing: [], files: [] };
  const seen = new Set();
  for (const t of typefaces) {
    const sys = faces.filter(f => f.kind === 'system' && matches(f, t));
    const other = faces.filter(f => f.kind !== 'system' && matches(f, t));
    // un font di sistema solo variabile non basta: LibreOffice spesso lo sostituisce. Se esiste una versione statica, si fornisce quella.
    if (sys.some(f => !f.variable) || (sys.length && !other.some(f => !f.variable))) { out.system.push(t); continue; }
    const emb = (embedded || []).filter(e => norm(e.typeface) === norm(t) || e.faces.some(f => matches(f, t)));
    if (other.length || emb.length) {
      const src = other.length ? other[0].kind : 'embedded';
      out.provided.push({ typeface: t, source: src, faces: other.length + emb.length });
      for (const f of other) if (!seen.has(f.file)) { seen.add(f.file); out.files.push({ file: f.file, typeface: t, source: f.kind }); }
      for (const e of emb) if (!seen.has(e.file)) { seen.add(e.file); out.files.push({ file: e.file, typeface: t, source: 'embedded' }); }
    } else if (COMPAT[norm(t)] && faces.some(f => f.kind === 'system' && matches(f, COMPAT[norm(t)]))) out.system.push(t);
    else out.missing.push(t);
  }
  return out;
}

/* Copia i file nella cartella dei font del motore; i nomi derivano dal contenuto (niente doppioni). */
function installInto(files, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const done = [];
  for (const f of files) {
    const buf = fs.readFileSync(f.file);
    const sig = buf.toString('latin1', 0, 4);
    const ext = sig === 'ttcf' ? '.ttc' : sig === 'OTTO' ? '.otf' : '.ttf';
    const name = 'inregia-' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + ext;
    const dst = path.join(dir, name);
    if (!fs.existsSync(dst)) { fs.writeFileSync(dst + '.part', buf); fs.renameSync(dst + '.part', dst); }
    done.push(dst);
  }
  return done;
}

/* Linux/macOS: LibreOffice usa fontconfig; una configurazione che aggiunge la cartella ai font di sistema. */
function fontconfigFile(dir, outFile) {
  const sys = ['/etc/fonts/fonts.conf'].find(f => fs.existsSync(f));
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  fs.writeFileSync(outFile, `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n${sys ? `  <include ignore_missing="yes">${sys}</include>\n` : ''}  <dir>${esc(dir)}</dir>\n  <cachedir>${esc(path.join(dir, '.cache'))}</cachedir>\n</fontconfig>\n`);
  return outFile;
}

// nomi dei font effettivamente presenti nel PDF prodotto (diagnostica e test)
function pdfFonts(buf) {
  const s = buf.toString('latin1'); const set = new Set();
  for (const m of s.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+#\-_.,]+)/g)) set.add(m[1].replace(/^[A-Z]{6}\+/, '').replace(/#20/g, ' '));
  return [...set].sort();
}

module.exports = { fontFaces, eotToFont, buildIndex, usedTypefaces, resolve, installInto, fontconfigFile, pdfFonts, matches, sourceDirs };
