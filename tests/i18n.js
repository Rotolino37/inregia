'use strict';

// su GitHub Actions i fallimenti diventano annotazioni, leggibili senza accesso ai log
const ghErr = m => { if (process.env.GITHUB_ACTIONS) console.log('::error::' + String(m).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A').slice(0, 900)); };
/* Copertura delle traduzioni: per ogni lingua apre libreria, musica, impostazioni, relatore e finestre di dialogo
 * e raccoglie i testi rimasti in italiano. Fallisce se ne trova (esclusi i dati: nomi di file, brani, note).
 * Uso: xvfb-run node tests/i18n.js   (INREGIA_EXE per l'app installata) */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron } = require(path.join(__dirname, '..', 'app', 'node_modules', 'playwright-core'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = path.join(__dirname, '..'), APP = path.join(ROOT, 'app'), FIX = path.join(__dirname, 'fixtures');
const EXE = process.env.INREGIA_EXE;
// dati dei fixture, non testi dell'interfaccia
const DATA_RE = [/^Presentazione di prova$/, /^InRegia - /, /^brano [ab]$/, /^Test$/, /^Tazza calda$/, /^Nota della prima slide\.$/, /^Novità$/, /^- Prova /, /^InRegia v\d/, /^Titolo/, /^Elenco per paragrafo$/, /^(Rotazione|Ingrandisci|Trasparenza|Percorso|Impulso|Esce a destra)$/];
async function until(fn, ms = 20000, step = 250) { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (e) {} if (Date.now() - t > ms) return null; await sleep(step); } }

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inregia-i18n-'));
  const data = path.join(tmp, 'data'), inst = path.join(tmp, 'install');
  fs.mkdirSync(path.join(inst, 'music', 'default', 'Lofi Chill'), { recursive: true });
  fs.mkdirSync(path.join(inst, 'music', 'default', 'Pianoforte'), { recursive: true });
  fs.copyFileSync(path.join(FIX, 'brano_a.mp3'), path.join(inst, 'music', 'default', 'Lofi Chill', '01 Tazza calda.mp3'));
  fs.copyFileSync(path.join(FIX, 'brano_b.mp3'), path.join(inst, 'music', 'default', 'Pianoforte', '01 Tazza calda.mp3'));
  const feed = path.join(tmp, 'feed.json');
  fs.writeFileSync(feed, JSON.stringify([{ tag: 'v2099.0', name: 'InRegia v2099.0', prerelease: false, notes: 'Novità', assets: [{ name: 'InRegia-Setup-v2099.0.exe', url: 'https://example.invalid/s.exe' }] }]));
  const pptx = path.join(tmp, 'Presentazione di prova.pptx'); fs.copyFileSync(path.join(FIX, 'test.pptx'), pptx);
  let ok = true; const report = {};
  for (const lang of ['en', 'de', 'fr', 'es']) {
    const harvest = path.join(tmp, `miss-${lang}.txt`);
    fs.rmSync(path.join(data, 'settings.json'), { force: true }); // la richiesta di consenso compare di nuovo
    const env = Object.assign({}, process.env, { INREGIA_LANG: lang, INREGIA_I18N_HARVEST: harvest, INREGIA_DATA: data, INREGIA_UPDATE_FEED: feed, INREGIA_NO_POWERPOINT: '1' });
    if (!EXE) env.INREGIA_INSTALL = inst;
    const app = await _electron.launch(EXE ? { executablePath: EXE, env } : { executablePath: require(path.join(APP, 'node_modules', 'electron')), args: [APP, '--no-sandbox'], env });
    const lib = await app.firstWindow(); await lib.waitForSelector('#v-decks', { timeout: 30000 });
    // consenso, poi avviso di aggiornamento
    if (await until(() => lib.evaluate(() => !!document.querySelector('.dlg-bg.upd [data-a=yes]')), 10000)) { await sleep(400); await lib.click('.dlg-bg.upd [data-a=yes]'); }
    if (await until(() => lib.evaluate(() => !!document.querySelector('.dlg-bg.upd [data-a=later]')), 10000)) { await sleep(400); await lib.click('.dlg-bg.upd [data-a=later]'); }
    const list = await lib.evaluate(() => DP.invoke('lib:list'));
    if (!list.decks.some(d => d.id === 'Presentazione di prova')) {
      await lib.evaluate(p => DP.invoke('lib:import', [p]), pptx);
      await until(async () => { const l = await lib.evaluate(() => DP.invoke('lib:list')); const d = l.decks.find(x => x.id === 'Presentazione di prova'); return d && d.status === 'ready'; }, 300000, 1000);
    }
    await sleep(600);
    await lib.click('.deck [data-a=more]').catch(() => {}); await sleep(300); await lib.keyboard.press('Escape');
    for (const v of ['music', 'settings', 'decks']) { await lib.click(`nav button[data-v=${v}]`); await sleep(700); }
    if (process.env.INREGIA_SHOTS) { fs.mkdirSync(path.join(ROOT, 'test-output'), { recursive: true }); await lib.click('nav button[data-v=settings]'); await sleep(500); await lib.screenshot({ path: path.join(ROOT, 'test-output', `i18n-${lang}-settings.png`) }); await lib.click('nav button[data-v=decks]'); await sleep(300); }
    const navLabel = await lib.evaluate(() => document.querySelector('nav button[data-v=settings]').textContent.trim());
    // relatore
    await lib.evaluate(() => { setTimeout(() => DP.invoke('deck:open', 'Presentazione di prova'), 10); });
    const pr = await until(() => app.windows().find(w => w.url().includes('presenter.html') && !w.isClosed()), 20000);
    await pr.waitForLoadState(); await sleep(1500);
    if (await pr.evaluate(() => !!document.querySelector('.dlg-bg'))) { await pr.keyboard.press('Escape'); await sleep(300); }
    if (process.env.INREGIA_SHOTS) await pr.screenshot({ path: path.join(ROOT, 'test-output', `i18n-${lang}-presenter.png`) });
    for (const t of ['music', 'notes', 'audio']) { await pr.click(`.tab[data-tab=${t}]`); await sleep(400); }
    await pr.click('.tab[data-tab=music]'); await pr.click('#muSeg button[data-mv=lib]').catch(() => {}); await sleep(500);
    await pr.click('#muSeg button[data-mv=queue]').catch(() => {}); await sleep(300);
    await pr.keyboard.press('F1'); await sleep(500); await pr.keyboard.press('Escape'); await sleep(300);
    await pr.keyboard.press('F5'); await sleep(600); await pr.keyboard.press('Escape'); await sleep(300);
    // fino alla slide con il video, poi avanti senza avviarlo: avviso
    for (let i = 0; i < 8 && !(await pr.evaluate(() => !!document.querySelector('.dlg-bg'))); i++) { await pr.keyboard.press('ArrowRight'); await sleep(700); }
    await sleep(500); await pr.keyboard.press('Escape'); await sleep(300);
    await pr.click('#bList').catch(() => {}); await sleep(400); await pr.keyboard.press('Escape'); await sleep(1500);
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await sleep(500);
    let miss = []; try { miss = [...new Set(fs.readFileSync(harvest, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)))]; } catch (e) {}
    const left = miss.filter(s => !DATA_RE.some(r => r.test(s)) && /[a-zà-ú]{3,}/i.test(s));
    report[lang] = { navLabel, untranslated: left };
    const expected = { en: 'Settings', de: 'Einstellungen', fr: 'Paramètres', es: 'Ajustes' }[lang];
    const pass = left.length === 0 && navLabel.includes(expected);
    if (!pass) { ok = false; ghErr('FAIL ' + lang + ': ' + JSON.stringify(left)); }
    console.log((pass ? 'PASS ' : 'FAIL ') + lang + ': ' + (left.length ? left.length + ' testi non tradotti: ' + JSON.stringify(left) : 'tutto tradotto') + ' (impostazioni: ' + navLabel + ')');
  }
  fs.mkdirSync(path.join(ROOT, 'test-output'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'test-output', 'i18n.json'), JSON.stringify(report, null, 1));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  console.log(ok ? 'TRADUZIONI COMPLETE' : 'TRADUZIONI INCOMPLETE');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('ERRORE', e); ghErr('ERRORE ' + (e && e.stack || e)); process.exit(1); });
