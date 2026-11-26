'use strict';
/* InRegia - finestra relatore */
const $ = id => document.getElementById(id);
const send = m => DP.send('p2a', m);
/* Aggiorna il contenuto solo se cambia: sostituire il nodo tra mousedown e mouseup fa perdere il click. */
const setHTML = (el, h) => { if (el && el.__h !== h) { el.innerHTML = h; el.__h = h; } };
const setBtn = (id, icon, label) => setHTML($(id), ic(icon) + (label ? '<span>' + esc(label) + '</span>' : ''));

let M = null, BASE = '', N = 0, ST = {}, SET = {}, DECK = '';
const S = { n: 1, step: 0, cover: null, ptr: false, visitStarted: false };
let AST = { n: 0, media: [] };
let AUD = { open: false, locked: false, displays: [], displayId: null };
let curView = null, nxtView = null, mediaIdx = 0;

/* statico */
setBtn('bTmr', 'play'); setBtn('bTmr0', 'refresh'); setBtn('bHelp', 'help'); setBtn('bList', 'library'); setBtn('bQuit', 'power');
setBtn('bBlack', 'black'); setBtn('bWhite', 'white'); setBtn('bPtr', 'pointer'); setBtn('bFs', 'monitor');
setBtn('bFirst', 'first'); setBtn('bPrev', 'prev', 'Indietro'); $('bNext').innerHTML = '<span>Avanti</span>' + ic('next');
setBtn('mPlay', 'play'); setBtn('mStop', 'stop'); setBtn('mBack', 'back10'); setBtn('mFwd', 'fwd10');
setBtn('muPrev', 'trkPrev'); setBtn('muPlay', 'play'); setBtn('muNext', 'trkNext'); setBtn('muStop', 'fade', 'Sfuma'); setBtn('muShuf', 'shuffle');
setBtn('nMinus', 'minus'); setBtn('nPlus', 'plus');
document.querySelector('[data-tab=audio]').innerHTML = ic('sliders') + 'Audio';
document.querySelector('[data-tab=music]').innerHTML = ic('music') + 'Musica';
document.querySelector('[data-tab=notes]').innerHTML = ic('notes') + 'Note';

/* =============================================================== utilità */
function dialogBox(title, html, buttons, icon) {
  const bg = document.createElement('div'); bg.className = 'dlg-bg';
  bg.innerHTML = `<div class="dlg" role="dialog" aria-modal="true"><h2>${icon ? ic(icon) : ''}${esc(title)}</h2><div class="body">${html}</div><div class="row"></div></div>`;
  const row = bg.querySelector('.row'); const close = () => { bg.remove(); document.removeEventListener('keydown', kh, true); };
  const btns = buttons.map(([t, cls, fn, keys]) => { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.innerHTML = t; b.onclick = () => { fn && fn(bg); close(); }; row.appendChild(b); return { b, keys }; });
  const kh = e => { e.stopPropagation(); const m = btns.find(x => x.keys && x.keys.includes(e.key)); if (m) { e.preventDefault(); m.b.click(); } };
  document.addEventListener('keydown', kh, true); document.body.appendChild(bg);
  (btns[btns.length - 1] || {}).b && btns[btns.length - 1].b.focus();
  return close;
}
const isModal = () => !!document.querySelector('.dlg-bg');
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => DP.send('deck:state', { n: S.n, mix: MIX, eqName: EQNAME, queue: QUEUE, excluded: [...EXCL], manual: [...MANUAL], sources: SRC,
    xf: MO.xf, shuffle: MO.shuffle, repeat: MO.repeat, nfs: NFS, displayId: AUD.displayId != null ? AUD.displayId : ST.displayId, warnVideo: WARN_VIDEO }), 400);
}

/* =============================================================== anteprime */
function fitStage(box, st) {
  new ResizeObserver(() => {
    const W = box.clientWidth, H = box.clientHeight, ar = M ? M.aspect : 16 / 9;
    let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
    st.style.width = Math.floor(w) + 'px'; st.style.height = Math.floor(h) + 'px';
  }).observe(box);
}
const slide = n => M.slides[n - 1];
const steps = n => { const s = slide(n); return s && s.anim ? s.anim.steps.length - 1 : 0; };
function nextVisible(n, dir) { let k = n + dir; while (k >= 1 && k <= N && slide(k).hidden) k += dir; return k >= 1 && k <= N ? k : 0; }

function renderPreviews() {
  const s = slide(S.n);
  curView.render(S.n, S.step);
  $('cnt').textContent = `Slide ${S.n} di ${N}`;
  const ns = steps(S.n);
  $('stepInfo').hidden = !ns; $('stepInfo').textContent = `Animazione ${S.step} di ${ns}`;
  let lbl, info = '';
  if (S.step < ns) { nxtView.render(S.n, S.step + 1); lbl = 'Prossima animazione'; $('endMsg').style.display = 'none'; $('nxtStage').style.visibility = 'visible'; }
  else {
    const k = nextVisible(S.n, 1);
    if (k) { nxtView.render(k, 0); lbl = 'Prossima: slide ' + k; const x = slide(k); info = x.tr && x.tr.type === 'morph' ? 'Morph' : (x.media.some(m => m.kind === 'video') ? 'Video' : ''); $('endMsg').style.display = 'none'; $('nxtStage').style.visibility = 'visible'; }
    else { lbl = 'Prossima'; $('endMsg').style.display = 'flex'; $('nxtStage').style.visibility = 'hidden'; }
  }
  $('nxtLbl').textContent = lbl; $('nxtInfo').hidden = !info; $('nxtInfo').textContent = info;
  const md = s.media;
  mediaIdx = Math.min(mediaIdx, Math.max(0, md.length - 1));
  const sm = $('selMedia'); sm.innerHTML = '';
  md.forEach((m, i) => { const o = document.createElement('option'); o.value = i; o.textContent = (m.kind === 'video' ? 'Video ' : 'Audio ') + (i + 1) + (m.dur > 0 ? ' (' + fmtT(m.dur) + ')' : ''); sm.appendChild(o); });
  sm.value = mediaIdx; sm.hidden = md.length < 2;
  $('mediaCtl').hidden = !md.length; $('noMedia').hidden = !!md.length;
  if (md.length) { const v = md.filter(m => m.kind === 'video').length, a = md.length - v; $('mediaInfo').hidden = false; $('mediaInfo').textContent = [v ? v + ' video' : '', a ? a + ' audio' : ''].filter(Boolean).join(' e ') + ', avvio manuale'; }
  else $('mediaInfo').hidden = true;
  buildMirror();
  $('notes').textContent = s.notes || 'Nessuna nota per questa slide.';
  $('notes').classList.toggle('empty', !s.notes);
  document.querySelectorAll('#strip .th').forEach(e => { e.removeAttribute('aria-current'); e.classList.remove('nx'); });
  const tc = $('th' + S.n);
  if (tc) { // centra la miniatura scorrendo solo la striscia (scrollIntoView sposterebbe anche la finestra)
    tc.setAttribute('aria-current', 'true');
    const st = $('strip'), a = tc.getBoundingClientRect(), b = st.getBoundingClientRect();
    st.scrollTo({ left: st.scrollLeft + (a.left - b.left) - (st.clientWidth - a.width) / 2, behavior: 'smooth' });
  }
  const kn = nextVisible(S.n, 1); if (kn && $('th' + kn)) $('th' + kn).classList.add('nx');
  updateMediaUI();
}

/* video nell'anteprima: copia muta sincronizzata con il proiettore */
let MIR = [];
function buildMirror() {
  const st = $('curStage'); st.querySelectorAll('.vbadge,.vmir').forEach(e => e.remove()); MIR = [];
  slide(S.n).media.forEach((m, i) => {
    if (m.kind !== 'video' || !m.rect) { MIR.push(null); return; }
    const place = e => { e.style.left = m.rect.x + '%'; e.style.top = m.rect.y + '%'; e.style.width = m.rect.w + '%'; e.style.height = m.rect.h + '%'; };
    let v = null;
    if (SET.videoMirror !== false && m.playable) { v = document.createElement('video'); v.className = 'vmir'; v.muted = true; v.preload = 'auto'; v.src = BASE + m.src; place(v); st.appendChild(v); }
    const b = document.createElement('div'); b.className = 'vbadge'; b.id = 'vb' + i; place(b);
    b.innerHTML = '<span>Video ' + (m.playable ? fmtT(m.dur) : 'formato non supportato') + '</span>'; st.appendChild(b);
    MIR.push(v);
  });
}
function syncMirror() {
  if (AST.n !== S.n) return;
  MIR.forEach((v, i) => {
    if (!v) return; const x = AST.media[i]; if (!x || x.dead) return;
    const show = x.started && !x.stopped;
    v.classList.toggle('on', !!show);
    if (!show) { if (!v.paused) v.pause(); return; }
    if (Math.abs(v.currentTime - x.cur) > 0.35) v.currentTime = x.cur;
    if (x.paused || x.ended) { if (!v.paused) v.pause(); } else if (v.paused) v.play().catch(() => {});
  });
}

/* =============================================================== navigazione */
let timerStarted = false;
function onEnter() { S.visitStarted = false; mediaIdx = 0; renderPreviews(); save(); if (!timerStarted) startTimer(); }
function go(n, how) {
  n = Math.max(1, Math.min(N, n));
  S.n = n; S.step = how === 'back' ? steps(n) : 0;
  send({ t: 'go', n, how });
  onEnter();
}
function videoPending() {
  if (!WARN_VIDEO) return false;
  const s = slide(S.n);
  const vids = s.media.map((m, i) => [m, i]).filter(([m]) => m.playable && m.kind === 'video');
  if (!vids.length || S.visitStarted) return false;
  if (AST.n !== S.n) return true;
  return !vids.some(([, i]) => AST.media[i] && AST.media[i].started);
}
function next(force) {
  if (isModal()) return;
  if (S.step < steps(S.n)) { S.step++; send({ t: 'step', k: S.step }); renderPreviews(); return; }
  const k = nextVisible(S.n, 1);
  if (!k) { toast('Sei all\'ultima slide'); return; }
  if (!force && videoPending()) { videoWarning(); return; }
  go(k, 'forward');
}
function prev() {
  if (isModal()) return;
  if (S.step > 0) { S.step--; send({ t: 'show', n: S.n, step: S.step }); renderPreviews(); return; }
  const k = nextVisible(S.n, -1); if (k) go(k, 'back');
}
function first() { if (S.n === 1 && S.step === 0) return; go(1, 'jump'); }
let WARN_VIDEO = true;
function videoWarning() {
  const v = slide(S.n).media.find(m => m.kind === 'video' && m.playable);
  dialogBox('Il video non è partito', `<p>Questa slide contiene un video${v && v.dur ? ' di ' + fmtT(v.dur) : ''} che non hai avviato.</p>
    <label class="switch"><input type="checkbox" class="wOff"><i></i><span>Non avvisare più in questa presentazione</span></label>`, [
    ['Resta qui', '', bg => readOff(bg), ['Escape', 'PageUp', 'ArrowLeft']],
    ['Vai avanti senza video', '', bg => { readOff(bg); setTimeout(() => next(true), 0); }, ['a', 'A']],
    [ic('play') + 'Avvia il video', 'primary', bg => { readOff(bg); mediaCmd('play'); }, ['Enter', ' ', 'PageDown', 'ArrowRight']],
  ], 'alert');
  function readOff(bg) { const c = bg.querySelector('.wOff'); if (c && c.checked) { WARN_VIDEO = false; save(); } }
}

/* =============================================================== media */
function mediaCmd(a, extra) { const s = slide(S.n); if (!s.media.length) return; if (a === 'play') S.visitStarted = true; send(Object.assign({ t: 'media', a, idx: mediaIdx }, extra || {})); }
let seeking = false;
function updateMediaUI() {
  const s = slide(S.n), md = s.media[mediaIdx];
  const st = AST.n === S.n ? AST.media[mediaIdx] : null;
  if (!md) return;
  const dur = st && st.dur ? st.dur : (md.dur || 0), cur = st ? st.cur : 0;
  const playing = st && !st.paused && !st.ended;
  setHTML($('mPlay'), ic(playing ? 'pause' : 'play')); $('mPlay').title = playing ? 'Pausa (P)' : 'Avvia (P)';
  $('mTime').textContent = fmtT(cur) + ' / ' + fmtT(dur);
  if (!seeking) $('mSeek').value = dur ? Math.round(cur / dur * 1000) : 0;
  s.media.forEach((m, i) => {
    const b = $('vb' + i); if (!b) return;
    const x = AST.n === S.n ? AST.media[i] : null, p = x && !x.paused && !x.ended;
    b.classList.toggle('play', !!p);
    b.firstChild.textContent = p ? 'In onda ' + fmtT(x.cur) + ' / ' + fmtT(x.dur) : (x && x.started && !x.stopped ? 'In pausa ' + fmtT(x.cur) : 'Video ' + (m.playable ? fmtT(m.dur) : 'formato non supportato'));
  });
  if (st && st.started) S.visitStarted = true;
  syncMirror();
}
$('mPlay').onclick = () => mediaCmd('toggle');
$('mStop').onclick = () => mediaCmd('stop');
$('mBack').onclick = () => mediaCmd('rel', { d: -10 });
$('mFwd').onclick = () => mediaCmd('rel', { d: 10 });
$('selMedia').onchange = e => { mediaIdx = +e.target.value; updateMediaUI(); };
$('mSeek').addEventListener('input', e => { seeking = true; const md = slide(S.n).media[mediaIdx], st = AST.media[mediaIdx]; const d = (st && st.dur) || (md && md.dur) || 0; mediaCmd('seek', { to: d * e.target.value / 1000 }); });
$('mSeek').addEventListener('change', () => { seeking = false; });

/* =============================================================== proiettore */
const dispName = d => d ? (d.id === AUD.presenterDisplay ? 'Schermo ' + d.n + ' (relatore)' : 'Schermo ' + d.n) : '';
function audUI() {
  const same = AUD.open && AUD.displayId === AUD.presenterDisplay;
  const d = AUD.displays.find(x => x.id === AUD.displayId);
  const ps = $('projState');
  ps.className = 'pill ' + (AUD.open ? 'live' : '');
  ps.textContent = AUD.open ? (same ? 'In onda su questo schermo' : 'In onda: ' + dispName(d)) : 'Proiettore spento';
  if (AUD.open) setBtn('bProj', 'x', 'Spegni proiettore'); else setBtn('bProj', 'monitor', 'Proietta');
  $('bProj').className = 'btn sm' + (AUD.open ? '' : ' primary');
  $('bProj').title = AUD.open ? 'Spegni il proiettore e resta sul relatore (Esc)' : 'Scegli lo schermo e avvia la proiezione (F5)';
  $('bFs').style.display = AUD.open && !same && !AUD.fullscreen ? '' : 'none';
  setBtn('bLock', AUD.locked ? 'lock' : 'unlock', AUD.locked ? 'Bloccato' : 'Blocca');
  $('bLock').className = 'btn sm' + (AUD.locked ? ' live' : '');
  $('bLock').setAttribute('aria-pressed', String(!!AUD.locked));
  $('bLock').disabled = !AUD.open;
  $('bLock').title = AUD.open ? 'Lucchetto: blocca qualsiasi azione sullo schermo del proiettore (Ctrl+L)' : 'Disponibile quando il proiettore è acceso';
}
DP.on('aud-state', s => { const was = AUD.open; Object.assign(AUD, s); audUI(); if (was && !AUD.open) toast('Proiettore spento. Premi "Proietta" o F5 per riaccenderlo.', '', 4000); });
/* Scelta dello schermo: mai automatica, sempre confermata dal relatore. */
function chooseDisplay() {
  if (isModal()) return;
  const L = AUD.displays; if (!L.length) return;
  const others = L.filter(d => d.id !== AUD.presenterDisplay);
  let sel = ST.displayId != null && L.some(d => d.id === ST.displayId) ? ST.displayId : (others[0] || L[0]).id;
  const minX = Math.min(...L.map(d => d.x)), minY = Math.min(...L.map(d => d.y));
  const maxX = Math.max(...L.map(d => d.x + d.bw)), maxY = Math.max(...L.map(d => d.y + d.bh));
  const sc = Math.min(460 / (maxX - minX), 170 / (maxY - minY));
  const cards = L.map(d => `<button type="button" class="dcard" data-id="${d.id}" style="left:${Math.round((d.x - minX) * sc)}px;top:${Math.round((d.y - minY) * sc)}px;width:${Math.round(d.bw * sc) - 6}px;height:${Math.round(d.bh * sc) - 6}px">
      <b class="num">${d.n}</b><span>${d.id === AUD.presenterDisplay ? 'Relatore' : d.w + ' x ' + d.h}</span></button>`).join('');
  const html = `<p>Il numero grande compare su ogni schermo: scegli quello del proiettore.</p>
    <div class="dmap" style="width:${Math.round((maxX - minX) * sc)}px;height:${Math.round((maxY - minY) * sc)}px">${cards}</div>
    <p class="dnote" id="dNote"></p>`;
  DP.invoke('aud:identify', true);
  const label = () => { const d = L.find(x => x.id === sel); return 'Proietta su schermo ' + (d ? d.n : ''); };
  const close = dialogBox('Su quale schermo proiettare?', html, [
    ['Annulla', '', null, ['Escape']],
    [label(), 'primary', () => openOn(sel), ['Enter']]
  ], 'monitor');
  const bg = [...document.querySelectorAll('.dlg-bg')].pop();
  const ok = bg.querySelector('.row .primary');
  const paint = () => {
    bg.querySelectorAll('.dcard').forEach(c => { const on = +c.dataset.id === sel; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); });
    ok.textContent = label();
    $('dNote').textContent = sel === AUD.presenterDisplay ? 'È lo schermo del relatore: la proiezione lo copre, premi Esc per tornare qui.' : (others.length ? '' : 'Un solo schermo collegato.');
  };
  bg.querySelectorAll('.dcard').forEach(c => { c.onclick = () => { sel = +c.dataset.id; paint(); }; c.ondblclick = () => { sel = +c.dataset.id; ok.click(); }; });
  const dk = e => { const d = L.find(x => String(x.n) === e.key); if (d) { e.preventDefault(); sel = d.id; paint(); } };
  window.addEventListener('keydown', dk, true);
  new MutationObserver((m, o) => { if (!bg.isConnected) { o.disconnect(); window.removeEventListener('keydown', dk, true); DP.invoke('aud:identify', false); } }).observe(document.body, { childList: true });
  paint(); ok.focus();
  return close;
}
function openOn(id) {
  DP.invoke('aud:identify', false);
  AUD.displayId = id; ST.displayId = id; save();
  DP.invoke('aud:show', id).then(() => {
    if (SET.lockOnOpen) DP.invoke('aud:lock', true);
    if (id === AUD.presenterDisplay) toast('Proiezione su questo schermo: premi Esc per tornare al relatore.', '', 5000);
  });
}
function projToggle() { if (AUD.open) DP.invoke('aud:hide'); else chooseDisplay(); }
$('bProj').onclick = projToggle;
$('bFs').onclick = () => DP.invoke('aud:fullscreen');
$('bLock').onclick = () => DP.invoke('aud:lock', !AUD.locked).then(v => toast(v ? 'Proiettore bloccato: nessuna azione possibile sul suo schermo' : 'Proiettore sbloccato', v ? 'ok' : ''));
function setCover(c) {
  S.cover = S.cover === c ? null : c; send({ t: 'cover', c: S.cover });
  for (const [id, k] of [['bBlack', 'black'], ['bWhite', 'white']]) { $(id).classList.toggle('live', S.cover === k); $(id).setAttribute('aria-pressed', String(S.cover === k)); }
  $('coverInfo').hidden = !S.cover; $('coverInfo').textContent = S.cover === 'white' ? 'Il pubblico vede uno schermo bianco' : 'Il pubblico vede uno schermo nero';
}
$('bBlack').onclick = () => setCover('black');
$('bWhite').onclick = () => setCover('white');
function togglePtr() { S.ptr = !S.ptr; $('bPtr').classList.toggle('on', S.ptr); $('bPtr').setAttribute('aria-pressed', String(S.ptr)); $('curBox').classList.toggle('ptr', S.ptr); if (!S.ptr) { send({ t: 'ptr', on: false }); $('ptrLocal').style.display = 'none'; } }
$('bPtr').onclick = togglePtr;
let ptrT = 0;
$('curBox').addEventListener('mousemove', e => {
  if (!S.ptr) return; const r = $('curStage').getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
  const d = $('ptrLocal'), b = $('curBox').getBoundingClientRect();
  d.style.display = inside ? 'block' : 'none'; d.style.left = (e.clientX - b.left) + 'px'; d.style.top = (e.clientY - b.top) + 'px';
  const now = performance.now(); if (now - ptrT > 25) { ptrT = now; send({ t: 'ptr', on: inside, x, y }); }
});
$('curBox').addEventListener('mouseleave', () => { if (S.ptr) { send({ t: 'ptr', on: false }); $('ptrLocal').style.display = 'none'; } });

/* =============================================================== orologio */
let tAcc = 0, tStart = 0, tRun = false;
function startTimer() { if (tRun) return; tRun = true; timerStarted = true; tStart = Date.now(); setBtn('bTmr', 'pause'); $('tmr').classList.add('run'); }
function pauseTimer() { if (!tRun) return; tAcc += Date.now() - tStart; tRun = false; setBtn('bTmr', 'play'); $('tmr').classList.remove('run'); }
$('bTmr').onclick = () => tRun ? pauseTimer() : startTimer();
$('bTmr0').onclick = () => { tAcc = 0; tStart = Date.now(); if (tRun) pauseTimer(); timerStarted = false; $('tmr').textContent = '00:00'; };
setInterval(() => {
  $('tmr').textContent = fmtT((tAcc + (tRun ? Date.now() - tStart : 0)) / 1000);
  const d = new Date(); $('wall').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}, 250);

/* =============================================================== mixer */
const SEG = [[0, -60], [.25, -30], [.5, -12], [.75, 0], [1, 12]];
const posToDb = p => { if (p <= 0.004) return -60; for (let i = 1; i < SEG.length; i++) if (p <= SEG[i][0]) { const [p0, d0] = SEG[i - 1], [p1, d1] = SEG[i]; return d0 + (d1 - d0) * (p - p0) / (p1 - p0); } return 12; };
const dbToPos = db => { if (db <= -60) return 0; for (let i = 1; i < SEG.length; i++) if (db <= SEG[i][1]) { const [p0, d0] = SEG[i - 1], [p1, d1] = SEG[i]; return p0 + (p1 - p0) * (db - d0) / (d1 - d0); } return 1; };
const fmtDb = db => db <= -60 ? 'Muto' : (db > 0 ? '+' : '') + db.toFixed(1).replace('.', ',') + ' dB';

class Fader {
  constructor(host, o) {
    this.o = o; this.v = o.value;
    const el = this.el = document.createElement('div'); el.className = 'fader' + (o.eq ? ' eq' : '');
    el.tabIndex = 0; el.setAttribute('role', 'slider'); el.setAttribute('aria-label', o.label || 'Livello');
    el.innerHTML = '<div class="trk"></div><div class="fill"></div><div class="th"></div>';
    (o.ticks || []).forEach(([v, t]) => { const k = document.createElement('div'); k.className = 'tk' + (v === o.def ? ' z' : ''); k.textContent = t; k.dataset.v = v; el.appendChild(k); });
    host.appendChild(el);
    const at = ev => { const r = el.getBoundingClientRect(); const p = 1 - (ev.clientY - r.top - 8) / (r.height - 16); return o.fromPos(Math.max(0, Math.min(1, p))); };
    el.addEventListener('pointerdown', ev => { el.setPointerCapture(ev.pointerId); this.drag = true; this.set(at(ev), true); });
    el.addEventListener('pointermove', ev => { if (this.drag) this.set(at(ev), true); });
    el.addEventListener('pointerup', () => { this.drag = false; });
    el.addEventListener('dblclick', () => this.set(o.def, true));
    el.addEventListener('wheel', ev => { ev.preventDefault(); this.nudge(-Math.sign(ev.deltaY)); }, { passive: false });
    el.addEventListener('keydown', ev => { if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') { this.nudge(1); ev.preventDefault(); ev.stopPropagation(); } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') { this.nudge(-1); ev.preventDefault(); ev.stopPropagation(); } });
    new ResizeObserver(() => this.layout()).observe(el);
  }
  nudge(d) { this.set(this.o.fromPos(Math.max(0, Math.min(1, this.o.toPos(this.v) + d * .012))), true); }
  layout() {
    const h = this.el.clientHeight - 16; if (h <= 0) return;
    const p = this.o.toPos(this.v), y = 8 + (1 - p) * h;
    this.el.querySelector('.th').style.top = y + 'px';
    const f = this.el.querySelector('.fill');
    if (this.o.eq) { const y0 = 8 + h / 2; f.style.top = Math.min(y, y0) + 'px'; f.style.bottom = 'auto'; f.style.height = Math.abs(y - y0) + 'px'; }
    else f.style.height = (p * h) + 'px';
    this.el.querySelectorAll('.tk').forEach(k => { k.style.top = (8 + (1 - this.o.toPos(+k.dataset.v)) * h) + 'px'; });
    this.el.setAttribute('aria-valuetext', this.o.eq ? this.v + ' dB' : fmtDb(this.v));
  }
  set(v, user) { this.v = v; this.layout(); if (user && this.o.onChange) this.o.onChange(v); }
}

let MIX = { pres: { db: 0, mute: false }, mus: { db: -8, mute: false }, mas: { db: 0, mute: false }, eqP: { on: true, bands: EQ_BANDS.map(() => 0) }, eqM: { on: true, bands: EQ_BANDS.map(() => 0) }, duck: { on: true, db: -18 } };
let EQNAME = { eqP: 'Piatta', eqM: 'Piatta' }, EQSEL = 'eqP';
const pushMix = () => { send({ t: 'mix', mix: MIX }); save(); };
const CH = [['pres', 'Slide'], ['mus', 'Musica'], ['mas', 'Master']];
const FAD = {}, METER = {};
let EQF = [];
function buildMixer() {
  for (const [k, name] of CH) {
    const s = document.createElement('div'); s.className = 'strip ' + k;
    s.innerHTML = `<div class="nm">${name}</div><div class="body"><canvas width="22" height="220" aria-hidden="true"></canvas></div><div class="db num"></div><button class="btn xs mute" aria-pressed="${MIX[k].mute}" title="Silenzia ${name.toLowerCase()}">${ic('mute')}Muto</button>`;
    $('strips').appendChild(s);
    METER[k] = { cv: s.querySelector('canvas'), disp: [-90, -90], pk: [-90, -90], pkT: [0, 0] };
    const db = s.querySelector('.db');
    const show = () => { db.textContent = fmtDb(MIX[k].db); db.classList.toggle('hot', MIX[k].db > 0); };
    FAD[k] = new Fader(s.querySelector('.body'), {
      label: 'Volume ' + name, value: MIX[k].db, def: 0, toPos: dbToPos, fromPos: posToDb,
      ticks: [[12, '+12'], [6, '+6'], [0, '0'], [-6, '-6'], [-12, '-12'], [-20, '-20'], [-30, '-30'], [-45, '-45']],
      onChange: v => { MIX[k].db = Math.round(v * 10) / 10; show(); pushMix(); },
    });
    show();
    const mb = s.querySelector('.mute');
    mb.onclick = () => { MIX[k].mute = !MIX[k].mute; mb.setAttribute('aria-pressed', String(MIX[k].mute)); pushMix(); };
  }
  const ps = $('eqPreset');
  ps.innerHTML = EQ_PRESETS.map(([n]) => `<option>${esc(n)}</option>`).join('') + '<option>Personalizzato</option>';
  $('eqLab').innerHTML = EQ_LABELS.map(l => `<span>${l}</span>`).join('');
  EQF = EQ_BANDS.map((f, i) => {
    const cell = document.createElement('div'); cell.style.position = 'relative'; $('eqSl').appendChild(cell);
    return new Fader(cell, { eq: true, label: 'Banda ' + EQ_LABELS[i] + ' Hz', value: 0, def: 0, toPos: v => (v + 12) / 24, fromPos: p => Math.round((p * 24 - 12) * 2) / 2,
      onChange: v => { MIX[EQSEL].bands[i] = v; EQNAME[EQSEL] = matchPreset(MIX[EQSEL].bands); ps.value = EQNAME[EQSEL]; pushMix(); drawEq(); } });
  });
  $('eqSeg').querySelectorAll('button').forEach(b => b.onclick = () => { EQSEL = b.dataset.eq; $('eqSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))); eqUI(); });
  ps.onchange = () => { const p = EQ_PRESETS.find(x => x[0] === ps.value); if (p) { MIX[EQSEL].bands = p[1].slice(); EQNAME[EQSEL] = p[0]; MIX[EQSEL].on = true; eqUI(); pushMix(); } };
  $('eqOn').onchange = e => { MIX[EQSEL].on = e.target.checked; pushMix(); drawEq(); };
  $('eqReset').onclick = () => { MIX[EQSEL].bands = EQ_BANDS.map(() => 0); EQNAME[EQSEL] = 'Piatta'; eqUI(); pushMix(); };
  $('duckOn').checked = MIX.duck.on; $('duckDb').value = String(MIX.duck.db);
  $('duckOn').onchange = e => { MIX.duck.on = e.target.checked; pushMix(); };
  $('duckDb').onchange = e => { MIX.duck.db = +e.target.value; pushMix(); };
  eqUI();
}
function matchPreset(b) { const p = EQ_PRESETS.find(x => x[1].every((v, i) => v === b[i])); return p ? p[0] : 'Personalizzato'; }
function eqUI() { const e = MIX[EQSEL]; EQF.forEach((f, i) => f.set(e.bands[i])); $('eqPreset').value = EQNAME[EQSEL] || matchPreset(e.bands); $('eqOn').checked = e.on; drawEq(); }
const OAC = new OfflineAudioContext(1, 128, 48000);
const RESP_N = 160, RESP_F = new Float32Array(RESP_N).map((_, i) => 20 * Math.pow(1000, i / (RESP_N - 1)));
const BQ = EQ_BANDS.map((f, i) => { const b = OAC.createBiquadFilter(); b.type = i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking'; b.frequency.value = f; b.Q.value = 1.3; return b; });
const RESP = new Float32Array(RESP_N);
function drawEq() {
  const e = MIX[EQSEL]; RESP.fill(0);
  const mag = new Float32Array(RESP_N), ph = new Float32Array(RESP_N);
  if (e.on) BQ.forEach((b, i) => { b.gain.value = e.bands[i]; b.getFrequencyResponse(RESP_F, mag, ph); for (let k = 0; k < RESP_N; k++) RESP[k] += 20 * Math.log10(mag[k]); });
}
let SP = { p: new Array(40).fill(0), m: new Array(40).fill(0) }; const SPD = { p: new Array(40).fill(0), m: new Array(40).fill(0) };
function paintEq(dt) {
  const cv = $('eqCv'), r = cv.getBoundingClientRect(); if (!r.width) return;
  const dpr = devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const key = EQSEL === 'eqP' ? 'p' : 'm', src = SP[key], d = SPD[key];
  for (let i = 0; i < d.length; i++) d[i] = src[i] > d[i] ? src[i] : Math.max(src[i], d[i] - 260 * dt);
  c.fillStyle = 'oklch(0.80 0.1 195 / 0.30)'; const bw = W / d.length;
  for (let i = 0; i < d.length; i++) { const h = d[i] / 255 * H * .95; c.fillRect(i * bw + 1, H - h, bw - 2, h); }
  c.strokeStyle = 'oklch(1 0 0 / 0.07)'; c.lineWidth = 1;
  for (const db of [-12, -6, 0, 6, 12]) { const y = H / 2 - db / 15 * H / 2; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.strokeStyle = MIX[EQSEL].on ? 'oklch(0.86 0.10 85)' : 'oklch(0.86 0.10 85 / 0.35)'; c.lineWidth = 2 * dpr; c.beginPath();
  for (let k = 0; k < RESP_N; k++) { const x = k / (RESP_N - 1) * W, y = H / 2 - Math.max(-15, Math.min(15, RESP[k])) / 15 * H / 2; k ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
}
const LV = { pres: [-90, -90], mus: [-90, -90], mas: [-90, -90] };
const NSEG = 30, DBMIN = -48, DBMAX = 6;
function paintMeter(k, dt) {
  const m = METER[k], cv = m.cv, r = cv.getBoundingClientRect(); if (!r.height) return;
  if (cv.height !== Math.round(r.height)) cv.height = Math.round(r.height);
  const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const gap = 2, sh = (H - (NSEG + 1) * gap) / NSEG, cw = (W - 3 * gap) / 2, now = performance.now();
  for (let ch = 0; ch < 2; ch++) {
    const v = LV[k][ch];
    m.disp[ch] = v > m.disp[ch] ? v : Math.max(v, m.disp[ch] - 40 * dt);
    if (v >= m.pk[ch]) { m.pk[ch] = v; m.pkT[ch] = now; } else if (now - m.pkT[ch] > 1200) m.pk[ch] = Math.max(-90, m.pk[ch] - 20 * dt);
    const x = gap + ch * (cw + gap), lit = Math.round((m.disp[ch] - DBMIN) / (DBMAX - DBMIN) * NSEG), pi = Math.round((m.pk[ch] - DBMIN) / (DBMAX - DBMIN) * NSEG) - 1;
    for (let i = 0; i < NSEG; i++) {
      const db = DBMIN + (i + 1) / NSEG * (DBMAX - DBMIN);
      const col = db > -3 ? '229,72,77' : db > -12 ? '245,196,50' : '54,201,142';
      c.fillStyle = `rgba(${col},${i < lit || i === pi ? 1 : .13})`;
      c.fillRect(x, H - gap - (i + 1) * (sh + gap) + gap, cw, sh);
    }
  }
}
let lastF = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - lastF) / 1000); lastF = now;
  if (!$('tab-audio').hidden) { for (const [k] of CH) paintMeter(k, dt); paintEq(dt); }
  requestAnimationFrame(frame);
}

/* =============================================================== musica */
let QUEUE = [], EXCL = new Set(), MANUAL = new Set(), SRC = { deck: true, global: true, default: null };
let MO = { xf: 4, shuffle: false, repeat: 'all' }, MST = { idx: -1, id: null, playing: false, cur: 0, dur: 0 };
let TR = new Map(), mlib = null, mlibData = null;
const SRC_LABEL = { deck: 'Presentazione', global: 'Globale', default: 'Predefinita' };
function rebuildQueue(fromLib) {
  if (fromLib) { TR = new Map(); for (const t of mlib.allTracks()) TR.set(t.id, t); }
  if (SRC.default == null) SRC.default = !mlibData.deck.length && !mlibData.global.length;
  const ok = id => { const t = TR.get(id); return t && (srcOk(t) || MANUAL.has(id)); };
  const q = QUEUE.filter(ok);
  for (const [id, t] of TR) if (!q.includes(id) && !EXCL.has(id) && srcOk(t)) q.push(id);
  QUEUE = q; sendQueue(); renderQueue(); save();
}
// sorgente attiva; per la musica predefinita solo i generi scelti (null = tutti)
const srcOk = t => !!SRC[t.src] && (t.src !== 'default' || !SRC.genres || SRC.genres.includes(t.cat));
function sendQueue() { send({ t: 'mus', a: 'queue', queue: QUEUE.map(id => TR.get(id)).filter(Boolean).map(x => ({ id: x.id, url: x.url, name: x.name })) }); }
const inQueue = id => QUEUE.includes(id);
function toggleQueue(t) {
  if (inQueue(t.id)) { QUEUE = QUEUE.filter(x => x !== t.id); EXCL.add(t.id); MANUAL.delete(t.id); }
  else { EXCL.delete(t.id); if (!srcOk(t)) MANUAL.add(t.id); QUEUE.push(t.id); }
  sendQueue(); renderQueue(); save();
}
let dragId = null;
function renderQueue() {
  const q = $('queue'); q.innerHTML = '';
  QUEUE.forEach((id, i) => {
    const t = TR.get(id); if (!t) return;
    const r = document.createElement('div'); r.className = 'qi'; r.draggable = true; r.dataset.id = id;
    r.innerHTML = `<span class="gr" title="Trascina per riordinare">${ic('grip')}</span><span class="no num">${i + 1}</span><span class="eqa"><i></i><i></i><i></i></span><span class="nm" title="${esc(t.name)}">${esc(t.name)}</span><span class="src">${SRC_LABEL[t.src]}${t.cat ? ', ' + esc(t.cat) : ''}</span><span class="du num"></span>
      <button class="btn xs icon quiet" data-a="play" title="Riproduci ora">${ic('play')}</button><button class="btn xs icon quiet" data-a="rm" title="Togli dalla coda">${ic('x')}</button>`;
    trackDuration(t, d => { const e = r.querySelector('.du'); if (e) e.textContent = d > 0 ? fmtT(d) : ''; });
    r.querySelector('[data-a=rm]').onclick = () => toggleQueue(t);
    r.querySelector('[data-a=play]').onclick = () => send({ t: 'mus', a: 'play', idx: QUEUE.indexOf(id) });
    r.ondblclick = () => send({ t: 'mus', a: 'play', idx: QUEUE.indexOf(id) });
    r.addEventListener('dragstart', e => { dragId = id; r.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); });
    r.addEventListener('dragend', () => { dragId = null; r.classList.remove('drag'); q.classList.remove('over'); });
    q.appendChild(r);
  });
  if (!QUEUE.length) q.innerHTML = `<div class="qempty">La coda è vuota. Apri "Brani" per aggiungere musica o attivare le raccolte.</div>`;
  const tot = QUEUE.reduce((a, id) => { const t = TR.get(id); const d = t && window.__durCache.get(t.url); return a + (d > 0 ? d : 0); }, 0);
  $('qCount').textContent = `${QUEUE.length} ${QUEUE.length === 1 ? 'brano' : 'brani'}${tot ? ', ' + fmtT(tot) : ''}`;
  markCur();
}
function markCur() { document.querySelectorAll('#queue .qi').forEach(r => { const c = r.dataset.id === MST.id; r.classList.toggle('cur', c); r.classList.toggle('play', c && MST.playing); }); }
const qEl = $('queue');
qEl.addEventListener('dragover', e => { if (!dragId) return; e.preventDefault(); qEl.classList.add('over'); });
qEl.addEventListener('dragleave', () => qEl.classList.remove('over'));
qEl.addEventListener('drop', e => {
  e.preventDefault(); qEl.classList.remove('over'); if (!dragId) return;
  const without = QUEUE.filter(x => x !== dragId);
  const rows = [...qEl.querySelectorAll('.qi:not(.drag)')];
  let k = rows.length; for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { k = i; break; } }
  const before = rows[k] && rows[k].dataset.id; const at = before ? without.indexOf(before) : without.length;
  without.splice(at < 0 ? without.length : at, 0, dragId); QUEUE = without; sendQueue(); renderQueue(); save();
});
function musUI() {
  setBtn('muPlay', MST.playing ? 'pause' : 'play');
  const x = MST.id ? TR.get(MST.id) : null;
  $('npName').textContent = x ? x.name : (QUEUE.length ? 'Pronto: ' + (TR.get(QUEUE[0]) || {}).name : 'Nessun brano in coda');
  $('npTime').textContent = (MST.held ? 'In pausa durante il video · ' : '') + fmtT(MST.cur) + ' / ' + fmtT(MST.dur);
  $('npProg').style.width = (MST.dur ? Math.min(100, MST.cur / MST.dur * 100) : 0) + '%';
  markCur();
}
function moUI() {
  $('muXf').value = MO.xf; $('muXfV').textContent = Number(MO.xf).toFixed(1).replace('.', ',') + ' s';
  $('muShuf').classList.toggle('on', MO.shuffle); $('muShuf').setAttribute('aria-pressed', String(MO.shuffle));
  setBtn('muRep', 'repeat', { all: 'Ripeti tutto', one: 'Ripeti brano', off: 'Non ripetere' }[MO.repeat]);
  $('muRep').classList.toggle('on', MO.repeat !== 'off');
}
const pushMo = () => { send({ t: 'mus', a: 'opts', opts: MO }); moUI(); save(); };
$('muPlay').onclick = () => { if (!QUEUE.length && !MST.id) { toast('La coda è vuota: aggiungi brani da "Brani".', 'warn'); return; } send({ t: 'mus', a: 'toggle' }); };
$('muNext').onclick = () => send({ t: 'mus', a: 'next' });
$('muPrev').onclick = () => send({ t: 'mus', a: 'prev' });
$('muStop').onclick = () => send({ t: 'mus', a: 'stop', fade: Math.max(1.5, MO.xf) });
$('muShuf').onclick = () => { MO.shuffle = !MO.shuffle; pushMo(); };
$('muRep').onclick = () => { MO.repeat = { all: 'one', one: 'off', off: 'all' }[MO.repeat]; pushMo(); };
$('muXf').oninput = e => { MO.xf = +e.target.value; pushMo(); };
const seekMus = e => { if (!MST.dur) return; const r = $('npBar').getBoundingClientRect(); send({ t: 'mus', a: 'seek', to: (e.clientX - r.left) / r.width * MST.dur }); };
$('npBar').onclick = seekMus;
$('npBar').onkeydown = e => { if (!MST.dur) return; if (e.key === 'ArrowRight') send({ t: 'mus', a: 'seek', to: MST.cur + 10 }); if (e.key === 'ArrowLeft') send({ t: 'mus', a: 'seek', to: MST.cur - 10 }); };
$('qAz').onclick = () => { QUEUE.sort((a, b) => TR.get(a).name.localeCompare(TR.get(b).name, 'it', { numeric: true })); sendQueue(); renderQueue(); save(); };
$('qMix').onclick = () => { for (let i = QUEUE.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [QUEUE[i], QUEUE[j]] = [QUEUE[j], QUEUE[i]]; } sendQueue(); renderQueue(); save(); };
$('muSeg').querySelectorAll('button').forEach(b => b.onclick = () => {
  $('muSeg').querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  $('mv-queue').hidden = b.dataset.mv !== 'queue'; $('mv-lib').hidden = b.dataset.mv !== 'lib';
  if (b.dataset.mv === 'lib') mlib.render(); else renderQueue();
});
DP.on('music:changed', () => mlib && mlib.load());

/* =============================================================== note */
let NFS = 20;
const setNfs = v => { NFS = Math.max(14, Math.min(44, v)); document.documentElement.style.setProperty('--nfs', NFS + 'px'); save(); };
$('nPlus').onclick = () => setNfs(NFS + 2); $('nMinus').onclick = () => setNfs(NFS - 2);

/* =============================================================== schede */
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
  ['audio', 'music', 'notes'].forEach(k => $('tab-' + k).hidden = k !== t.dataset.tab);
});

/* =============================================================== striscia */
function buildStrip() {
  const st = $('strip');
  M.slides.forEach(s => {
    const d = document.createElement('button'); d.className = 'th' + (s.hidden ? ' hid' : ''); d.id = 'th' + s.n;
    d.style.backgroundImage = `url('${BASE + s.thumb}')`;
    const b = [];
    if (s.media.some(m => m.kind === 'video')) b.push(`<span title="Video">${ic('film')}</span>`);
    if (s.media.some(m => m.kind === 'audio')) b.push(`<span title="Audio">${ic('vol')}</span>`);
    if (s.tr && s.tr.type === 'morph') b.push(`<span class="g" title="Morph">${ic('morph')}</span>`);
    if (s.anim) b.push(`<span class="g" title="Animazioni">${ic('spark')}${s.anim.steps.length - 1}</span>`);
    d.innerHTML = `<span class="n">${s.n}${s.hidden ? ' nascosta' : ''}</span><span class="bd">${b.join('')}</span>`;
    d.title = 'Vai alla slide ' + s.n + (s.title ? ': ' + s.title : '');
    d.onclick = () => go(s.n, 'jump');
    st.appendChild(d);
  });
  st.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { st.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
}

/* =============================================================== tastiera */
let buf = '', bufT = null;
function showBuf() { const g = $('goto'); g.style.display = buf ? 'block' : 'none'; g.textContent = buf ? 'Slide ' + buf : ''; clearTimeout(bufT); bufT = setTimeout(() => { buf = ''; showBuf(); }, 3000); }
function onKey(k, shift, ctrl) {
  if (ctrl && (k === 'l' || k === 'L')) { if (AUD.open) $('bLock').click(); return true; }
  if (ctrl) return false;
  if (/^[0-9]$/.test(k)) { buf = (buf + k).slice(0, 3); showBuf(); return true; }
  if (k === 'Enter' && buf) { const n = parseInt(buf, 10); buf = ''; showBuf(); if (n >= 1 && n <= N) go(n, 'jump'); return true; }
  if (k === 'Escape') { if (buf) { buf = ''; showBuf(); } else if (AUD.open) DP.invoke('aud:hide'); return true; }
  switch (k) {
    case ' ': case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'Enter': next(); break;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
    case 'Home': first(); break;
    case 'End': go(N, 'jump'); break;
    case 'p': case 'P': case 'k': case 'K': mediaCmd('toggle'); break;
    case 's': case 'S': mediaCmd('stop'); break;
    case 'j': case 'J': mediaCmd('rel', { d: -10 }); break;
    case 'l': case 'L': mediaCmd('rel', { d: 10 }); break;
    case 'b': case 'B': case '.': setCover('black'); break;
    case 'w': case 'W': case ',': setCover('white'); break;
    case 'z': case 'Z': togglePtr(); break;
    case 'm': case 'M': $('muPlay').click(); break;
    case 'n': case 'N': send({ t: 'mus', a: 'next' }); break;
    case '+': case '=': FAD.mas.set(Math.min(12, MIX.mas.db + 1), true); break;
    case '-': case '_': FAD.mas.set(Math.max(-60, MIX.mas.db - 1), true); break;
    case 'F1': help(); break;
    case 'F5': if (!AUD.open) chooseDisplay(); break;
    default: return false;
  }
  return true;
}
document.addEventListener('keydown', e => {
  if (isModal()) return;
  const t = e.target;
  if (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox') || (t.classList && t.classList.contains('fader'))) return;
  if (t.tagName === 'INPUT' && t.type === 'range' && /Arrow/.test(e.key)) t.blur();
  if (t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) { t.blur(); }
  if (onKey(e.key, e.shiftKey, e.ctrlKey || e.metaKey)) e.preventDefault();
});
DP.on('key', k => { if (!isModal()) onKey(k.key, k.shift, k.ctrl); });
document.addEventListener('mouseup', e => { const b = e.target.closest('button'); if (b) b.blur(); });
function help() {
  const R = [['Avanti', 'Spazio, Freccia destra, PagGiù, Invio'], ['Indietro', 'Freccia sinistra, PagSù, Backspace'], ['Inizio, fine', 'Home, Fine'], ['Vai alla slide', 'Numero, poi Invio'],
    ['Video: avvia o pausa, stop', 'P, S'], ['Video: indietro o avanti di 10 s', 'J, L'], ['Schermo nero, bianco', 'B, W'], ['Puntatore laser', 'Z'],
    ['Musica: avvia o pausa, successivo', 'M, N'], ['Volume master', '+, -'], ['Accendi il proiettore', 'F5'], ['Spegni il proiettore', 'Esc'], ['Lucchetto del proiettore', 'Ctrl+L']];
  dialogBox('Scorciatoie da tastiera', `<div class="help"><table>${R.map(r => `<tr><td>${r[0]}</td><td>${r[1].split(', ').map(x => '<kbd>' + esc(x) + '</kbd>').join(' ')}</td></tr>`).join('')}</table></div>`, [['Chiudi', 'primary', null, ['Escape', 'Enter', 'F1']]], 'help');
}
$('bHelp').onclick = help;
$('bList').onclick = () => dialogBox('Tornare alla libreria?', '<p>La presentazione e il proiettore vengono chiusi.</p>', [['Annulla', '', null, ['Escape']], ['Torna alla libreria', 'primary', () => DP.invoke('app:back'), ['Enter']]], 'library');
$('bQuit').onclick = () => DP.invoke('app:quit');
$('bNext').onclick = () => next(); $('bPrev').onclick = prev; $('bFirst').onclick = first;

/* =============================================================== messaggi */
DP.on('msg', m => {
  if (m.t === 'hello') syncAudience();
  else if (m.t === 'mediaerr') toast('Il video non si avvia (' + m.code + '). Formato non supportato o file danneggiato.', 'bad', 7000);
  else if (m.t === 'st') {
    AST = m;
    if (m.lv) { LV.pres = m.lv.pres; LV.mus = m.lv.mus; LV.mas = m.lv.mas; }
    if (m.sp) SP = m.sp;
    if (m.mus) { MST = m.mus; musUI(); }
    updateMediaUI();
  }
});
function syncAudience() {
  send({ t: 'sync', n: S.n, step: S.step, cover: S.cover });
  send({ t: 'mix', mix: MIX });
  sendQueue(); send({ t: 'mus', a: 'opts', opts: MO });
}

/* =============================================================== avvio */
(async () => {
  const info = await DP.invoke('deck:info');
  M = info.manifest; BASE = info.base; N = M.slides.length; ST = info.state || {}; SET = info.settings || {}; DECK = info.id;
  document.title = 'InRegia - ' + M.name; $('deckName').textContent = M.name;
  if (ST.mix) MIX = Object.assign(MIX, ST.mix);
  if (ST.eqName) EQNAME = ST.eqName;
  if (ST.queue) QUEUE = ST.queue; if (ST.excluded) EXCL = new Set(ST.excluded); if (ST.manual) MANUAL = new Set(ST.manual);
  if (ST.sources) SRC = Object.assign(SRC, ST.sources);
  if (ST.xf != null) MO.xf = ST.xf; if (ST.shuffle != null) MO.shuffle = ST.shuffle; if (ST.repeat) MO.repeat = ST.repeat;
  if (ST.nfs) setNfs(ST.nfs); if (ST.warnVideo === false) WARN_VIDEO = false;
  if (ST.displayId != null) AUD.displayId = ST.displayId;
  curView = new DeckView($('curStage'), M, BASE); nxtView = new DeckView($('nxtStage'), M, BASE);
  fitStage($('curBox'), $('curStage')); fitStage($('nxtBox'), $('nxtStage'));
  buildStrip(); buildMixer(); moUI(); audUI();
  mlib = new MusicLibrary($('mv-lib'), {
    deckId: DECK, deckName: M.name, mode: 'presenter', inQueue, toggleQueue,
    sourceOn: k => !!SRC[k], setSource: (k, on) => { SRC[k] = on; rebuildQueue(false); mlib.render(); toast(on ? `Brani "${SRC_LABEL[k]}" aggiunti alla coda` : `Brani "${SRC_LABEL[k]}" tolti dalla coda`, 'ok', 2200); },
    genres: () => SRC.genres || null,
    setGenres: g => { SRC.genres = g; if (SRC.default) rebuildQueue(false); else save(); },
    onChange: d => { mlibData = d; rebuildQueue(true); },
  });
  S.n = 1; S.step = 0;
  renderPreviews();
  send({ t: 'go', n: 1, how: 'jump' });
  syncAudience();
  await mlib.load();
  DP.invoke('aud:state');
  requestAnimationFrame(frame);
  if (ST.n > 1 && ST.n <= N) dialogBox('Riprendere la presentazione?', `<p>L'ultima volta eri alla slide ${ST.n}.</p>`, [['Dall\'inizio', '', null, ['Escape', 'Home']], [`Riprendi dalla slide ${ST.n}`, 'primary', () => go(ST.n, 'jump'), ['Enter']]], 'play');
  if (M.warnings && M.warnings.length) toast(M.warnings.map(T).join(' | '), 'warn', 7000);
})();

/* La finestra del relatore resta sempre ferma: se qualcosa (focus, browser) la fa scorrere, torna a posto. */
addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); }, { passive: true });
document.addEventListener('focusin', () => { const se = document.scrollingElement; if (se && (se.scrollTop || se.scrollLeft)) { se.scrollTop = 0; se.scrollLeft = 0; } });
