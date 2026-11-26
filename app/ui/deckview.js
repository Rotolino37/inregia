'use strict';
/* InRegia - motore di visualizzazione: slide composite, transizioni, morph, animazioni */
(function (G) {
  const EASE = 'cubic-bezier(.45,0,.2,1)';

  function visAfter(slide, step) {
    const a = slide.anim; if (!a) return null;
    const v = Object.assign({}, a.initial);
    for (let k = 0; k <= step && k < a.steps.length; k++) for (const e of a.steps[k]) {
      if (e.cls === 'entr') v[e.id] = true; else if (e.cls === 'exit') v[e.id] = false;
    }
    return v;
  }

  /* ---------------------------------------------------------- maschere (clip-path)
     q = quota rivelata 0..1. Stesso numero di punti per ogni q, così le chiavi si interpolano. */
  const P2 = (x, y) => (Math.round(x * 100) / 100) + '% ' + (Math.round(y * 100) / 100) + '%';
  const poly = pts => 'polygon(' + pts.map(([x, y]) => P2(x, y)).join(',') + ')';
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  function rects(list) { // unione di rettangoli [x,y,w,h] come un solo poligono: ogni rettangolo è raggiunto da (0,0) e si torna indietro sullo stesso segmento (area nulla)
    const pts = [[0, 0]];
    for (const [x, y, w, h] of list) pts.push([x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y], [0, 0]);
    if (!pts.length) pts.push([0, 0], [0, 0], [0, 0]);
    return poly(pts);
  }
  function sector(cx, cy, r, a0, a1, n) { const pts = [[cx, cy]]; for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n - 90) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return pts; }
  const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  function clipAt(k, q, o) {
    q = clamp01(q); o = o || {};
    switch (k) {
      case 'wipe': { const r = (1 - q) * 100; return { l: `inset(0 ${r}% 0 0)`, r: `inset(0 0 0 ${r}%)`, u: `inset(0 0 ${r}% 0)`, d: `inset(${r}% 0 0 0)` }[o.dir || 'l']; }
      case 'split': { const r = (1 - q) * 50; return o.orient === 'v' ? `inset(0 ${r}% 0 ${r}%)` : `inset(${r}% 0 ${r}% 0)`; }
      case 'splitIn': { const r = q * 50; return poly(o.orient === 'v' ? [[0, 0], [r, 0], [r, 100], [0, 100], [0, 0], [100 - r, 0], [100, 0], [100, 100], [100 - r, 100], [100 - r, 0]] : [[0, 0], [100, 0], [100, r], [0, r], [0, 0], [0, 100 - r], [100, 100 - r], [100, 100], [0, 100], [0, 100 - r]]); }
      case 'box': { const r = (1 - q) * 50; return `inset(${r}% ${r}% ${r}% ${r}%)`; }
      case 'circle': return `circle(${q * 75}% at 50% 50%)`;
      case 'diamond': { const r = q * 100; return poly([[50, 50 - r], [50 + r, 50], [50, 50 + r], [50 - r, 50]]); }
      case 'plus': { const a = q * 50, b = q * 100; return poly([[50 - a / 2, 50 - b], [50 + a / 2, 50 - b], [50 + a / 2, 50 - a / 2], [50 + b, 50 - a / 2], [50 + b, 50 + a / 2], [50 + a / 2, 50 + a / 2], [50 + a / 2, 50 + b], [50 - a / 2, 50 + b], [50 - a / 2, 50 + a / 2], [50 - b, 50 + a / 2], [50 - b, 50 - a / 2], [50 - a / 2, 50 - a / 2]]); }
      case 'wheel': { const n = Math.max(1, Math.min(8, o.spokes || 1)), pts = []; for (let i = 0; i < n; i++) pts.push(...sector(50, 50, 75, i * 360 / n, i * 360 / n + q * 360 / n, 6)); return poly(pts); }
      case 'wedge': return poly(sector(50, 50, 75, -q * 180, q * 180, 12));
      case 'blinds': { const L = []; for (let i = 0; i < 6; i++) L.push(o.orient === 'v' ? [i * 100 / 6, 0, q * 100 / 6, 100] : [0, i * 100 / 6, 100, q * 100 / 6]); return rects(L); }
      case 'checker': { const L = [], R = 6, C = 8, w = 100 / C, h = 100 / R; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const off = (r + c) % 2 ? 0.5 : 0, f = clamp01(q * 2 - off) ; if (o.orient === 'v') L.push([c * w, r * h, w, h * f]); else L.push([c * w, r * h, w * f, h]); } return rects(L); }
      case 'randomBar': { const L = [], N = 20, g = rnd(7919); for (let i = 0; i < N; i++) { const at = g() * 0.9, on = q > at ? 1 : 0; L.push(o.orient === 'v' ? [i * 100 / N, 0, on * 100 / N, 100] : [0, i * 100 / N, 100, on * 100 / N]); } return rects(L); }
      case 'strips': { // diagonale verso la direzione indicata
        const t = q * 200, d = o.dir || 'rd';
        const P = { rd: [[0, 0], [t, 0], [0, t]], ld: [[100, 0], [100 - t, 0], [100, t]], ru: [[0, 100], [t, 100], [0, 100 - t]], lu: [[100, 100], [100 - t, 100], [100, 100 - t]] }[d] || [[0, 0], [t, 0], [0, t]];
        return poly(P);
      }
      default: return 'inset(0 0 0 0)';
    }
  }
  // filtri di animEffect -> maschera
  function filterClip(f) {
    const m = /^(\w+)(?:\(([^)]*)\))?/.exec(f || ''); if (!m) return null;
    const k = m[1], a = (m[2] || '').trim();
    switch (k) {
      case 'wipe': return { k: 'wipe', dir: { down: 'u', up: 'd', left: 'r', right: 'l' }[a] || 'l' };
      case 'slide': return { k: 'wipe', dir: { fromTop: 'u', fromBottom: 'd', fromLeft: 'l', fromRight: 'r' }[a] || 'd' };
      case 'barn': return { k: /^in/.test(a) ? 'splitIn' : 'split', orient: /Vertical/.test(a) ? 'v' : 'h' };
      case 'box': return { k: 'box' };
      case 'circle': return { k: 'circle' };
      case 'diamond': return { k: 'diamond' };
      case 'plus': return { k: 'plus' };
      case 'wheel': return { k: 'wheel', spokes: parseInt(a, 10) || 1 };
      case 'wedge': return { k: 'wedge' };
      case 'blinds': return { k: 'blinds', orient: a === 'vertical' ? 'v' : 'h' };
      case 'checkerboard': return { k: 'checker', orient: a === 'down' ? 'v' : 'h' };
      case 'randombar': return { k: 'randomBar', orient: a === 'vertical' ? 'v' : 'h' };
      case 'strips': return { k: 'strips', dir: { downRight: 'rd', downLeft: 'ld', upRight: 'ru', upLeft: 'lu' }[a] || 'rd' };
      default: return null; // fade, dissolve e altri: dissolvenza
    }
  }

  /* ---------------------------------------------------------- comportamenti delle animazioni */
  // formule di PowerPoint: #ppt_x, #ppt_y (centro) e #ppt_w, #ppt_h (dimensioni), in frazioni della slide
  const FMLA_FN = /\b(sin|cos|tan|abs|sqrt|min|max|atan|floor|ceil|round|pi)\b/g;
  function fmla(expr, V) {
    let s = String(expr == null ? '' : expr).trim(); if (!s) return NaN;
    if (/^[+-]?\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) return parseFloat(s);
    s = s.replace(/#ppt_([xywh])/g, (m, k) => '(' + V[k] + ')').replace(/\^/g, '**');
    if (/[^0-9.+\-*/()\s,eE]/.test(s.replace(FMLA_FN, ''))) return NaN;
    try { const v = Function('"use strict";const {sin,cos,tan,abs,sqrt,min,max,atan,floor,ceil,round}=Math,pi=Math.PI;return (' + s + ');')(); return isFinite(v) ? v : NaN; }
    catch (e) { return NaN; }
  }
  // valori numerici di un comportamento con formule, per il riquadro dell'oggetto (in % della slide)
  function bvals(b, L) {
    if (b.v) return b.v;
    const key = L ? L.x + ',' + L.y + ',' + L.w + ',' + L.h : '-';
    if (b._k === key) return b._v;
    const V = L ? { x: (L.x + L.w / 2) / 100, y: (L.y + L.h / 2) / 100, w: L.w / 100, h: L.h / 100 } : { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    const conv = { x: v => (v - V.x) * 100, y: v => (v - V.y) * 100, sx: v => V.w ? v / V.w : 1, sy: v => V.h ? v / V.h : 1, rot: v => v, op: v => v }[b.p];
    const pts = (b.f || []).map(([t, f]) => [t, conv(fmla(f, V))]).filter(x => isFinite(x[1]));
    b._k = key; b._v = pts.length ? pts : [[0, b.p === 'sx' || b.p === 'sy' || b.p === 'op' ? 1 : 0]];
    return b._v;
  }
  const ID = () => ({ x: 0, y: 0, sx: 1, sy: 1, rot: 0, op: 1 });
  // accelerazione e decelerazione come in PowerPoint (frazioni della durata)
  function easeAD(p, acc, dec) {
    acc = acc || 0; dec = dec || 0; if (!acc && !dec) return p;
    const s = acc + dec > 1 ? 1 / (acc + dec) : 1; acc *= s; dec *= s;
    const v = 1 / (1 - acc / 2 - dec / 2);
    if (p < acc) return v * p * p / (2 * acc);
    if (p <= 1 - dec) return v * (p - acc / 2);
    const r = 1 - p; return 1 - v * r * r / (2 * dec);
  }
  function localQ(b, t) { // avanzamento 0..1 di un comportamento al tempo t dall'inizio dell'effetto
    const d = Math.max(1, b.d || 1), rc = b.rc || 1, cyc = d * (b.ar ? 2 : 1);
    let u = (t - b.t) / cyc;
    if (u <= 0) return 0;
    if (u >= rc) { u = rc - Math.floor(rc) || 1; } else u = u - Math.floor(u);
    let q = b.ar ? (u < 0.5 ? u * 2 : (1 - u) * 2) : u;
    if (b.ar && (t - b.t) / cyc >= rc) q = 0;
    return easeAD(q, b.acc, b.dec);
  }
  function tav(v, q) { if (!v.length) return 0; if (q <= v[0][0]) return v[0][1]; for (let i = 1; i < v.length; i++) if (q <= v[i][0]) { const [t0, a] = v[i - 1], [t1, c] = v[i]; return t1 > t0 ? a + (c - a) * (q - t0) / (t1 - t0) : c; } return v[v.length - 1][1]; }
  function pathAt(pts, q) { if (pts.length < 2) return [0, 0]; const f = q * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), r = f - i; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r]; }
  // stato dell'oggetto durante un effetto; S = stato persistente prima dell'effetto
  function sampleFx(e, S, t, L) {
    const o = Object.assign({}, S), out = { clip: null, op: 1 };
    for (const b of e.beh) {
      const q = localQ(b, t);
      switch (b.p) {
        case 'x': o.x += tav(bvals(b, L), q); break;
        case 'y': o.y += tav(bvals(b, L), q); break;
        case 'sx': o.sx *= tav(bvals(b, L), q); break;
        case 'sy': o.sy *= tav(bvals(b, L), q); break;
        case 'rot': o.rot += tav(bvals(b, L), q); break;
        case 'op': out.op *= tav(bvals(b, L), q); break;
        case 'opTo': o.op = S.op + (b.v - S.op) * q; break;
        case 'scaleBy': o.sx *= 1 + (b.x - 1) * q; o.sy *= 1 + (b.y - 1) * q; break;
        case 'scaleTo': { const fx = b.fx == null ? S.sx : b.fx, fy = b.fy == null ? S.sy : b.fy; o.sx = fx + (b.x - fx) * q; o.sy = fy + (b.y - fy) * q; break; }
        case 'rotBy': o.rot += b.v * q; break;
        case 'rotTo': { const f = b.from == null ? S.rot : b.from; o.rot = f + (b.v - f) * q; break; }
        case 'path': { const [dx, dy] = pathAt(b.pts, q); o.x += dx; o.y += dy; break; }
        case 'filter': {
          const io = b.io === 'out' ? 1 - q : q, fc = filterClip(b.f);
          if (fc) out.clip = clipAt(fc.k, io, fc); else out.op *= io;
          break;
        }
      }
    }
    out.state = o; return out;
  }
  // stato persistente dopo un effetto (enfasi e percorsi restano, ingressi e uscite no)
  function endState(e, S, L) {
    if (!e.beh || (e.cls !== 'emph' && e.cls !== 'path')) return S;
    const o = sampleFx(e, S, 1e9, L).state;
    return { x: o.x, y: o.y, sx: o.sx, sy: o.sy, rot: o.rot, op: o.op };
  }
  function statesAfter(slide, step) {
    const a = slide.anim, st = {}; if (!a) return st;
    for (const l of a.layers) st[l.id] = ID();
    for (let k = 0; k <= step && k < a.steps.length; k++) {
      const list = a.steps[k].slice().sort((p, q) => p.t - q.t);
      for (const e of list) if (st[e.id]) st[e.id] = endState(e, st[e.id], a.layers.find(l => l.id === e.id));
    }
    return st;
  }
  const tf = (o, W, H) => `translate(${(o.x * W / 100).toFixed(2)}px,${(o.y * H / 100).toFixed(2)}px) rotate(${o.rot.toFixed(3)}deg) scale(${o.sx.toFixed(4)},${o.sy.toFixed(4)})`;
  const isId = o => !o.x && !o.y && o.sx === 1 && o.sy === 1 && !o.rot;
  const visBefore = slide => slide.anim ? Object.assign({}, slide.anim.initial) : null;
  const place = (el, r) => { el.style.left = r.x + '%'; el.style.top = r.y + '%'; el.style.width = r.w + '%'; el.style.height = r.h + '%'; };

  class DeckView {
    constructor(stage, manifest, base, opt) {
      this.stage = stage; this.m = manifest; this.base = base.replace(/\/?$/, '/'); this.opt = opt || {};
      this.cur = null; this.n = 0; this.step = -1; this.anims = []; this.busy = false; this.timers = [];
      stage.classList.add('dv-stage');
    }
    url(p) { return this.base + p; }
    slide(n) { return this.m.slides[n - 1]; }
    stepsOf(n) { const s = this.slide(n); return s && s.anim ? s.anim.steps.length - 1 : 0; }

    build(n, vis, sts) {
      const s = this.slide(n); const el = document.createElement('div'); el.className = 'dv-slide'; el.dataset.n = n;
      const img = document.createElement('img'); img.className = 'dv-base'; img.draggable = false; img.decoding = 'sync';
      img.src = this.url(s.anim ? s.anim.base : s.img); el.appendChild(img);
      if (s.anim) for (const l of s.anim.layers) {
        const li = document.createElement('img'); li.className = 'dv-layer'; li.draggable = false; li.dataset.id = l.id;
        li.src = this.url(l.src); place(li, l); if (vis && !vis[l.id]) li.style.visibility = 'hidden';
        if (sts && sts[l.id] && !isId(sts[l.id])) li.dataset.st = JSON.stringify(sts[l.id]);
        if (sts && sts[l.id] && sts[l.id].op !== 1) li.style.opacity = String(sts[l.id].op);
        el.appendChild(li);
      }
      return el;
    }
    // trasformazioni persistenti in pixel: si calcolano quando la slide è nello stage
    _applyTf(el) { const W = this.stage.clientWidth, H = this.stage.clientHeight; el.querySelectorAll('.dv-layer[data-st]').forEach(li => { li.style.transform = tf(JSON.parse(li.dataset.st), W, H); }); }
    layer(el, id) { return el.querySelector('.dv-layer[data-id="' + CSS.escape(String(id)) + '"]'); }
    preload(n) {
      const s = this.slide(n); if (!s) return;
      const L = [s.anim ? s.anim.base : s.img]; if (s.anim) s.anim.layers.forEach(l => L.push(l.src));
      const mo = this.m.morphs[n]; if (mo) { L.push(mo.baseA, mo.baseB); mo.movers.forEach(x => { if (x.a) L.push(x.a.src); if (x.b) L.push(x.b.src); }); }
      L.forEach(p => { const i = new Image(); i.src = this.url(p); });
    }
    finish() {
      this.timers.forEach(clearTimeout); this.timers = [];
      const a = this.anims; this.anims = [];
      a.forEach(x => { try { x.finish(); } catch (e) {} });
      if (this._done) { const d = this._done; this._done = null; d(); }
    }
    _anim(el, kf, o) { const a = el.animate(kf, Object.assign({ fill: 'both' }, o)); this.anims.push(a); return a; }
    _swap(el) {
      for (const c of Array.from(this.stage.querySelectorAll(':scope > .dv-slide, :scope > .dv-morph'))) if (c !== el) c.remove();
      el.style.zIndex = 1; this.cur = el; this._applyTf(el);
    }

    /* visualizzazione immediata (anteprime e salti) */
    render(n, step) {
      this.finish(); const s = this.slide(n); if (!s) return;
      const el = this.build(n, step < 0 ? visBefore(s) : visAfter(s, step), step < 0 ? null : statesAfter(s, step));
      this.stage.appendChild(el); this._swap(el); this.n = n; this.step = step; this._applyTf(el);
    }

    /* cambio slide con transizione. how: 'forward' | 'back' | 'jump' */
    go(n, how) {
      this.finish();
      const s = this.slide(n); if (!s) return Promise.resolve();
      const from = this.n, old = this.cur;
      let tr = null, rev = false;
      if (how === 'forward') tr = s.tr;
      else if (how === 'back') { const lv = this.slide(from); tr = lv && lv.tr; rev = true; }
      else if (how === 'jump' && old) tr = { type: 'fade', dur: 300 };
      if (this.opt.noTransitions) tr = null;
      const endStep = how === 'back' ? this.stepsOf(n) : 0;
      const target = this.build(n, how === 'back' ? visAfter(s, endStep) : visBefore(s), how === 'back' ? statesAfter(s, endStep) : null);
      this.n = n; this.step = how === 'back' ? endStep : -1;
      const after = () => { if (how !== 'back') return this.playStep(0); return Promise.resolve(); };
      if (tr && tr.type === 'morph' && old) {
        const key = rev ? from : n, mo = this.m.morphs[key];
        if (mo && ((!rev && mo.a === from) || (rev && mo.b === from))) return this._morph(mo, rev, target, tr.dur || 2000).then(after);
        tr = { type: 'fade', dur: tr.dur || 700 };
      }
      if (!old || !tr || tr.type === 'cut' || !(tr.dur > 0)) {
        this.stage.appendChild(target); this._swap(target); this._applyTf(target); return after();
      }
      return this._trans(old, target, tr, rev).then(after);
    }

    _trans(old, el, tr, rev) {
      const d = tr.dur, W = this.stage.clientWidth, H = this.stage.clientHeight;
      // in PowerPoint dir = verso del movimento; qui serve il lato da cui entra la nuova slide
      const OPP = { l: 'r', r: 'l', u: 'd', d: 'u' };
      let dir = OPP[tr.dir || 'l'] || 'r'; if (rev) dir = OPP[dir];
      const off = { l: [-W, 0], r: [W, 0], u: [0, -H], d: [0, H] }[dir] || [W, 0];
      const T = (x, y) => `translate(${x}px,${y}px)`;
      el.style.zIndex = 2; old.style.zIndex = 1; this.stage.appendChild(el); this._applyTf(el);
      const o = { duration: d, easing: EASE };
      let a;
      switch (tr.type) {
        case 'fade': a = this._anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: 'linear' }); break;
        case 'fadeBlack': case 'flash': {
          const c = tr.type === 'flash' ? '#fff' : '#000';
          const cover = document.createElement('div'); cover.className = 'dv-cover'; cover.style.background = c; this.stage.appendChild(cover);
          this._anim(cover, [{ opacity: 0 }, { opacity: 1, offset: .5 }, { opacity: 0 }], { duration: d, easing: 'linear' });
          a = this._anim(el, [{ opacity: 0 }, { opacity: 0, offset: .5 }, { opacity: 1 }], { duration: d, easing: 'linear' });
          a.finished.then(() => cover.remove(), () => cover.remove()); break;
        }
        case 'push':
          this._anim(old, [{ transform: T(0, 0) }, { transform: T(-off[0], -off[1]) }], o);
          a = this._anim(el, [{ transform: T(off[0], off[1]) }, { transform: T(0, 0) }], o); break;
        case 'cover': a = this._anim(el, [{ transform: T(off[0], off[1]) }, { transform: T(0, 0) }], o); break;
        case 'uncover':
          old.style.zIndex = 3;
          a = this._anim(old, [{ transform: T(0, 0) }, { transform: T(-off[0], -off[1]) }], o); break;
        case 'wipe': {
          const from = { l: 'inset(0 100% 0 0)', r: 'inset(0 0 0 100%)', u: 'inset(0 0 100% 0)', d: 'inset(100% 0 0 0)' }[dir];
          a = this._anim(el, [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }], { duration: d, easing: 'ease-in-out' }); break;
        }
        case 'split': {
          const v = tr.orient === 'v';
          const closed = v ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)';
          if (tr.inOut === 'in') { old.style.zIndex = 3; a = this._anim(old, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: closed }], o); }
          else a = this._anim(el, [{ clipPath: closed }, { clipPath: 'inset(0 0 0 0)' }], o);
          break;
        }
        case 'zoom':
          if (tr.inOut === 'out') { old.style.zIndex = 3; a = this._anim(old, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], o); }
          else { a = this._anim(el, [{ transform: 'scale(.25)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], o); }
          break;
        case 'circle': case 'diamond': case 'plus': case 'box': case 'wheel': case 'wedge': case 'blinds': case 'checker': case 'randomBar': case 'strips': {
          const N = 30, kf = [];
          const k = tr.type === 'box' && tr.inOut === 'in' ? 'box' : tr.type;
          for (let i = 0; i <= N; i++) kf.push({ offset: i / N, clipPath: clipAt(k, i / N, { orient: tr.orient, spokes: tr.spokes, dir: tr.dir }) });
          a = this._anim(el, kf, { duration: d, easing: tr.type === 'randomBar' || tr.type === 'checker' ? 'linear' : 'ease-in-out' }); break;
        }
        case 'cube': case 'flip': {
          this.stage.classList.add('dv-3d');
          const ax = dir === 'u' || dir === 'd' ? 'X' : 'Y', sg = (dir === 'l' || dir === 'u') ? -1 : 1;
          if (tr.type === 'cube') {
            const half = (ax === 'Y' ? W : H) / 2;
            this._anim(old, [{ transform: `translateZ(-${half}px) rotate${ax}(0deg) translateZ(${half}px)` }, { transform: `translateZ(-${half}px) rotate${ax}(${-sg * 90}deg) translateZ(${half}px)` }], o);
            a = this._anim(el, [{ transform: `translateZ(-${half}px) rotate${ax}(${sg * 90}deg) translateZ(${half}px)` }, { transform: `translateZ(-${half}px) rotate${ax}(0deg) translateZ(${half}px)` }], o);
          } else {
            this._anim(old, [{ transform: `rotate${ax}(0deg)`, opacity: 1 }, { transform: `rotate${ax}(${-sg * 90}deg)`, opacity: 1, offset: .5 }, { transform: `rotate${ax}(${-sg * 90}deg)`, opacity: 0 }], o);
            a = this._anim(el, [{ transform: `rotate${ax}(${sg * 90}deg)`, opacity: 0 }, { transform: `rotate${ax}(${sg * 90}deg)`, opacity: 1, offset: .5 }, { transform: `rotate${ax}(0deg)`, opacity: 1 }], o);
          }
          a.finished.then(() => this.stage.classList.remove('dv-3d'), () => this.stage.classList.remove('dv-3d'));
          break;
        }
        default: a = this._anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: 'linear' });
      }
      return this._wait(d, () => { this.anims.forEach(x => { try { x.cancel(); } catch (e) {} }); this.anims = []; el.style.transform = ''; this._swap(el); });
    }
    _wait(ms, fin) {
      return new Promise(res => {
        this.busy = true;
        const done = () => { this.busy = false; this._done = null; fin(); res(); };
        this._done = done;
        this.timers.push(setTimeout(() => { if (this._done === done) done(); }, ms + 20));
      });
    }

    _morph(mo, rev, target, d) {
      const wrap = document.createElement('div'); wrap.className = 'dv-morph'; wrap.style.zIndex = 3;
      const im = src => { const i = document.createElement('img'); i.src = this.url(src); i.draggable = false; return i; };
      const bFrom = im(rev ? mo.baseB : mo.baseA), bTo = im(rev ? mo.baseA : mo.baseB);
      bFrom.className = bTo.className = 'dv-full'; wrap.append(bFrom, bTo);
      const o = { duration: d, easing: EASE };
      this._anim(bTo, [{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: 'ease-in-out' });
      for (const mv of mo.movers) {
        const A = rev ? mv.b : mv.a, B = rev ? mv.a : mv.b;
        const box = document.createElement('div'); box.className = 'dv-mbox'; wrap.appendChild(box);
        const r0 = A || B, r1 = B || A; place(box, r0);
        if (A) { const i = im(A.src); box.appendChild(i); if (B) this._anim(i, [{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: 'ease-in-out' }); else this._anim(i, [{ opacity: 1 }, { opacity: 0 }], { duration: d * .5, easing: 'ease-in' }); }
        if (B) { const i = im(B.src); box.appendChild(i); this._anim(i, [{ opacity: 0 }, { opacity: 1 }], A ? { duration: d, easing: 'ease-in-out' } : { duration: d * .5, delay: d * .5, easing: 'ease-out' }); }
        this._anim(box, [{ left: r0.x + '%', top: r0.y + '%', width: r0.w + '%', height: r0.h + '%' }, { left: r1.x + '%', top: r1.y + '%', width: r1.w + '%', height: r1.h + '%' }], o);
      }
      this.stage.appendChild(wrap);
      return this._wait(d, () => {
        this.anims.forEach(x => { try { x.cancel(); } catch (e) {} }); this.anims = [];
        this.stage.appendChild(target); this._swap(target);
      });
    }

    /* animazioni di un passo (0 = automatiche all'ingresso) */
    playStep(k) {
      const s = this.slide(this.n);
      if (!s || !s.anim || k >= s.anim.steps.length) { this.step = Math.max(this.step, k); return Promise.resolve(); }
      this.finish();
      const el = this.cur, list = s.anim.steps[k]; this.step = k;
      if (!list.length || this.opt.noAnimations) { this._applyStatic(el, s, k); return Promise.resolve(); }
      const W = this.stage.clientWidth, H = this.stage.clientHeight;
      const ST = statesAfter(s, k - 1);
      let end = 0;
      // effetti sullo stesso oggetto nello stesso passo: si concatenano nell'ordine di inizio
      for (const e of list.slice().sort((p, q) => p.t - q.t)) {
        const li = this.layer(el, e.id); if (!li) continue;
        const l = s.anim.layers.find(x => x.id === e.id);
        const d = Math.max(1, e.dur), o = { duration: d, delay: e.t, easing: EASE };
        end = Math.max(end, e.t + d);
        const S0 = ST[e.id] || ID();
        if (e.beh && e.beh.length) {
          const N = Math.min(60, Math.max(12, Math.round(d / 40)));
          const kf = [];
          for (let i = 0; i <= N; i++) {
            const r = sampleFx(e, S0, d * i / N, l), f = { offset: i / N, transform: tf(r.state, W, H), opacity: Math.max(0, Math.min(1, r.state.op * r.op)) };
            f.clipPath = r.clip || 'none';
            kf.push(f);
          }
          if (kf.every(f => f.clipPath === 'none')) kf.forEach(f => delete f.clipPath);
          if (e.cls === 'entr') this.timers.push(setTimeout(() => { li.style.visibility = 'visible'; }, e.t));
          this._anim(li, kf, { duration: d, delay: e.t, easing: 'linear' });
          if (e.cls === 'exit') this.timers.push(setTimeout(() => { li.style.visibility = 'hidden'; }, e.t + d));
          ST[e.id] = endState(e, S0, l);
          continue;
        }
        // manifest della versione 3: effetti predefiniti
        const kf = this._fx(e, l, W, H);
        if (e.cls === 'entr') {
          this.timers.push(setTimeout(() => { li.style.visibility = 'visible'; }, e.t));
          if (e.fx !== 'appear') this._anim(li, kf, o);
        } else if (e.cls === 'exit') {
          if (e.fx !== 'appear') this._anim(li, kf.slice().reverse(), o);
          this.timers.push(setTimeout(() => { li.style.visibility = 'hidden'; }, e.t + (e.fx === 'appear' ? 0 : d)));
        } else {
          this._anim(li, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], o);
        }
      }
      return this._wait(end, () => { this.anims.forEach(x => { try { x.cancel(); } catch (e) {} }); this.anims = []; this._applyStatic(el, s, k); });
    }
    _applyStatic(el, s, k) {
      const v = visAfter(s, k), st = statesAfter(s, k), W = this.stage.clientWidth, H = this.stage.clientHeight;
      for (const l of s.anim.layers) {
        const li = this.layer(el, l.id); if (!li) continue;
        const o = st[l.id] || ID();
        li.style.visibility = v[l.id] ? 'visible' : 'hidden'; li.style.clipPath = '';
        li.style.transform = isId(o) ? '' : tf(o, W, H); li.style.opacity = o.op === 1 ? '' : String(o.op);
      }
    }
    _fx(e, l, W, H) {
      const dir = e.dir || 'd';
      switch (e.fx) {
        case 'fade': return [{ opacity: 0 }, { opacity: 1 }];
        case 'fly': {
          const dx = dir === 'l' ? -(l.x + l.w) / 100 * W : dir === 'r' ? (100 - l.x) / 100 * W : 0;
          const dy = dir === 'u' ? -(l.y + l.h) / 100 * H : dir === 'd' ? (100 - l.y) / 100 * H : 0;
          return [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }];
        }
        case 'wipe': {
          const from = { l: 'inset(0 100% 0 0)', r: 'inset(0 0 0 100%)', u: 'inset(0 0 100% 0)', d: 'inset(100% 0 0 0)' }[dir] || 'inset(0 100% 0 0)';
          return [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }];
        }
        case 'split': return [{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }];
        case 'zoom': return [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
        case 'circle': return [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }];
        case 'rise': return [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }];
        case 'descend': return [{ transform: 'translateY(-40px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }];
        default: return [{ opacity: 0 }, { opacity: 1 }];
      }
    }
  }
  G.DeckView = DeckView;
})(window);
