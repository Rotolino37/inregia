'use strict';
/* InRegia - gestione brani a tre livelli: predefinita, globale, presentazione */
(function (G) {
  const DUR = G.__durCache || (G.__durCache = new Map());
  const AUDIO_RE = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|weba)$/i;
  let durQ = [], durBusy = false;
  function wantDur(t, cb) {
    if (DUR.has(t.url)) return cb(DUR.get(t.url));
    durQ.push([t, cb]); if (!durBusy) nextDur();
  }
  function nextDur() {
    const j = durQ.shift(); if (!j) { durBusy = false; return; } durBusy = true;
    const [t, cb] = j; if (DUR.has(t.url)) { cb(DUR.get(t.url)); return nextDur(); }
    const a = new Audio(); a.preload = 'metadata';
    const fin = d => { DUR.set(t.url, d); a.removeAttribute('src'); cb(d); nextDur(); };
    const to = setTimeout(() => fin(0), 8000);
    a.onloadedmetadata = () => { clearTimeout(to); fin(isFinite(a.duration) ? a.duration : 0); };
    a.onerror = () => { clearTimeout(to); fin(-1); };
    a.src = t.url;
  }
  G.trackDuration = wantDur;

  function confirmDlg(title, html, okLabel, onOk) {
    const bg = document.createElement('div'); bg.className = 'dlg-bg';
    bg.innerHTML = `<div class="dlg" role="dialog" aria-modal="true"><h2>${ic('alert')}${esc(title)}</h2><div class="body">${html}</div><div class="row"><button class="btn" data-a="no">Annulla</button><button class="btn danger" data-a="ok">${esc(okLabel)}</button></div></div>`;
    const close = () => { bg.remove(); document.removeEventListener('keydown', k, true); };
    const k = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    bg.querySelector('[data-a=no]').onclick = close;
    bg.querySelector('[data-a=ok]').onclick = () => { onOk(bg); close(); };
    document.addEventListener('keydown', k, true); document.body.appendChild(bg); bg.querySelector('[data-a=no]').focus();
  }
  G.confirmDlg = confirmDlg;

  /* opt: { deckId, deckName, mode: 'library'|'presenter', inQueue(id), toggleQueue(track), sourceOn(src), setSource(src,on), onChange() } */
  class MusicLibrary {
    constructor(host, opt) {
      this.host = host; this.o = opt || {}; this.data = null; this.open = { default: new Set() }; this.gsel = null;
      host.classList.add('mlib');
      host.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
      host.addEventListener('drop', e => e.preventDefault());
    }
    setDeck(id, name) { this.o.deckId = id; this.o.deckName = name; return this.load(); }
    async load() { this.data = await DP.invoke('music:sources', this.o.deckId || null); this.render(); if (this.o.onChange) this.o.onChange(this.data); return this.data; }
    allTracks() { if (!this.data) return []; return [...this.data.deck, ...this.data.global, ...this.data.default.flatMap(c => c.tracks)]; }
    async add(target, files) {
      const audio = files.filter(f => AUDIO_RE.test(f)), bad = files.length - audio.length;
      if (!audio.length) { toast('Nessun file audio riconosciuto. Formati: mp3, m4a, aac, wav, ogg, flac, opus.', 'warn'); return; }
      const r = await DP.invoke('music:add', target, audio);
      if (!r.ok) { toast('Brani non aggiunti: ' + r.error, 'bad'); return; }
      const parts = [];
      if (r.added.length) parts.push(r.added.length === 1 ? 'Aggiunto 1 brano' : `Aggiunti ${r.added.length} brani`);
      if (r.skipped.length) parts.push(`${r.skipped.length} già presenti`);
      if (bad) parts.push(`${bad} file ignorati`);
      toast(parts.join(', '), r.added.length ? 'ok' : 'warn');
      await this.load();
    }
    section(key, title, desc, tracks, target) {
      const s = document.createElement('section'); s.className = 'msec'; s.dataset.src = key;
      const editable = key !== 'default';
      const sw = this.o.mode === 'presenter' ? `<label class="switch" title="Usa questi brani nella coda"><input type="checkbox" ${this.o.sourceOn(key) ? 'checked' : ''}><i></i><span>Usa</span></label>` : '';
      s.innerHTML = `<header class="mhead"><div class="mtitle"><h3>${esc(title)}</h3><span class="muted num">${tracks.length} ${tracks.length === 1 ? 'brano' : 'brani'}</span></div>
        <div class="mact">${sw}${editable ? `<button class="btn sm" data-a="add">${ic('plus')}Aggiungi brani</button>` : ''}<button class="btn sm icon quiet" data-a="dir" title="Apri cartella">${ic('folder')}</button></div></header>
        <p class="mdesc muted">${desc}</p>`;
      if (editable) {
        const dz = document.createElement('div'); dz.className = 'drop mdrop';
        dz.innerHTML = `${ic('upload')}<span>Trascina qui i file audio</span>`;
        dz.addEventListener('dragenter', e => { e.preventDefault(); dz.classList.add('over'); });
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('over'));
        dz.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('over'); const fs = [...e.dataTransfer.files].map(f => DP.pathOf(f)).filter(Boolean); this.add(target, fs); });
        dz.addEventListener('click', () => s.querySelector('[data-a=add]').click());
        s.appendChild(dz);
      }
      const list = document.createElement('div'); list.className = 'mlist'; s.appendChild(list);
      if (key === 'default') {
        // filtro per genere: nel relatore decide anche quali generi entrano in coda
        const sel = this.o.genres ? this.o.genres() : this.gsel;
        const cats = this.data.default.map(c => c.cat);
        if (cats.length > 1) {
          const f = document.createElement('div'); f.className = 'gfilter'; f.setAttribute('role', 'group'); f.setAttribute('aria-label', 'Filtra per genere');
          const chip = (label, on, n) => `<button class="chip${on ? ' on' : ''}" aria-pressed="${on}" data-g="${esc(label)}">${esc(label === '*' ? 'Tutti i generi' : label)}${n != null ? `<span class="num">${n}</span>` : ''}</button>`;
          f.innerHTML = chip('*', !sel) + this.data.default.map(c => chip(c.cat, !!sel && sel.includes(c.cat), c.tracks.length)).join('');
          f.onclick = ev => {
            const b = ev.target.closest('.chip'); if (!b) return;
            const g = b.dataset.g; let next = null;
            if (g !== '*') { const cur = new Set(sel || []); if (cur.has(g)) cur.delete(g); else cur.add(g); next = cur.size && cur.size < cats.length ? [...cur] : null; }
            if (next && next.length === 1) this.open.default.add(next[0]);
            if (this.o.setGenres) this.o.setGenres(next); else this.gsel = next;
            this.render();
          };
          s.insertBefore(f, list);
        }
        const miss = (this.data.genres || []).filter(g => !g.installed);
        if (!this.data.default.length) list.innerHTML = `<div class="mempty">La musica predefinita non è installata.</div>`;
        if (miss.length) {
          const m = document.createElement('div'); m.className = 'gmiss';
          if (this.o.downloadGenres) {
            m.innerHTML = `<span class="muted">Altri generi disponibili:</span>` + miss.map(g => `<button class="btn xs" data-dl="${g.slug}" title="Circa ${g.mb} MB, oltre un'ora di musica">${ic('download')}${esc(g.name)}</button>`).join('') +
              (miss.length > 1 ? `<button class="btn xs quiet" data-dl="*">Scarica tutti (${miss.reduce((a, g) => a + g.mb, 0)} MB)</button>` : '');
            m.onclick = ev => { const b = ev.target.closest('[data-dl]'); if (b) this.o.downloadGenres(b.dataset.dl === '*' ? miss.map(g => g.slug) : [b.dataset.dl]); };
          } else m.innerHTML = `<span class="muted">Altri generi (${miss.map(g => esc(g.name)).join(', ')}) si scaricano dalla libreria, scheda Musica.</span>`;
          s.appendChild(m);
        }
        for (const c of this.data.default) {
          if (sel && !sel.includes(c.cat)) continue;
          const g = document.createElement('div'); g.className = 'mcat' + (this.open.default.has(c.cat) ? ' open' : '');
          g.innerHTML = `<button class="mcathead"><span class="chev">${ic('next')}</span><span class="nm">${esc(c.cat)}</span><span class="muted num">${c.tracks.length}</span>${this.o.mode === 'presenter' ? `<span class="btn xs quiet" data-a="cat">Aggiungi tutti</span>` : ''}</button><div class="mcatbody"></div>`;
          g.querySelector('.mcathead').onclick = ev => {
            if (ev.target.closest('[data-a=cat]')) { c.tracks.forEach(t => { if (!this.o.inQueue(t.id)) this.o.toggleQueue(t); }); this.render(); return; }
            if (this.open.default.has(c.cat)) this.open.default.delete(c.cat); else this.open.default.add(c.cat); g.classList.toggle('open');
          };
          const body = g.querySelector('.mcatbody'); c.tracks.forEach(t => body.appendChild(this.row(t, false)));
          list.appendChild(g);
        }
      } else {
        if (!tracks.length) list.innerHTML = `<div class="mempty">Nessun brano.</div>`;
        tracks.forEach(t => list.appendChild(this.row(t, true, target)));
      }
      s.querySelector('[data-a=dir]').onclick = () => DP.invoke('music:open', target);
      const ab = s.querySelector('[data-a=add]'); if (ab) ab.onclick = async () => { const f = await DP.invoke('music:pick'); if (f.length) this.add(target, f); };
      const swi = s.querySelector('.switch input'); if (swi) swi.onchange = () => { this.o.setSource(key, swi.checked); };
      return s;
    }
    row(t, removable, target) {
      const r = document.createElement('div'); r.className = 'mrow'; r.dataset.id = t.id;
      const q = this.o.mode === 'presenter';
      const inq = q && this.o.inQueue(t.id);
      r.innerHTML = `<span class="nm" title="${esc(t.name)}">${esc(t.name)}</span><span class="du muted num"></span>
        ${q ? `<button class="btn xs ${inq ? 'on' : ''}" data-a="q" title="${inq ? 'Togli dalla coda' : 'Aggiungi alla coda'}">${ic(inq ? 'check' : 'plus')}${inq ? 'In coda' : 'Coda'}</button>` : ''}
        ${removable ? `<button class="btn xs icon quiet danger" data-a="rm" title="Elimina il file">${ic('trash')}</button>` : ''}`;
      wantDur(t, d => { const e = r.querySelector('.du'); if (e) e.textContent = d > 0 ? fmtT(d) : d < 0 ? 'Non leggibile' : ''; });
      const qb = r.querySelector('[data-a=q]'); if (qb) qb.onclick = () => { this.o.toggleQueue(t); this.render(); };
      const rb = r.querySelector('[data-a=rm]');
      if (rb) rb.onclick = () => confirmDlg('Eliminare il brano?', `<p>Il file <b>${esc(t.name)}</b> viene eliminato dalla cartella musica di InRegia. Il file originale da cui lo hai aggiunto non viene toccato.</p>`, 'Elimina brano', async () => {
        const ok = await DP.invoke('music:remove', target, t.file.split(/[\\/]/).pop());
        toast(ok ? 'Brano eliminato' : 'Impossibile eliminare il brano', ok ? 'ok' : 'bad'); this.load();
      });
      return r;
    }
    render() {
      if (!this.data) return;
      const h = this.host, y = h.scrollTop; h.innerHTML = '';
      if (this.o.deckId) h.appendChild(this.section('deck', 'Questa presentazione', `Solo per <b>${esc(this.o.deckName || this.o.deckId)}</b>.`, this.data.deck, 'deck:' + this.o.deckId));
      h.appendChild(this.section('global', 'Globale', 'Disponibile in tutte le presentazioni.', this.data.global, 'global'));
      const nDef = this.data.default.reduce((a, c) => a + c.tracks.length, 0);
      h.appendChild(this.section('default', 'Predefinita', this.o.mode === 'presenter' ? 'Brani inclusi con InRegia. Scegli i generi: con "Usa" attivo entrano in coda solo quelli selezionati.' : 'Brani inclusi con InRegia, divisi per genere. Non si possono eliminare.', new Array(nDef), 'default'));
      h.scrollTop = y;
    }
  }
  G.MusicLibrary = MusicLibrary;
})(window);
