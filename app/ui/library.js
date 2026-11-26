'use strict';
/* InRegia - libreria: importazione, presentazioni, musica, impostazioni */
const $ = id => document.getElementById(id);
let D = null, view = 'decks', mlib = null, menuEl = null;
$('bImport').innerHTML = ic('upload') + 'Importa presentazione';
document.querySelector('#dropover .ic-slot').outerHTML = ic('upload');

const STATUS = {
  ready: ['Pronta', 'ok'], stale: ['File modificato', 'warn'], nosource: ['File originale non trovato', 'plain'],
  old: ['Da reimportare', 'warn'], broken: ['Importazione incompleta', 'warn'], importing: ['In importazione', 'gold'],
};

/* ------------------------------------------------------------ dati */
async function load() { D = await DP.invoke('lib:list'); renderBanner(); renderDecks(); if (view === 'settings') renderSettings(); fillDeckSelect(); }
DP.on('lib:changed', load);
DP.on('imp:progress', x => {
  const c = document.querySelector(`.deck[data-id="${CSS.escape(x.id)}"]`); if (!c) return;
  const b = c.querySelector('.job .bar i'), m = c.querySelector('.job .msg');
  if (b) b.style.width = Math.max(2, x.p) + '%'; if (m) m.textContent = x.m + ' (' + Math.round(x.p) + '%)';
});

/* ------------------------------------------------------------ motore */
function renderBanner() {
  const e = D.engine, b = $('banner');
  if (e.found && e.kind === 'bundled') { b.style.display = 'none'; return; }
  b.style.display = 'flex';
  b.innerHTML = e.found
    ? `<div class="txt"><b>Motore di conversione: LibreOffice installato nel sistema</b><span class="sec">Funziona. Per rendere InRegia indipendente dal sistema puoi installare il motore interno.</span></div>
       <button class="btn sm" id="eMsi">Ho il file .msi</button><button class="btn sm" id="eDl">${ic('upload')}Installa motore interno</button>`
    : `<div class="txt"><b>Per importare presentazioni serve il motore di conversione</b><span class="sec">Download unico di LibreOffice (circa 350 MB) dentro la cartella di InRegia, senza modificare il sistema. Dopo funziona offline.</span></div>
       <button class="btn sm" id="eMsi">Ho il file .msi</button><button class="btn primary" id="eDl">${ic('upload')}Scarica e installa</button>`;
  $('eDl').onclick = () => job('Installazione del motore', 'engine:download', 'Motore installato. Ora puoi importare presentazioni.');
  $('eMsi').onclick = () => job('Installazione del motore', 'engine:msi', 'Motore installato.');
}
async function job(title, ch, okMsg) {
  $('jbT').textContent = title; $('jbM').textContent = 'Avvio'; setBar(-1); $('jobbox').style.display = 'flex';
  const off = DP.on('job:progress', d => { $('jbM').textContent = d.m; setBar(d.p); });
  const r = await DP.invoke(ch); off(); $('jobbox').style.display = 'none';
  if (r.ok) toast(okMsg, 'ok', 5000);
  else if (!r.canceled) toast('Operazione non riuscita: ' + r.error, 'bad', 8000);
  load(); if (mlib) mlib.load();
  return r;
}
function setBar(p) { const b = $('jbBar'); b.classList.toggle('ind', !(p >= 0)); b.firstElementChild.style.width = (p >= 0 ? p : 30) + '%'; }

/* ------------------------------------------------------------ presentazioni */
function renderDecks() {
  const v = $('v-decks'); v.innerHTML = '';
  if (!D.decks.length) {
    v.innerHTML = `<div class="empty drop" id="emptyDrop">${ic('upload', 'big')}<h1>Importa la tua prima presentazione</h1>
      <p>Trascina qui uno o più file PowerPoint (.pptx), oppure sceglili dal computer. La conversione avviene una volta sola: poi la presentazione funziona anche offline.</p>
      <div class="row"><button class="btn primary lg" id="ePick">${ic('upload')}Scegli file .pptx</button></div></div>`;
    $('ePick').onclick = pick;
    return;
  }
  v.innerHTML = `<div class="vhead"><div><h1>Presentazioni</h1><div class="sec">${D.decks.length} ${D.decks.length === 1 ? 'presentazione' : 'presentazioni'}. Scegli quella da avviare.</div></div></div><div class="grid" id="grid"></div>`;
  const g = $('grid');
  for (const d of D.decks) g.appendChild(card(d));
  const add = document.createElement('button'); add.className = 'deck drop addtile'; add.id = 'addTile';
  add.innerHTML = `${ic('plus')}<b>Aggiungi presentazione</b><span class="sec">Trascina qui file .pptx o fai clic per sceglierli</span>`;
  add.onclick = pick; g.appendChild(add);
}
function card(d) {
  const el = document.createElement('article'); el.className = 'deck'; el.dataset.id = d.id;
  const st = STATUS[d.status] || STATUS.broken, ready = d.status === 'ready' || d.status === 'nosource' || d.status === 'stale';
  const meta = [];
  if (d.slides) meta.push(d.slides + ' slide');
  if (d.media) meta.push(d.media + (d.media === 1 ? ' video/audio' : ' video e audio'));
  if (d.morphs) meta.push(d.morphs + ' morph');
  meta.push(d.music + (d.music === 1 ? ' brano proprio' : ' brani propri'));
  el.innerHTML = `<div class="thumb" style="${d.thumb ? `background-image:url('${d.thumb}?${encodeURIComponent(d.imported || '')}')` : ''}">${d.thumb ? '' : `<div class="ph">${ic('film')}</div>`}<span class="pill ${st[1]}">${st[0]}</span></div>
    <div class="dbody"><div class="dname" title="${esc(d.name)}">${esc(d.name)}</div><div class="dmeta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</div>
    ${d.status === 'stale' ? `<div class="dwarn">Il file .pptx è cambiato dopo l'importazione.</div>` : ''}
    ${d.warnings && d.warnings.length ? `<div class="dwarn" title="${esc(d.warnings.join('\n'))}">${esc(d.warnings[0])}${d.warnings.length > 1 ? ` (e altri ${d.warnings.length - 1})` : ''}</div>` : ''}
    <div class="dact">
      ${ready ? `<button class="btn primary" data-a="go">${ic('play')}Presenta</button>` : `<button class="btn" data-a="reimp">${ic('refresh')}Importa di nuovo</button>`}
      ${d.status === 'stale' ? `<button class="btn" data-a="reimp" title="Aggiorna dal file modificato">${ic('refresh')}Aggiorna</button>` : ''}
      <button class="btn icon" data-a="mus" title="Musica di questa presentazione">${ic('music')}</button>
      <button class="btn icon" data-a="more" title="Altre azioni" aria-haspopup="menu">${ic('dots')}</button></div></div>`;
  if (d.job) {
    const j = document.createElement('div'); j.className = 'job' + (d.job.state === 'error' ? ' err' : '');
    if (d.job.state === 'error') { j.innerHTML = `<b>Importazione non riuscita</b><div class="msg">${esc(d.job.error || '')}</div><div class="dact"><button class="btn primary" data-a="retry">Riprova</button><button class="btn" data-a="dismiss">Annulla</button></div>`; }
    else { j.innerHTML = `<b>${d.job.state === 'queued' ? 'In coda' : 'Importazione in corso'}</b><div class="msg">${esc(d.job.m || '')}${d.job.p ? ' (' + Math.round(d.job.p) + '%)' : ''}</div><div class="bar"><i style="width:${Math.max(2, d.job.p || 0)}%"></i></div>`; }
    el.appendChild(j);
  }
  el.addEventListener('click', ev => {
    const a = ev.target.closest('[data-a]'); if (!a) return;
    const k = a.dataset.a;
    if (k === 'go') openDeck(d);
    else if (k === 'reimp') DP.invoke('lib:reimport', d.id).then(r => { if (!r.added.length) toast('File originale non trovato: importa di nuovo il .pptx', 'warn'); });
    else if (k === 'mus') { setView('music'); $('mDeck').value = d.id; mlib.setDeck(d.id, d.name); }
    else if (k === 'more') openMenu(a, d);
    else if (k === 'retry') DP.invoke('lib:retry', d.id);
    else if (k === 'dismiss') DP.invoke('lib:dismiss', d.id);
  });
  return el;
}
async function openDeck(d) {
  if (d.status === 'stale') toast('Avvio la versione già importata. Usa "Aggiorna" per le modifiche al file.', 'warn', 5000);
  const r = await DP.invoke('deck:open', d.id);
  if (!r.ok) toast('Impossibile aprire: ' + r.error, 'bad');
}
function openMenu(btn, d) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<button role="menuitem" data-m="reimp">${ic('refresh')}Importa di nuovo</button><button role="menuitem" data-m="reveal">${ic('folder')}Mostra il file originale</button><button role="menuitem" class="danger" data-m="rm">${ic('trash')}Rimuovi da InRegia</button>`;
  document.body.appendChild(m);
  const r = btn.getBoundingClientRect();
  m.style.left = Math.min(innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth) + 'px';
  m.style.top = (r.bottom + m.offsetHeight + 6 > innerHeight ? r.top - m.offsetHeight - 6 : r.bottom + 6) + 'px';
  m.querySelector('button').focus();
  m.onclick = ev => {
    const b = ev.target.closest('[data-m]'); if (!b) return; closeMenu();
    if (b.dataset.m === 'reimp') DP.invoke('lib:reimport', d.id).then(x => { if (!x.added.length) toast('File originale non trovato', 'warn'); });
    else if (b.dataset.m === 'reveal') DP.invoke('lib:reveal', d.id);
    else if (b.dataset.m === 'rm') removeDeck(d);
  };
  menuEl = m;
}
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
document.addEventListener('mousedown', e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
function removeDeck(d) {
  confirmDlg('Rimuovere la presentazione?', `<p><b>${esc(d.name)}</b> viene tolta da InRegia: si cancellano le slide convertite e i video estratti. Il file .pptx originale non viene toccato.</p>
    ${d.music ? `<label class="switch"><input type="checkbox" class="rmMus"><i></i><span>Elimina anche i ${d.music} brani propri di questa presentazione</span></label>` : ''}`, 'Rimuovi', bg => {
    const cb = bg.querySelector('.rmMus');
    DP.invoke('lib:remove', d.id, !!(cb && cb.checked)).then(ok => toast(ok ? 'Presentazione rimossa' : 'Impossibile rimuovere durante l\'importazione', ok ? 'ok' : 'warn'));
  });
}
async function pick() { const f = await DP.invoke('lib:pick'); if (f.length) importFiles(f); }
async function importFiles(paths) {
  if (!D.engine.found) { toast('Prima installa il motore di conversione (riquadro in alto).', 'warn', 6000); return; }
  const r = await DP.invoke('lib:import', paths);
  if (r.added.length) toast(r.added.length === 1 ? 'Importazione avviata' : `Importazione avviata per ${r.added.length} presentazioni`, 'ok');
  if (r.rejected.length) toast('Ignorati (non sono .pptx): ' + r.rejected.join(', '), 'warn', 6000);
  setView('decks');
}
$('bImport').onclick = pick;

/* ------------------------------------------------------------ trascinamento */
let dragN = 0;
const isFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
addEventListener('dragenter', e => {
  if (!isFiles(e)) return; e.preventDefault(); dragN++;
  if (view === 'music') return; // nella vista musica valgono le aree delle singole sezioni
  $('dropover').style.display = 'flex';
});
addEventListener('dragover', e => { if (isFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
addEventListener('dragleave', e => { if (!isFiles(e)) return; dragN = Math.max(0, dragN - 1); if (!dragN) $('dropover').style.display = 'none'; });
addEventListener('drop', e => {
  if (!isFiles(e)) return; e.preventDefault(); dragN = 0; $('dropover').style.display = 'none';
  if (view === 'music') return;
  const files = [...e.dataTransfer.files].map(f => DP.pathOf(f)).filter(Boolean);
  const pptx = files.filter(f => /\.pptx$/i.test(f)), audio = files.filter(f => /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|weba)$/i.test(f));
  if (pptx.length) importFiles(pptx);
  if (audio.length) { setView('music'); mlib.add('global', audio); }
  if (!pptx.length && !audio.length) toast('Trascina file PowerPoint (.pptx) o file audio.', 'warn');
});

/* ------------------------------------------------------------ musica */
function fillDeckSelect() {
  const s = $('mDeck'), cur = s.value;
  s.innerHTML = '<option value="">Nessuna presentazione</option>' + D.decks.filter(d => d.status !== 'importing').map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
  s.value = [...s.options].some(o => o.value === cur) ? cur : '';
}
$('mDeck').onchange = e => { const d = D.decks.find(x => x.id === e.target.value); mlib.setDeck(d ? d.id : null, d ? d.name : null); };
DP.on('music:changed', () => mlib && mlib.load());

/* ------------------------------------------------------------ impostazioni */
function renderSettings() {
  const s = D.settings, e = D.engine;
  $('v-settings').innerHTML = `<div class="vhead"><div><h1>Impostazioni</h1><div class="sec">Valgono per tutte le presentazioni.</div></div></div><div class="settings">
    <h2 class="sgroup">Presentazione</h2>
    <div class="srow"><div class="l"><b>Lucchetto attivo all'apertura</b><span>Il proiettore si apre già bloccato</span></div><label class="switch"><input type="checkbox" data-k="lockOnOpen"><i></i></label></div>
    <div class="srow"><div class="l"><b>Video anche nell'anteprima del relatore</b><span>Mostra il video in riproduzione nella slide corrente. Disattiva su PC molto lenti</span></div><label class="switch"><input type="checkbox" data-k="videoMirror"><i></i></label></div>
    <h2 class="sgroup">Importazione</h2>
    <div class="srow"><div class="l"><b>Qualità delle immagini delle slide</b><span>Vale dalla prossima importazione</span></div><select class="sel" data-k="renderWidth"><option value="1920">Full HD (1920 px)</option><option value="2560">QHD (2560 px)</option><option value="3840">4K (3840 px)</option></select></div>
    <div class="srow"><div class="l"><b>Motore di conversione</b><span>${e.found ? (e.kind === 'bundled' ? 'LibreOffice interno a InRegia' : 'LibreOffice del sistema') : 'Non installato'}</span></div><button class="btn sm" id="sEng">${e.found && e.kind === 'bundled' ? 'Reinstalla' : 'Installa'}</button></div>
    <h2 class="sgroup">Sistema</h2>
    <div class="srow"><div class="l"><b>Modalità compatibilità grafica</b><span>Per schede video problematiche. Richiede il riavvio di InRegia</span></div><label class="switch"><input type="checkbox" data-k="compatGpu"><i></i></label></div>
    <div class="srow"><div class="l"><b>Cartella dei dati</b><span>Presentazioni importate, musica aggiunta, impostazioni</span></div><button class="btn sm" id="sData">${ic('folder')}Apri cartella</button></div>
    <div class="srow"><div class="l"><b>Versione</b><span>InRegia ${esc(D.version)}</span></div></div></div>`;
  const v = $('v-settings');
  v.querySelectorAll('[data-k]').forEach(el => {
    const k = el.dataset.k;
    if (el.type === 'checkbox') { el.checked = k === 'videoMirror' ? s[k] !== false : !!s[k]; el.onchange = () => DP.invoke('settings:set', { [k]: el.checked }).then(x => { D.settings = x; toast('Impostazione salvata', 'ok', 1800); }); }
    else { el.value = String(s[k] || 1920); el.onchange = () => DP.invoke('settings:set', { [k]: +el.value }).then(x => { D.settings = x; toast('Impostazione salvata', 'ok', 1800); }); }
  });
  $('sEng').onclick = () => job('Installazione del motore', 'engine:download', 'Motore installato.');
  $('sData').onclick = () => DP.invoke('open:data');
}

/* ------------------------------------------------------------ navigazione */
function setView(v) {
  view = v;
  document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  if (v === 'settings') renderSettings();
  if (v === 'music' && !mlib) { mlib = new MusicLibrary($('mview'), { mode: 'library', downloadDefault: () => job('Musica predefinita', 'music:downloadDefault', 'Musica predefinita installata.') }); mlib.load(); }
}
document.querySelectorAll('nav button').forEach(b => b.onclick = () => setView(b.dataset.v));
load();
