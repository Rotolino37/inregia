"""InRegia - generatore della musica di sottofondo predefinita.

Compone e sintetizza brani originali (nessun campione esterno, nessun diritto di terzi).
Uscita: <out>/<Genere>/<Titolo>.mp3 e opzionalmente uno zip.
Uso:  python generate.py --out out [--zip InRegia-music-default.zip] [--seconds 150]
Richiede numpy, scipy e ffmpeg nel PATH.
"""
import argparse, os, subprocess, zipfile
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
QUAL = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], '7': [0, 4, 7, 10], 'maj9': [0, 4, 7, 11, 14],
        'm9': [0, 3, 7, 10, 14], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], '6': [0, 4, 7, 9], 'add9': [0, 4, 7, 14], '13': [0, 4, 10, 14, 21], 'm11': [0, 3, 7, 10, 14, 17]}


def chord(name, octave=4):
    root = name[:2] if len(name) > 1 and name[1] in '#b' else name[:1]
    q = name[len(root):] or 'maj'
    base = 12 * (octave + 1) + NOTE[root]
    return base, [base + i for i in QUAL[q]]


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    e = np.full(n, s, dtype=np.float32)
    a = min(a, n); e[:a] = np.linspace(0, 1, a, endpoint=False) if a else e[:a]
    d2 = min(d, max(0, n - a)); e[a:a + d2] = np.linspace(1, s, d2, endpoint=False) if d2 else e[a:a + d2]
    if r and n > r: e[-r:] *= np.linspace(1, 0, r)
    return e


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45) / (SR / 2), 'low', output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc / (SR / 2), 'high', output='sos'), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], 'band', output='sos'), x)


class Track:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.bus = {}

    def buf(self, name):
        if name not in self.bus: self.bus[name] = np.zeros((2, self.n), dtype=np.float32)
        return self.bus[name]

    def add(self, name, t, sig, pan=0.0, gain=1.0):
        i = int(t * SR)
        if i >= self.n: return
        sig = (sig[..., : self.n - i]) * gain
        b = self.buf(name)
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        if sig.ndim == 1: b[0, i:i + len(sig)] += sig * l; b[1, i:i + len(sig)] += sig * r
        else: b[0, i:i + sig.shape[1]] += sig[0] * l * 1.414; b[1, i:i + sig.shape[1]] += sig[1] * r * 1.414


rng = np.random.default_rng(7)


_TABLES = {}


def _saw_table(nh, size=4096):
    if nh not in _TABLES:
        ph = np.arange(size) / size * 2 * np.pi
        _TABLES[nh] = (sum(np.sin(ph * k) / k for k in range(1, nh + 1)) * 0.6).astype(np.float32)
    return _TABLES[nh]


def saw_add(f, n, nh=None, detune_cents=0.0, phase=0.0):
    """Dente di sega a banda limitata tramite tabella d'onda."""
    f = f * 2 ** (detune_cents / 1200)
    nh = nh or max(1, int(min(32, (SR * 0.45) / f)))
    tab = _saw_table(nh); size = len(tab)
    idx = (phase / (2 * np.pi) * size + np.arange(n) * (f * size / SR)) % size
    i0 = idx.astype(np.int64); fr = (idx - i0).astype(np.float32)
    return tab[i0] * (1 - fr) + tab[(i0 + 1) % size] * fr


# ------------------------------------------------------------------ strumenti
def pad(f, dur, bright=2500, attack=1.6, release=2.5):
    n = int((dur + release) * SR)
    L = saw_add(f, n, detune_cents=-7, phase=rng.random() * 6) + saw_add(f, n, detune_cents=5, phase=rng.random() * 6)
    R = saw_add(f, n, detune_cents=7, phase=rng.random() * 6) + saw_add(f, n, detune_cents=-4, phase=rng.random() * 6)
    e = env_adsr(n, attack, 0.5, 0.85, release)
    return np.stack([lp(L, bright) * e, lp(R, bright * 0.95) * e]) * 0.18


def epiano(f, dur, vel=0.8):
    n = int((dur + 1.2) * SR); t = np.arange(n) / SR
    idx = 1.8 * vel * np.exp(-t * 3.0)
    mod = np.sin(2 * np.pi * f * t) * idx
    car = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 5)
    e = np.exp(-t * 1.1) * env_adsr(n, 0.004, 0.1, 1.0, 0.25)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 4.5 * t)
    return (car * e * vel * 0.35).astype(np.float32), (car * e * trem * vel * 0.35).astype(np.float32)


def piano(f, dur, vel=0.8):
    n = int((dur + 2.5) * SR); t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32); B = 0.0004
    for k in range(1, 13):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > SR * 0.45: break
        out += (np.sin(2 * np.pi * fk * t) * np.exp(-t * (0.9 + 0.55 * k)) * (vel ** (0.5 + k * 0.08)) / k ** 0.9).astype(np.float32)
    ham = hp(rng.standard_normal(int(0.01 * SR)).astype(np.float32), 2000) * 0.02 * vel
    out[:len(ham)] += ham
    rel = env_adsr(n, 0.002, 0, 1, 0.4)
    damp = np.ones(n, dtype=np.float32); k0 = int(dur * SR)
    if k0 < n: damp[k0:] = np.exp(-(np.arange(n - k0) / SR) * 6)
    return out * rel * damp * 0.3


def pluck(f, dur=0.6, vel=0.8, bright=1.0):
    n = int((dur + 0.4) * SR); t = np.arange(n) / SR
    out = np.zeros(n, dtype=np.float32)
    for k in range(1, 20):
        if f * k > SR * 0.45: break
        out += (np.sin(2 * np.pi * f * k * t) * np.exp(-t * (4 + k * 2.2 / bright)) / k).astype(np.float32)
    return out * vel * 0.35


def bass(f, dur, vel=0.9):
    n = int((dur + 0.15) * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)
    s = np.tanh(s * 1.6) * env_adsr(n, 0.005, 0.2, 0.7, 0.12)
    return (lp(s, 900) * vel * 0.5).astype(np.float32)


def kick(vel=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 7.5) * vel * 0.9).astype(np.float32)


def clap(vel=0.7):
    n = int(0.3 * SR); t = np.arange(n) / SR
    no = rng.standard_normal(n).astype(np.float32)
    e = np.exp(-t * 22) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) * 20) * (t > 0.012)
    return bp(no, 900, 4500) * e * vel * 0.5


def hat(vel=0.4, open_=False):
    n = int((0.25 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n).astype(np.float32), 7000) * np.exp(-t * (12 if open_ else 60)) * vel * 0.35


def shaker(vel=0.3):
    n = int(0.09 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n).astype(np.float32), 4000, 12000) * np.sin(np.pi * t / t[-1]) * vel * 0.25


def timpani(f, vel=0.9):
    n = int(2.5 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.6) + 0.4 * np.sin(2 * np.pi * f * 1.5 * t) * np.exp(-t * 3)
    s += lp(rng.standard_normal(n), 300) * np.exp(-t * 20) * 0.6
    return (s * vel * 0.5).astype(np.float32)


def strings(f, dur, bright=1800):
    n = int((dur + 1.5) * SR); t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = sum(np.sin(ph * k) / k for k in range(1, 12))
    e = env_adsr(n, 0.9, 0.3, 0.9, 1.4)
    return (lp(s, bright) * e * 0.12).astype(np.float32)


# ------------------------------------------------------------------ mix
def reverb_ir(sec=2.6, seed=1):
    r = np.random.default_rng(seed); n = int(sec * SR); t = np.arange(n) / SR
    env = np.exp(-t * 6.9 / sec)
    L = lp(r.standard_normal(n), 6000) * env; R = lp(r.standard_normal(n), 6000) * env
    L[:int(0.012 * SR)] = 0; R[:int(0.017 * SR)] = 0
    return np.stack([L, R]).astype(np.float32) / np.sqrt(np.sum(L ** 2))


def master(tr, sends, fade_in=2.0, fade_out=4.0):
    mix = np.zeros((2, tr.n), dtype=np.float32); wet = np.zeros((2, tr.n), dtype=np.float32)
    for name, b in tr.bus.items():
        mix += b; wet += b * sends.get(name, 0.2)
    ir = reverb_ir()
    for c in range(2): mix[c] += fftconvolve(wet[c], ir[c])[:tr.n] * 0.9
    mix = hp(mix, 30)
    peak = np.max(np.abs(mix)) + 1e-9; mix = mix / peak
    rms = np.sqrt(np.mean(mix ** 2)); mix *= min(4.0, 0.16 / max(rms, 1e-6))
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi); mix[:, -fo:] *= np.linspace(1, 0, fo)
    return mix * (10 ** (-1.0 / 20)) / max(1e-9, np.max(np.abs(mix)))


# ------------------------------------------------------------------ composizioni
def song_ambient(sec, prog, base_oct=3, bright=1800, bells=True, seed=0):
    global rng; rng = np.random.default_rng(seed)
    tr = Track(sec); cd = 8.0; t = 0.0; i = 0
    while t < sec - 2:
        root, notes = chord(prog[i % len(prog)], base_oct)
        for m in notes: tr.add('pad', t, pad(mtof(m), cd + 1.5, bright), pan=rng.uniform(-.3, .3), gain=0.9)
        tr.add('bass', t, pad(mtof(root - 12), cd + 1, 500, attack=2.5), gain=1.2)
        if bells:
            for k in range(4):
                if rng.random() < 0.7:
                    m = notes[rng.integers(len(notes))] + 24
                    l, r = epiano(mtof(m), 1.5, 0.5); tr.add('bell', t + k * 2 + rng.uniform(0, .5), np.stack([l, r]), pan=rng.uniform(-.6, .6), gain=0.45)
        t += cd; i += 1
    return master(tr, {'pad': 0.45, 'bass': 0.1, 'bell': 0.7}, 4, 6)


def song_lounge(sec, prog, bpm=88, seed=0):
    global rng; rng = np.random.default_rng(seed)
    tr = Track(sec); beat = 60 / bpm; bar = 4 * beat; t = 0.0; i = 0
    while t < sec - 1:
        root, notes = chord(prog[i % len(prog)], 4)
        for hit, ln in ((0, 1.5), (1.5 * beat, 0.8), (2.5 * beat, 1.2)):
            for m in notes[1:]:
                l, r = epiano(mtof(m), ln * beat, 0.55 + rng.random() * 0.15); tr.add('keys', t + hit + rng.uniform(0, .012), np.stack([l, r]), pan=-0.15, gain=0.55)
        for b, ln, off in ((0, 1.5, 0), (1.5, 0.5, 7), (2, 1.0, 12), (3.5, 0.4, 10)):
            tr.add('bass', t + b * beat, bass(mtof(root - 12 + off if off != 7 else root - 12 + 7), ln * beat, 0.8), gain=0.9)
        for k in range(4):
            tr.add('drums', t + k * beat, kick(0.7 if k % 2 == 0 else 0.0), gain=0.8)
            if k % 2 == 1: tr.add('drums', t + k * beat, clap(0.35), pan=0.05)
            for s in range(2): tr.add('perc', t + k * beat + s * beat / 2 + (0.03 if s else 0), shaker(0.25 + 0.1 * s), pan=0.35)
        t += bar; i += 1
    return master(tr, {'keys': 0.35, 'bass': 0.05, 'drums': 0.08, 'perc': 0.15}, 1.5, 5)


def song_corporate(sec, prog, bpm=112, seed=0):
    global rng; rng = np.random.default_rng(seed)
    tr = Track(sec); beat = 60 / bpm; bar = 4 * beat; t = 0.0; i = 0; nbar = 0
    while t < sec - 1:
        root, notes = chord(prog[i % len(prog)], 4)
        intro = nbar < 4
        for m in notes: tr.add('pad', t, pad(mtof(m), bar, 2200, attack=0.4, release=0.8), gain=0.5)
        arp = [notes[0], notes[1], notes[2], notes[0] + 12, notes[2] + 12, notes[1] + 12, notes[2], notes[1]]
        for s in range(8):
            m = arp[s % len(arp)] + 12
            tr.add('pluck', t + s * beat / 2, pluck(mtof(m), 0.3, 0.6 + 0.2 * (s % 2 == 0), 1.4), pan=0.4 if s % 2 else -0.4, gain=0.7)
        if not intro:
            for k in range(4):
                tr.add('drums', t + k * beat, kick(0.95))
                if k % 2 == 1: tr.add('drums', t + k * beat, clap(0.5))
                tr.add('drums', t + k * beat + beat / 2, hat(0.35), pan=0.25)
            for s in range(8): tr.add('bass', t + s * beat / 2, bass(mtof(root - 12), beat / 2 * 0.8, 0.85))
        t += bar; i += 1; nbar += 1
    return master(tr, {'pad': 0.3, 'pluck': 0.3, 'drums': 0.06, 'bass': 0.0}, 1.0, 5)


def song_cinematic(sec, prog, bpm=70, seed=0):
    global rng; rng = np.random.default_rng(seed)
    tr = Track(sec); beat = 60 / bpm; bar = 4 * beat; t = 0.0; i = 0; nbar = 0
    while t < sec - 2:
        root, notes = chord(prog[i % len(prog)], 3)
        level = min(1.0, 0.35 + nbar * 0.06)
        for m in notes + [notes[0] + 12, notes[1] + 12]: tr.add('str', t, strings(mtof(m), bar + 0.2, 1200 + 1500 * level), pan=rng.uniform(-.5, .5), gain=0.9 * level + 0.3)
        tr.add('low', t, strings(mtof(root - 12), bar + 0.2, 500), gain=1.1)
        if nbar >= 4:
            tr.add('perc', t, timpani(mtof(root - 12 if root - 12 > 36 else root), 0.9 * level))
            tr.add('perc', t + 2.5 * beat, timpani(mtof(root - 12 if root - 12 > 36 else root), 0.5 * level))
        if nbar >= 8 and nbar % 2 == 0:
            for k, m in enumerate([notes[2] + 12, notes[1] + 12, notes[0] + 12, notes[2]]):
                tr.add('piano', t + k * beat, piano(mtof(m), beat * 1.5, 0.55), pan=0.2, gain=0.8)
        t += bar; i += 1; nbar += 1
    return master(tr, {'str': 0.55, 'low': 0.3, 'perc': 0.35, 'piano': 0.5}, 3, 7)


def song_piano(sec, prog, bpm=72, seed=0):
    global rng; rng = np.random.default_rng(seed)
    tr = Track(sec); beat = 60 / bpm; bar = 4 * beat; t = 0.0; i = 0
    while t < sec - 2:
        root, notes = chord(prog[i % len(prog)], 3)
        tr.add('pianoL', t, piano(mtof(root), bar, 0.6), pan=-0.2)
        tr.add('pianoL', t + 2 * beat, piano(mtof(root + 7), bar / 2, 0.45), pan=-0.2)
        pat = [notes[1] + 12, notes[2] + 12, notes[0] + 24, notes[2] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24, notes[1] + 24]
        for s, m in enumerate(pat):
            tr.add('pianoR', t + s * beat / 2 + rng.uniform(0, 0.015), piano(mtof(m), beat * 0.9, 0.35 + 0.15 * (s % 4 == 0)), pan=0.2)
        t += bar; i += 1
    return master(tr, {'pianoL': 0.35, 'pianoR': 0.4}, 1.5, 6)


def song_acoustic(sec, prog, bpm=96, seed=0):
    global rng; rng = np.random.default_rng(seed)
    tr = Track(sec); beat = 60 / bpm; bar = 4 * beat; t = 0.0; i = 0
    strum = [0, 1, 1.5, 2.5, 3, 3.5]
    while t < sec - 1:
        root, notes = chord(prog[i % len(prog)], 3)
        voicing = [root, notes[1] + 12, notes[2] + 12, root + 12, notes[1] + 24]
        for s in strum:
            down = s in (0, 1, 2.5, 3)
            for k, m in enumerate(voicing if down else voicing[::-1]):
                tr.add('gtr', t + s * beat + k * 0.012, pluck(mtof(m), 0.5, 0.45 if down else 0.3, 2.2), pan=-0.3 + 0.15 * k, gain=0.6)
        tr.add('bass', t, bass(mtof(root - 12), beat * 1.8, 0.7)); tr.add('bass', t + 2 * beat, bass(mtof(root - 12 + 7), beat * 1.8, 0.6))
        for k in range(4):
            tr.add('perc', t + k * beat, kick(0.45 if k % 2 == 0 else 0))
            for s in range(2): tr.add('perc', t + k * beat + s * beat / 2, shaker(0.3), pan=0.4)
        t += bar; i += 1
    return master(tr, {'gtr': 0.35, 'bass': 0.05, 'perc': 0.12}, 1.0, 5)


CATALOG = [
    ('Ambient', 'Alba sul porto', lambda s: song_ambient(s, ['Dmaj7', 'Bm9', 'Gmaj9', 'Asus4'], seed=11)),
    ('Ambient', 'Mare calmo', lambda s: song_ambient(s, ['Ebmaj9', 'Cm9', 'Abmaj7', 'Bbsus2'], 3, 1500, seed=12)),
    ('Lounge', 'Terrazza al tramonto', lambda s: song_lounge(s, ['Gm9', 'C13', 'Fmaj9', 'Dm9'], 86, seed=21)),
    ('Lounge', 'Notturno urbano', lambda s: song_lounge(s, ['Am9', 'Dm9', 'Gmaj7', 'Cmaj9'], 92, seed=22)),
    ('Corporate', 'Avanti tutta', lambda s: song_corporate(s, ['C', 'G', 'Amin', 'F'], 112, seed=31)),
    ('Corporate', 'Nuove idee', lambda s: song_corporate(s, ['D', 'Bmin', 'G', 'A'], 118, seed=32)),
    ('Cinematico', 'Orizzonte', lambda s: song_cinematic(s, ['Amin', 'F', 'C', 'G'], 70, seed=41)),
    ('Pianoforte', 'Riflessi', lambda s: song_piano(s, ['Emin', 'C', 'G', 'D'], 72, seed=51)),
    ('Acustico', 'Strada di campagna', lambda s: song_acoustic(s, ['G', 'D', 'Emin', 'C'], 96, seed=61)),
]


def write_mp3(path, audio):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(audio.T, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '192k',
                    '-metadata', f'title={os.path.splitext(os.path.basename(path))[0]}', '-metadata', 'artist=InRegia', '-metadata', 'album=InRegia - musica predefinita', path],
                   input=pcm, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'out'))
    ap.add_argument('--zip', default=None)
    ap.add_argument('--seconds', type=float, default=150)
    ap.add_argument('--only', default=None)
    a = ap.parse_args()
    files = []
    for cat, title, fn in CATALOG:
        if a.only and a.only.lower() not in title.lower(): continue
        audio = fn(a.seconds)
        p = os.path.join(a.out, cat, title + '.mp3'); write_mp3(p, audio); files.append((p, os.path.join(cat, title + '.mp3')))
        print('ok', cat, title, f'{os.path.getsize(p) / 1e6:.1f} MB')
    if a.zip:
        with zipfile.ZipFile(a.zip, 'w', zipfile.ZIP_STORED) as z:
            for p, arc in files: z.write(p, arc)
            z.writestr('LEGGIMI.txt', 'Musica di sottofondo predefinita di InRegia.\r\nBrani originali generati dal codice in tools/music/generate.py, rilasciati con licenza CC0 (pubblico dominio).\r\n')
        print('zip', a.zip)


if __name__ == '__main__':
    main()
