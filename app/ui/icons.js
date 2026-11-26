'use strict';
(function (G) {
  const P = {
    play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
    pause: '<path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z" fill="currentColor"/>',
    stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="currentColor"/>',
    prev: '<path d="M15.5 4.5 7 12l8.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    next: '<path d="M8.5 4.5 17 12l-8.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    first: '<path d="M6 5v14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M18 5 9.5 12 18 19z" fill="currentColor"/>',
    trkPrev: '<path d="M6 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19 5 8.5 12 19 19z" fill="currentColor"/>',
    trkNext: '<path d="M18 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M5 5l10.5 7L5 19z" fill="currentColor"/>',
    back10: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 3.5v4.2h4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.3" font-size="7.5" text-anchor="middle" fill="currentColor" font-family="Arial" font-weight="700">10</text>',
    fwd10: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 3.5v4.2h-4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.3" font-size="7.5" text-anchor="middle" fill="currentColor" font-family="Arial" font-weight="700">10</text>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 20.5h6M12 16.5v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    black: '<rect x="3" y="4" width="18" height="13" rx="2" fill="currentColor"/><path d="M9 20.5h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    white: '<rect x="3" y="4" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 20.5h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    x: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    refresh: '<path d="M19.5 8.5A8 8 0 1 0 20 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M20 3.5v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    shuffle: '<path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.8 0 3.1-1.6 4.2-3.5M14 9.3C15 8 16.2 7 17.5 7H21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    repeat: '<path d="M4 11V9.5A2.5 2.5 0 0 1 6.5 7H20M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17 4l3 3-3 3M7 20l-3-3 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    music: '<path d="M9 18V6l11-2.5v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="17.5" cy="15.5" r="2.8" fill="currentColor"/>',
    sliders: '<path d="M6 3v18M12 3v18M18 3v18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".55"/><rect x="3.5" y="13" width="5" height="3.4" rx="1" fill="currentColor"/><rect x="9.5" y="6" width="5" height="3.4" rx="1" fill="currentColor"/><rect x="15.5" y="10" width="5" height="3.4" rx="1" fill="currentColor"/>',
    notes: '<rect x="4.5" y="3" width="15" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    pointer: '<circle cx="12" cy="12" r="4.2" fill="currentColor"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".5"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    minus: '<path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    grip: '<g fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></g>',
    alert: '<path d="M12 3.5 22 20H2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.3" fill="currentColor"/>',
    back: '<path d="M10 5 3 12l7 7M3.5 12H21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    power: '<path d="M12 3v8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 6.2a8 8 0 1 0 10 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    film: '<rect x="3" y="4.5" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 4.5v15M16.5 4.5v15M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21" stroke="currentColor" stroke-width="1.6"/>',
    morph: '<path d="M4 17c3-9 13-9 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4.5" cy="17" r="2.5" fill="currentColor"/><rect x="17.5" y="14.5" width="5" height="5" rx="1" fill="currentColor"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    fade: '<path d="M3 18 21 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 18h18" stroke="currentColor" stroke-width="1.6" opacity=".5"/>',
    vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    help: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    timer: '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v4.5l3 2M9.5 2.5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 13h9l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    dots: '<g fill="currentColor"><circle cx="5.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/></g>',
    library: '<rect x="3.5" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13.5" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3.5" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="13.5" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  };
  G.ic = (n, cls) => `<span class="ic ${cls || ''}"><svg viewBox="0 0 24 24">${P[n] || ''}</svg></span>`;
  G.hydrateIcons = root => { (root || document).querySelectorAll('[data-ic]').forEach(e => { if (!e.querySelector('.ic')) e.insertAdjacentHTML('afterbegin', G.ic(e.dataset.ic)); }); };
  G.toast = (msg, kind, ms) => {
    let h = document.getElementById('toasts'); if (!h) { h = document.createElement('div'); h.id = 'toasts'; h.setAttribute('role', 'status'); h.setAttribute('aria-live', 'polite'); document.body.appendChild(h); }
    const t = document.createElement('div'); t.className = 'toast ' + (kind || '');
    t.innerHTML = G.ic(kind === 'ok' ? 'check' : kind === 'warn' || kind === 'bad' ? 'alert' : 'spark') + '<span></span>'; t.lastChild.textContent = msg; h.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .25s'; t.style.opacity = 0; setTimeout(() => t.remove(), 260); }, ms || 3600);
  };
  G.fmtT = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
  G.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})(window);
