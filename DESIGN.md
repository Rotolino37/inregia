# InRegia design system

## Context
- Mode: **Operate**. The presenter runs a live event from a laptop beside the stage, often in a dim room, under time pressure, with a clicker in one hand.
- Priorities: state always visible (what the audience sees, what plays, what is next), large targets for the critical actions, no surprises (nothing starts or advances by itself).
- Dark theme because of the use scene: a bright screen next to a projector distracts the audience and blinds the presenter.

## Type
- Family: **Calibri** (client choice), fallback Carlito, Segoe UI, Arial. Numbers always `font-variant-numeric: tabular-nums`.
- Scale (px): 12 meta, 14 UI, 16 body/notes base, 20 panel titles, 28 slide counter, 36 library title.
- Weights: 400 body, 600 labels and buttons, 700 titles and counters. Sentence case everywhere, no tracked uppercase labels.

## Color (OKLCH roles, see `app/ui/theme.css`)
| Role | Token | Value |
|---|---|---|
| Canvas | `--bg` | oklch(0.17 0.018 262) |
| Surface 1 / 2 / 3 | `--s1` `--s2` `--s3` | oklch(0.205 / 0.24 / 0.28 ...) |
| Border | `--line` | oklch(0.33 0.022 262) |
| Text primary / secondary / muted | `--t1` `--t2` `--t3` | 0.96 / 0.80 / 0.66 lightness |
| Action (brand gold from logo) | `--gold` | oklch(0.80 0.115 82), text on it `--on-gold` |
| Live / on air / lock | `--live` | oklch(0.64 0.2 25) |
| Media (video, audio) | `--media` | oklch(0.80 0.1 195) |
| Success / warning | `--ok` `--warn` | green 155, orange 60 |
| Meters | fixed green / yellow / red | required by the client |

Gold is reserved for the primary action of each surface (Avanti, Presenta, Importa) and the active state. Red only for live state: projector on air, lock engaged, black screen.

## Shape and depth
- Radius: 6 px controls, 10 px panels, 999 px only for small status pills.
- Elevation declared once: panels use a 1 px border, no shadow. Only overlays (dialogs, menus, drop overlay) carry a soft offset shadow.

## Components
- Button sizes: 32 (toolbar), 40 (default), 52 (transport). Primary = gold fill; secondary = s2 fill + border; quiet = text only; danger = live red on hover/confirm.
- Status pill: dot + text, never color alone.
- Fader: vertical, thumb 26x16, double click resets to 0 dB, wheel for fine steps, range silence to +12 dB.
- Meter: LED segments green below -12 dB, yellow to -3 dB, red above.
- Drop zone: dashed border, becomes solid gold with tinted fill on drag-over; always paired with a "Scegli file" button.
- Filter chip: 32 px pill, s2 fill and line2 border; selected = gold border, gold-tinted fill, gold count. Multi-select; "Tutti i generi" clears the selection.
- Screen picker: scaled map of the real display layout, one card per screen with its number; selected = gold border. The same number appears large on each physical screen while the dialog is open.
- Button contents are updated only when they change (never re-rendered on a timer) and icons/labels inside buttons ignore pointer events, so a click is never lost.

## Motion
- 120 ms hover/press, 180 ms tab and panel changes, ease `cubic-bezier(0.16,1,0.3,1)`.
- One authored moment: the projector status turning "In onda".
- `prefers-reduced-motion`: UI transitions drop to opacity only. Slide transitions on the projector are content, not UI, and are kept.

## Do / don't
- Do keep the state of the projector visible at all times in the presenter header.
- Do show disabled controls with a reason nearby instead of hiding them when layout stability matters (transport bar).
- Don't use modals for routine tasks. Modals only for: leaving a video unplayed, closing the app, deleting files.
- Don't use emoji or Unicode glyphs as icons: icons are authored SVG with one stroke weight (`app/ui/icons.js`).
