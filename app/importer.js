'use strict';
/*
 * InRegia - importatore PPTX
 * Gira in una finestra nascosta (node + DOM). Converte un .pptx in:
 *   slides/  immagini complete delle slide
 *   thumbs/  miniature
 *   base/    sfondi per morph e animazioni (slide senza gli oggetti animati)
 *   img/     livelli trasparenti degli oggetti (morph / animazioni)
 *   video/   video e audio incorporati
 *   manifest.json
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const yauzl = require('yauzl');
const yazl = require('yazl');

const NS = {
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  p14: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
};
const SHAPES = new Set(['sp', 'pic', 'grpSp', 'graphicFrame', 'cxnSp', 'contentPart', 'AlternateContent']);
const MANIFEST_VERSION = 3;

/* ---------------------------------------------------------------- zip */
function openZip(file) {
  return new Promise((res, rej) => yauzl.open(file, { lazyEntries: true, autoClose: false }, (e, z) => {
    if (e) return rej(e);
    const entries = new Map();
    z.on('entry', en => { entries.set(en.fileName, en); z.readEntry(); });
    z.on('end', () => res({ z, entries }));
    z.on('error', rej);
    z.readEntry();
  }));
}
const entryStream = (z, en) => new Promise((res, rej) => z.openReadStream(en, (e, s) => e ? rej(e) : res(s)));
async function readBuf(zz, name) {
  const en = zz.entries.get(name); if (!en) return null;
  const s = await entryStream(zz.z, en); const ch = [];
  for await (const c of s) ch.push(c);
  return Buffer.concat(ch);
}
async function readText(zz, name) { const b = await readBuf(zz, name); return b ? b.toString('utf8') : null; }

/* ---------------------------------------------------------------- xml */
const parseXml = s => new DOMParser().parseFromString(s, 'application/xml');
const ser = d => new XMLSerializer().serializeToString(d);
const kids = (el, ln) => el ? Array.from(el.children).filter(c => c.localName === ln) : [];
const kid = (el, ln) => kids(el, ln)[0] || null;
const desc = (el, ns, ln) => el ? Array.from(el.getElementsByTagNameNS(NS[ns], ln)) : [];
const desc1 = (el, ns, ln) => desc(el, ns, ln)[0] || null;
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };

function relsPathOf(part) { const d = path.posix.dirname(part), b = path.posix.basename(part); return `${d}/_rels/${b}.rels`; }
function resolveTarget(part, target) {
  if (target.startsWith('/')) return target.slice(1);
  return path.posix.normalize(path.posix.join(path.posix.dirname(part), target));
}
async function readRels(zz, part) {
  const t = await readText(zz, relsPathOf(part)); const m = new Map();
  if (!t) return m;
  const d = parseXml(t);
  for (const r of Array.from(d.documentElement.children)) {
    const ext = r.getAttribute('TargetMode') === 'External';
    m.set(r.getAttribute('Id'), { type: (r.getAttribute('Type') || '').split('/').pop(), target: ext ? r.getAttribute('Target') : resolveTarget(part, r.getAttribute('Target')), external: ext, raw: r.getAttribute('Target') });
  }
  return m;
}

/* ------------------------------------------------------------ shapes */
function shapeOfCNvPr(c) {
  let s = c.parentNode && c.parentNode.parentNode; if (!s) return null;
  // shape avvolta in mc:AlternateContent
  let up = s.parentNode;
  if (up && (up.localName === 'Choice' || up.localName === 'Fallback') && up.parentNode && up.parentNode.localName === 'AlternateContent') s = up.parentNode;
  return s;
}
function shapeId(el) {
  const c = desc1(el, 'p', 'cNvPr'); return c ? c.getAttribute('id') : null;
}
function shapeName(el) { const c = desc1(el, 'p', 'cNvPr'); return c ? (c.getAttribute('name') || '') : ''; }
function findShape(doc, id) {
  for (const c of desc(doc, 'p', 'cNvPr')) if (c.getAttribute('id') === String(id)) { const s = shapeOfCNvPr(c); if (s) return s; }
  return null;
}
function realShape(el) { // dentro AlternateContent prende la scelta principale
  if (el.localName !== 'AlternateContent') return el;
  const ch = kid(el, 'Choice') || kid(el, 'Fallback');
  return ch ? Array.from(ch.children).find(c => SHAPES.has(c.localName)) || el : el;
}
function xfrmOf(el) {
  el = realShape(el);
  let x = null;
  if (el.localName === 'grpSp') x = kid(kid(el, 'grpSpPr'), 'xfrm');
  else if (el.localName === 'graphicFrame') x = kid(el, 'xfrm');
  else x = kid(kid(el, 'spPr'), 'xfrm');
  if (!x) return null;
  const off = kid(x, 'off'), ext = kid(x, 'ext'), chOff = kid(x, 'chOff'), chExt = kid(x, 'chExt');
  if (!off || !ext) return null;
  return {
    x: num(off.getAttribute('x'), 0), y: num(off.getAttribute('y'), 0), cx: num(ext.getAttribute('cx'), 0), cy: num(ext.getAttribute('cy'), 0),
    rot: num(x.getAttribute('rot'), 0) / 60000,
    chx: chOff ? num(chOff.getAttribute('x'), 0) : null, chy: chOff ? num(chOff.getAttribute('y'), 0) : null,
    chcx: chExt ? num(chExt.getAttribute('cx'), 0) : null, chcy: chExt ? num(chExt.getAttribute('cy'), 0) : null,
  };
}
function absRect(el) {
  const f = xfrmOf(el); if (!f) return null;
  let r = { x: f.x, y: f.y, cx: f.cx, cy: f.cy };
  let p = el.parentNode;
  while (p && p.localName !== 'spTree') {
    if (p.localName === 'grpSp') {
      const g = xfrmOf(p);
      if (g && g.chcx && g.chcy) {
        const sx = g.cx / g.chcx, sy = g.cy / g.chcy;
        r = { x: g.x + (r.x - g.chx) * sx, y: g.y + (r.y - g.chy) * sy, cx: r.cx * sx, cy: r.cy * sy };
      }
    }
    p = p.parentNode;
  }
  return r;
}
function textOf(el) { return desc(el, 'a', 't').map(t => t.textContent).join(' ').replace(/\s+/g, ' ').trim(); }
function blipTarget(el, rels) {
  const b = desc1(realShape(el), 'a', 'blip'); if (!b) return null;
  const id = b.getAttributeNS(NS.r, 'embed'); const r = id && rels.get(id);
  return r && !r.external ? r.target : null;
}
function topShapes(spTree) { return Array.from(spTree.children).filter(c => SHAPES.has(c.localName)); }
function allShapes(spTree) {
  const out = [];
  const walk = cont => { for (const c of topShapes(cont)) { out.push(c); const r = realShape(c); if (r.localName === 'grpSp') walk(r); } };
  walk(spTree); return out;
}

/* ---------------------------------------------------------- transitions */
const TR_DIR = { l: 'l', r: 'r', u: 'u', d: 'd', lu: 'l', ru: 'r', ld: 'l', rd: 'r' };
function parseTransition(sld) {
  // preferisce la variante mc:Choice (p14/p159), poi la normale
  let tr = null;
  for (const ac of kids(sld, 'AlternateContent')) {
    const ch = kid(ac, 'Choice'); const t = ch && kid(ch, 'transition'); if (t) { tr = t; break; }
    const fb = kid(ac, 'Fallback'); const t2 = fb && kid(fb, 'transition'); if (t2 && !tr) tr = t2;
  }
  if (!tr) tr = kid(sld, 'transition');
  if (!tr) return null;
  const spd = tr.getAttribute('spd') || 'med';
  let dur = num(tr.getAttributeNS(NS.p14, 'dur') || tr.getAttribute('p14:dur'), NaN);
  if (!isFinite(dur)) dur = { slow: 1000, med: 750, fast: 500 }[spd] || 750;
  const fx = Array.from(tr.children).find(c => c.localName !== 'sndAc' && c.localName !== 'extLst');
  if (!fx) return dur > 0 ? null : null;
  const t = fx.localName, A = n => fx.getAttribute(n);
  const dir = TR_DIR[A('dir')] || null;
  let o;
  switch (t) {
    case 'morph': o = { type: 'morph' }; break;
    case 'fade': o = { type: A('thruBlk') === '1' || A('thruBlk') === 'true' ? 'fadeBlack' : 'fade' }; break;
    case 'dissolve': case 'checker': case 'randomBar': case 'blinds': case 'strips': case 'ripple': case 'glitter': case 'honeycomb': case 'shred': case 'vortex': case 'warp': case 'prism': case 'random': case 'newsflash':
      o = { type: 'fade' }; break;
    case 'push': o = { type: 'push', dir: dir || 'l' }; break;
    case 'pull': o = { type: 'uncover', dir: dir || 'l' }; break;
    case 'cover': o = { type: 'cover', dir: dir || 'l' }; break;
    case 'reveal': o = { type: 'uncover', dir: dir || 'l' }; break;
    case 'pan': case 'conveyor': case 'gallery': o = { type: 'push', dir: A('dir') === 'r' ? 'r' : (dir || 'l') }; break;
    case 'wipe': o = { type: 'wipe', dir: dir || 'l' }; break;
    case 'split': o = { type: 'split', orient: A('orient') === 'vert' ? 'v' : 'h', inOut: A('dir') === 'in' ? 'in' : 'out' }; break;
    case 'doors': case 'window': o = { type: 'split', orient: A('dir') === 'horz' ? 'h' : 'v', inOut: 'out' }; break;
    case 'zoom': case 'flythrough': case 'ferris': o = { type: 'zoom', inOut: A('dir') === 'out' ? 'out' : 'in' }; break;
    case 'circle': case 'diamond': case 'plus': case 'wheel': case 'wheelReverse': case 'wedge': o = { type: 'circle' }; break;
    case 'flash': o = { type: 'flash' }; break;
    case 'cube': case 'box': o = { type: 'cube', dir: dir || 'l' }; break;
    case 'flip': case 'switch': o = { type: 'flip', dir: dir || 'l' }; break;
    case 'cut': o = { type: A('thruBlk') === '1' ? 'fadeBlack' : 'cut' }; if (o.type === 'fadeBlack') dur = 300; break;
    default: o = { type: 'fade' };
  }
  o.dur = Math.max(0, Math.round(dur));
  o.native = t;
  return o;
}

/* ---------------------------------------------------------- animazioni */
const ENTR_MAP = { 1: 'appear', 2: 'fly', 3: 'wipe', 4: 'zoom', 5: 'fade', 6: 'circle', 7: 'fly', 8: 'circle', 9: 'fade', 10: 'fade', 12: 'wipe', 13: 'zoom', 14: 'wipe', 16: 'split', 17: 'zoom', 18: 'wipe', 21: 'circle', 22: 'wipe', 23: 'zoom', 26: 'fly', 37: 'rise', 42: 'rise', 47: 'descend', 53: 'zoom', 55: 'zoom' };
function subtypeDir(st) { // 1 alto, 2 destra, 4 basso, 8 sinistra
  st = parseInt(st, 10) || 0;
  if (st & 8) return 'l'; if (st & 2) return 'r'; if (st & 1) return 'u'; if (st & 4) return 'd'; return 'd';
}
function parseTiming(sld) {
  const res = { effects: [], mediaHide: new Set(), media: {} };
  const timing = kid(sld, 'timing'); if (!timing) return res;
  // media: opzioni di riproduzione
  for (const mn of desc(timing, 'p', 'cMediaNode')) {
    const tg = desc1(mn, 'p', 'spTgt'); if (!tg) continue;
    const id = tg.getAttribute('spid');
    const ctn = kid(mn, 'cTn');
    res.media[id] = {
      vol: num(mn.getAttribute('vol'), 100000) / 100000,
      mute: mn.getAttribute('mute') === '1',
      showWhenStopped: mn.getAttribute('showWhenStopped') !== '0',
      loop: !!ctn && ctn.getAttribute('repeatCount') === 'indefinite',
    };
    if (mn.getAttribute('showWhenStopped') === '0') res.mediaHide.add(id);
  }
  let main = null;
  for (const c of desc(timing, 'p', 'cTn')) if (c.getAttribute('nodeType') === 'mainSeq') { main = c; break; }
  if (!main) return res;
  for (const c of desc(main, 'p', 'cTn')) {
    const cls = c.getAttribute('presetClass'); if (!cls) continue;
    if (cls === 'mediacall' || cls === 'verb') continue;
    const tg = desc1(c, 'p', 'spTgt'); if (!tg) continue;
    let dur = 0;
    for (const d of desc(c, 'p', 'cTn')) { const v = num(d.getAttribute('dur'), NaN); if (isFinite(v)) dur = Math.max(dur, v + num(desc1(d, 'p', 'cond') && desc1(d, 'p', 'cond').getAttribute('delay'), 0)); }
    const st = kid(c, 'stCondLst'), cond = st && kid(st, 'cond');
    const delay = cond ? num(cond.getAttribute('delay'), 0) : 0;
    const pid = parseInt(c.getAttribute('presetID'), 10) || 10;
    let fx = cls === 'entr' || cls === 'exit' ? (ENTR_MAP[pid] || 'fade') : 'pulse';
    if (cls === 'path') fx = 'pulse';
    res.effects.push({
      id: tg.getAttribute('spid'), cls: cls === 'entr' || cls === 'exit' ? cls : 'emph', fx,
      dir: subtypeDir(c.getAttribute('presetSubtype')), node: c.getAttribute('nodeType') || 'clickEffect',
      dur: Math.max(dur || 500, 1), delay: Math.max(0, delay),
    });
  }
  return res;
}
function buildSteps(effects, mediaIds) {
  const eff = effects.filter(e => !mediaIds.has(e.id));
  const steps = [[]]; let cur = steps[0], lastStart = 0, maxEnd = 0, first = true;
  for (const e of eff) {
    let start;
    if (e.node === 'clickEffect') { cur = []; steps.push(cur); start = 0; maxEnd = 0; }
    else if (e.node === 'withEffect') start = first ? 0 : lastStart;
    else start = maxEnd; // afterEffect
    start += e.delay;
    cur.push({ id: e.id, cls: e.cls, fx: e.fx, dir: e.dir, t: Math.round(start), dur: Math.round(e.dur) });
    lastStart = start; maxEnd = Math.max(maxEnd, start + e.dur); first = false;
  }
  const initial = {};
  for (const e of eff) if (!(e.id in initial)) initial[e.id] = e.cls !== 'entr';
  return { steps, initial, ids: Object.keys(initial) };
}

/* ------------------------------------------------- manipolazione slide */
function stripTimingTrans(doc) {
  const sld = doc.documentElement;
  for (const c of Array.from(sld.children)) {
    if (c.localName === 'timing' || c.localName === 'transition') sld.removeChild(c);
    else if (c.localName === 'AlternateContent' && desc1(c, 'p', 'transition')) sld.removeChild(c);
  }
  sld.removeAttribute('show');
}
function removeIds(doc, ids) {
  for (const id of ids) { const s = findShape(doc, id); if (s && s.parentNode) s.parentNode.removeChild(s); }
}
function keepOnly(doc, id) {
  const target = findShape(doc, id); const spTree = desc1(doc, 'p', 'spTree');
  if (!target || !spTree) return false;
  const prune = cont => {
    for (const c of topShapes(cont)) {
      if (c === target) continue;
      if (c.contains(target)) { prune(realShape(c)); continue; }
      cont.removeChild(c);
    }
  };
  prune(spTree);
  return true;
}
function setBg(doc, hex) {
  const sld = doc.documentElement, cSld = desc1(doc, 'p', 'cSld');
  for (const b of kids(cSld, 'bg')) cSld.removeChild(b);
  const mk = (ns, q) => doc.createElementNS(NS[ns], q);
  const bg = mk('p', 'p:bg'), bgPr = mk('p', 'p:bgPr'), sf = mk('a', 'a:solidFill'), clr = mk('a', 'a:srgbClr'), el = mk('a', 'a:effectLst');
  clr.setAttribute('val', hex); sf.appendChild(clr); bgPr.appendChild(sf); bgPr.appendChild(el); bg.appendChild(bgPr);
  cSld.insertBefore(bg, cSld.firstChild);
  sld.setAttribute('showMasterSp', '0');
}

/* ------------------------------------------------------- LibreOffice */
function runSoffice(soffice, input, outDir, profile) {
  return new Promise((res, rej) => {
    const prof = profile || path.join(os.tmpdir(), 'inregia-lo-profile');
    const profUrl = require('url').pathToFileURL(prof).href;
    const args = ['--headless', '--invisible', '--norestore', '--nolockcheck', '--nodefault', '--nofirststartwizard',
      '-env:UserInstallation=' + profUrl, '--convert-to', 'pdf', '--outdir', outDir, input];
    const p = cp.spawn(soffice, args, { windowsHide: true });
    let err = '';
    p.stdout.on('data', d => { err += d; });
    p.stderr.on('data', d => { err += d; });
    const to = setTimeout(() => { try { p.kill(); } catch (e) {} rej(new Error('LibreOffice: tempo scaduto')); }, 30 * 60 * 1000);
    p.on('error', e => { clearTimeout(to); rej(e); });
    p.on('close', code => {
      clearTimeout(to);
      const pdf = path.join(outDir, path.basename(input).replace(/\.[^.]+$/, '') + '.pdf');
      if (fs.existsSync(pdf)) res(pdf); else rej(new Error('LibreOffice non ha prodotto il PDF (codice ' + code + '). ' + err.slice(-400)));
    });
  });
}

/* ---------------------------------------------------------- immagini */
function canvasToFile(cv, file, type, q) {
  const url = cv.toDataURL(type, q); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
}
async function renderPage(pdf, i, width) {
  const page = await pdf.getPage(i);
  const vp0 = page.getViewport({ scale: 1 });
  const scale = width / vp0.width; const vp = page.getViewport({ scale });
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  page.cleanup();
  return cv;
}
// matting a differenza: stesso oggetto su nero e su bianco => colore + trasparenza esatti
function matte(cvB, cvW) {
  const W = cvB.width, H = cvB.height;
  const B = cvB.getContext('2d').getImageData(0, 0, W, H), Wd = cvW.getContext('2d').getImageData(0, 0, W, H);
  const b = B.data, w = Wd.data, out = new ImageData(W, H), o = out.data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const d = ((w[i] - b[i]) + (w[i + 1] - b[i + 1]) + (w[i + 2] - b[i + 2])) / 3;
    let a = 1 - d / 255; if (a < 0) a = 0; if (a > 1) a = 1;
    if (a > 0.004) {
      o[i] = Math.min(255, b[i] / a); o[i + 1] = Math.min(255, b[i + 1] / a); o[i + 2] = Math.min(255, b[i + 2] / a); o[i + 3] = Math.round(a * 255);
      if (a > 0.02) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
  const cv = document.createElement('canvas'); cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
  cv.getContext('2d').putImageData(out, -x0, -y0);
  return { cv, x: x0 / W * 100, y: y0 / H * 100, w: cv.width / W * 100, h: cv.height / H * 100 };
}
function mediaDuration(file) {
  return new Promise(res => {
    const v = document.createElement(/\.(mp3|m4a|wav|aac|ogg|oga|flac|opus|wma)$/i.test(file) ? 'audio' : 'video');
    const done = d => { v.removeAttribute('src'); try { v.load(); } catch (e) {} res(d); };
    const t = setTimeout(() => done(0), 15000);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { clearTimeout(t); done(isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : 0); };
    v.onerror = () => { clearTimeout(t); done(-1); };
    v.src = require('url').pathToFileURL(file).href;
  });
}

/* --------------------------------------------------------------- main */
async function importDeck(opt) {
  const { pptx, outDir, soffice, width = 1920, profile } = opt;
  const P = (pct, msg) => opt.onProgress && opt.onProgress(Math.max(0, Math.min(100, pct)), msg);
  const warn = [];
  P(1, 'Lettura del file');
  const zz = await openZip(pptx);
  try {
    const presPart = 'ppt/presentation.xml';
    const presXml = await readText(zz, presPart); if (!presXml) throw new Error('File non valido: manca ppt/presentation.xml');
    const pres = parseXml(presXml);
    const presRels = await readRels(zz, presPart);
    const sz = desc1(pres, 'p', 'sldSz');
    const SW = sz ? num(sz.getAttribute('cx'), 12192000) : 12192000, SH = sz ? num(sz.getAttribute('cy'), 6858000) : 6858000;
    const sldIds = desc(pres, 'p', 'sldId');
    const slideParts = sldIds.map(s => presRels.get(s.getAttributeNS(NS.r, 'id'))).filter(Boolean).map(r => r.target);
    if (!slideParts.length) throw new Error('Nessuna slide trovata');
    const pct = (v, tot) => Math.round(v / tot * 1e6) / 1e4;

    /* ---- analisi slide ---- */
    P(3, 'Analisi delle slide');
    const S = [];
    for (let i = 0; i < slideParts.length; i++) {
      const part = slideParts[i];
      const xml = await readText(zz, part); const doc = parseXml(xml); const rels = await readRels(zz, part);
      const sld = doc.documentElement; const spTree = desc1(doc, 'p', 'spTree');
      const timing = parseTiming(sld);
      const shapes = allShapes(spTree).map((el, z) => {
        const r = realShape(el);
        const o = { el, id: shapeId(el), name: shapeName(el), type: r.localName, z, top: el.parentNode === spTree, text: textOf(el), img: r.localName === 'pic' ? blipTarget(el, rels) : null };
        const vf = desc1(r, 'a', 'videoFile'), af = desc1(r, 'a', 'audioFile');
        if (vf || af) {
          const pm = desc1(r, 'p14', 'media');
          const rid = (pm && pm.getAttributeNS(NS.r, 'embed')) || (vf || af).getAttributeNS(NS.r, 'link') || (vf || af).getAttributeNS(NS.r, 'embed');
          const rel = rels.get(rid);
          const trim = desc1(r, 'p14', 'trim');
          o.media = { kind: vf ? 'video' : 'audio', target: rel ? rel.target : null, external: rel ? rel.external : false, raw: rel ? rel.raw : '',
            trimSt: trim ? num(trim.getAttribute('st'), 0) / 1000 : 0, trimEnd: trim ? num(trim.getAttribute('end'), 0) / 1000 : 0 };
        }
        const ar = absRect(el); if (ar) o.rect = { x: pct(ar.x, SW), y: pct(ar.y, SH), w: pct(ar.cx, SW), h: pct(ar.cy, SH) };
        const xf = xfrmOf(el); o.rot = xf ? xf.rot : 0;
        return o;
      });
      const mediaIds = new Set(shapes.filter(s => s.media).map(s => s.id));
      const anim = buildSteps(timing.effects, mediaIds);
      // note del relatore
      let notes = '';
      for (const [, r] of rels) if (r.type === 'notesSlide' && !r.external) {
        const nx = await readText(zz, r.target);
        if (nx) {
          const nd = parseXml(nx);
          for (const sp of desc(nd, 'p', 'sp')) {
            const ph = desc1(sp, 'p', 'ph'); if (!ph || ph.getAttribute('type') !== 'body') continue;
            notes = desc(sp, 'a', 'p').map(p => desc(p, 'a', 't').map(t => t.textContent).join('')).join('\n').trim();
          }
        }
      }
      let title = '';
      for (const s of shapes) { const ph = desc1(s.el, 'p', 'ph'); if (ph && /title|ctrTitle/i.test(ph.getAttribute('type') || '') && s.text) { title = s.text; break; } }
      S.push({ i, n: i + 1, part, doc, rels, shapes, timing, anim, notes, title, hidden: sld.getAttribute('show') === '0', tr: parseTransition(sld) });
    }

    /* ---- morph: abbinamento oggetti ---- */
    const morphs = {};
    for (let k = 1; k < S.length; k++) {
      const B = S[k]; if (!B.tr || B.tr.type !== 'morph') continue;
      const A = S[k - 1];
      const cand = sh => sh.filter(s => s.top && !s.media && s.rect);
      const sa = cand(A.shapes), sb = cand(B.shapes), used = new Set(), pairs = [];
      const take = (b, test) => { const a = sa.find(x => !used.has(x) && test(x, b)); if (a) { used.add(a); pairs.push([a, b]); return true; } return false; };
      const bl = sb.slice();
      for (const b of bl) if (b.name.startsWith('!!')) take(b, a => a.name === b.name);
      for (const b of bl) if (!pairs.some(p => p[1] === b) && b.img) take(b, a => a.img === b.img && a.type === b.type);
      for (const b of bl) if (!pairs.some(p => p[1] === b) && !b.img && b.text) take(b, a => a.type === b.type && a.text === b.text);
      for (const b of bl) if (!pairs.some(p => p[1] === b) && !b.img) take(b, a => a.type === b.type && a.name === b.name && !a.img);
      const movers = pairs.filter(([a, b]) => ['x', 'y', 'w', 'h'].some(q => Math.abs(a.rect[q] - b.rect[q]) > 0.05) || Math.abs(a.rot - b.rot) > 0.5 || a.text !== b.text);
      if (movers.length) morphs[B.n] = { a: A.n, b: B.n, pairs: movers.map(([a, b]) => ({ ida: a.id, idb: b.id })) };
    }

    /* ---- piano di rendering ---- */
    P(6, 'Preparazione del rendering');
    const pages = []; // {slide, ops, tag}
    S.forEach(s => pages.push({ slide: s.i, tag: { k: 'full', n: s.n }, remove: [...s.timing.mediaHide] }));
    for (const b of Object.keys(morphs)) {
      const m = morphs[b], A = S[m.a - 1], B = S[m.b - 1];
      pages.push({ slide: A.i, tag: { k: 'mbase', n: m.b, side: 'a' }, remove: [...A.timing.mediaHide, ...m.pairs.map(p => p.ida)] });
      pages.push({ slide: B.i, tag: { k: 'mbase', n: m.b, side: 'b' }, remove: [...B.timing.mediaHide, ...m.pairs.map(p => p.idb)] });
      m.pairs.forEach((p, j) => {
        for (const [side, sl, id] of [['a', A, p.ida], ['b', B, p.idb]]) for (const bg of ['000000', 'FFFFFF'])
          pages.push({ slide: sl.i, tag: { k: 'mlayer', n: m.b, j, side, bg }, keep: id, bg });
      });
    }
    for (const s of S) if (s.anim.ids.length) {
      pages.push({ slide: s.i, tag: { k: 'abase', n: s.n }, remove: [...s.timing.mediaHide, ...s.anim.ids] });
      for (const id of s.anim.ids) for (const bg of ['000000', 'FFFFFF']) pages.push({ slide: s.i, tag: { k: 'alayer', n: s.n, id, bg }, keep: id, bg });
    }

    /* ---- pptx di lavoro ---- */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inregia-'));
    const work = path.join(tmp, 'render.pptx');
    P(8, 'Creazione file di lavoro (' + pages.length + ' pagine)');
    {
      const ct = parseXml(await readText(zz, '[Content_Types].xml'));
      const pr = parseXml(await readText(zz, 'ppt/_rels/presentation.xml.rels'));
      const pdoc = parseXml(presXml); const lst = desc1(pdoc, 'p', 'sldIdLst');
      // rimuove slide nascoste dall'elenco? no: tutte visibili nel file di lavoro
      let maxId = 255; for (const s of desc(pdoc, 'p', 'sldId')) maxId = Math.max(maxId, num(s.getAttribute('id'), 0));
      let maxN = 0; for (const n of zz.entries.keys()) { const m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(n); if (m) maxN = Math.max(maxN, +m[1]); }
      const zo = new yazl.ZipFile();
      const outStream = fs.createWriteStream(work);
      const finished = new Promise((res, rej) => { outStream.on('close', res); outStream.on('error', rej); });
      zo.outputStream.pipe(outStream);
      const modified = new Map();
      // slide originali: niente timing, tutte visibili, media nascosti rimossi
      for (const pg of pages.filter(p => p.tag.k === 'full')) {
        const s = S[pg.slide]; const d = parseXml(ser(s.doc)); stripTimingTrans(d); removeIds(d, pg.remove);
        modified.set(s.part, ser(d));
      }
      let rid = 0;
      for (const pg of pages.filter(p => p.tag.k !== 'full')) {
        const s = S[pg.slide]; const d = parseXml(ser(s.doc)); stripTimingTrans(d);
        if (pg.keep) { keepOnly(d, pg.keep); setBg(d, pg.bg); } else removeIds(d, pg.remove);
        const n = ++maxN, part = `ppt/slides/slide${n}.xml`;
        modified.set(part, ser(d));
        // rels: come l'originale, senza note
        const rx = await readText(zz, relsPathOf(s.part));
        const rd = parseXml(rx || '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
        for (const r of Array.from(rd.documentElement.children)) if (/notesSlide|comments/.test(r.getAttribute('Type') || '')) rd.documentElement.removeChild(r);
        modified.set(relsPathOf(part), ser(rd));
        const ov = ct.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types', 'Override');
        ov.setAttribute('PartName', '/' + part); ov.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
        ct.documentElement.appendChild(ov);
        const rel = pr.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
        const id = 'rIdDP' + (++rid); rel.setAttribute('Id', id);
        rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'); rel.setAttribute('Target', `slides/slide${n}.xml`);
        pr.documentElement.appendChild(rel);
        const sid = pdoc.createElementNS(NS.p, 'p:sldId'); sid.setAttribute('id', String(++maxId)); sid.setAttributeNS(NS.r, 'r:id', id);
        lst.appendChild(sid);
      }
      // sezioni personalizzate (p14:sectionLst) farebbero riordinare: rimosse
      for (const sec of desc(pdoc, 'p14', 'sectionLst')) { const ext = sec.parentNode; if (ext && ext.parentNode) ext.parentNode.removeChild(ext); }
      modified.set('[Content_Types].xml', ser(ct));
      modified.set('ppt/_rels/presentation.xml.rels', ser(pr));
      modified.set(presPart, ser(pdoc));
      const MEDIA_RE = /\.(mp4|m4v|mov|wmv|avi|mpe?g|mkv|webm|m4a|mp3|wav|wma|aac|ogg|oga|flac|opus|asf)$/i;
      const order = ['[Content_Types].xml'].concat([...zz.entries.keys()].filter(n => n !== '[Content_Types].xml' && !n.endsWith('/')));
      for (const n of modified.keys()) if (!zz.entries.has(n)) order.push(n);
      for (const name of order) {
        if (modified.has(name)) { zo.addBuffer(Buffer.from(modified.get(name), 'utf8'), name); continue; }
        const en = zz.entries.get(name); if (!en) continue;
        if (MEDIA_RE.test(name)) { zo.addBuffer(Buffer.alloc(0), name); continue; } // i media non servono al rendering
        zo.addBuffer(await readBuf(zz, name), name, { compress: en.compressionMethod !== 0 });
      }
      zo.end();
      await finished;
    }

    /* ---- LibreOffice ---- */
    P(14, 'Rendering con LibreOffice (può richiedere alcuni minuti)');
    let tick = 14; const ti = setInterval(() => { tick = Math.min(44, tick + 0.4); P(tick, 'Rendering con LibreOffice (può richiedere alcuni minuti)'); }, 1500);
    let pdfFile;
    try { pdfFile = await runSoffice(soffice, work, tmp, profile); } finally { clearInterval(ti); }

    /* ---- pagine -> immagini ---- */
    for (const d of ['slides', 'thumbs', 'base', 'img', 'video']) fs.mkdirSync(path.join(outDir, d), { recursive: true });
    for (const d of ['slides', 'thumbs', 'base', 'img']) for (const f of fs.readdirSync(path.join(outDir, d))) fs.unlinkSync(path.join(outDir, d, f));
    const pdfjs = window.pdfjsLib;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfFile)), disableFontFace: false, verbosity: 0 }).promise;
    if (pdf.numPages < pages.length) warn.push('Il PDF ha ' + pdf.numPages + ' pagine invece di ' + pages.length);
    const res = { full: {}, mbase: {}, mlayer: {}, abase: {}, alayer: {} };
    const pend = new Map();
    const pad = n => String(n).padStart(3, '0');
    let H = Math.round(width * SH / SW);
    for (let k = 0; k < pages.length && k < pdf.numPages; k++) {
      P(45 + 40 * k / pages.length, 'Creazione immagini ' + (k + 1) + '/' + pages.length);
      const t = pages[k].tag; const cv = await renderPage(pdf, k + 1, width); H = cv.height;
      if (t.k === 'full') {
        canvasToFile(cv, path.join(outDir, 'slides', `s${pad(t.n)}.jpg`), 'image/jpeg', 0.92);
        const th = document.createElement('canvas'); th.width = 384; th.height = Math.round(384 * cv.height / cv.width);
        const c2 = th.getContext('2d'); c2.imageSmoothingQuality = 'high'; c2.drawImage(cv, 0, 0, th.width, th.height);
        canvasToFile(th, path.join(outDir, 'thumbs', `t${pad(t.n)}.jpg`), 'image/jpeg', 0.85);
      } else if (t.k === 'mbase') {
        const f = `m${pad(t.n)}${t.side}.jpg`; canvasToFile(cv, path.join(outDir, 'base', f), 'image/jpeg', 0.92); res.mbase[t.n + t.side] = 'base/' + f;
      } else if (t.k === 'abase') {
        const f = `a${pad(t.n)}.jpg`; canvasToFile(cv, path.join(outDir, 'base', f), 'image/jpeg', 0.92); res.abase[t.n] = 'base/' + f;
      } else {
        const key = t.k === 'mlayer' ? `${t.n}_${t.j}_${t.side}` : `${t.n}_${t.id}`;
        if (t.bg === '000000') pend.set(t.k + key, cv);
        else {
          const cb = pend.get(t.k + key); pend.delete(t.k + key);
          if (cb) {
            const m = matte(cb, cv);
            if (m) {
              const f = (t.k === 'mlayer' ? 'm' : 'a') + key.replace(/[^\w]/g, '_') + '.png';
              canvasToFile(m.cv, path.join(outDir, 'img', f), 'image/png');
              const o = { src: 'img/' + f, x: +m.x.toFixed(4), y: +m.y.toFixed(4), w: +m.w.toFixed(4), h: +m.h.toFixed(4) };
              (t.k === 'mlayer' ? res.mlayer : res.alayer)[key] = o;
            }
          }
        }
      }
      if (k % 8 === 7) await new Promise(r => setTimeout(r, 0));
    }
    await pdf.destroy();

    /* ---- media ---- */
    const mediaDone = new Map();
    const allMedia = []; S.forEach(s => s.shapes.forEach(sh => { if (sh.media) allMedia.push([s, sh]); }));
    let mi = 0;
    for (const [s, sh] of allMedia) {
      mi++; P(86 + 10 * mi / Math.max(1, allMedia.length), 'Estrazione media ' + mi + '/' + allMedia.length);
      const m = sh.media;
      if (m.external || !m.target) { warn.push(`Slide ${s.n}: media collegato esterno non incluso (${m.raw})`); continue; }
      if (mediaDone.has(m.target)) { m.file = mediaDone.get(m.target); continue; }
      const en = zz.entries.get(m.target); if (!en) { warn.push(`Slide ${s.n}: media mancante ${m.target}`); continue; }
      const name = path.posix.basename(m.target); const dst = path.join(outDir, 'video', name);
      if (!(fs.existsSync(dst) && fs.statSync(dst).size === en.uncompressedSize)) {
        const st = await entryStream(zz.z, en);
        await new Promise((res, rej) => { const w = fs.createWriteStream(dst); st.pipe(w); w.on('close', res); w.on('error', rej); st.on('error', rej); });
      }
      m.file = 'video/' + name; mediaDone.set(m.target, m.file);
      m.dur = await mediaDuration(dst);
      if (m.dur < 0) warn.push(`Slide ${s.n}: formato ${path.extname(name)} non riproducibile`);
    }
    // rimuove media non più usati
    const usedMedia = new Set([...mediaDone.values()].map(f => path.basename(f)));
    for (const f of fs.readdirSync(path.join(outDir, 'video'))) if (!usedMedia.has(f)) try { fs.unlinkSync(path.join(outDir, 'video', f)); } catch (e) {}

    /* ---- manifest ---- */
    P(97, 'Scrittura manifest');
    const slides = S.map(s => {
      const o = { n: s.n, img: `slides/s${pad(s.n)}.jpg`, thumb: `thumbs/t${pad(s.n)}.jpg`, hidden: s.hidden, title: s.title, notes: s.notes, tr: s.tr, media: [] };
      for (const sh of s.shapes) if (sh.media && sh.media.file) {
        const md = s.timing.media[sh.id] || {};
        o.media.push({ id: sh.id, kind: sh.media.kind, src: sh.media.file, dur: sh.media.dur, rect: sh.rect, name: sh.name,
          vol: md.vol == null ? 1 : md.vol, mute: !!md.mute, loop: !!md.loop, hideStopped: md.showWhenStopped === false,
          trimSt: sh.media.trimSt, trimEnd: sh.media.trimEnd, playable: sh.media.dur >= 0 });
      }
      if (s.anim.ids.length && res.abase[s.n]) {
        o.anim = { base: res.abase[s.n], layers: [], steps: s.anim.steps, initial: s.anim.initial };
        const zOf = id => (s.shapes.find(x => x.id === id) || { z: 0 }).z;
        for (const id of s.anim.ids) { const l = res.alayer[`${s.n}_${id}`]; if (l) o.anim.layers.push(Object.assign({ id, z: zOf(id) }, l)); }
        o.anim.layers.sort((p, q) => p.z - q.z);
        const have = new Set(o.anim.layers.map(l => l.id));
        o.anim.steps = o.anim.steps.map(st => st.filter(e => have.has(e.id)));
        // passi vuoti (oggetti invisibili) eliminati, tranne il passo 0
        o.anim.steps = [o.anim.steps[0]].concat(o.anim.steps.slice(1).filter(st => st.length));
        if (!o.anim.layers.length) delete o.anim;
      }
      return o;
    });
    const M = {};
    for (const b of Object.keys(morphs)) {
      const m = morphs[b];
      const movers = m.pairs.map((p, j) => ({ a: res.mlayer[`${b}_${j}_a`] || null, b: res.mlayer[`${b}_${j}_b`] || null })).filter(x => x.a || x.b);
      if (!res.mbase[b + 'a'] || !res.mbase[b + 'b']) continue;
      M[b] = { a: m.a, b: m.b, baseA: res.mbase[b + 'a'], baseB: res.mbase[b + 'b'], movers };
    }
    const st = fs.statSync(pptx);
    const manifest = {
      version: MANIFEST_VERSION, app: 'InRegia', name: path.basename(pptx).replace(/\.pptx$/i, ''), source: path.basename(pptx),
      sourceSize: st.size, sourceMtime: Math.round(st.mtimeMs), imported: new Date().toISOString(),
      width, height: H, aspect: SW / SH, slides, morphs: M, warnings: warn,
    };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    P(100, 'Completato');
    return manifest;
  } finally {
    try { zz.z.close(); } catch (e) {}
  }
}

module.exports = { importDeck, MANIFEST_VERSION };
