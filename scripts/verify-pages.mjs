import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Compare actual hosted bytes with this checkout's deterministic production build.
const root = path.resolve(import.meta.dirname, '..');
const base = new URL(process.argv[2] || 'https://wieslawsoltes.github.io/ConduitCAD/');
assert(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)), 'Use HTTPS or a loopback development server.');
assert(!base.username && !base.password, 'Credentials must not be included in the site URL.');
base.search = ''; base.hash = '';
if (!base.pathname.endsWith('/')) base.pathname += '/';
const files = ['index.html', 'app.js', 'styles.css', 'dxf-worker.js', 'sw.js', 'icon.svg', 'manifest.webmanifest', 'build-info.json', 'ConduitCAD.html'];
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const expected = new Map(await Promise.all(files.map(async file => [file, await fs.readFile(path.join(root, 'dist', file))])));
const info = JSON.parse(expected.get('build-info.json').toString('utf8'));
let report;
for (let attempt = 1; attempt <= 12; attempt++) {
    try {
        const results = await Promise.all(files.map(async file => {
            // Exercise the project root as well as the remaining published assets.
            const url = new URL(file === 'index.html' ? './' : file, base);
            url.searchParams.set('verify', `${info.sha256}-${attempt}`);
            const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
            assert.equal(response.status, 200, `${file}: HTTP ${response.status}`);
            assert.equal(new URL(response.url).origin, base.origin, `${file}: unexpected cross-origin redirect`);
            const data = Buffer.from(await response.arrayBuffer());
            assert.equal(sha256(data), sha256(expected.get(file)), `${file}: stale or mismatched deployed content`);
            return { file, status: response.status, bytes: data.length, sha256: sha256(data), contentType: response.headers.get('content-type') };
        }));
        report = { url: base.href, commit: process.env.GITHUB_SHA || null, version: info.version, buildHash: info.sha256, verifiedAt: new Date().toISOString(), files: results };
        break;
    } catch (error) {
        if (attempt === 12) throw error;
        console.warn(`Live verification attempt ${attempt}: ${error.message}`);
        await delay(5000);
    }
}
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
await fs.writeFile(path.join(root, 'artifacts/pages-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
