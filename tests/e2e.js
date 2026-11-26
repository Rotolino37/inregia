'use strict';
/*
 * InRegia - test end-to-end (Linux e Windows)
 *   node tests/e2e.js                 usa Electron di sviluppo (app/)
 *   INREGIA_EXE=path\InRegia.exe ...  usa l'app installata
 * Variabili: INREGIA_SHOTS=1 salva screenshot in test-output/ (solo uso interno, mai in CI).
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const APP = path.join(__dirname, '..', 'app');
const { _electron } = require(path.join(APP, 'node_modules', 'playwright-core'));
const FIX = path.join(__dirname, 'fixtures');
const OUT = path.join(__dirname, '..', 'test-output');
const SHOTS = process.env.INREGIA_SHOTS === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const R = { ok: true, checks: [], metrics: {}, errors: [] };
function check(name, cond, info) { R.checks.push({ name, ok: !!cond, info: info === undefined ? null : info }); if (!cond) R.ok = false; console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); }
async function until(fn, ms, step) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step || 200); } }
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(OUT, name + '.png') }); }

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inregia-e2e-'));
  const data = path.join(tmp, 'data');
  // Feed di aggiornamento finto: una stabile vecchia, una stabile nuova, una beta più nuova (canale predefinito: stabile).
  const feed = path.join(tmp, 'feed.json');
  const rel = (tag, pre) => ({ tag, name: 'InRegia ' + tag, prerelease: pre, notes: '## Novità\n- Prova ' + tag, assets: [{ name: 'InRegia-Setup-' + tag + '.exe', url: 'https://example.invalid/s.exe' }] });
  fs.writeFileSync(feed, JSON.stringify([rel('v2026.11', false), rel('v2099.0', false), rel('v2099.1-beta.1', true), rel('v2099.1-beta.0', true)]));
  const env = Object.assign({}, process.env, { INREGIA_DATA: data, INREGIA_UPDATE_FEED: feed, INREGIA_CLOUDFONTS: path.join(FIX, 'cloudfonts') });
  if (!process.env.INREGIA_EXE) env.INREGIA_LO_LATEST = '99.1.0';
  let launch;
  if (process.env.INREGIA_EXE) launch = { executablePath: process.env.INREGIA_EXE, args: [], env };
  else {
    const inst = path.join(tmp, 'install'); fs.mkdirSync(path.join(inst, 'music', 'default', 'Test'), { recursive: true });
    for (const f of ['brano_a.mp3', 'brano_b.mp3']) fs.copyFileSync(path.join(FIX, f), path.join(inst, 'music', 'default', 'Test', f));
    fs.mkdirSync(path.join(inst, 'music', 'default', 'Lofi Chill'), { recursive: true });
    fs.copyFileSync(path.join(FIX, 'brano_c.opus'), path.join(inst, 'music', 'default', 'Lofi Chill', '01 Tazza calda.opus'));
    env.INREGIA_INSTALL = inst;
    launch = { executablePath: require(path.join(APP, 'node_modules', 'electron')), args: process.platform === 'linux' ? ['--no-sandbox', APP] : [APP], env };
  }
  let app;
  try { app = await _electron.launch(launch); }
  catch (e) { R.ok = false; R.errors.push('Avvio dell\'app non riuscito: ' + String(e && e.stack || e)); fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(R, null, 1)); console.log('ERRORE avvio', e); process.exit(1); }
  const pageErr = [];
  const hook = w => { w.on('pageerror', e => pageErr.push(w.url().split('/').pop().split('?')[0] + ': ' + e.message)); w.on('console', m => { if (m.type() === 'error') pageErr.push(w.url().split('/').pop().split('?')[0] + ' console: ' + m.text()); }); };
  app.on('window', hook);
  try {
    /* ---------------- libreria */
    const lib = await app.firstWindow(); hook(lib);
    await lib.waitForSelector('#v-decks', { timeout: 30000 });
    const L0 = await lib.evaluate(() => DP.invoke('lib:list'));
    check('libreria aperta', true, { engine: L0.engine.kind || 'none', defaultMusic: L0.defaultMusic });
    check('motore di conversione trovato', L0.engine.found, L0.engine);
    check('musica predefinita disponibile', L0.defaultMusic > 0, L0.defaultMusic);
    await shot(lib, '01-library-empty');
    /* ---------------- aggiornamenti */
    const ask = await until(() => lib.evaluate(() => !!document.querySelector('.dlg-bg.upd [data-a=yes]')), 12000);
    check('consenso chiesto prima di controllare gli aggiornamenti', ask, ask);
    if (ask) await lib.click('.dlg-bg.upd [data-a=yes]');
    const popup = await until(() => lib.evaluate(() => { const d = document.querySelector('.dlg-bg.upd'); const b = d && d.querySelector('.urow b'); return b && b.textContent; }), 12000);
    check('avviso nuova versione all\'avvio (canale stabile)', popup === 'InRegia v2099.0', popup);
    await shot(lib, '01b-library-update');
    await lib.click('.dlg-bg.upd [data-a=later]');
    await lib.evaluate(() => DP.invoke('settings:set', { updateChannel: 'beta' }));
    const ub = await lib.evaluate(() => DP.invoke('update:check'));
    check('canale beta propone anche le beta', ub.app.available && ub.app.latest.tag === 'v2099.1-beta.1', ub.app.latest && ub.app.latest.tag);
    await lib.evaluate(() => DP.invoke('settings:set', { updateChannel: 'stable' }));
    const us = await lib.evaluate(() => DP.invoke('update:check'));
    check('canale stabile ignora le beta', us.app.available && us.app.latest.tag === 'v2099.0', us.app.latest && us.app.latest.tag);
    check('versione LibreOffice letta', !!us.engine.latest && (us.engine.status.kind !== 'bundled' || !!us.engine.installed), { kind: us.engine.status.kind, installed: us.engine.installed, latest: us.engine.latest, available: us.engine.available });
    R.engine = us.engine;
    /* ---------------- importazione (stesso percorso del trascinamento) */
    const pptx = path.join(tmp, 'Presentazione di prova.pptx'); fs.copyFileSync(path.join(FIX, 'test.pptx'), pptx);
    const t0 = Date.now();
    const r = await lib.evaluate(p => DP.invoke('lib:import', [p, p.replace('.pptx', '.txt')]), pptx);
    check('importazione avviata', r.added.length === 1 && r.rejected.length === 1, r);
    const ready = await until(async () => { const l = await lib.evaluate(() => DP.invoke('lib:list')); const d = l.decks[0]; if (d && d.job && d.job.state === 'error') return d; return d && d.status === 'ready' ? d : null; }, 600000, 1000);
    R.metrics.importSeconds = Math.round((Date.now() - t0) / 100) / 10;
    check('presentazione importata', ready && ready.status === 'ready', ready && { status: ready.status, slides: ready.slides, media: ready.media, err: ready.job && ready.job.error, sec: R.metrics.importSeconds });
    if (!ready || ready.status !== 'ready') throw new Error('import fallito');
    check('slide e media riconosciuti', ready.slides === 7 && ready.media === 1 && ready.morphs === 1 && ready.animated === 1, ready);
    await sleep(500); await shot(lib, '02-library-ready');
    /* ---------------- font: cloud di Office, incorporati nel file, mancanti */
    const fop = path.join(tmp, 'Font.pptx'); fs.copyFileSync(path.join(FIX, 'fonts.pptx'), fop);
    await lib.evaluate(p => DP.invoke('lib:import', [p]), fop);
    const foReady = await until(async () => { const l = await lib.evaluate(() => DP.invoke('lib:list')); const d = l.decks.find(x => x.id === 'Font'); return d && (d.status === 'ready' || (d.job && d.job.state === 'error')) ? d : null; }, 600000, 1000);
    check('deck font importato', foReady && foReady.status === 'ready', foReady && { status: foReady.status, err: foReady.job && foReady.job.error });
    const FOM = JSON.parse(fs.readFileSync(path.join(data, 'presentations', 'Font', 'manifest.json'), 'utf8'));
    const fo = FOM.fonts || {};
    R.fonts = fo;
    check('font cloud di Office forniti al motore', fo.engine === 'libreoffice' && fo.provided.some(p => p.typeface === 'InRegia Prova' && p.source === 'cloud') && fo.pdf.some(n => /InRegiaProva/.test(n)), fo);
    check('font incorporato nel file (EOT) usato', fo.provided.some(p => p.typeface === 'InRegia Incorporato' && p.source === 'embedded') && fo.pdf.some(n => /InRegiaIncorporato/.test(n)), fo.pdf);
    check('font introvabile segnalato', fo.missing.includes('Font Inesistente XYZ') && /^Font non trovati: Font Inesistente XYZ/.test(FOM.warnings[0] || '') && !!foReady.fonts && foReady.fonts.missing.length === 1, { missing: fo.missing, w: FOM.warnings[0] });
    const fbtn = await lib.evaluate(() => !!document.querySelector('.deck [data-a=font], [data-a=font]'));
    check('pulsante "Aggiungi font" sulla presentazione', fbtn, fbtn);
    /* ---------------- deck di compatibilità animazioni e transizioni */
    const fxp = path.join(tmp, 'Effetti.pptx'); fs.copyFileSync(path.join(FIX, 'effects.pptx'), fxp);
    await lib.evaluate(p => DP.invoke('lib:import', [p]), fxp);
    const fxReady = await until(async () => { const l = await lib.evaluate(() => DP.invoke('lib:list')); const d = l.decks.find(x => x.id === 'Effetti'); return d && (d.status === 'ready' || (d.job && d.job.state === 'error')) ? d : null; }, 600000, 1000);
    check('deck effetti importato', fxReady && fxReady.status === 'ready', fxReady && { status: fxReady.status, err: fxReady.job && fxReady.job.error });
    const FXM = JSON.parse(fs.readFileSync(path.join(data, 'presentations', 'Effetti', 'manifest.json'), 'utf8'));
    const s1 = FXM.slides[0], s2 = FXM.slides[1], s3 = FXM.slides[2];
    const paraIds = s1.anim ? s1.anim.layers.map(l => l.id).filter(id => id.includes('#')) : [];
    check('animazione per paragrafo: un livello per paragrafo', paraIds.length === 3, paraIds);
    const allBeh = st => (st.anim ? st.anim.steps.flat() : []).flatMap(e => e.beh || []);
    const b2 = allBeh(s2), b3 = allBeh(s3);
    const filters = b2.filter(b => b.p === 'filter').map(b => b.f);
    check('ingressi con maschera riconosciuti', ['wheel(1)', 'blinds(horizontal)', 'checkerboard(across)', 'diamond(in)', 'plus(out)', 'randombar(horizontal)', 'strips(downRight)', 'barn(inVertical)'].every(f => filters.includes(f)), filters);
    check('cresci e ruota, zoom: scala e rotazione', b2.some(b => b.p === 'rot' && b.f[0][1] === '90') && b2.some(b => b.p === 'sx' && b.f[0][1] === '0'), b2.filter(b => b.p !== 'filter').map(b => b.p));
    check('enfasi e percorso riconosciuti', b3.some(b => b.p === 'rotBy' && b.v === 360) && b3.some(b => b.p === 'scaleBy' && b.x === 1.5) && b3.some(b => b.p === 'opTo' && b.v === 0.5) && b3.some(b => b.p === 'path' && b.pts.length === 2) && b3.some(b => b.p === 'scaleBy' && b.ar), b3.map(b => b.p));
    const flyIn = allBeh(s1).find(b => b.p === 'x');
    check('formule PowerPoint conservate (entra da sinistra)', flyIn && flyIn.f[0][1] === '0-#ppt_w/2' && flyIn.f[1][1] === '#ppt_x', flyIn);
    const trs = FXM.slides.map(x => x.tr && x.tr.type);
    check('transizioni riconosciute', JSON.stringify(trs) === JSON.stringify(['wheel', 'blinds', 'checker', 'randomBar', 'strips', 'diamond', 'plus', 'split']), trs);
    /* ---------------- musica: aggiunta globale e alla presentazione */
    const ag = await lib.evaluate(f => DP.invoke('music:add', 'global', [f]), path.join(FIX, 'brano_a.mp3'));
    const ad = await lib.evaluate(([id, f]) => DP.invoke('music:add', 'deck:' + id, [f]), [ready.id, path.join(FIX, 'brano_b.mp3')]);
    const src = await lib.evaluate(id => DP.invoke('music:sources', id), ready.id);
    check('musica a tre livelli', ag.ok && ad.ok && src.global.length === 1 && src.deck.length === 1 && src.default.length >= 1, { g: src.global.length, d: src.deck.length, def: src.default.map(c => c.cat + ':' + c.tracks.length) });
    await lib.click('nav button[data-v=music]'); await sleep(400); await shot(lib, '03-library-music');
    const gen = { list: src.genres.map(g => g.slug + (g.installed ? '+' : '-')), chips: await lib.evaluate(() => document.querySelectorAll('#mview .chip').length), dl: await lib.evaluate(() => document.querySelectorAll('#mview [data-dl]').length) };
    if (!process.env.INREGIA_EXE) check('generi musicali: filtro e download dei mancanti', src.genres.length === 7 && src.genres.find(g => g.slug === 'lofi').installed && gen.chips === 3 && gen.dl === 7, gen);
    else check('generi musicali installati', src.genres.filter(g => g.installed).length >= 1 && gen.chips >= 2, gen);
    await lib.click('nav button[data-v=decks]');
    /* ---------------- relatore */
    await lib.evaluate(id => { setTimeout(() => DP.invoke('deck:open', id), 10); }, ready.id);
    const pr = await until(() => app.windows().find(w => w.url().includes('presenter.html')), 20000);
    const au = await until(() => app.windows().find(w => w.url().includes('audience.html')), 20000);
    await pr.waitForLoadState(); await au.waitForLoadState();
    await until(() => pr.evaluate(() => !!(window.mlib && mlib.data && window.curView)), 15000);
    await sleep(1200);
    const vis = await au.evaluate(() => document.visibilityState);
    check('proiettore chiuso ma attivo (non sospeso)', vis === 'visible', vis);
    check('proiettore non aperto all\'avvio', (await pr.evaluate(() => AUD.open)) === false, await pr.evaluate(() => AUD.open));
    await shot(pr, '04-presenter');
    /* ---------------- video con proiettore chiuso */
    for (let i = 0; i < 4; i++) { await pr.keyboard.press('ArrowRight'); await sleep(700); }
    const cnt = await pr.textContent('#cnt');
    check('animazioni passo per passo, poi slide video', cnt === 'Slide 3 di 7', cnt);
    await pr.keyboard.press('ArrowRight'); await sleep(400);
    const warn = await pr.evaluate(() => !!document.querySelector('.dlg-bg') && document.querySelector('.dlg h2').textContent);
    check('avviso video non avviato', warn === 'Il video non è partito', warn);
    const tv = Date.now(); await pr.keyboard.press('Enter');
    const vstart = await until(() => au.evaluate(() => MEDIA[0] && MEDIA[0].el.currentTime > 0.2), 8000, 50);
    R.metrics.videoStartMs = vstart ? Date.now() - tv : null;
    await sleep(2500);
    const vs = await au.evaluate(() => MEDIA[0] && { t: MEDIA[0].el.currentTime, paused: MEDIA[0].el.paused, rs: MEDIA[0].el.readyState, err: MEDIA[0].el.error && MEDIA[0].el.error.code });
    check('video in riproduzione con proiettore chiuso', vs && vs.t > 2 && !vs.paused, Object.assign({ startMs: R.metrics.videoStartMs }, vs));
    const lvp = await pr.evaluate(() => LV.pres[0]);
    check('audio del video nel mixer', lvp > -50, lvp);
    const mir = await pr.evaluate(() => { const v = document.querySelector('.vmir'); return v && { on: v.classList.contains('on'), t: v.currentTime, paused: v.paused }; });
    check('video visibile nell\'anteprima del relatore', mir && mir.on && mir.t > 1 && !mir.paused, mir);
    await shot(pr, '05-presenter-video');
    await pr.keyboard.press('s'); await sleep(400);
    /* ---------------- musica */
    const q = await pr.evaluate(() => QUEUE.slice());
    check('coda musicale costruita', q.length === 2 && q.some(x => x.startsWith('g:')) && q.some(x => x.startsWith('p:')), q);
    await pr.click('.tab[data-tab=music]'); await sleep(300);
    const tm = Date.now(); await pr.click('#muPlay');
    const mstart = await until(() => au.evaluate(() => MUS.deck >= 0 && A.decks[MUS.deck].el.currentTime > 0.2 && peak(A.musM.l, A.musM.b) > -60), 8000, 50);
    R.metrics.musicStartMs = mstart ? Date.now() - tm : null;
    check('musica avviata con un click su Play', mstart && R.metrics.musicStartMs < 2500, R.metrics.musicStartMs);
    const stable = await pr.evaluate(() => new Promise(r => { const a = $('muPlay').firstChild, b = $('mPlay').firstChild; setTimeout(() => r(a === $('muPlay').firstChild && b === $('mPlay').firstChild), 600); }));
    check('pulsanti Play non ridisegnati durante la riproduzione', stable, stable);
    await sleep(800);
    const lvm = await pr.evaluate(() => [LV.mus[0], MST.playing, MST.id]);
    check('livelli musica nel relatore', lvm[0] > -60 && lvm[1], lvm);
    await shot(pr, '06-presenter-music');
    await pr.click('#muSeg button[data-mv=lib]'); await sleep(300); await shot(pr, '07-presenter-music-lib');
    await pr.click('#muSeg button[data-mv=queue]');
    // ducking durante il video
    await pr.click('#mPlay'); await sleep(2000);
    const vplay = await au.evaluate(() => MEDIA[0] && !MEDIA[0].el.paused);
    check('video avviato con un click su Play', vplay, vplay);
    const duck = await au.evaluate(() => A.musDuck.gain.value);
    check('musica abbassata durante il video', duck < 0.5, duck);
    await pr.keyboard.press('s'); await sleep(1500);
    // crossfade al brano successivo
    const id1 = await pr.evaluate(() => MST.id); await pr.keyboard.press('n'); await sleep(1800);
    const id2 = await pr.evaluate(() => MST.id);
    check('brano successivo', id1 && id2 && id1 !== id2, [id1, id2]);
    await pr.keyboard.press('m'); await sleep(1200);
    // filtro per genere sulla coda e riproduzione Opus
    const gq = await pr.evaluate(() => { const g = mlibData.default.map(c => c.cat).find(c => /Lofi/.test(c)) || mlibData.default[0].cat; SRC.default = true; SRC.genres = [g]; rebuildQueue(false); return { g, q: QUEUE.slice() }; });
    const onlyG = gq.q.filter(x => x.startsWith('d:')).every(x => x.startsWith('d:' + gq.g + '/')) && gq.q.some(x => x.startsWith('d:' + gq.g + '/'));
    check('filtro per genere applicato alla coda', onlyG, gq);
    const oi = gq.q.findIndex(x => x.startsWith('d:' + gq.g + '/'));
    await pr.evaluate(i => send({ t: 'mus', a: 'play', idx: i }), oi);
    const opus = await until(() => au.evaluate(() => { const D = A.decks[MUS.deck]; return D && D.item && /\.opus$/i.test(D.el.src) && D.el.currentTime > 0.5 && { t: D.el.currentTime, src: decodeURIComponent(D.el.src).split('/').slice(-2).join('/') }; }), 8000);
    check('brano Opus riprodotto', !!opus, opus);
    await pr.keyboard.press('m'); await sleep(900);
    await pr.evaluate(() => { SRC.default = false; SRC.genres = null; rebuildQueue(false); });
    // la finestra del relatore non deve mai scorrere (prima la casella dell'interruttore "Usa" la spostava in alto)
    const fixd = await pr.evaluate(async () => { const se = document.scrollingElement; const r = []; for (const i of document.querySelectorAll('.switch input')) { i.focus(); await new Promise(z => setTimeout(z, 30)); r.push(se.scrollTop); } $('mPlay').focus(); return { over: se.scrollHeight - se.clientHeight, max: Math.max(0, ...r) }; });
    check('relatore fermo: nessuno scorrimento della finestra', fixd.over <= 0 && fixd.max === 0, fixd);
    /* ---------------- mixer ed equalizzatore */
    await pr.click('.tab[data-tab=audio]');
    await pr.evaluate(() => FAD.mas.set(6, true)); await pr.selectOption('#eqPreset', 'Voce chiara'); await sleep(400);
    const mx = await au.evaluate(() => [A.mas.gain.value, A.eqP.f.map(b => Math.round(b.gain.value))]);
    check('fader master a +6 dB e stile EQ', Math.abs(mx[0] - 2) < 0.05 && mx[1][0] === -6 && mx[1][6] === 4, mx);
    await pr.evaluate(() => FAD.mas.set(0, true));
    /* ---------------- morph */
    await pr.evaluate(() => go(4, 'jump')); await sleep(800);
    await pr.keyboard.press('ArrowRight'); await sleep(500);
    const morph = await au.evaluate(() => !!document.querySelector('.dv-morph'));
    check('transizione morph', morph, morph); await sleep(2500);
    await pr.keyboard.press('ArrowRight'); await sleep(600);
    check('slide nascosta saltata', (await pr.textContent('#cnt')) === 'Slide 7 di 7', await pr.textContent('#cnt'));
    /* ---------------- proiettore e lucchetto */
    await pr.click('#bProj'); await sleep(700);
    const dlg = await pr.evaluate(() => ({ cards: document.querySelectorAll('.dcard').length, ok: (document.querySelector('.dlg .primary') || {}).textContent }));
    const idw = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().startsWith('data:')).length);
    check('scelta dello schermo con numeri identificativi', dlg.cards >= 1 && idw === dlg.cards && /Proietta su schermo \d/.test(dlg.ok), Object.assign({ idw }, dlg));
    await shot(pr, '08-presenter-choose-display');
    await pr.keyboard.press('Enter'); await sleep(1500);
    const idw2 = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && w.webContents.getURL().startsWith('data:')).length);
    check('numeri identificativi chiusi dopo la scelta', idw2 === 0, idw2);
    const st1 = await pr.evaluate(() => AUD);
    check('proiettore acceso', st1.open, { open: st1.open, fs: st1.fullscreen, same: st1.displayId === st1.presenterDisplay });
    await pr.click('#bLock'); await sleep(500);
    const lk = await au.evaluate(() => locked);
    check('lucchetto attivo sul proiettore', lk === true, lk);
    const nBefore = await pr.textContent('#cnt');
    await au.keyboard.press('Home').catch(() => {}); await sleep(400);
    check('tastiera bloccata sul proiettore', (await pr.textContent('#cnt')) === nBefore, await pr.textContent('#cnt'));
    await shot(pr, '09-presenter-onair');
    await pr.click('#bLock'); await sleep(300);
    await au.keyboard.press('Escape'); await sleep(800);
    const st2 = await pr.evaluate(() => AUD.open);
    check('Esc sul proiettore lo spegne', st2 === false, st2);
    await pr.keyboard.press('F5'); await sleep(500); await pr.keyboard.press('Enter'); await sleep(1500);
    const st3 = await pr.evaluate(() => AUD.open);
    await pr.evaluate(() => onKey('Escape')); await sleep(800);
    const st4 = await pr.evaluate(() => AUD.open);
    check('F5 accende, Esc dal relatore spegne', st3 === true && st4 === false, [st3, st4]);
    /* ---------------- riproduzione del deck effetti */
    await pr.evaluate(() => { setTimeout(() => DP.invoke('app:back'), 10); });
    const lib2 = await until(() => app.windows().find(w => w.url().includes('library.html') && !w.isClosed()), 20000);
    await lib2.waitForSelector('#v-decks', { timeout: 20000 }); await sleep(800);
    await lib2.evaluate(() => { setTimeout(() => DP.invoke('deck:open', 'Effetti'), 10); });
    const pr2 = await until(() => app.windows().find(w => w.url().includes('presenter.html') && !w.isClosed()), 20000);
    await pr2.waitForLoadState(); await until(() => pr2.evaluate(() => !!(window.curView && window.M)), 15000); await sleep(1000);
    const au2 = await until(() => app.windows().find(w => w.url().includes('audience.html') && !w.isClosed()), 20000);
    await pr2.keyboard.press('F5'); await sleep(500); await pr2.keyboard.press('Enter'); await sleep(1500);
    const st = async () => pr2.evaluate(() => [...curView.cur.querySelectorAll('.dv-layer')].map(l => ({ id: l.dataset.id, v: l.style.visibility, t: l.style.transform, o: l.style.opacity })));
    for (let i = 0; i < 3; i++) { await pr2.keyboard.press('ArrowRight'); await sleep(1500); }
    const p1 = await st();
    const flyPos = await pr2.evaluate(() => { const s = M.slides[0], e = s.anim.steps.flat().find(x => x.beh && x.beh.some(b => b.p === 'x' && b.f[0][1] === '0-#ppt_w/2')); const L = s.anim.layers.find(l => l.id === e.id); return { L, kf: curView._kfDebug ? null : null, x0: (() => { const V = { x: (L.x + L.w / 2) / 100, w: L.w / 100 }; return (-V.w / 2 - V.x) * 100; })() }; });
    check('paragrafi visibili dopo tre clic', p1.filter(l => l.id.includes('#')).length === 3 && p1.filter(l => l.id.includes('#')).every(l => l.v !== 'hidden'), p1);
    check('entra da sinistra: parte fuori dalla slide', flyPos.x0 < -(flyPos.L.x + flyPos.L.w / 2) + 0.01, flyPos);
    await shot(pr2, '10-effects-paragraphs');
    await pr2.keyboard.press('ArrowRight'); await sleep(1600); await pr2.keyboard.press('ArrowRight'); await sleep(400); await shot(au2, '11a-effects-masks-mid');
    const midClip = await au2.evaluate(() => [...document.querySelectorAll('.dv-layer')].map(l => getComputedStyle(l).clipPath).filter(c => c && c !== 'none').length);
    check('maschere animate sul proiettore', midClip >= 6, midClip);
    await sleep(1100); await pr2.keyboard.press('ArrowRight'); await sleep(250); await shot(au2, '11b-effects-grow-mid');
    const midTf = await au2.evaluate(() => [...document.querySelectorAll('.dv-layer')].map(l => getComputedStyle(l).transform).filter(t => t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)').length);
    check('cresci e ruota animato sul proiettore', midTf >= 2, midTf); await sleep(1250);
    await shot(pr2, '11-effects-entrances');
    await pr2.keyboard.press('ArrowRight'); await sleep(1600);
    for (let i = 0; i < 2; i++) { await pr2.keyboard.press('ArrowRight'); await sleep(2600); }
    const p3 = await st();
    const txt = id => (FXM.slides[2].anim.layers.find(l => l.id === id) || {}).id;
    const byPos = p3.map(l => Object.assign(l, { lay: FXM.slides[2].anim.layers.find(x => x.id === l.id) }));
    const rotL = byPos.find(l => /rotate\(360/.test(l.t)), scL = byPos.find(l => /scale\(1\.5/.test(l.t)), opL = byPos.find(l => l.o === '0.5'), pathL = byPos.find(l => /translate\((?!0\.00px,0\.00px)/.test(l.t));
    check('stato finale di enfasi e percorso mantenuto', !!(rotL && scL && opL && pathL), p3.map(l => [l.id, l.t, l.o]));
    await shot(pr2, '12-effects-emphasis');
    await pr2.keyboard.press('ArrowRight'); await sleep(1200);
    const p4 = await st();
    check('uscita: oggetto nascosto dopo l\'effetto', p4.some(l => l.v === 'hidden'), p4.map(l => [l.id, l.v]));
    for (let i = 0; i < 6; i++) { await pr2.keyboard.press('ArrowRight'); await sleep(1500); }
    check('transizioni del deck effetti completate', (await pr2.textContent('#cnt')) === 'Slide 8 di 8', await pr2.textContent('#cnt'));
    check('nessun errore JavaScript', pageErr.length === 0, pageErr.slice(0, 5));
  } catch (e) {
    R.ok = false; R.errors.push(String(e && e.stack || e)); console.log('ERRORE', e);
  } finally {
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(R, null, 1));
    console.log('METRICHE', JSON.stringify(R.metrics));
    console.log(R.ok ? 'TUTTI I TEST SUPERATI' : 'TEST FALLITI');
    try { await app.evaluate(({ app }) => app.exit(0)); } catch (e) {}
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    process.exit(R.ok ? 0 : 1);
  }
})();
