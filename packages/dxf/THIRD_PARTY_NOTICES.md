# Third-party notices

The default AutoCAD Color Index palette in `packages/dxf/src/index.js` is based
on the `DXF_DEFAULT_COLORS` numeric palette distributed with ezdxf 1.4.4.
The implementation uses this data directly; ezdxf is not a runtime dependency.
ACI 7 is adapted to the application's light canvas. Its license follows.

The independent audit script also uses a separately installed ezdxf package.
Playwright and Chromium are optional external test tools; their binaries are
not included. TypeScript was used to format source and generate some public
API declarations; its runtime is not included or needed to build the app.

The app contains no AutoCAD or Visio application source, artwork, bundled
proprietary fonts or vendor symbol files. The sample symbol geometry and SVG
UI icons were authored for this implementation; standards certification is not
claimed. Product and standard names identify interoperability targets only.

## ezdxf

MIT License

Copyright (c) 2020 Manfred Moitzi

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
