/* InRegia - traduzione dell'interfaccia.
 * Il testo sorgente è in italiano. Il dizionario (i18n-dict.js) associa a ogni testo italiano le traduzioni;
 * i modelli con {0}, {1} coprono i testi composti ("Slide {0} di {1}"). Qui si traduce tutto ciò che compare
 * nel documento (testi, title, aria-label, placeholder) anche quando viene creato o cambiato dopo, così
 * il codice dell'interfaccia resta scritto in un solo modo.
 */
(function (G) {
  'use strict';
  const DICT = G.I18N_DICT || { strings: {}, patterns: [] };
  const bridge = G.DP || {};
  const LANG = (bridge.lang || 'it');
  const HARVEST = !!bridge.i18nHarvest;
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const memo = new Map();
  const misses = new Set();
  const produced = new Set(); // testi già tradotti: non vanno ritradotti né segnalati
  const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const PAT = (DICT.patterns || []).map(([src, tr]) => {
    const order = []; const re = new RegExp('^' + esc(src).replace(/\{(\d)\}/g, (m, n) => { order.push(+n); return '([\\s\\S]+?)'; }) + '$');
    return { re, order, tr };
  });
  const exact = k => { const e = DICT.strings[k]; return e && e[LANG] != null ? e[LANG] : null; };
  function translate(k, depth) {
    if (LANG === 'it') return null;
    if (memo.has(k)) return memo.get(k);
    depth = depth || 0;
    let r = exact(k);
    if (r == null && depth < 4) for (const p of PAT) {
      const m = p.re.exec(k); if (!m || !p.tr[LANG]) continue;
      // le parti variabili possono essere a loro volta testi da tradurre
      const vals = []; p.order.forEach((n, i) => {
        const v = m[i + 1], t = v.trim();
        let x = /[A-Za-zÀ-ú]{2}/.test(t) ? translate(t, depth + 1) : null;
        // elenco separato da virgole: si traduce voce per voce
        if (x == null && t.includes(', ')) { const parts = t.split(', ').map(q => { const y = /[A-Za-zÀ-ú]{2}/.test(q) ? translate(q, depth + 1) : null; return y == null ? q : y; }); const j = parts.join(', '); if (j !== t) x = j; }
        vals[n] = x != null ? v.replace(t, x) : v;
      });
      r = p.tr[LANG].replace(/\{(\d)\}/g, (x, n) => vals[+n] != null ? vals[+n] : x);
      break;
    }
    if (memo.size > 5000) memo.clear();
    memo.set(k, r);
    if (r != null) { if (produced.size > 5000) produced.clear(); produced.add(r); }
    if (r == null && HARVEST && depth === 0 && !produced.has(k) && /[a-zà-ú]{2,}/i.test(k)) misses.add(k);
    return r;
  }
  // testo con gli spazi originali attorno
  function tr(s) {
    if (s == null) return s;
    const k = String(s).trim();
    if (!k || !/[A-Za-zÀ-ú]/.test(k)) return null;
    const r = translate(k);
    return r == null ? null : String(s).replace(k, r);
  }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
  function skip(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { if (SKIP.has(e.tagName) || e.hasAttribute('data-noi18n') || e.isContentEditable) return true; } return false; }
  function doText(n) { if (skip(n.parentElement)) return; const r = tr(n.nodeValue); if (r != null && r !== n.nodeValue) n.nodeValue = r; }
  function doAttrs(el) {
    if (skip(el)) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const r = tr(v); if (r != null && r !== v) el.setAttribute(a, r); } }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skip(root)) return; doAttrs(root); }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function start() {
    if (LANG === 'it' && !HARVEST) { document.documentElement.lang = 'it'; return; }
    document.documentElement.lang = LANG;
    walk(document.documentElement);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else for (const n of m.addedNodes) walk(n);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    if (HARVEST && bridge.send) setInterval(() => { if (misses.size) { bridge.send('i18n:miss', [...misses]); misses.clear(); } }, 1000);
  }
  // per i testi usati fuori dal documento (confirm, titoli, Notification...)
  G.T = s => { const r = tr(s); return r == null ? s : r; };
  G.I18N = { lang: LANG, t: G.T, walk };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(window);
