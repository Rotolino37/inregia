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

    build(n, vis) {
      const s = this.slide(n); const el = document.createElement('div'); el.className = 'dv-slide'; el.dataset.n = n;
      const img = document.createElement('img'); img.className = 'dv-base'; img.draggable = false; img.decoding = 'sync';
      img.src = this.url(s.anim ? s.anim.base : s.img); el.appendChild(img);
      if (s.anim) for (const l of s.anim.layers) {
        const li = document.createElement('img'); li.className = 'dv-layer'; li.draggable = false; li.dataset.id = l.id;
        li.src = this.url(l.src); place(li, l); if (vis && !vis[l.id]) li.style.visibility = 'hidden';
        el.appendChild(li);
      }
      return el;
    }
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
      el.style.zIndex = 1; this.cur = el;
    }

    /* visualizzazione immediata (anteprime e salti) */
    render(n, step) {
      this.finish(); const s = this.slide(n); if (!s) return;
      const el = this.build(n, step < 0 ? visBefore(s) : visAfter(s, step));
      this.stage.appendChild(el); this._swap(el); this.n = n; this.step = step;
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
      const target = this.build(n, how === 'back' ? visAfter(s, endStep) : visBefore(s));
      this.n = n; this.step = how === 'back' ? endStep : -1;
      const after = () => { if (how !== 'back') return this.playStep(0); return Promise.resolve(); };
      if (tr && tr.type === 'morph' && old) {
        const key = rev ? from : n, mo = this.m.morphs[key];
        if (mo && ((!rev && mo.a === from) || (rev && mo.b === from))) return this._morph(mo, rev, target, tr.dur || 2000).then(after);
        tr = { type: 'fade', dur: tr.dur || 700 };
      }
      if (!old || !tr || tr.type === 'cut' || !(tr.dur > 0)) {
        this.stage.appendChild(target); this._swap(target); return after();
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
      el.style.zIndex = 2; old.style.zIndex = 1; this.stage.appendChild(el);
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
        case 'circle': a = this._anim(el, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], o); break;
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
      let end = 0;
      for (const e of list) {
        const li = this.layer(el, e.id); if (!li) continue;
        const l = s.anim.layers.find(x => x.id === e.id);
        const d = Math.max(1, e.dur), o = { duration: d, delay: e.t, easing: EASE };
        end = Math.max(end, e.t + d);
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
      const v = visAfter(s, k);
      for (const l of s.anim.layers) { const li = this.layer(el, l.id); if (li) { li.style.visibility = v[l.id] ? 'visible' : 'hidden'; li.style.transform = ''; li.style.clipPath = ''; li.style.opacity = ''; } }
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
