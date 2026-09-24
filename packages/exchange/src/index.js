import { documentBounds, textLayout } from '@conduitcad/model';
import { buildScene, Camera, drawPath, drawText, drawFill } from '@conduitcad/renderer';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export function writeSVG(doc, { padding = 24, background = '#ffffff' } = {}) {
    const scene = buildScene(doc, { tolerance: .08 }), b = documentBounds(doc), x = b.minX - padding, y = b.minY - padding, w = b.maxX - b.minX + padding * 2, h = b.maxY - b.minY + padding * 2, parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${-y - h} ${w} ${h}"><title>${esc(doc.name)}</title><rect x="${x}" y="${-y - h}" width="${w}" height="${h}" fill="${esc(background)}"/>`];
    for (const span of scene.spans.values()) {
        for (const p of scene.paths.slice(span.pathStart, span.pathStart + span.pathCount)) {
            const d = (p.contours || [p.points]).map(points => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(6)} ${(-p.y).toFixed(6)}`).join(' ') + (p.closed || p.contours ? ' Z' : '')).join(' ');
            parts.push(`<path d="${d}" fill="${p.fill ? esc(p.fill) : 'none'}" fill-rule="evenodd" opacity="${p.opacity ?? 1}" stroke="${p.stroke === false ? 'none' : esc(p.color)}" stroke-width="${p.width || 1.5}" stroke-linecap="round" stroke-linejoin="round" ${p.dash?.length ? `stroke-dasharray="${p.dash.join(' ')}"` : ''}/>`);
        }
        for (const t of scene.texts.slice(span.textStart, span.textStart + span.textCount)) {
            const angle = (t.rotation || 0) * Math.PI / 180;
            const [a,b,c,d] = t.frame || [Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle)];
            const layout = textLayout(t);
            parts.push(`<g transform="matrix(${a} ${-b} ${-c} ${d} ${t.p.x} ${-t.p.y})" opacity="${t.opacity ?? 1}">`);
            if (t.backgroundFill) {
                const pad = Math.max(0,(t.backgroundScale || 1.5)-1)*(t.nominalHeight || t.height);
                parts.push(`<rect x="${layout.minX-pad}" y="${layout.minY-pad}" width="${layout.width+2*pad}" height="${layout.height+2*pad}" fill="${esc(t.backgroundColor || '#ffffff')}"/>`);
            }
            for (const line of layout.lines) for (const run of line.runs) {
                const font = /\.shx$|^txt$/i.test(run.font || t.font || '') ? 'sans-serif' : run.font || t.font || 'sans-serif';
                parts.push(`<text x="${run.x}" y="${run.y}" font-family="${esc(font)}" font-size="${run.height}" fill="${esc(run.color || t.color)}" font-weight="${run.bold ? 'bold' : 'normal'}" font-style="${run.italic ? 'italic' : 'normal'}" textLength="${run.width}" lengthAdjust="spacingAndGlyphs" xml:space="preserve" text-decoration="${[run.underline ? 'underline' : '',run.overline ? 'overline' : '',run.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'}">${esc(run.text)}</text>`);
            }
            parts.push('</g>');
        }
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
    for (const span of scene.spans.values()) {
        for (const p of scene.paths.slice(span.pathStart, span.pathStart + span.pathCount)) { drawFill(ctx,p,camera); drawPath(ctx,p,camera); }
        for (const t of scene.texts.slice(span.textStart,span.textStart+span.textCount)) drawText(ctx,t,camera);
    }
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
}
export function writeBOM(doc) {
    const rows = [['Tag', 'Block', 'Layer', 'X', 'Y', 'Rotation']];
    for (const e of doc.entities)
        if (e.type === 'INSERT')
            rows.push([e.tag || '', e.block, e.layer, e.x, e.y, e.rotation || 0]);
    return rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}
