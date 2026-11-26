MIT License

Copyright (c) 2026 Marco

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Third-party components

InRegia includes or relies on the following third-party software. Each
component is distributed under its own license, which remains in effect and
is not replaced by the license above.

| Component | Use in InRegia | License |
|---|---|---|
| [Electron](https://github.com/electron/electron) | Application runtime (`app/logic/runtime`) | MIT |
| [Chromium](https://www.chromium.org/) (bundled with Electron) | Rendering, audio and video playback | BSD-3-Clause and others, see `app/logic/runtime/LICENSES.chromium.html` |
| [PDF.js](https://github.com/mozilla/pdf.js) | Slide rasterization during import (`app/logic/core/lib`) | Apache-2.0 |
| [yauzl](https://github.com/thejoshwolfe/yauzl) | Reading .pptx files | MIT |
| [yazl](https://github.com/thejoshwolfe/yazl) | Writing temporary .pptx files during import | MIT |
| [buffer-crc32](https://github.com/brianloveswords/buffer-crc32) | Dependency of yauzl/yazl | MIT |
| [pend](https://github.com/andrewrk/node-pend) | Dependency of yauzl | MIT |

### LibreOffice

InRegia does not include LibreOffice. On first launch, at the user's request,
it downloads the official LibreOffice installer from The Document Foundation
and extracts it into `app/logic/engine`. LibreOffice is licensed under the
[Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/) and is used as a
separate program to convert presentations.

### Trademarks

PowerPoint is a trademark of Microsoft Corporation. LibreOffice is a
trademark of The Document Foundation. InRegia is not affiliated with or
endorsed by either company.
