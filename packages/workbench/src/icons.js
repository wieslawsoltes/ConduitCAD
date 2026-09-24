const paths = {
    logo: 'M5 5h6v6H5z M19 13h6v6h-6z M5 21h6v6H5z M11 8h5a6 6 0 0 1 6 5 M8 11v10 M11 24h5a6 6 0 0 0 6-5',
    select: 'm5 3 14 11-7 1-4 7Z', pan: 'M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v8c0 4-3 7-7 7h-1c-3 0-5-2-7-5l-3-5a2 2 0 0 1 3-2l3 3',
    line: 'M5 19 19 5 M3 17h4v4H3z M17 3h4v4h-4z', polyline: 'M4 18 9 5l7 11 5-10 M2 16h4v4H2z M7 3h4v4H7z M14 14h4v4h-4z',
    connect: 'M3 7h5v5h8v5h5 M1 5h4v4H1z M19 15h4v4h-4z', rect: 'M4 5h16v14H4z', circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 9v6 M9 12h6', text: 'M4 5h16 M12 5v15 M8 20h8 M4 5v3 M20 5v3',
    undo: 'M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 0 12', redo: 'm15 5 5 5-5 5 M20 10H10a6 6 0 0 0 0 12',
    folder: 'M3 6h7l2 3h9v11H3z M3 6V4h7l2 2h8v3', export: 'M12 16V3 M7 8l5-5 5 5 M4 14v7h16v-7', save: 'M4 3h13l4 4v14H3V3z M7 3v6h10V3 M7 21v-8h10v8',
    plus: 'M12 5v14 M5 12h14', minus: 'M5 12h14', close: 'M5 5l14 14 M19 5 5 19', chevron: 'm8 4 8 8-8 8', down: 'm5 9 7 7 7-7', search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6',
    layers: 'm12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 17l10 5 10-5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', lock: 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4', unlock: 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0',
    properties: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6', grid: 'M4 4h16v16H4z M4 12h16 M12 4v16', snap: 'M5 4v10a7 7 0 0 0 14 0V4h-4v10a3 3 0 0 1-6 0V4z M5 8h4 M15 8h4', ortho: 'M5 4v16h15 M5 15h5v5',
    fit: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 8h8v8H8z', more: 'M5 12h.01 M12 12h.01 M19 12h.01', trash: 'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7', copy: 'M8 8h13v13H8z M4 16H2V2h14v2', rotate: 'M4 11a8 8 0 1 1 3 7 M4 4v7h7',
    symbols: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M17.5 13l5 4.5-5 4.5-5-4.5z', dimension: 'M4 3v18 M20 3v18 M4 12h16 m-11-4-5 4 5 4 m6-8 5 4-5 4', ruler: 'm3 17 14-14 4 4L7 21z M7 13l3 3 M11 9l3 3 M15 5l3 3',
    check: 'm4 12 5 5L20 6', warning: 'm12 3 10 18H2z M12 9v5 M12 17h.01', help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5 M12 17h.01',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-7z', code: 'm8 6-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18', command: 'M8 8H5a3 3 0 1 1 3-3v14a3 3 0 1 1-3-3h14a3 3 0 1 1-3 3V5a3 3 0 1 1 3 3z',
    param: 'M3 6h18 M5 12h14 M7 18h10 M8 3v6 M16 9v6 M12 15v6', offset: 'M3 18 9 6h12 M7 21l6-11h10', trim: 'M4 4 20 20 M4 20 20 4 M12 4v16', fillet: 'M4 20V10a6 6 0 0 1 6-6h10', extend: 'M3 20 21 2 M13 3h8v8 M3 13v7h7',
    new: 'M14 2H4v20h16V8z M14 2v6h6 M8 15h8 M12 11v8', screen: 'M3 4h18v14H3z M8 22h8 M12 18v4', touch: 'M8 12V5a2 2 0 0 1 4 0v6l5-1 4 3-2 7H9l-6-7 2-2 3 3', graph: 'M5 5h5v5H5z M15 15h5v5h-5z M5 17h5v5H5z M10 8h7v7 M7 10v7', arrow: 'M4 12h16 M14 6l6 6-6 6',
};
export function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 ${name === 'logo' ? 32 : 24} ${name === 'logo' ? 32 : 24}" fill="none" stroke="currentColor" stroke-width="${name === 'more' ? 3 : 1.65}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.rect}"/></svg>`; }
export function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
