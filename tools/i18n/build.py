"""Genera app/ui/i18n-dict.js da tools/i18n/ui.py. Controlla che ogni voce abbia 5 lingue e gli stessi segnaposto."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from ui import E
LANGS = ['en', 'de', 'fr', 'es']
strings, patterns, seen, err = {}, [], set(), []
for row in E:
    if len(row) != 5: err.append(f'voce con {len(row)} colonne: {row[0]!r}'); continue
    it, *tr = row
    if it in seen: err.append(f'doppione: {it!r}')
    seen.add(it)
    ph = sorted(re.findall(r'\{\d\}', it.replace('{#', '{')))
    for l, t in zip(LANGS, tr):
        if sorted(re.findall(r'\{\d\}', t)) != ph: err.append(f'segnaposto diversi ({l}): {it!r} -> {t!r}')
    d = dict(zip(LANGS, tr))
    if ph: patterns.append((it, d))
    else: strings[it] = d
if err: print('\n'.join(err)); sys.exit(1)
# i modelli più specifici (più testo fisso) vengono provati per primi
patterns.sort(key=lambda p: -len(re.sub(r'\{#?\d\}', '', p[0])))
# nessuna traduzione deve essere a sua volta traducibile: l'interfaccia la ritradurrebbe all'infinito
def comp(src):
    order = []
    def f(m): order.append(int(m.group(2))); return r'(\d[\d.,:k]*)' if m.group(1) else r'([\s\S]+?)'
    return re.compile('^' + re.sub(r'\\\{(#?)(\d)\\\}', f, re.escape(src)) + '$'), order
PC = [(comp(src), d) for src, d in patterns]
for l in LANGS:
    def tr(k, depth=0):
        if k in strings: return strings[k][l]
        if depth > 3: return None
        for (rx, order), d in PC:
            m = rx.match(k)
            if not m: continue
            v = {}
            for i, n in enumerate(order):
                t = m.group(i + 1); x = tr(t, depth + 1) if re.search(r'[A-Za-zÀ-ú]{2}', t) else None
                v[n] = x if x is not None else t
            return re.sub(r'\{(\d)\}', lambda q: v[int(q.group(1))], d[l])
        return None
    outs = [d[l] for d in strings.values()] + [re.sub(r'\{(\d)\}', lambda q: str(int(q.group(1)) + 3), d[l]) for _, d in patterns]
    for o in outs:
        r = tr(o)
        if r is not None and r != o: err.append(f'traduzione ritraducibile ({l}): {o!r} -> {r!r}')
if err: print('\n'.join(err)); sys.exit(1)
out = os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'ui', 'i18n-dict.js')
js = ('/* Generato da tools/i18n/build.py a partire da tools/i18n/ui.py: non modificare a mano. */\n'
      '(function (root) {\n  const D = ' + json.dumps({'strings': strings, 'patterns': patterns}, ensure_ascii=False, separators=(',', ':')) + ';\n'
      "  if (typeof module !== 'undefined' && module.exports) module.exports = { I18N_DICT: D }; else root.I18N_DICT = D;\n})(this);\n")
open(out, 'w', encoding='utf-8').write(js)
print(f'{len(strings)} testi, {len(patterns)} modelli -> {os.path.normpath(out)}')
