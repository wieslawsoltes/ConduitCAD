import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, 'dist');
await fs.mkdir(out, { recursive: true });
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid package version');
/** Purpose-built deterministic bundler for this workspace's static named ESM imports.
 * It rejects unsupported import/export syntax rather than silently rewriting it.
 * No network, package download, transpiler runtime, or eval is required.
 */
async function bundle(entry) {
    const modules = new Map(), visiting = new Set();
    async function visit(file) {
        file = path.resolve(file);
        if (modules.has(file))
            return;
        if (visiting.has(file))
            throw new Error('Cyclic modules are not supported: ' + file);
        visiting.add(file);
        let code = await fs.readFile(file, 'utf8');
        const imports = [...code.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm)];
        for (const m of imports) {
            const spec = m[2], dep = spec.startsWith('@conduitcad/') ? path.join(root, 'packages', spec.slice('@conduitcad/'.length), 'src/index.js') : path.resolve(path.dirname(file), spec);
            await visit(dep);
            const names = m[1].trim().replace(/\s+as\s+/g, ':');
            code = code.replace(m[0], `const {${names}} = __modules[${JSON.stringify(path.relative(root, dep))}];`);
        }
        if (/^import\s/m.test(code))
            throw new Error('Unsupported import in ' + file);
        const exports = [...code.matchAll(/\bexport\s+(?:async\s+)?(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
        code = code.replace(/\bexport\s+(?=(?:async\s+)?(?:class|function|const|let|var)\b)/g, '');
        if (/^export\s/m.test(code))
            throw new Error('Unsupported export in ' + file);
        modules.set(file, { code, exports });
        visiting.delete(file);
    }
    await visit(path.join(root, entry));
    return `'use strict';\n(()=>{\nconst __modules=Object.create(null);\n${[...modules].map(([file, m]) => `// ${path.relative(root, file)}\n__modules[${JSON.stringify(path.relative(root, file))}]=(()=>{\n${m.code}\nreturn {${m.exports.join(',')}};\n})();`).join('\n')}\n})();\n`;
}
const worker = await bundle('apps/studio/dxf-worker.js');
const app = `globalThis.__CONDUIT_DXF_WORKER__=${JSON.stringify(worker)};\n` + await bundle('apps/studio/main.js');
const css = await fs.readFile(path.join(root, 'packages/workbench/src/styles.css'), 'utf8'), html = await fs.readFile(path.join(root, 'apps/studio/index.html'), 'utf8'), icon = await fs.readFile(path.join(root, 'apps/studio/icon.svg'), 'utf8');
await Promise.all([fs.writeFile(out + '/app.js', app), fs.writeFile(out + '/dxf-worker.js', worker), fs.writeFile(out + '/styles.css', css), fs.writeFile(out + '/index.html', html), fs.writeFile(out + '/icon.svg', icon)]);
const manifest = { name: 'Conduit CAD', short_name: 'Conduit', description: 'Touch-first DXF-native CAD and diagramming', id: './', start_url: './', scope: './', display: 'standalone', background_color: '#fbfcfb', theme_color: '#167c70', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] };
await fs.writeFile(out + '/manifest.webmanifest', JSON.stringify(manifest, null, 2));
const hash = crypto.createHash('sha256').update(app).update(css).digest('hex').slice(0, 12);
const sw = `const CACHE='conduit-${version}-${hash}';const FILES=['./','./index.html','./app.js','./styles.css','./icon.svg','./manifest.webmanifest'];self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('conduit-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return response;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));});`;
await fs.writeFile(out + '/sw.js', sw);
const standalone = html.replace(/<link rel="(?:icon|manifest)"[^>]*>/g, '').replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`).replace('<script src="app.js"></script>', `<script>globalThis.__CONDUIT_STANDALONE__=true;\n${app.replace(/<\/script/gi, '<\\/script')}</script>`);
await fs.writeFile(out + '/ConduitCAD.html', standalone);
await fs.writeFile(out + '/build-info.json', JSON.stringify({ version, sha256: hash, packages: (await fs.readdir(root + '/packages', {withFileTypes:true})).filter(e=>e.isDirectory()).length, applicationBytes: Buffer.byteLength(app), standaloneBytes: Buffer.byteLength(standalone) }, null, 2));
console.log(`Built dist/ and standalone ConduitCAD.html (${Math.round(Buffer.byteLength(standalone) / 1024)} KiB). Version hash: ${hash}`);
