import { documentBounds } from '@conduitcad/model';
import { buildScene, Camera, drawPath, drawText } from '@conduitcad/renderer';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export function writeSVG(doc, { padding = 24, background = '#ffffff' } = {}) {
    const scene = buildScene(doc, { tolerance: .08 }), b = documentBounds(doc), x = b.minX - padding, y = b.minY - padding, w = b.maxX - b.minX + padding * 2, h = b.maxY - b.minY + padding * 2, parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${-y - h} ${w} ${h}"><title>${esc(doc.name)}</title><rect x="${x}" y="${-y - h}" width="${w}" height="${h}" fill="${esc(background)}"/>`];
    for (const p of scene.paths) {
        const d = p.points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(4)} ${(-p.y).toFixed(4)}`).join(' ') + (p.closed ? ' Z' : '');
        parts.push(`<path d="${d}" fill="${p.fill ? esc(p.fill) : 'none'}" ${p.fill ? 'fill-opacity="0.15"' : ''} stroke="${esc(p.color)}" stroke-width="${p.width || 1.5}" stroke-linecap="round" stroke-linejoin="round" ${p.dash?.length ? `stroke-dasharray="${p.dash.join(' ')}"` : ''}/>`);
    }
    for (const t of scene.texts) {
        const anchor = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start';
        parts.push(`<text transform="translate(${t.p.x} ${-t.p.y}) rotate(${-t.rotation}) scale(${t.widthFactor || 1} 1)" fill="${esc(t.color)}" font-family="system-ui,sans-serif" font-size="${t.height}" text-anchor="${anchor}">${String(t.text).split('\n').map((line, i) => `<tspan x="0" dy="${i ? t.height * 1.3 : 0}">${esc(line)}</tspan>`).join('')}</text>`);
    }
    parts.push('</svg>');
    return parts.join('\n');
}
export async function renderPNG(doc, { width = 2400, padding = 40, background = '#ffffff' } = {}) {
    const b = documentBounds(doc), scene = buildScene(doc, { tolerance: .08 }), aspect = (b.maxY - b.minY + padding * 2) / (b.maxX - b.minX + padding * 2), canvas = document.createElement('canvas');
    canvas.width = Math.min(8192, width);
    canvas.height = Math.min(8192, Math.round(width * aspect));
    const ctx = canvas.getContext('2d'), camera = new Camera();
    camera.width = canvas.width;
    camera.height = canvas.height;
    camera.fit(b, padding);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const p of scene.paths) {
        if (p.fill) {
            ctx.beginPath();
            p.points.forEach((p, i) => { const s = camera.screen(p); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
            ctx.closePath();
            ctx.fillStyle = p.fill;
            ctx.globalAlpha = .15;
            ctx.fill('evenodd');
            ctx.globalAlpha = 1;
        }
        drawPath(ctx, p, camera);
    }
    for (const t of scene.texts)
        drawText(ctx, t, camera);
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
}
export function writeBOM(doc) {
    const rows = [['Tag', 'Block', 'Layer', 'X', 'Y', 'Rotation']];
    for (const e of doc.entities)
        if (e.type === 'INSERT')
            rows.push([e.tag || '', e.block, e.layer, e.x, e.y, e.rotation || 0]);
    return rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}
