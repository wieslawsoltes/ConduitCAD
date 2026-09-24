import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../dist'), port = Number(process.env.PORT || 4173), host = process.env.HOST || '0.0.0.0';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.dxf': 'application/dxf' };
const server = http.createServer(async (req, res) => {
    try {
        const uri = decodeURIComponent(new URL(req.url, 'http://localhost').pathname), file = path.resolve(root, '.' + (uri.endsWith('/') ? uri + 'index.html' : uri));
        if (file !== root && !file.startsWith(root + path.sep)) {
            res.writeHead(403).end();
            return;
        }
        const data = await fs.readFile(file);
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        res.end(data);
    }
    catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found. Run npm run build first.');
    }
});
server.listen(port, host, () => console.log(`Conduit CAD at http://localhost:${port} (serving dist/)`));
