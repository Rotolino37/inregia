# InRegia

InRegia turns a PC and a projector into a control room for live presentations.
Copy your .pptx files into the `upload` folder, launch `inregia.exe`, pick a presentation and you are ready to go.

## What it does

**Imports any PowerPoint**
- Automatically converts .pptx files on first launch: slides, transitions, morph, click animations, embedded video and audio, speaker notes, hidden slides.
- Detects when a file has changed and offers to re-import it.
- Handles multiple presentations: at startup it asks which one to run.

**Two screens, two roles**
- Projector: the presentation only, with no bars, cursor or controls.
- Presenter: current and next slide, animation progress, notes, timer, clickable thumbnails.
- Lock: blocks any action on the projector screen (mouse, keyboard, closing).
- The projector can be opened and closed from the presenter; closing the presenter closes everything.
- Black or white screen and laser pointer controlled from the presenter.

**Video under control**
- No video starts on its own and no slide advances on its own.
- Play, pause, stop, ±10 seconds and seek bar on the presenter side only.
- Warning when moving on without starting the video on the current slide.

**Control-room audio**
- Three-channel mixer (presentation, music, master) from silence to +12 dB, with green/yellow/red LED meters and an anti-clipping limiter.
- Two 10-band equalizers, one for the presentation and one for the music, with 21 presets, response curve and spectrum analyzer.

**Background music**
- One music folder per presentation, plus a shared folder.
- Drag-and-drop editable queue, adjustable crossfade (0-15 s), shuffle, repeat, fade-out.
- Music ducks automatically during videos.

**Portable and offline**
- Everything lives in a single folder: no installation, no administrator rights.
- The conversion engine (LibreOffice) is downloaded once on first launch into the app folder; from then on it works without internet and can be copied to other PCs.

## Requirements
Windows 10 or 11, 64-bit.

## Known limitations
- PowerPoint animations are rendered with equivalent effects (fly in, fade, wipe, zoom, split, circle); motion paths and emphasis effects become a pulse.
- Text animated by paragraph is animated as a single block.
