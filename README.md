# InRegia

InRegia turns a PC and a projector into a control room for live presentations: a presenter view for you, a clean and lockable screen for the audience, and an audio mixer with background music.

## Install

1. Download `InRegia-Setup-<version>.exe` from [Releases](https://github.com/Rotolino37/inregia/releases).
2. Choose the folder (default `C:\Program Files\InRegia`) and the components: the LibreOffice conversion engine and the seven genres of default background music are selected by default.
3. The installer downloads everything, creates the desktop and Start menu shortcuts, and registers the uninstaller in Windows Settings > Apps.

Offline install: put `InRegia-app-win-x64.zip`, the `InRegia-music-<genre>.zip` packages and a `LibreOffice_*_Win_x86-64.msi` next to the installer; they are used instead of downloading.

Updates: if you agree (InRegia asks once), the library checks for new versions at startup, never during a presentation. One button downloads the new installer, verifies its SHA-256, updates InRegia and reopens it. The bundled LibreOffice is checked against the latest stable release and updated with one button too.

## What it does

**Imports any PowerPoint**
- Drag .pptx files onto the library, or pick them from your computer. Each file is converted once; after that it works offline.
- Slides, transitions, morph, click animations (including text by paragraph, motion paths and emphasis effects), embedded video and audio, speaker notes and hidden slides are kept. See [PowerPoint compatibility](#powerpoint-compatibility).
- Detects when the original file has changed and offers to update it.

**Two screens, two roles**
- Projector: the presentation only, with no bars, cursor or controls.
- Presenter: current and next slide, animation progress, notes, timer, clickable thumbnails, live video preview.
- Lock: blocks any action on the projector screen (mouse, keyboard, closing).
- The projector never opens on its own: press Proietta (F5), confirm the screen (a large number appears on each one) and it opens full screen, always on top. Esc turns it off and leaves you on the presenter.
- Black or white screen and laser pointer controlled from the presenter.

**Video under control**
- No video starts on its own and no slide advances on its own.
- Play, pause, stop, ±10 seconds and seek bar on the presenter side only.
- Warning when moving on without starting the video on the current slide.

**Control-room audio**
- Three-channel mixer (slides, music, master) from silence to +12 dB, with green/yellow/red LED meters and an anti-clipping limiter.
- Two 10-band equalizers, one for the presentation and one for the music, with 21 styles, response curve and spectrum analyzer.

**Background music on three levels**
- Default: over an hour of original music for each of 7 genres (Lofi Chill, Lounge, Ambient, Piano, Acoustic, Corporate, Cinematic), Opus at 64 kbps (about 37 MB per genre). Filter by genre; in the presenter the selected genres are the ones that feed the queue. Missing genres can be downloaded from the Music tab.
- Global: tracks you add for every presentation.
- Presentation: tracks for a single presentation.
- Add tracks by dragging them in or picking several at once. Editable queue, crossfade (0-15 s), shuffle, repeat, fade-out, automatic ducking during videos.

## Where files live

| What | Where |
|---|---|
| Program, LibreOffice engine, default music | `C:\Program Files\InRegia` |
| Imported presentations, added music, settings | `%LOCALAPPDATA%\InRegia` |

The original .pptx files are never modified.

## Requirements
Windows 10 or 11, 64-bit.

## Build from source

```
cd app && npm ci && npm start                 # run in development
node tests/e2e.js                             # end-to-end tests (needs LibreOffice)
node tools/package-app.js                     # Windows package in dist/
python tools/music/generate.py --zipdir dist                    # 7 genre packages
ISCC installer/inregia.iss                    # installer (Inno Setup 6)
```

Releases are built, tested on Windows (install, use, uninstall) and published by [GitHub Actions](.github/workflows/build.yml).

## Rendering engine and fonts

- **PowerPoint installed** (default when present): InRegia converts the slides with PowerPoint itself, so text, fonts, effects and layout are exactly what PowerPoint shows. If PowerPoint fails for any reason, LibreOffice takes over automatically. Settings > Rendering engine can force LibreOffice.
- **LibreOffice**: before each conversion InRegia reads which fonts the presentation uses and hands LibreOffice the ones Windows does not have installed: Microsoft 365 cloud fonts (Aptos, Montserrat and the others PowerPoint downloads), fonts installed for the current user only, fonts embedded in the .pptx (uncompressed Embedded OpenType) and fonts added in Settings > Fonts. A system font available only as a variable font is replaced by a static version when one is found. Calibri, Cambria, Arial, Times New Roman and Courier New fall back to metric-compatible fonts. Any font that cannot be found is listed on the presentation card, with a button to add it.

## PowerPoint compatibility

Checked on every build with a dedicated test deck (`tests/fixtures/effects.pptx`). Effects are read from their behaviours (position, scale, rotation, opacity, reveal mask, motion path, PowerPoint formulas such as `#ppt_x`), so variants and custom timings follow the original.

| Area | Supported | Approximated | Not supported |
|---|---|---|---|
| Transitions | Fade, fade through black, cut, push, cover, uncover, wipe, split, zoom, circle, diamond, plus, wheel, wedge, blinds, checkerboard, random bars, strips, flash, cube, flip, curtains, morph | Pan, conveyor, gallery (as push); doors, window (as split); vortex, ripple, glitter, honeycomb, shred, prism, dissolve (as fade); airplane, origami, crush, fracture, page curl, peel off, prestige (as zoom); fall over, drape (as flip); wind (as push) | |
| Entrance and exit | Appear, fade, fly, float, rise, descend, zoom, grow & turn, expand, swivel and spin-in (rotation), wipe, split, circle, box, diamond, plus, wheel, wedge, blinds, checkerboard, random bars, strips, peek | Effects whose formulas use the time variable `$` (bounce, spiral): start and end positions only | |
| Emphasis | Spin, grow/shrink, transparency, pulse, teeter; the end state stays on screen | | Colour changes (fill, line, font colour), font and underline changes |
| Motion paths | Lines, curves, custom and closed paths; the object stays where the path ends | | Auto-rotate along the path |
| Sequence | On click, with previous, after previous, delays, repeat, auto-reverse, acceleration and deceleration | | Triggers (click on a shape), interactive sequences, sounds attached to animations |
| Text | By paragraph | By word or by letter (animated as a whole) | |
| Charts and SmartArt | As a single object | By series or element (animated as a whole) | |

Video and audio never start on their own: they are controlled from the presenter.

Presentations imported with an earlier version still work; use **Update** on the library card to get the new animation engine.


## Code signing policy
See the [Code signing policy](CODE_SIGNING_POLICY.md). Free code signing provided by SignPath.io, certificate by SignPath Foundation (application in progress).

## Privacy
InRegia does not collect or send any data. It connects to the internet only to download the components you choose (the app, LibreOffice, the default music), during installation or when you press the matching button in the app, and, if you agree when asked at first start, to check for new versions of InRegia and LibreOffice. Details in the [privacy policy](CODE_SIGNING_POLICY.md#privacy-policy).

## License
[MIT](LICENSE.md). The default background music is original and released as CC0.
