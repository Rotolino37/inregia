# InRegia

InRegia turns a PC and a projector into a control room for live presentations: a presenter view for you, a clean and lockable screen for the audience, and an audio mixer with background music.

## Install

1. Download `InRegia-Setup-<version>.exe` from [Releases](https://github.com/Saggiaa/inregia/releases).
2. Choose the folder (default `C:\Program Files\InRegia`) and the components: the LibreOffice conversion engine and the default background music are selected by default.
3. The installer downloads everything, creates the desktop and Start menu shortcuts, and registers the uninstaller in Windows Settings > Apps.

Offline install: put `InRegia-app-win-x64.zip`, `InRegia-music-default.zip` and a `LibreOffice_*_Win_x86-64.msi` next to the installer; they are used instead of downloading.

## What it does

**Imports any PowerPoint**
- Drag .pptx files onto the library, or pick them from your computer. Each file is converted once; after that it works offline.
- Slides, transitions, morph, click animations, embedded video and audio, speaker notes and hidden slides are kept.
- Detects when the original file has changed and offers to update it.

**Two screens, two roles**
- Projector: the presentation only, with no bars, cursor or controls.
- Presenter: current and next slide, animation progress, notes, timer, clickable thumbnails, live video preview.
- Lock: blocks any action on the projector screen (mouse, keyboard, closing).
- The projector can be turned on and off from the presenter; with a single screen it goes full screen and Esc brings you back.
- Black or white screen and laser pointer controlled from the presenter.

**Video under control**
- No video starts on its own and no slide advances on its own.
- Play, pause, stop, ±10 seconds and seek bar on the presenter side only.
- Warning when moving on without starting the video on the current slide.

**Control-room audio**
- Three-channel mixer (slides, music, master) from silence to +12 dB, with green/yellow/red LED meters and an anti-clipping limiter.
- Two 10-band equalizers, one for the presentation and one for the music, with 21 styles, response curve and spectrum analyzer.

**Background music on three levels**
- Default: 9 original tracks in 6 genres, included with the installer.
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
python tools/music/generate.py --zip dist/InRegia-music-default.zip
ISCC installer/inregia.iss                    # installer (Inno Setup 6)
```

Releases are built, tested on Windows (install, use, uninstall) and published by [GitHub Actions](.github/workflows/build.yml).

## Known limitations
- PowerPoint animations are rendered with equivalent effects (fly in, fade, wipe, zoom, split, circle); motion paths and emphasis effects become a pulse.
- Text animated by paragraph is animated as a single block.

## Code signing policy
See the [Code signing policy](CODE_SIGNING_POLICY.md). Free code signing provided by SignPath.io, certificate by SignPath Foundation (application in progress).

## Privacy
InRegia does not collect or send any data. It connects to the internet only to download the components you choose (the app, LibreOffice, the default music), during installation or when you press the matching button in the app. Details in the [privacy policy](CODE_SIGNING_POLICY.md#privacy-policy).

## License
[MIT](LICENSE.md). The default background music is original and released as CC0.
