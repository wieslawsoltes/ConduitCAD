/** Semantic names, not label guessing: the same command always has the same glyph. */
export const ACTION_ICONS = Object.freeze({
    new:'new', open:'folder', export:'export', help:'help', rename:'rename', command:'command',
    'mode-draw':'sketch', 'mode-3d':'cube', 'mode-connect':'connect', 'mode-inspect':'properties',
    'dynamic-demo':'param', 'rotate-angle':'rotate', parameters:'param', 'line-styles':'line-style', 'toggle-library':'symbols', 'toggle-inspector':'properties',
    more:'more', shapes:'polygon', 'library-guide':'info', 'icon-guide':'icons',
    undo:'undo', redo:'redo', 'zoom-in':'plus', 'zoom-out':'minus', fit:'fit',
    'toggle-grid':'grid', 'toggle-snap':'snap', 'toggle-ortho':'ortho', 'multi-select':'multi',
    'select-all':'multi', 'draw-exact-point':'precision', 'draw-back':'undo', 'draw-close':'close-path',
    'draw-options':'settings', 'draw-cancel':'close', finish:'check',
    'modal-close':'close', 'modal-confirm':'check', 'close-panels':'close',
    'add-layer':'layers', duplicate:'copy', copy:'copy', paste:'paste', delete:'trash', rotate:'rotate',
    offset:'offset', trim:'trim', extend:'extend', fillet:'fillet', explode:'explode',
    reroute:'reroute', graph:'graph', precision:'precision', 'make-symbol':'block',
    'hatch-selection':'hatch', 'native-vertices':'vertex',
    'dimension-source':'dimension', 'dimension-manage':'dimension', 'dimension-reset-text':'reset',
    'dimension-drive':'formula', 'dynamic-author':'param', 'dynamic-reset':'reset',
    constraint:'constraint', 'auto-constrain':'solve', 'constraint-display':'eye',
    'calculated-text':'formula', 'calculation-bake':'unlink', 'solver-report':'calculator', 'solver-run':'solve',
    'parametric-demo':'formula', blocks:'block', 'block-edit':'block-edit', 'block-copy':'copy',
    'block-rename':'rename', 'block-sync-attributes':'sync', 'block-attribute':'attribute', 'block-port':'port',
    'block-author':'param', 'block-save':'save', 'block-save-close':'save', 'block-save-as':'save-all',
    'block-test':'play', 'block-test-close':'arrow-left', 'block-settings':'settings', 'block-close':'close',
    'document-list':'files', 'document-save-all':'save-all',
    '3d-2d':'sketch', '3d-fit':'fit', '3d-view-options':'settings', '3d-tools':'plus',
    '3d-edit':'feature-edit', '3d-appearance':'appearance', '3d-bodies':'bodies', '3d-measure':'ruler',
    '3d-examples':'files', '3d-undo':'undo', '3d-redo':'redo', '3d-bake':'unlink', '3d-remove':'trash',
    '3d-vertex':'vertex', '3d-multi':'multi', '3d-inputs':'inputs', '3d-suppress':'feature-off',
    '3d-nav-toggle':'orbit', '3d-clear':'clear-selection', '3d-face-profile':'sketch-face',
    '3d-look-face':'look-face', '3d-sketch':'sketch', '3d-path':'polyline', '3d-section':'section',
    '3d-obj':'file-3d', '3d-stl':'file-3d', '3d-preview':'eye', '3d-visibility':'eye-off'
});
export const MODEL_ICONS = Object.freeze({box:'cube',cylinder:'cylinder',cone:'cone',sphere:'sphere',torus:'torus',wedge:'wedge',
    extrude:'extrude',hole:'hole',revolve:'revolve',loft:'loft',sweep:'sweep',transform:'move','offset-face':'press-pull',
    union:'union',subtract:'subtract',intersect:'intersect','linear-pattern':'pattern-linear','circular-pattern':'pattern-polar',mirror:'mirror'});
export const TOOL_ICONS = Object.freeze({select:'select',pan:'pan',line:'line',polyline:'polyline',rect:'rect',circle:'circle',
    connect:'connect',text:'text',dimension:'dimension',insert:'block',arc:'arc','arc-center':'arc','circle-3p':'circle',
    'circle-diameter':'diameter',ellipse:'ellipse','ellipse-arc':'ellipse',spline:'spline',bezier:'bezier',polygon:'polygon',
    donut:'donut',solid:'solid',face:'face-3d',hatch:'hatch',wipeout:'wipeout',point:'point',ray:'ray',xline:'xline',
    mtext:'mtext',leader:'leader','dim-aligned':'dimension','dim-horizontal':'dimension-horizontal',
    'dim-vertical':'dimension-vertical','dim-radius':'radius','dim-diameter':'diameter','dim-angular':'angle-dimension',
    'dim-angular-lines':'angle-dimension','dim-ordinate-x':'ordinate','dim-ordinate-y':'ordinate'});
export const EXAMPLE_ICONS = Object.freeze({'hole-plate':'counterbore','extrusion-study':'extrude','face-boss':'sketch-face',
    bracket:'wedge',flange:'flange',vessel:'vessel',transition:'loft',conduit:'pipe',fixture:'pattern-linear',shaft:'revolve',
    enclosure:'cube',manifold:'pipe',primitives:'bodies'});
const documentIcons = Object.freeze({rename:'rename',duplicate:'copy',reorder:'arrow-left','reorder-right':'arrow-right',
    close:'close','close-save':'save','close-discard':'trash',reopen:'history'});
export function actionIcon(action, fallback = 'settings') {
    if (typeof action !== 'string') return fallback;
    if (action.startsWith('tool-')) return toolIcon(action.slice(5), fallback);
    if (Object.hasOwn(ACTION_ICONS, action)) return ACTION_ICONS[action];
    if (action.startsWith('3d-op-')) return MODEL_ICONS[action.slice(6)] || fallback;
    if (action.startsWith('3d-view-')) return 'view-' + action.slice(8);
    if (action.startsWith('3d-pick:')) return ({body:'cube',face:'face',vertex:'vertex'})[action.slice(8)] || fallback;
    if (action.startsWith('3d-select:')) return 'cube';
    if (action.startsWith('3d-example:')) return EXAMPLE_ICONS[action.slice(11)] || 'file-3d';
    if (action.startsWith('document-')) return documentIcons[action.slice(9).split(':')[0]] || 'files';
    return fallback;
}
export function toolIcon(tool, fallback = 'sketch') { return TOOL_ICONS[tool] || fallback; }
export function entityIcon(entity) {
    if (entity?.feature3d) return MODEL_ICONS[entity.feature3d.kind] || 'cube';
    return ({MESH:'mesh','3DFACE':'face-3d',SOLID:'solid',INSERT:'block',LINE:'line',POLYLINE:'polyline',LWPOLYLINE:'polyline',
        CIRCLE:'circle',ARC:'arc',ELLIPSE:'ellipse',SPLINE:'spline',HELIX:'helix',TEXT:'text',MTEXT:'mtext',HATCH:'hatch',
        DIMENSION:'dimension',LEADER:'leader',POINT:'point',XLINE:'xline',RAY:'ray',WIPEOUT:'wipeout',ATTDEF:'attribute'})[entity?.type] || 'file-cad';
}
export function fieldIcon(name, label = '') {
    const key = String(name).toLowerCase(), text = String(label).toLowerCase();
    if (['x','x1','x2','cx','nx','dx','sx','u'].includes(key)) return 'axis-x';
    if (['y','y1','y2','cy','ny','dy','sy','v'].includes(key)) return 'axis-y';
    if (['z','z1','z2','cz','nz','dz','sz'].includes(key)) return 'axis-z';
    if (/diameter/.test(text)) return 'diameter';
    if (/radius/.test(text)) return 'radius';
    if (/angle|rotation|yaw|pitch/.test(text)) return 'angle';
    if (/width/.test(text)) return 'width';
    if (/height/.test(text)) return 'height';
    if (/length|depth|distance/.test(text)) return 'depth';
    if (/offset|taper/.test(text)) return 'offset';
    if (/expression|formula/.test(text)) return 'formula';
    if (/layer/.test(text)) return 'layers';
    if (/color|colour|appearance/.test(text)) return 'appearance';
    if (/text|name|tag|prefix|suffix/.test(text)) return 'text';
    if (/count|segments|precision|decimal/.test(text)) return 'calculator';
    if (/target|body/.test(text)) return 'cube';
    if (/face/.test(text)) return 'face';
    if (/direction|normal|plane/.test(text)) return 'axis-z';
    if (/find|search/.test(text)) return 'search';
    if (/profile|shape/.test(text)) return 'sketch';
    if (/extent/.test(text)) return 'extrude';
    if (/operation/.test(text)) return 'union';
    return null;
}
export function headingIcon(title) {
    const s = String(title).toLowerCase();
    if (/hole/.test(s)) return 'hole';
    if (/extrud/.test(s)) return 'extrude';
    if (/revol/.test(s)) return 'revolve';
    if (/loft/.test(s)) return 'loft';
    if (/sweep/.test(s)) return 'sweep';
    if (/vertices|vertex/.test(s)) return 'vertex';
    if (/measure|dimension/.test(s)) return 'dimension';
    if (/solve|constraint/.test(s)) return 'solve';
    if (/parameter|calculat/.test(s)) return 'param';
    if (/block/.test(s)) return 'block-edit';
    if (/layer/.test(s)) return 'layers';
    if (/export|exchange/.test(s)) return 'export';
    if (/drawing|document/.test(s)) return 'files';
    if (/3d|bodies|primitive/.test(s)) return 'bodies';
    if (/sketch|profile/.test(s)) return 'sketch';
    if (/view|camera/.test(s)) return 'view-iso';
    if (/icon|toolbar/.test(s)) return 'icons';
    if (/curve/.test(s)) return 'spline';
    if (/shape|fill/.test(s)) return 'hatch';
    if (/construct/.test(s)) return 'xline';
    if (/annotation/.test(s)) return 'text';
    if (/help|convention/.test(s)) return 'help';
    return null;
}
