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
  const env = Object.assign({}, process.env, { INREGIA_DATA: data });
  let launch;
  if (process.env.INREGIA_EXE) launch = { executablePath: process.env.INREGIA_EXE, args: [], env };
  else {
    const inst = path.join(tmp, 'install'); fs.mkdirSync(path.join(inst, 'music', 'default', 'Test'), { recursive: true });
    for (const f of ['brano_a.mp3', 'brano_b.mp3']) fs.copyFileSync(path.join(FIX, f), path.join(inst, 'music', 'default', 'Test', f));
    env.INREGIA_INSTALL = inst;
    launch = { executablePath: require(path.join(APP, 'node_modules', 'electron')), args: process.platform === 'linux' ? ['--no-sandbox', APP] : [APP], env };
  }
  const app = await _electron.launch(launch);
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
    /* ---------------- musica: aggiunta globale e alla presentazione */
    const ag = await lib.evaluate(f => DP.invoke('music:add', 'global', [f]), path.join(FIX, 'brano_a.mp3'));
    const ad = await lib.evaluate(([id, f]) => DP.invoke('music:add', 'deck:' + id, [f]), [ready.id, path.join(FIX, 'brano_b.mp3')]);
    const src = await lib.evaluate(id => DP.invoke('music:sources', id), ready.id);
    check('musica a tre livelli', ag.ok && ad.ok && src.global.length === 1 && src.deck.length === 1 && src.default.length >= 1, { g: src.global.length, d: src.deck.length, def: src.default.map(c => c.cat + ':' + c.tracks.length) });
    await lib.click('nav button[data-v=music]'); await sleep(400); await shot(lib, '03-library-music');
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
