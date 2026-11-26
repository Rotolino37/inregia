"""InRegia - generatore della musica di sottofondo predefinita.

Compone e sintetizza brani originali (nessun campione esterno, nessun diritto di terzi), licenza CC0.
Sette generi, ognuno di almeno un'ora: ogni brano ha tonalità, tempo, giro armonico e struttura propri.
Uscita: <out>/<Genere>/<Titolo>.opus (Opus 64 kbps, circa 0,5 MB al minuto) e uno zip per genere.

Uso:  python generate.py --out out --zipdir dist [--minutes 62] [--jobs 4] [--genres lofi,ambient] [--seconds 20]
      --seconds forza la durata di ogni brano (prove rapide).
Richiede numpy, scipy e ffmpeg con libopus nel PATH.
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


def chord(name, octave=4, tr=0):
    root = name[:2] if len(name) > 1 and name[1] in '#b' else name[:1]
    q = name[len(root):] or 'maj'
    base = 12 * (octave + 1) + NOTE[root] + tr
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


def snare(vel=0.6, tone=190):
    n = int(0.28 * SR); t = np.arange(n) / SR
    no = bp(rng.standard_normal(n).astype(np.float32), 1200, 7000) * np.exp(-t * 18)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 25)
    return ((no * 0.8 + body * 0.5) * vel * 0.45).astype(np.float32)


def vinyl(n, amount=1.0):
    """Fruscio e crepitio da vinile, stereo."""
    out = np.zeros((2, n), dtype=np.float32)
    for c in range(2):
        hiss = lp(hp(rng.standard_normal(n).astype(np.float32), 2500), 9000) * 0.012
        pops = np.zeros(n, dtype=np.float32)
        k = rng.integers(0, n, int(n / SR * 9))
        pops[k] = rng.uniform(-1, 1, len(k)) * rng.uniform(0.05, 0.3, len(k))
        pops = lp(hp(pops, 1500), 6000)
        out[c] = (hiss + pops * 0.6) * amount
    return out


def master(tr, sends, fade_in=2.0, fade_out=4.0, warm=None, vinyl_amt=0.0):
    mix = np.zeros((2, tr.n), dtype=np.float32); wet = np.zeros((2, tr.n), dtype=np.float32)
    for name, b in tr.bus.items():
        mix += b; wet += b * sends.get(name, 0.2)
    ir = reverb_ir()
    for c in range(2): mix[c] += fftconvolve(wet[c], ir[c])[:tr.n] * 0.9
    mix = hp(mix, 30)
    if warm: mix = np.tanh(lp(mix, warm, 2) * 1.4) / np.tanh(1.4)
    if vinyl_amt: mix = mix / (np.max(np.abs(mix)) + 1e-9) + vinyl(tr.n, vinyl_amt) * 0.6
    peak = np.max(np.abs(mix)) + 1e-9; mix = mix / peak
    rms = np.sqrt(np.mean(mix ** 2)); mix *= min(4.0, 0.16 / max(rms, 1e-6))
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    fi, fo = int(fade_in * SR), int(fade_out * SR)
    mix[:, :fi] *= np.linspace(0, 1, fi); mix[:, -fo:] *= np.linspace(1, 0, fo)
    return mix * (10 ** (-1.5 / 20)) / max(1e-9, np.max(np.abs(mix)))


# ------------------------------------------------------------------ forma
SECTIONS = {  # battute, giro, batteria, solista, intensità
    'intro': (4, 'A', False, False, 0.55), 'A': (8, 'A', True, False, 0.85), 'B': (8, 'B', True, True, 1.0),
    'break': (4, 'A', False, True, 0.65), 'outro': (4, 'A', False, False, 0.55),
}


def form(nbars, r):
    """Struttura del brano, una voce per battuta: intro, poi A B A pausa B A..., finale."""
    body = ['A', 'B', 'A', 'break'] if r.random() < 0.5 else ['A', 'A', 'B', 'break', 'B']
    seq = ['intro']; k = 0
    while sum(SECTIONS[x][0] for x in seq) < nbars - 4:
        seq.append(body[k % len(body)]); k += 1
    seq.append('outro')
    bars = []
    for name in seq:
        n, prog, drums, lead, lvl = SECTIONS[name]
        for b in range(n): bars.append({'sec': name, 'prog': prog, 'drums': drums, 'lead': lead, 'lvl': lvl, 'first': b == 0, 'i': b})
    return bars[:nbars] if len(bars) >= nbars else bars + [dict(bars[-1])] * (nbars - len(bars))


class Song:
    def __init__(self, sec, P, bar_sec):
        global rng
        rng = np.random.default_rng(P['seed'])
        self.r = rng; self.P = P; self.tr = Track(sec); self.bar = bar_sec
        self.bars = form(max(4, int((sec - 2) // bar_sec)), self.r)

    def chord(self, k, octave):
        b = self.bars[k]; prog = self.P['A'] if b['prog'] == 'A' else self.P['B']
        idx = (k if b['prog'] == 'A' else b['i']) % len(prog)
        return chord(prog[idx], octave, self.P['tr'])

    def each(self):
        for k, b in enumerate(self.bars): yield k, k * self.bar, b


# ------------------------------------------------------------------ generi
def song_ambient(sec, P):
    S = Song(sec, P, 8.0); tr = S.tr
    for k, t, b in S.each():
        if t > sec - 2: break
        root, notes = S.chord(k, P.get('oct', 3))
        for m in notes: tr.add('pad', t, pad(mtof(m), S.bar + 1.5, P['bright'] * (0.7 + 0.3 * b['lvl'])), pan=S.r.uniform(-.35, .35), gain=0.9)
        tr.add('bass', t, pad(mtof(root - 12), S.bar + 1, 500, attack=2.5), gain=1.2 * (0.6 + 0.4 * b['lvl']))
        if P['bells'] and b['sec'] != 'intro':
            for q in range(4):
                if S.r.random() < (0.75 if b['lead'] else 0.45):
                    m = notes[S.r.integers(len(notes))] + 24
                    l, r_ = epiano(mtof(m), 1.5, 0.45); tr.add('bell', t + q * 2 + S.r.uniform(0, .5), np.stack([l, r_]), pan=S.r.uniform(-.6, .6), gain=0.45)
    return master(tr, {'pad': 0.45, 'bass': 0.1, 'bell': 0.7}, 4, 6)


def song_lounge(sec, P):
    beat = 60 / P['bpm']; S = Song(sec, P, 4 * beat); tr = S.tr
    for k, t, b in S.each():
        root, notes = S.chord(k, 4)
        for hit, ln in ((0, 1.5), (1.5 * beat, 0.8), (2.5 * beat, 1.2)):
            for m in notes[1:]:
                l, r_ = epiano(mtof(m), ln * beat, (0.5 + S.r.random() * 0.15) * (0.75 + 0.25 * b['lvl'])); tr.add('keys', t + hit + S.r.uniform(0, .012), np.stack([l, r_]), pan=-0.15, gain=0.55)
        if b['sec'] != 'intro':
            for bb, ln, off in ((0, 1.5, 0), (1.5, 0.5, 7), (2, 1.0, 12), (3.5, 0.4, 10)):
                tr.add('bass', t + bb * beat, bass(mtof(root - 12 + off), ln * beat, 0.8), gain=0.9)
        if b['drums']:
            for q in range(4):
                if q % 2 == 0: tr.add('drums', t + q * beat, kick(0.7), gain=0.8)
                else: tr.add('drums', t + q * beat, clap(0.35), pan=0.05)
                for s in range(2): tr.add('perc', t + q * beat + s * beat / 2 + (0.03 if s else 0), shaker(0.25 + 0.1 * s), pan=0.35)
        if b['lead']:
            for q in range(0, 8, 2 if S.r.random() < 0.5 else 3):
                if S.r.random() < 0.6:
                    m = notes[S.r.integers(1, len(notes))] + 12
                    tr.add('lead', t + q * beat / 2, pluck(mtof(m), 0.5, 0.45, 1.6), pan=0.3, gain=0.6)
    return master(tr, {'keys': 0.35, 'bass': 0.05, 'drums': 0.08, 'perc': 0.15, 'lead': 0.4}, 1.5, 5)


def song_corporate(sec, P):
    beat = 60 / P['bpm']; S = Song(sec, P, 4 * beat); tr = S.tr
    for k, t, b in S.each():
        root, notes = S.chord(k, 4)
        for m in notes: tr.add('pad', t, pad(mtof(m), S.bar, 2200, attack=0.4, release=0.8), gain=0.5)
        arp = [notes[0], notes[1], notes[2], notes[0] + 12, notes[2] + 12, notes[1] + 12, notes[2], notes[1]]
        if P['arp'] == 'up': arp = sorted(arp)
        for s in range(8):
            m = arp[s % len(arp)] + 12
            tr.add('pluck', t + s * beat / 2, pluck(mtof(m), 0.3, (0.6 + 0.2 * (s % 2 == 0)) * (0.7 + 0.3 * b['lvl']), 1.4), pan=0.4 if s % 2 else -0.4, gain=0.7)
        if b['drums']:
            for q in range(4):
                tr.add('drums', t + q * beat, kick(0.95))
                if q % 2 == 1: tr.add('drums', t + q * beat, clap(0.5))
                tr.add('drums', t + q * beat + beat / 2, hat(0.35), pan=0.25)
            for s in range(8): tr.add('bass', t + s * beat / 2, bass(mtof(root - 12), beat / 2 * 0.8, 0.85))
        if b['lead'] and b['i'] % 2 == 0:
            tr.add('lead', t, strings(mtof(notes[2] + 12), S.bar * 2, 2600), pan=-0.1, gain=0.7)
    return master(tr, {'pad': 0.3, 'pluck': 0.3, 'drums': 0.06, 'bass': 0.0, 'lead': 0.4}, 1.0, 5)


def song_cinematic(sec, P):
    beat = 60 / P['bpm']; S = Song(sec, P, 4 * beat); tr = S.tr; n = len(S.bars)
    for k, t, b in S.each():
        if t > sec - 2: break
        root, notes = S.chord(k, 3)
        level = min(1.0, 0.35 + k / max(1, n) * 1.1) * b['lvl']
        for m in notes + [notes[0] + 12, notes[1] + 12]: tr.add('str', t, strings(mtof(m), S.bar + 0.2, 1200 + 1500 * level), pan=S.r.uniform(-.5, .5), gain=0.9 * level + 0.3)
        tr.add('low', t, strings(mtof(root - 12), S.bar + 0.2, 500), gain=1.1)
        if b['drums']:
            f0 = mtof(root - 12 if root - 12 > 36 else root)
            tr.add('perc', t, timpani(f0, 0.9 * level)); tr.add('perc', t + 2.5 * beat, timpani(f0, 0.5 * level))
        if b['lead'] and b['i'] % 2 == 0:
            for q, m in enumerate([notes[2] + 12, notes[1] + 12, notes[0] + 12, notes[2]]):
                tr.add('piano', t + q * beat, piano(mtof(m), beat * 1.5, 0.55), pan=0.2, gain=0.8)
    return master(tr, {'str': 0.55, 'low': 0.3, 'perc': 0.35, 'piano': 0.5}, 3, 7)


def song_piano(sec, P):
    beat = 60 / P['bpm']; S = Song(sec, P, 4 * beat); tr = S.tr
    pats = [[1, 2, 3, 2, 1, 2, 3, 4], [1, 3, 2, 3, 4, 3, 2, 3], [3, 2, 1, 2, 3, 4, 3, 2]]
    for k, t, b in S.each():
        if t > sec - 2: break
        root, notes = S.chord(k, 3)
        up = [notes[1] + 12, notes[2] + 12, notes[0] + 24, notes[1] + 24, notes[2] + 24]
        tr.add('pianoL', t, piano(mtof(root), S.bar, 0.6 * (0.8 + 0.2 * b['lvl'])), pan=-0.2)
        if b['sec'] != 'intro': tr.add('pianoL', t + 2 * beat, piano(mtof(root + 7), S.bar / 2, 0.45), pan=-0.2)
        pat = pats[P['pat']] if b['sec'] in ('A', 'intro', 'outro') else pats[(P['pat'] + 1) % 3]
        for s, ix in enumerate(pat):
            if b['sec'] == 'intro' and s % 2: continue
            tr.add('pianoR', t + s * beat / 2 + S.r.uniform(0, 0.015), piano(mtof(up[ix]), beat * 0.9, (0.33 + 0.15 * (s % 4 == 0)) * (0.8 + 0.2 * b['lvl'])), pan=0.2)
        if b['lead'] and S.r.random() < 0.7:
            tr.add('pianoR', t + 3 * beat, piano(mtof(up[-1] + 12), beat * 1.5, 0.3), pan=0.3)
    return master(tr, {'pianoL': 0.35, 'pianoR': 0.4}, 1.5, 6)


def song_acoustic(sec, P):
    beat = 60 / P['bpm']; S = Song(sec, P, 4 * beat); tr = S.tr
    strum = [0, 1, 1.5, 2.5, 3, 3.5] if P['strum'] == 0 else [0, 0.5, 1.5, 2, 2.5, 3.5]
    for k, t, b in S.each():
        root, notes = S.chord(k, 3)
        voicing = [root, notes[1] + 12, notes[2] + 12, root + 12, notes[1] + 24]
        hits = strum if b['sec'] not in ('intro', 'outro') else [0, 2]
        for s in hits:
            down = int(s * 2) % 2 == 0
            for q, m in enumerate(voicing if down else voicing[::-1]):
                tr.add('gtr', t + s * beat + q * 0.012, pluck(mtof(m), 0.5, (0.45 if down else 0.3) * (0.8 + 0.2 * b['lvl']), 2.2), pan=-0.3 + 0.15 * q, gain=0.6)
        tr.add('bass', t, bass(mtof(root - 12), beat * 1.8, 0.7)); tr.add('bass', t + 2 * beat, bass(mtof(root - 12 + 7), beat * 1.8, 0.6))
        if b['drums']:
            for q in range(4):
                if q % 2 == 0: tr.add('perc', t + q * beat, kick(0.45))
                for s in range(2): tr.add('perc', t + q * beat + s * beat / 2, shaker(0.3), pan=0.4)
        if b['lead']:
            for q in range(4):
                if S.r.random() < 0.55:
                    tr.add('lead', t + q * beat + beat / 2 * S.r.integers(0, 2), pluck(mtof(notes[S.r.integers(0, len(notes))] + 24), 0.7, 0.35, 3.0), pan=0.45, gain=0.55)
    return master(tr, {'gtr': 0.35, 'bass': 0.05, 'perc': 0.12, 'lead': 0.45}, 1.0, 5)


def song_lofi(sec, P):
    beat = 60 / P['bpm']; S = Song(sec, P, 4 * beat); tr = S.tr; sw = beat * P['swing']
    penta = [0, 3, 5, 7, 10]
    for k, t, b in S.each():
        root, notes = S.chord(k, 3)
        vo = [notes[1] + 12, notes[2] + 12] + [x + 12 for x in notes[3:]] + [root + 12]
        for hit in ((0, 2.2), (2.5, 1.4)) if P['comp'] == 0 else ((0, 1.4), (1.5, 0.8), (3, 0.9)):
            for q, m in enumerate(vo):
                l, r_ = epiano(mtof(m), hit[1] * beat, 0.42 + S.r.random() * 0.08); tr.add('keys', t + hit[0] * beat + q * 0.009 + S.r.uniform(0, .01), np.stack([l, r_]), pan=-0.1, gain=0.6)
        if b['sec'] != 'intro':
            tr.add('bass', t, bass(mtof(root - 12), beat * 1.6, 0.75), gain=1.0)
            tr.add('bass', t + 2.5 * beat, bass(mtof(root - 12 + (7 if S.r.random() < 0.5 else 12)), beat * 1.2, 0.6), gain=1.0)
        if b['drums']:
            for q in range(4):
                if q == 0 or (q == 2 and P['kick2']): tr.add('drums', t + q * beat, kick(0.8), gain=0.75)
                if q == 2 and not P['kick2']: tr.add('drums', t + q * beat + sw, kick(0.55), gain=0.75)
                if q % 2 == 1: tr.add('drums', t + q * beat, snare(0.55), pan=0.05)
                for s in range(2):
                    if S.r.random() < 0.92: tr.add('hat', t + q * beat + (beat / 2 + sw if s else 0), hat(0.22 + 0.12 * (s == 0) + S.r.uniform(0, .06)), pan=0.3)
        if b['lead']:
            for q in range(8):
                if S.r.random() < 0.35:
                    m = 12 * 6 + ((root % 12) + penta[S.r.integers(0, 5)])
                    tr.add('lead', t + q * beat / 2 + (sw if q % 2 else 0), pluck(mtof(m), 0.6, 0.35, 1.2), pan=0.35, gain=0.55)
    return master(tr, {'keys': 0.4, 'bass': 0.04, 'drums': 0.07, 'hat': 0.1, 'lead': 0.5}, 2.0, 5, warm=P['warm'], vinyl_amt=1.0)


# ------------------------------------------------------------------ catalogo
PROG = {
    'ambient': [['Dmaj7', 'Bm9', 'Gmaj9', 'Asus4'], ['Ebmaj9', 'Cm9', 'Abmaj7', 'Bbsus2'], ['Cmaj9', 'Am9', 'Fmaj9', 'Gsus2'], ['Fmaj7', 'Dm9', 'Bbmaj9', 'Csus4'],
                ['Am9', 'Fmaj9', 'Cmaj9', 'Gadd9'], ['Gmaj9', 'Em9', 'Cmaj9', 'Dsus2'], ['Em9', 'Cmaj9', 'Am9', 'Bsus4']],
    'lounge': [['Gm9', 'C13', 'Fmaj9', 'Dm9'], ['Am9', 'Dm9', 'Gmaj7', 'Cmaj9'], ['Dm9', 'G13', 'Cmaj9', 'Am9'], ['Fmaj9', 'Em7', 'Dm9', 'Cmaj9'],
               ['Cm9', 'F13', 'Bbmaj9', 'Gm9'], ['Em9', 'A13', 'Dmaj9', 'Bm9'], ['Bbmaj9', 'Am7', 'Gm9', 'C13']],
    'corporate': [['C', 'G', 'Amin', 'F'], ['D', 'Bmin', 'G', 'A'], ['F', 'C', 'Dmin', 'Bb'], ['G', 'Emin', 'C', 'D'], ['Amin', 'F', 'C', 'G'],
                  ['C', 'Amin', 'F', 'G'], ['E', 'C#min', 'A', 'B'], ['Bb', 'F', 'Gmin', 'Eb']],
    'cinematico': [['Amin', 'F', 'C', 'G'], ['Dmin', 'Bb', 'F', 'C'], ['Emin', 'C', 'G', 'D'], ['Cmin', 'Ab', 'Eb', 'Bb'], ['Amin', 'Emin', 'F', 'G'],
                   ['Dmin', 'Amin', 'Bb', 'C'], ['Gmin', 'Eb', 'Bb', 'F']],
    'pianoforte': [['Emin', 'C', 'G', 'D'], ['C', 'Amin', 'F', 'G'], ['Amin', 'F', 'C', 'G'], ['D', 'Bmin', 'G', 'A'], ['F', 'Dmin', 'Bb', 'C'],
                   ['G', 'D', 'Emin', 'C'], ['Dmin', 'Bb', 'F', 'C'], ['Bb', 'Gmin', 'Eb', 'F']],
    'acustico': [['G', 'D', 'Emin', 'C'], ['C', 'G', 'Amin', 'F'], ['D', 'A', 'Bmin', 'G'], ['A', 'E', 'F#min', 'D'], ['E', 'B', 'C#min', 'A'],
                 ['G', 'C', 'D', 'C'], ['C', 'F', 'Amin', 'G'], ['D', 'G', 'Bmin', 'A']],
    'lofi': [['Dm9', 'G13', 'Cmaj9', 'Am9'], ['Fmaj9', 'Em7', 'Am9', 'Dm9'], ['Cmaj9', 'Am9', 'Dm9', 'G13'], ['Ebmaj9', 'Dm7', 'Cm9', 'F13'],
             ['Am9', 'Dm9', 'Gmaj9', 'Cmaj9'], ['Bbmaj9', 'Am7', 'Dm9', 'Gm9'], ['Em9', 'A13', 'Dmaj9', 'Bm9'], ['Gm9', 'C13', 'Fmaj9', 'Dm9']],
}
# cartella, slug, funzione, generatore dei parametri, parole per i titoli
NOUNS = {
    'ambient': ['Luce', 'Onde', 'Nebbia', 'Cielo', 'Respiro', 'Riva', 'Vento', 'Silenzio', 'Brezza', 'Marea', 'Quiete', 'Aurora', 'Riflessi', 'Nuvole', 'Correnti', 'Spazio', 'Bonaccia', 'Rugiada', 'Distese', 'Altura', 'Faro', 'Sospiro'],
    'lounge': ['Terrazza', 'Aperitivo', 'Velluto', 'Notturno', 'Lanterne', 'Riviera', 'Cocktail', 'Salotto', 'Passeggiata', 'Tramonto', 'Jazz', 'Ombre', 'Boulevard', 'Vetrine', 'Caffè', 'Luci', 'Seta', 'Lungomare', 'Ombrellone', 'Mezzanotte', 'Bossa', 'Ritrovo'],
    'corporate': ['Avanti tutta', 'Nuove idee', 'Slancio', 'Traguardi', 'Visione', 'Progetto', 'Energia', 'Squadra', 'Ritmo', 'Partenza', 'Strategia', 'Crescita', 'Impulso', 'Orizzonti', 'Rotta', 'Passo', 'Obiettivo', 'Sinergia', 'Scatto', 'Primo piano', 'Direzione', 'Sprint'],
    'cinematico': ['Orizzonte', 'Leggenda', 'Ritorno', 'Ascesa', 'Viaggio', 'Promessa', 'Memorie', 'Confini', 'Vela', 'Tempesta', 'Approdo', 'Fiducia', 'Rinascita', 'Sentiero', 'Coraggio', 'Eco', 'Sinfonia', 'Vette', 'Epilogo', 'Destino', 'Varco', 'Frontiera'],
    'pianoforte': ['Riflessi', 'Pagine', 'Lettera', 'Ricordi', 'Stanze', 'Pioggia', 'Ritratto', 'Carezza', 'Notturno', 'Valzer', 'Finestre', 'Pensieri', 'Gocce', 'Ninnananna', 'Preludio', 'Attesa', 'Sospeso', 'Intermezzo', 'Brina', 'Specchio', 'Diario', 'Crepuscolo'],
    'acustico': ['Strada di campagna', 'Corde', 'Falò', 'Sentieri', 'Fienile', 'Colline', 'Ritorno a casa', 'Vendemmia', 'Mattino', 'Ponte', 'Giardino', 'Bicicletta', 'Fontana', 'Campi', 'Radici', 'Viottolo', 'Staccionata', 'Ruscello', 'Fieno', 'Sagra', 'Cortile', 'Lanterna'],
    'lofi': ['Tazza calda', 'Quaderni', 'Pomeriggio', 'Finestra', 'Cuffie', 'Polvere', 'Libreria', 'Tram', 'Pioggia', 'Gatto', 'Lampada', 'Vinile', 'Scrivania', 'Tetti', 'Nastro', 'Divano', 'Taccuino', 'Pennarelli', 'Autobus', 'Tisana', 'Persiane', 'Biscotti'],
}
PLACES = ['all\'alba', 'sul lago', 'd\'inverno', 'di vetro', 'di sale', 'tra le nuvole', 'oltre il molo', 'di settembre', 'nel blu', 'a mezzanotte', 'sul porto',
          'di marzo', 'in città', 'al tramonto', 'di carta', 'sotto la pioggia', 'in collina', 'di domenica', 'a occhi chiusi', 'sul fiume']

GENRES = [
    ('Ambient', 'ambient', song_ambient, lambda r: {'bright': float(r.uniform(1300, 2300)), 'bells': bool(r.random() < 0.8), 'oct': int(r.choice([3, 3, 4]))}),
    ('Lounge', 'lounge', song_lounge, lambda r: {'bpm': int(r.integers(82, 100))}),
    ('Corporate', 'corporate', song_corporate, lambda r: {'bpm': int(r.integers(104, 124)), 'arp': str(r.choice(['wave', 'up']))}),
    ('Cinematico', 'cinematico', song_cinematic, lambda r: {'bpm': int(r.integers(62, 80))}),
    ('Pianoforte', 'pianoforte', song_piano, lambda r: {'bpm': int(r.integers(64, 84)), 'pat': int(r.integers(0, 3))}),
    ('Acustico', 'acustico', song_acoustic, lambda r: {'bpm': int(r.integers(88, 108)), 'strum': int(r.integers(0, 2))}),
    ('Lofi Chill', 'lofi', song_lofi, lambda r: {'bpm': int(r.integers(70, 88)), 'swing': float(r.uniform(0.06, 0.14)), 'comp': int(r.integers(0, 2)),
                                                  'kick2': bool(r.random() < 0.5), 'warm': float(r.uniform(3200, 5200))}),
]


def plan(slug, minutes, seconds=None):
    """Elenco deterministico dei brani di un genere: titolo, durata e parametri."""
    folder, _, fn, mk = next(g for g in GENRES if g[1] == slug)
    r = np.random.default_rng(sum(map(ord, slug)) * 7919)
    nouns = list(NOUNS[slug]); r.shuffle(nouns); places = list(PLACES); r.shuffle(places)
    pool = PROG[slug]; out = []; total = 0; k = 0
    while total < minutes * 60:
        dur = float(seconds) if seconds else float(r.uniform(180, 255))
        a = int(r.integers(len(pool))); b = (a + 1 + int(r.integers(len(pool) - 1))) % len(pool)
        title = nouns[k % len(nouns)] + ('' if k < len(nouns) else ' ' + places[(k - len(nouns)) % len(places)])
        P = dict(mk(r), A=pool[a], B=pool[b], tr=int(r.integers(-4, 5)), seed=int(r.integers(1, 2 ** 31)))
        out.append({'genre': folder, 'slug': slug, 'title': title, 'seconds': dur, 'P': P, 'n': k + 1})
        total += dur; k += 1
        if seconds and k >= max(1, int(minutes * 60 // seconds)): break
    return out


def render(job):
    folder, _, fn, _ = next(g for g in GENRES if g[1] == job['slug'])
    audio = fn(job['seconds'], job['P'])
    p = os.path.join(job['out'], folder, f"{job['n']:02d} {job['title']}.{job['fmt']}")
    encode(p, audio, job['fmt'], job['bitrate'], job['genre'])
    return p, os.path.relpath(p, job['out']), job['seconds']


def encode(path, audio, fmt, bitrate, genre):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(audio.T, -1, 1) * 32767).astype('<i2').tobytes()
    codec = ['-c:a', 'libopus', '-b:a', bitrate, '-vbr', 'on', '-compression_level', '10', '-application', 'audio', '-ar', '48000'] if fmt == 'opus' \
        else ['-c:a', 'libmp3lame', '-b:a', bitrate]
    title = os.path.splitext(os.path.basename(path))[0].split(' ', 1)[1]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-'] + codec +
                   ['-metadata', f'title={title}', '-metadata', 'artist=InRegia', '-metadata', f'album=InRegia - {genre}', '-metadata', f'genre={genre}', path],
                   input=pcm, check=True)


README = ('Musica di sottofondo predefinita di InRegia, genere {g}.\r\n'
          'Brani originali generati dal codice in tools/music/generate.py, rilasciati con licenza CC0 (pubblico dominio).\r\n'
          'Formato Opus {b}: si apre con InRegia, VLC, browser e la maggior parte dei lettori moderni.\r\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'out'))
    ap.add_argument('--zipdir', default=None)
    ap.add_argument('--minutes', type=float, default=62)
    ap.add_argument('--seconds', type=float, default=None)
    ap.add_argument('--genres', default=','.join(g[1] for g in GENRES))
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--format', default='opus', choices=['opus', 'mp3'])
    ap.add_argument('--bitrate', default='64k')
    a = ap.parse_args()
    slugs = [s.strip() for s in a.genres.split(',') if s.strip()]
    jobs = []
    for s in slugs:
        for j in plan(s, a.minutes, a.seconds): jobs.append(dict(j, out=a.out, fmt=a.format, bitrate=a.bitrate))
    jobs.sort(key=lambda j: -j['seconds'])
    print(f'{len(jobs)} brani, {sum(j["seconds"] for j in jobs) / 60:.0f} minuti, {a.jobs} processi', flush=True)
    import multiprocessing as mp
    done = {}
    with mp.get_context('fork').Pool(a.jobs) as pool:
        for p, arc, sec in pool.imap_unordered(render, jobs):
            done.setdefault(arc.split(os.sep)[0], []).append((p, arc, sec))
            print('ok', arc, f'{os.path.getsize(p) / 1e6:.1f} MB', flush=True)
    for folder, slug, *_ in GENRES:
        if folder not in done: continue
        files = sorted(done[folder], key=lambda x: x[1])
        mins = sum(x[2] for x in files) / 60; mb = sum(os.path.getsize(x[0]) for x in files) / 1e6
        print(f'{folder}: {len(files)} brani, {mins:.1f} minuti, {mb:.1f} MB')
        if a.zipdir:
            os.makedirs(a.zipdir, exist_ok=True)
            z = os.path.join(a.zipdir, f'InRegia-music-{slug}.zip')
            with zipfile.ZipFile(z, 'w', zipfile.ZIP_STORED) as zf:
                for p, arc, _ in files: zf.write(p, arc.replace(os.sep, '/'))
                zf.writestr(f'{folder}/LEGGIMI.txt', README.format(g=folder, b=a.bitrate))
            print('zip', z)


if __name__ == '__main__':
    main()
