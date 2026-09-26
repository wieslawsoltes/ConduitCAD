import { ModelingWorkbench } from './modeling-workbench.js';
import { regenerateFeatures, EXAMPLES_3D, create3DExample } from '@conduitcad/modeling';
import { initializeDocuments, claimWorkspace, createDocumentHistory, recoverDocuments, forkRecoveryWorkspace, captureActiveDocument, activateDocument, openDocument, renderDocuments, documentAction, documentKeyDown, documentChanged, scheduleRecovery, requestCloseDocument, disposeDocuments } from './document-workbench.js';
import { MOBILE_MEDIA, bindMobileWorkspace, updateMobilePanels, prepareMobileDialog } from './mobile-workspace.js';
import { mergeClipboardBlocks } from '@conduitcad/workspace';
import { DRAWING_TOOLS, drawingTool } from '@conduitcad/drawing';
import { beginDrawing, acceptDrawingPoint, drawingPointerUp, drawingPreview, updateDrawingControls, finishDrawing, drawingToolSections, bindDrawingSearch, drawingAction, drawingCommand, nativeGrips, changeNativeGrip, renderDrawingInspector, nativePropertyChange } from './drawing-workbench.js';
import { parametricAction, renderParametricInspector, refreshCalculations, drawParametricOverlay, startBlockEditor, finishBlockEditor, parameterManager, constraintAuthor } from './parametric-workbench.js';
import { renderCadEditing, changeCadEditing, cadEditingAction } from './cad-editing.js';
import { editDimension, dimensionGrips, regenerateDimensions, setDynamicParameters, dynamicParameterGrips, dynamicGripValue } from '@conduitcad/model';
import { bounds, inflate, contains, distance, distanceToSegment, lerp, union, emptyBounds, center, validBounds, snapCandidates, lineIntersection, offsetPolyline, filletLines, matrix, compose, TAU, clamp } from '@conduitcad/geometry';
import { createDocument, validateDocument, entity, line, polyline, rect, circle, text, clone, uid, entityBounds, entityGeometry, documentBounds, layerFor, isVisible, isLocked, ports, moveEntity, transformEntity, explodeEntity, detachReferences } from '@conduitcad/model';
import { History } from '@conduitcad/history';
import { ConstraintSolver, evaluateExpression, resolveParameters } from '@conduitcad/constraints';
import { routeOrthogonal, routePorts, routeVia, graphFromDocument } from '@conduitcad/routing';
import { SYMBOLS, LINE_STYLES, CATEGORIES, STANDARD_REFERENCES, DRAWING_TYPES, searchSymbols, symbolUpdates, updateSymbolDefinitions, installSymbols, insertSymbol, createDemo } from '@conduitcad/symbols';
import { parseDXF, writeDXF, writeDXFBinary, inspectObjectGraph, exportReport } from '@conduitcad/dxf';
import { CadRenderer, Camera, drawPath, drawText } from '@conduitcad/renderer';
import { PointerController } from '@conduitcad/input';
import { ProjectStore, downloadFile } from '@conduitcad/storage';
import { writeSVG, renderPNG, writeBOM } from '@conduitcad/exchange';
import { icon, escapeHTML, commandContent, toolIcon } from './icons.js';
import { actionIcon, EXAMPLE_ICONS } from './icon-map.js';
import { bindIconography, iconPreferencesMarkup } from './iconography.js';
const E = escapeHTML;
const TOOL_INFO = { ...Object.fromEntries(DRAWING_TOOLS.map(t => [t.id, [t.label, t.steps[0]]])), select: ['Select', 'Tap an object to select · drag to move'], pan: ['Pan', 'Drag the drawing · pinch to zoom'], line: ['Line', 'Tap two endpoints, or drag to draw a line'], polyline: ['Polyline', 'Tap vertices · Finish to complete the path'], rect: ['Rectangle', 'Tap opposite corners, or drag a rectangle'], circle: ['Circle', 'Tap the center, then set the radius'], connect: ['Connect', 'Tap a port, then a destination · routes avoid equipment'], text: ['Text', 'Tap the drawing to place editable text'], dimension: ['Dimension', 'Pick two points for an aligned dimension'], insert: ['Place symbol', 'Tap to place · Escape cancels'] };
const btn = (action, label, ic, cls = '', title = label) => `<button type="button" data-action="${action}" class="${cls}" title="${E(title)}" aria-label="${E(label)}">${commandContent(action, label, actionIcon(action,ic || 'settings'))}</button>`;
const iconButton = (action, ic, label, cls = '') => `<button type="button" data-action="${action}" class="icon-btn ${cls}" title="${E(label)}" aria-label="${E(label)}">${icon(ic,'command-icon')}</button>`;
const filledContains = (p, contours) => { let inside=false; for (const poly of contours) for(let i=0,j=poly.length-1;i<poly.length;j=i++) {const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;} return inside; };
const format = n => Number.isFinite(n) ? Number(n.toFixed(3)).toString() : '0';
export function symbolSVG(block, doc, extra = '') {
    if (!block)
        return icon('symbols');
    const preview = { id: 'preview', type: 'INSERT', block: block.name || block.block, x: 0, y: 0, sx: 1, sy: 1, layer: 'Equipment' };
    const g = entityGeometry(preview, doc, { tolerance: .03 }), pts = g.paths.flatMap(p => p.points), b = union(bounds(pts), entityBounds(preview, doc));
    if (!validBounds(b))
        return icon('symbols');
    const pad = 8, view = `${b.minX - pad} ${-b.maxY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
    return `<svg viewBox="${view}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ${extra}>${g.paths.map(p => `<path d="${p.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${-p.y}`).join(' ')}${p.closed ? 'Z' : ''}" fill="${p.fill ? 'currentColor' : 'none'}" fill-rule="evenodd" stroke="${p.stroke === false ? 'none' : 'currentColor'}" stroke-width="1.7" ${p.dash?.length ? `stroke-dasharray="${p.dash.join(' ')}"` : ''} vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}${g.texts.map(t => `<text x="${t.p.x}" y="${-t.p.y}" fill="currentColor" font-size="${t.height}" font-family="system-ui" text-anchor="${t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start'}">${E(t.text)}</text>`).join('')}</svg>`;
}
export class Workbench {
    constructor(root, options = {}) {
        if (!root)
            throw new Error('A host element is required');
        this.root = root;
        this.options = options;
        this.initializing = true;
        this.doc = options.document || createDemo('pid');
        this.selection = new Set();
        this.tool = 'select';
        this.category = 'P&ID';
        this.librarySearch = '';
        this.inspectorTab = 'properties';
        this.currentLayer = 'Process';
        this.lineStyle = 'process';
        this.gridSnap = true;
        this.objectSnap = true;
        this.ortho = false;
        this.draft = [];
        this.cursor = null;
        this.clipboard = null;
        this.pointer = null;
        this.connectionStart = null;
        this.multi = false;
        this.abort = new AbortController();
        this.solver = new ConstraintSolver();
        this.renderShell();
        const params = new URLSearchParams(globalThis.location?.search || '');
        this.camera = new Camera();
        this.renderer = new CadRenderer(this.$('.viewport'), { camera: this.camera, backend: options.backend || params.get('renderer') || 'auto', onStatus: status => this.rendererStatus(status) });
        this.renderer.drawOverlay = (ctx, cam) => this.drawOverlay(ctx, cam);
        this.renderer.onFrame = stats => this.updateFrame(stats);
        this.renderer.setDocument(this.doc);
        this.store = options.store || new ProjectStore({ onStatus: (s, error) => {
                const el = this.$('.save-status');
                if (el)
                    el.innerHTML = s === 'saved' ? `${icon('check')} Saved on device` : s === 'saving' ? 'Saving…' : 'Storage unavailable';
                if (error)
                    this.toast('Autosave unavailable. Export a project copy to keep your work.', true);
            } });
        this.history = createDocumentHistory(this);
        initializeDocuments(this);
        this.input = new PointerController(this.$('.viewport'), { down: p => this.pointerDown(p), move: p => {try{this.pointerMove(p);}catch(error){this.cancelGesture();this.toast(error.message,true);}}, up: p => this.pointerUp(p), hover: p => this.pointerHover(p), cancel: () => this.cancelGesture(), gesture: ({ previous, current, scale, dx, dy }) => { this.camera.zoom(scale, { x: previous.x, y: previous.y }); this.camera.pan(dx, dy); this.renderer.invalidate(); }, wheel: p => {
                if (p.original.shiftKey)
                    this.camera.pan(-p.deltaY, 0);
                else
                    this.camera.zoom(Math.exp(-p.deltaY * .0015), p);
                this.renderer.invalidate();
            }, longPress: p => this.showContext(p), context: p => this.showContext(p) });
        this.model3d = new ModelingWorkbench(this);
        this.iconography = bindIconography(this);
        this.bindEvents();
        bindMobileWorkspace(this);
        this.updateUI();
        this.ready = this.initialize(params);
    }
    $(selector) { return this.root.querySelector(selector); }
    async initialize(params) {
        await this.renderer.ready;
        if (this.disposed) return this;
        await claimWorkspace(this);
        let recovered = false;
        if (!this.options.document && params.get('fresh') !== '1') {
            recovered = await recoverDocuments(this);
            if (this.recoveryIncomplete) await forkRecoveryWorkspace(this);
            if (!recovered) {
                const saved = await this.store.load();
                if (saved?.document) {
                    try {
                        const document = validateDocument(saved.document);
                        const session = this.documents.active;
                        session.document = document; session.context.doc = document;
                        this.doc = document; this.renderer.setDocument(document); this.updateUI();
                        this.toast('Recovered your previous drawing in a document tab.');
                    } catch {}
                }
            }
        }
        this.renderer.resize();
        if (!recovered) this.renderer.fit();
        this.renderer.invalidate();
        this.initializing = false;
        captureActiveDocument(this); scheduleRecovery(this);
        return this;
    }
    renderShell() {
        this.root.innerHTML = `<div class="app">
 <header class="appbar"><div class="brand"><span class="logo">${icon('logo')}</span><span class="brand-name">conduit</span><small>CAD</small></div><div class="document-title"><span class="divider"></span><button class="doc-title-button" data-action="rename" title="Rename drawing"><span class="doc-name"></span>${icon('down')}</button><span class="save-status">${icon('check')} Local workspace</span></div><div class="appbar-actions">${btn('new', 'New', 'plus', 'desktop-only', 'Create a drawing')}${btn('open', 'Open DXF', 'folder', 'btn')}${btn('export', 'Export', 'export', 'btn primary')}${iconButton('help', 'help', 'Help & shortcuts', 'desktop-only')}<div class="avatar" title="Local workspace · no account">CC</div></div></header>
 <nav class="workbar" aria-label="Workspace tools"><div class="workspace-label">${icon('symbols')} Design workspace</div>${btn('mode-draw', 'Draw', 'line', 'tab active')}${btn('mode-3d', '3D', 'rect', 'tab')}${btn('mode-connect', 'Connect', 'connect', 'tab')}${btn('mode-inspect', 'Inspect', 'properties', 'tab')}<span class="spacer"></span>${btn('parameters', 'Parameters', 'param', 'compact optional')}${btn('line-styles', 'Line styles', 'line', 'compact optional')}<span class="separator desktop-only"></span>${btn('toggle-library', 'Library', 'symbols', 'compact mobile-only')}${iconButton('toggle-inspector', 'properties', 'Properties and layers', 'compact inspector-toggle')}${iconButton('command', 'command', 'Command palette', 'compact optional')}${iconButton('more', 'more', 'More drawing tools', 'compact mobile-only')}</nav>
 <main class="workspace"><aside class="library" aria-label="Symbol library"><div class="panel-heading"><h2>Symbol library <small class="library-count"></small></h2>${iconButton('toggle-library', 'close', 'Close library', 'mobile-only')}</div><p class="panel-subtitle">Drag a symbol. Make a connection.</p><div class="searchbox">${icon('search')}<input id="symbol-search" type="search" placeholder="Find a symbol…" aria-label="Search symbols" autocomplete="off"></div><div class="category-tabs"><select id="symbol-category" aria-label="Symbol category"><option value="All">All categories</option>${CATEGORIES.map(c => `<option value="${E(c.id)}" ${c.id === this.category ? 'selected' : ''}>${E(c.name)} · ${SYMBOLS.filter(s => s.category === c.id).length}</option>`).join('')}<option value="Custom">Custom / imported blocks</option></select></div><div class="library-summary" role="status" aria-live="polite"></div><div class="library-scroll"></div><div class="library-footer">${btn('library-guide', 'Conventions & library updates', 'help')}</div></aside>
 <section class="canvas-area" aria-label="Drawing canvas"><div class="viewport" tabindex="0" role="application" aria-label="CAD drawing. Use toolbar tools, touch gestures, or keyboard shortcuts."></div><div class="canvas-head"><div class="undo-group">${iconButton('undo', 'undo', 'Undo · Ctrl/⌘ Z')}${iconButton('redo', 'redo', 'Redo · Ctrl/⌘ Shift Z')}</div><div class="render-badge"><span class="dot"></span><span class="backend-name">Initializing</span><span class="stats-text quiet"> · retained renderer</span></div></div><div class="view-label">MODEL SPACE / TOP</div><div class="axis"><svg viewBox="0 0 38 38"><path d="M8 29V5m0 24h24M5 8l3-3 3 3m18 18 3 3-3 3" fill="none" stroke="#9aafa0" stroke-width="1.2"/><text x="2" y="4" font-size="6" fill="#94aa99">Y</text><text x="33" y="33" font-size="6" fill="#94aa99">X</text></svg><span class="unit-label">mm</span></div><div class="zoom-controls">${iconButton('zoom-out', 'minus', 'Zoom out')}<span class="zoom-value">100%</span>${iconButton('zoom-in', 'plus', 'Zoom in')}<span class="separator"></span>${iconButton('fit', 'fit', 'Fit drawing · F')}</div><div class="tool-hint"></div><div class="drawing-session-controls hide" role="toolbar" aria-label="Active drawing command">${btn('draw-exact-point', 'Point…', 'ruler')}${btn('draw-back', 'Back', 'undo')}${btn('draw-close', 'Close', 'polyline')}${btn('draw-options', 'Options', 'properties')}${btn('draw-cancel', 'Cancel', 'close')}</div><button class="finish-button hide" data-action="finish">${icon('check')} Finish path</button><nav class="tool-dock" aria-label="Drawing tools">
 ${this.toolButton('select', 'Select', 'select')}${this.toolButton('pan', 'Pan', 'pan', 'mobile-hidden')}${this.toolButton('line', 'Line', 'line')}${this.toolButton('connect', 'Connect', 'connect')}<span class="dock-divider"></span>${this.toolButton('rect', 'Rectangle', 'rect', 'mobile-hidden')}${this.toolButton('circle', 'Circle', 'circle', 'mobile-hidden')}${this.toolButton('text', 'Text', 'text', 'mobile-hidden')}${this.toolButton('dimension', 'Measure', 'dimension', 'desktop-only')}${btn('shapes', 'Shapes', 'rect', 'mobile-only')}${btn('toggle-library', 'Symbols', 'symbols', 'mobile-only')}${btn('toggle-inspector', 'Edit', 'properties', 'mobile-only')}<span class="dock-divider"></span>${btn('more', 'More', 'more', '')}
 </nav></section>
 <aside class="inspector" aria-label="Drawing properties"><div class="inspector-tabs"><button data-inspector="properties" class="active">Properties</button><button data-inspector="layers">Layers</button><button data-inspector="qa">Check</button>${iconButton('toggle-inspector', 'close', 'Close properties', 'mobile-only')}</div><div class="inspector-content"></div></aside><div class="sheet-backdrop" data-action="close-panels"></div></main>
 <footer class="statusbar"><div class="left"><select class="layout-select" aria-label="Drawing layout"></select><span class="status-document"></span><span class="coords">X 0.0   Y 0.0</span></div><div class="right"><button data-action="toggle-grid">GRID</button><button data-action="toggle-snap">SNAP</button><button data-action="toggle-ortho">ORTHO</button><span class="status-extra">1:1</span><span class="stats"></span>${btn('command', 'Command', 'code', 'desktop-only')}</div></footer><input class="file-input hide" type="file" multiple accept=".dxf,.json,.conduit" aria-label="Open DXF or Conduit project"><div class="toast" role="status" aria-live="polite"></div></div>`;
    }
    toolButton(tool, label, ic, cls = '') { return `<button data-tool="${tool}" class="${tool === 'select' ? 'active ' : ''}${cls}" title="${E(label)}" aria-label="${E(label)}" aria-pressed="${tool === 'select'}">${commandContent('', label, toolIcon(tool,ic))}</button>`; }
    bindEvents() {
        const opt = { signal: this.abort.signal };
        this.root.addEventListener('click', e => this.onClick(e), opt);
        this.root.addEventListener('change', e => this.onChange(e), opt);
        this.$('#symbol-search').addEventListener('input', e => { this.librarySearch = e.target.value; this.renderLibrary(); }, opt);
        this.$('.file-input').addEventListener('change', e => {
            this.openFiles([...e.target.files]);
            e.target.value = '';
        }, opt);
        this.$('.library-scroll').addEventListener('pointerdown', e => this.libraryPointerDown(e), opt);
        this.$('.viewport').addEventListener('dblclick', () => {
            if (this.tool === 'polyline' || this.drawingSession?.canFinish)
                this.finishPath();
            else if (this.tool === 'select' && this.selection.size === 1) {
                const e = this.selected()[0];
                if (['TEXT', 'MTEXT'].includes(e.type))
                    this.editText(e);
                else if(e.type==='INSERT'&&!this.blockSession)startBlockEditor(this,e.block);
                else
                    this.openPanel('inspector');
            }
        }, opt);
        this.$('.viewport').addEventListener('dragover', e => { e.preventDefault(); }, opt);
        this.$('.viewport').addEventListener('drop', e => {
            e.preventDefault();
            this.openFiles([...e.dataTransfer.files]);
        }, opt);
        document.addEventListener('keydown', e => this.keyDown(e), opt);
        document.addEventListener('keyup', e => {
            if (e.code === 'Space')
                this.space = false;
        }, opt);
        window.addEventListener('blur', () => { this.space = false; this.cancelGesture(); }, opt);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !this.initializing)
                this.documents.saveAll().catch(() => { });
        }, opt);
    }
    async onClick(event) {
        if (this.initializing || this.disposed) return;
        const target = event.target.closest('button,[data-action]');
        if (!target)
            return;
        if (target.disabled)
            return;
        if (target.dataset.documentId) {
            try {
                if (target.dataset.documentOperation === 'close') await requestCloseDocument(this, target.dataset.documentId);
                else activateDocument(this, target.dataset.documentId);
            } catch (error) { this.toast(error.message, true); }
            return;
        }
        if (target.dataset.tool) {
            this.setTool(target.dataset.tool);
            return;
        }
        if (target.dataset.category) {
            this.category = target.dataset.category;
            this.renderLibrary();
            return;
        }
        if (target.dataset.inspector) {
            this.inspectorTab = target.dataset.inspector;
            this.renderInspector();
            return;
        }
        if (target.dataset.symbol) {
            if (this.suppressLibraryClick === target.dataset.symbol && performance.now() < this.suppressLibraryClickUntil) {
                this.suppressLibraryClick = null;
                return;
            }
            this.suppressLibraryClick = null;
            this.pickSymbol(target.dataset.symbol);
            return;
        }
        if (target.dataset.export) {
            await this.doExport(target.dataset.export);
            return;
        }
        if (target.dataset.selectEntity) {
            this.selectEntity(target.dataset.selectEntity, true);
            return;
        }
        if (target.dataset.layerVisible) {
            this.edit('Layer visibility', () => { const l = this.doc.layers.find(l => l.name === target.dataset.layerVisible); l.visible = !l.visible; });
            return;
        }
        if (target.dataset.layerLock) {
            this.edit('Layer lock', () => { const l = this.doc.layers.find(l => l.name === target.dataset.layerLock); l.locked = !l.locked; });
            return;
        }
        if (target.dataset.constraintDelete) {
            this.edit('Remove constraint', () => { this.doc.constraints = this.doc.constraints.filter(c => c.id !== target.dataset.constraintDelete); });
            return;
        }
        if (target.dataset.demo) {
            try { await this.newDocument(target.dataset.demo); } catch (error) { this.toast(error.message, true); }
            return;
        }
        if (target.dataset.style) {
            this.lineStyle = target.dataset.style;
            this.closeModal();
            this.setTool('connect');
            this.toast(LINE_STYLES.find(s => s.id === this.lineStyle).name + ' selected');
            return;
        }
        const action = target.dataset.action;
        if (!action)
            return;
        try {
            await this.action(action);
        }
        catch (error) {
            this.toast(error.message, true);
        }
    }
    async action(action) {
        if (action === 'icon-guide') { this.iconography.guide(); return; }
        if (action === 'mode-3d' || action.startsWith('3d-')) return this.model3d.action(action);
        if (action.startsWith('document-')) { await documentAction(this, action); return; }
        if (action === 'new') { this.newDialog(); return; }
        if (action === 'open') { this.closeModal(); this.$('.file-input').click(); return; }
        if(drawingAction(this,action))return;
        if(parametricAction(this,action))return;
        if(cadEditingAction(this,action))return;
        switch (action) {
            case 'library-guide':
                this.libraryGuide();
                break;
            case 'undo':
                this.history.undo();
                break;
            case 'redo':
                this.history.redo();
                break;
            case 'open':
                this.$('.file-input').click();
                break;
            case 'export':
                this.exportDialog();
                break;
            case 'new':
                this.newDialog();
                break;
            case 'rename':
                this.ask('Drawing name', [{ name: 'name', label: 'Name', value: this.doc.name }], v => this.edit('Rename drawing', () => this.doc.name = v.name || 'Untitled drawing'));
                break;
            case 'zoom-in':
                this.camera.zoom(1.25);
                this.renderer.invalidate();
                break;
            case 'zoom-out':
                this.camera.zoom(.8);
                this.renderer.invalidate();
                break;
            case 'fit':
                this.renderer.fit();
                break;
            case 'toggle-library':
                this.togglePanel('library');
                break;
            case 'toggle-inspector':
                this.togglePanel('inspector');
                break;
            case 'close-panels':
                this.closePanels();
                break;
            case 'toggle-grid':
                this.renderer.grid = !this.renderer.grid;
                this.renderer.invalidate();
                this.updateStatus();
                break;
            case 'toggle-snap':
                this.objectSnap = !this.objectSnap;
                this.gridSnap = this.objectSnap;
                this.updateStatus();
                break;
            case 'toggle-ortho':
                this.ortho = !this.ortho;
                this.updateStatus();
                break;
            case 'mode-draw':
                this.setTool('select');
                break;
            case 'mode-connect':
                this.setTool('connect');
                break;
            case 'mode-inspect':
                this.inspectorTab = 'qa';
                this.openPanel('inspector');
                this.renderInspector();
                break;
            case 'line-styles':
                this.lineStylesDialog();
                break;
            case 'more':
                this.moreDialog();
                break;
            case 'shapes':
                this.moreDialog(true);
                break;
            case 'parameters':
                this.parametersDialog();
                break;
            case 'command':
                this.commandDialog();
                break;
            case 'help':
                this.helpDialog();
                break;
            case 'delete':
                this.deleteSelection();
                break;
            case 'duplicate':
                this.duplicateSelection();
                break;
            case 'copy':
                this.copySelection();
                break;
            case 'paste':
                this.pasteSelection();
                break;
            case 'rotate':
                this.rotateSelection(90);
                break;
            case 'rotate-angle':
                this.ask('Rotate selection', [{ name: 'angle', label: 'Angle · degrees or expression', value: '90' }], v => this.rotateSelection(this.eval(v.angle)));
                break;
            case 'offset':
                this.ask('Offset geometry', [{ name: 'amount', label: 'Distance · expression supported', value: '10' }], v => this.offsetSelection(this.eval(v.amount)));
                break;
            case 'fillet':
                this.ask('Fillet two lines', [{ name: 'radius', label: 'Radius', value: '20' }], v => this.filletSelection(this.eval(v.radius)));
                break;
            case 'trim':
                this.trimSelection(false);
                break;
            case 'extend':
                this.trimSelection(true);
                break;
            case 'explode':
                this.explodeSelection();
                break;
            case 'make-symbol':
                this.makeSymbolDialog();
                break;
            case 'constraint':
                this.constraintDialog();
                break;
            case 'finish':
                this.finishPath();
                break;
            case 'add-layer':
                this.ask('Add a layer', [{ name: 'name', label: 'Layer name', value: 'New layer' }], v => this.edit('Add layer', () => {
                    if (this.doc.layers.some(l => l.name === v.name))
                        throw new Error('That layer already exists');
                    this.doc.layers.push({ name: v.name || 'New layer', color: '#4f8c7c', visible: true, locked: false });
                    this.currentLayer = v.name;
                }));
                break;
            case 'select-all':
                this.selection = new Set(this.doc.entities.filter(e => isVisible(e, this.doc)).map(e => e.id));
                this.updateSelection();
                break;
            case 'multi-select':
                this.multi = !this.multi;
                this.setTool('select');
                this.toast(this.multi ? 'Multi-select on: tap objects to add or remove.' : 'Multi-select off');
                break;
            case 'reroute':
                this.edit('Reroute connectors', () => this.reroute());
                break;
            case 'graph':
                downloadFile(this.basename() + '.graph.json', JSON.stringify(graphFromDocument(this.doc), null, 2), 'application/json');
                break;
            case 'precision':
                this.precisionDialog();
                break;
            case 'modal-close':
                this.closeModal();
                break;
            case 'modal-confirm':
                await this.modalConfirm?.();
                break;
            case 'tool-line':
            case 'tool-polyline':
            case 'tool-rect':
            case 'tool-circle':
            case 'tool-text':
            case 'tool-dimension':
            case 'tool-pan':
                this.closeModal();
                this.setTool(action.slice(5));
                break;
            case 'edit-text':
                if (this.selected()[0])
                    this.editText(this.selected()[0]);
                break;
            case 'clear-constraints':
                this.edit('Clear sketch constraints', () => { this.doc.constraints = []; });
                break;
            case 'save-project':
                await this.doExport('project');
                break;
            case 'cancel':
                this.setTool('select');
                break;
            default: throw new Error('Unknown command: ' + action);
        }
        this.hideContext();
    }
    updateUI() { this.model3d?.sync(); this.$('.doc-name').textContent = this.doc.name; this.$('.unit-label').textContent = this.doc.units; this.$('.layout-select').innerHTML = (this.doc.layouts || ['Model']).map(l => `<option ${l === this.doc.activeLayout ? 'selected' : ''}>${E(l)}</option>`).join(''); this.renderLibrary(); this.renderInspector(); this.updateStatus(); this.updateTools(); this.updateHistory(); renderDocuments(this); }
    updateStatus() {
        this.$('.status-document').textContent = `${this.doc.entities.length} entities · ${this.doc.units}`;
        for (const [action, on] of [['toggle-grid', this.renderer?.grid], ['toggle-snap', this.objectSnap], ['toggle-ortho', this.ortho]]) {
            const b = this.$(`[data-action="${action}"]`);
            b?.classList.toggle('on', !!on);
            b?.setAttribute('aria-pressed', String(!!on));
        }
    }
    updateHistory() {
        for (const action of ['undo', 'redo']) {
            const b = this.$(`[data-action="${action}"]`);
            if (b)
                b.disabled = !(action === 'undo' ? this.history?.canUndo : this.history?.canRedo);
        }
    }
    updateFrame(stats) {
        if(this.model3d?.active) return;
        const layout = this.doc.activeLayout || 'Model';
        this.$('.view-label').textContent = layout === 'Model' ? 'MODEL SPACE / TOP' : `PAPER SPACE / ${layout}`;
        const badge = this.$('.backend-name');
        if (badge) badge.textContent = this.renderer.orderedComposite ? 'Canvas 2D · fidelity' : stats.backend;
        this.$('.render-badge')?.setAttribute('title', `${stats.compositor || stats.backend}. Stroke engine: ${stats.backend}. ${this.rendererMessage || ''}`);
        this.$('.zoom-value').textContent = Math.round(this.camera.scale * 100) + '%';
        this.$('.stats').textContent = `${stats.segments.toLocaleString()} segments · ${stats.frameMs.toFixed(1)} ms CPU`;
        if (this.cursor)
            this.$('.coords').textContent = `X ${this.cursor.x.toFixed(1)}   Y ${this.cursor.y.toFixed(1)}`;
    }
    rendererStatus(s) {
        const el = this.$('.backend-name');
        if (el)
            el.textContent = s.backend;
        this.rendererMessage = s.message || '';
        if (s.message)
            this.$('.render-badge')?.setAttribute('title', s.message);
    }
    beginBlockEdit(name) { return startBlockEditor(this,name); }
    saveBlockEdit(close=false) { return finishBlockEditor(this,true,!close); }
    cancelBlockEdit() { return finishBlockEditor(this,false); }
    selected() { return this.doc.entities.filter(e => this.selection.has(e.id)); }
    eval(source) { return evaluateExpression(source, this.doc.parameters); }
    touch(changed = null) {
        refreshCalculations(this);
        const spatial = regenerateFeatures(this.doc);
        if(changed && spatial.updated.length) changed = new Set([...changed,...spatial.updated]);
        if(changed){changed=new Set(changed);for(const c of this.doc.constraints||[])if(!c.suppressed)for(const id of c.entities||[c.entityId])if(id)changed.add(id);for(const e of this.doc.entities)if(e.calculation)changed.add(e.id);}
        const regenerated=regenerateDimensions(this.doc);
        if(changed&&regenerated.length)changed=new Set([...changed,...regenerated]);
        this.doc.version = (this.doc.version || 0) + 1;
        if (changed)
            this.renderer.updateEntities(new Set([...changed, ...(this.lastRoutedIds || [])]));
        else
            this.renderer.setDocument(this.doc);
        this.updateStatus();
    }
    edit(label, action) { this.history.run(label, () => { action(); this.solveConstraints(); this.touch(); }); this.updateUI(); }
    updateSelection() { this.model3d?.selectionChanged(); scheduleRecovery(this); this.renderInspector(); this.renderer.invalidate(); this.root.dispatchEvent(new CustomEvent('conduit:selection', { detail: { ids: [...this.selection] } })); }
    selectEntity(id, focus = false) {
        this.selection = new Set([id]);
        if (focus) {
            const e = this.doc.entities.find(e => e.id === id);
            if (e) {
                const b = entityBounds(e, this.doc);
                if (validBounds(b)) {
                    const c = center(b);
                    this.camera.x = c.x;
                    this.camera.y = c.y;
                    this.camera.scale = Math.max(this.camera.scale, Math.min(2, 150 / Math.max(b.maxX - b.minX, b.maxY - b.minY, 1)));
                }
            }
        }
        this.updateSelection();
    }
    setTool(tool) {
        if(this.model3d?.active) this.model3d.setActive(false);
        if (!TOOL_INFO[tool])
            return;
        this.cancelGesture();
        this.tool = tool;
        if (tool !== 'insert')
            this.previewSymbol = null;
        this.draft = [];
        beginDrawing(this,tool);
        this.connectionStart = null;
        this.preview = null;
        this.snap = null;
        this.closeModal();
        this.hideContext();
        this.updateTools();
        this.renderer.invalidate();
    }
    updateTools() {
        scheduleRecovery(this);
        this.root.querySelectorAll('[data-tool]').forEach(b => { b.classList.toggle('active', b.dataset.tool === this.tool); b.setAttribute('aria-pressed', String(b.dataset.tool === this.tool)); });
        this.$('.viewport')?.classList.toggle('drawing', !['select', 'pan'].includes(this.tool));
        this.$('.viewport')?.classList.toggle('panning', this.tool === 'pan');
        let hint = TOOL_INFO[this.tool]?.[1] || '';
        if (this.tool === 'insert')
            hint = `Tap to place ${this.symbolName(this.pendingSymbol)} · drag for precise placement`;
        if (this.tool === 'connect' && this.connectionStart)
            hint = 'Choose a destination port · Escape cancels';
        if (this.draft.length && this.tool !== 'polyline')
            hint = 'Choose the next point · Precision entry is available under More';
        this.$('.tool-hint').textContent = hint;
        this.$('.tool-hint').classList.toggle('working', this.tool !== 'select' && this.tool !== 'pan');
        this.$('.finish-button').classList.toggle('hide', !(this.tool === 'polyline' && this.draft.length >= 2));
        updateDrawingControls(this);
        this.root.querySelectorAll('.workbar .tab').forEach(b => b.classList.toggle('active', b.dataset.action === (this.model3d?.active ? 'mode-3d' : this.tool === 'connect' ? 'mode-connect' : this.inspectorTab === 'qa' && this.$('.inspector').classList.contains('open') ? 'mode-inspect' : 'mode-draw')));
    }
    isMobile() { return this.mobileMedia?.matches ?? matchMedia(MOBILE_MEDIA).matches; }
    togglePanel(name) {
        const panel = this.$('.' + name);
        if (panel.classList.contains('open')) {
            this.closePanels();
        }
        else
            this.openPanel(name);
    }
    openPanel(name) {
        if (this.isMobile()) {
            this.$('.library').classList.remove('open');
            this.$('.inspector').classList.remove('open');
            this.$('.sheet-backdrop').classList.add('visible');
        }
        this.$('.' + name).classList.add('open');
        if (name === 'inspector')
            this.renderInspector();
        updateMobilePanels(this, name);
    }
    closePanels() { const panelFocused = document.activeElement?.closest('.library,.inspector'); this.$('.library').classList.remove('open'); this.$('.inspector').classList.remove('open'); this.$('.sheet-backdrop').classList.remove('visible'); updateMobilePanels(this); if(panelFocused)this.panelPreviousFocus?.focus?.({preventScroll:true}); }
    symbolName(id) { return SYMBOLS.find(s => s.id === id)?.name || this.doc.blocks[id]?.symbol?.name || id || 'symbol'; }
    renderLibrary() {
        this.$('.library-count').textContent = String(SYMBOLS.length);
        this.$('#symbol-category').value = this.category;
        this.root.querySelectorAll('[data-category]').forEach(b => b.classList.toggle('active', b.dataset.category === this.category));
        const query = this.librarySearch.trim();
        let items = this.category === 'Custom' ? Object.values(this.doc.blocks).filter(b => !SYMBOLS.some(s => s.block === b.name)).map(b => ({ id: b.name, name: b.symbol?.name || b.name, block: b.name, category: 'Custom', symbol: b.symbol })) : searchSymbols(query, { category: query ? undefined : this.category });
        if (query && this.category === 'Custom') items = items.filter(s => (s.name + ' ' + s.id).toLowerCase().includes(query.toLowerCase()));
        this.$('.library-summary').textContent = `${items.length} matching symbols${query && this.category !== 'Custom' ? ' · all categories' : ''}`;
        const groups = {};
        for (const s of items) {
            const group = query || this.category === 'All' ? (CATEGORIES.find(c => c.id === s.category)?.name || s.category) : s.symbol?.group || (this.category === 'Custom' ? 'Your DXF blocks' : 'Components');
            (groups[group] ??= []).push(s);
        }
        this.$('.library-scroll').innerHTML = Object.entries(groups).map(([name, items]) => `<section class="library-group"><div class="section-label">${E(name)}<span>${items.length}</span></div><div class="symbol-grid">${items.map(s => `<button class="symbol-card ${this.pendingSymbol === s.id && this.tool === 'insert' ? 'selected' : ''}" data-symbol="${E(s.id)}" title="Place ${E(s.name)}" aria-label="Place ${E(s.name)}">${this.librarySymbolPreview(s)}<span>${E(s.name)}</span><small class="symbol-convention">${E(s.symbol?.standardRefs?.filter(r => r !== 'NFPC-FLUID').join(' / ') || 'Custom')}</small><span class="symbol-drag-handle" title="Drag symbol onto drawing" aria-hidden="true">${icon('drag')}</span></button>`).join('')}</div></section>`).join('') || `<div class="list-empty">${icon('symbols')}<br>${this.category === 'Custom' ? 'Select geometry and use Make symbol, or open a DXF with blocks.' : 'No matching symbols.'}</div>`;
    }
    librarySymbolPreview(symbol) {
        const existing = this.doc.blocks[symbol.block];
        if (existing) return symbolSVG(existing, this.doc);
        const block = { name: symbol.block, base: symbol.base, entities: symbol.entities, ports: symbol.ports, symbol: symbol.symbol };
        return symbolSVG(block, { ...this.doc, blocks: { ...this.doc.blocks, [symbol.block]: block } });
    }
    libraryGuide() {
        const updates = symbolUpdates(this.doc).filter(s => this.doc.entities.some(e => e.type === 'INSERT' && e.block === s.block));
        this.openModal('Symbol conventions & library updates', `<p><strong>${SYMBOLS.length} masters · ${CATEGORIES.length} categories · geometry revision 3.</strong> Native CAD geometry, named terminals, documented normal states and explicit reference families.</p><div class="hint-box">Reference families do not certify normative dimensions. ISO process/fluid-power, IEC electrical and ISA instrument notation are kept separate. Building services, automation, fire-alarm and network blocks are project conventions, not ISO safety signs.</div><div class="convention-list">${CATEGORIES.map(c => `<section><strong>${E(c.name)}</strong><p>${E(c.description)}</p><small>${E(c.refs.join(' / '))}</small></section>`).join('')}</div><details><summary>Primary reference catalogue</summary>${Object.entries(STANDARD_REFERENCES).map(([id, r]) => `<p><strong>${E(id)}</strong> — ${E(r.title)}<br><small>${E(r.scope)}</small></p>`).join('')}</details><div class="hint-box">${updates.length ? `${updates.length} used saved definitions have an older geometry revision. Applying updates replaces those definitions, keeps instance IDs/transforms and named terminals, and reroutes connections in one undoable edit. Custom changes to those definitions will be replaced.` : 'No used saved definitions need a revision update.'} Existing drawings are never migrated automatically.</div>`, { wide: true, ...(updates.length ? { confirm: 'Update used definitions', onConfirm: () => {
            this.edit('Update symbol library definitions', () => { updateSymbolDefinitions(this.doc, updates.map(s => s.id)); this.reroute(); });
            this.closeModal(); this.toast('Library updated; Undo restores previous definitions and routes.');
        } } : {}) });
    }
    pickSymbol(id) {
        this.pendingSymbol = id;
        this.setTool('insert');
        this.pendingSymbol = id;
        this.previewSymbol = this.symbolAt(id, this.camera.x, this.camera.y, false);
        if (this.isMobile())
            this.closePanels();
        this.renderLibrary();
        this.updateTools();
        this.renderer.invalidate();
    }
    symbolAt(id, x, y, tag = true) {
        const built = SYMBOLS.find(s => s.id === id);
        if (built)
            return insertSymbol(this.doc, id, x, y, { tag: tag ? this.nextTag(id) : '' });
        const block = this.doc.blocks[id];
        if (!block)
            throw new Error('Symbol block is missing');
        return entity('INSERT', { block: id, x, y, sx: 1, sy: 1, rotation: 0, layer: this.currentLayer, tag: tag ? this.nextTag(id) : '' });
    }
    nextTag(id) {
        const prefix = SYMBOLS.find(s => s.id === id)?.symbol?.functionCode || (id.includes('valve') ? 'HV' : id.includes('pump') ? 'P' : id === 'heat-exchanger' ? 'E' : id === 'pressure-indicator' ? 'PI' : id === 'flow-transmitter' ? 'FT' : id === 'temperature' ? 'TT' : id.includes('tank') ? 'TK' : id === 'motor' ? 'M' : id === 'resistor' ? 'R' : id === 'capacitor' ? 'C' : 'S');
        let i = 101;
        const tags = new Set(this.doc.entities.map(e => e.tag));
        while (tags.has(prefix + '-' + i))
            i++;
        return prefix + '-' + i;
    }
    placeSymbol(id, p) { let added; this.edit('Insert ' + this.symbolName(id), () => { added = this.symbolAt(id, p.x, p.y); added.layout = this.doc.activeLayout; this.doc.entities.push(added); this.selection = new Set([added.id]); }); this.setTool('select'); this.updateSelection(); this.toast(`${this.symbolName(id)} placed · drag a port to connect`); return added; }
    libraryPointerDown(event) {
        const card = event.target.closest('[data-symbol]');
        if (!card || event.button !== 0)
            return;
        const id = card.dataset.symbol, start = { x: event.clientX, y: event.clientY }, type = event.pointerType;
        let dragging = false, timer = null;
        const abort = new AbortController();
        const begin = () => {
            dragging = true;
            if (this.isMobile()) document.activeElement?.blur?.();
            try { this.$('.viewport').setPointerCapture(event.pointerId); } catch {}
            card.style.touchAction = 'none';
            this.pendingSymbol = id;
            this.previewSymbol = this.symbolAt(id, this.camera.x, this.camera.y, false);
            if (this.isMobile())
                this.closePanels();
        };
        if (type === 'touch' && event.target.closest('.symbol-drag-handle')) { event.preventDefault(); begin(); }
        else if (type === 'touch') return;
        const move = e => {
            if (e.pointerId !== event.pointerId) return;
            const dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (!dragging && type !== 'touch' && Math.hypot(dx, dy) > 7)
                begin();
            if (!dragging && type === 'touch' && Math.hypot(dx, dy) > 12) {
                clearTimeout(timer);
                return;
            }
            if (!dragging)
                return;
            e.preventDefault();
            const r = this.$('.viewport').getBoundingClientRect(), screen = { x: e.clientX - r.left, y: e.clientY - r.top };
            this.cursor = this.snapPoint(this.camera.world(screen), new Set());
            this.previewSymbol = this.symbolAt(id, this.cursor.x, this.cursor.y, false);
            this.renderer.invalidate();
        };
        const up = e => {
            if (e.pointerId !== event.pointerId) return;
            clearTimeout(timer);
            abort.abort();
            try { if (this.$('.viewport').hasPointerCapture(e.pointerId)) this.$('.viewport').releasePointerCapture(e.pointerId); } catch {}
            card.style.touchAction = 'pan-y';
            if (dragging) {
                this.suppressLibraryClick = id;
                this.suppressLibraryClickUntil = performance.now() + 300;
                this.previewSymbol = null;
                const r = this.$('.viewport').getBoundingClientRect();
                if (this.renderer.containsPoint({x:e.clientX-r.left,y:e.clientY-r.top})) {
                    const p = this.snapPoint(this.camera.world({ x: e.clientX - r.left, y: e.clientY - r.top }), new Set());
                    this.placeSymbol(id, p);
                }
                else
                    this.renderer.invalidate();
            }
        };
        window.addEventListener('pointermove', move, { signal: abort.signal, passive: false });
        window.addEventListener('pointerup', up, { signal: abort.signal, once: true });
        window.addEventListener('pointercancel', () => { clearTimeout(timer); abort.abort(); this.previewSymbol = null; this.renderer.invalidate(); }, { signal: abort.signal, once: true });
    }
    field(name, label, value, full = false, unit = '') { return `<label class="field ${full ? 'full' : ''}"><span>${E(label)}${unit ? `<span class="unit">${E(unit)}</span>` : ''}</span><input data-prop="${name}" value="${E(value ?? '')}" autocomplete="off" spellcheck="false" inputmode="${['tag', 'text'].includes(name) ? 'text' : 'decimal'}" aria-label="${E(label)}"></label>`; }
    renderInspector() {
        if(this.model3d?.active && this.inspectorTab === "properties") this.model3d.renderInspector();
        else { this.renderBaseInspector(); renderParametricInspector(this,this.$('.inspector-content')); }
        this.iconography?.prepare(this.$('.inspector'));
        updateMobilePanels(this);
    }
    renderBaseInspector() {
        const host = this.$('.inspector-content');
        if (!host)
            return;
        const scroll = host.scrollTop;
        this.root.querySelectorAll('[data-inspector]').forEach(b => b.classList.toggle('active', b.dataset.inspector === this.inspectorTab));
        if (this.inspectorTab === 'layers') {
            host.innerHTML = `<div class="section-label">DRAWING LAYERS <span>${this.doc.layers.length}</span></div><p class="muted-note">Hidden layers do not render. Locked layers can be inspected but not moved.</p>${this.doc.layers.map(l => `<div class="layer-row"><input type="color" value="${E(l.color)}" data-layer-color="${E(l.name)}" aria-label="Color of ${E(l.name)}"><span title="${E(l.name)}">${E(l.name)}</span><button data-layer-visible="${E(l.name)}" class="${l.visible ? 'active' : ''}" title="${l.visible ? 'Hide' : 'Show'} ${E(l.name)}" aria-label="${l.visible ? 'Hide' : 'Show'} ${E(l.name)}" aria-pressed="${l.visible}">${icon(l.visible ? 'eye' : 'eye-off')}</button><button data-layer-lock="${E(l.name)}" class="${l.locked ? 'active' : ''}" title="${l.locked ? 'Unlock' : 'Lock'} ${E(l.name)}" aria-label="${l.locked ? 'Unlock' : 'Lock'} ${E(l.name)}" aria-pressed="${l.locked}">${icon(l.locked ? 'lock' : 'unlock')}</button></div>`).join('')}<div style="margin-top:14px">${btn('add-layer', 'Add layer', 'plus', 'btn')}</div><div class="inspector-section"><h3>Active drawing layer</h3><select data-active-layer aria-label="Active drawing layer">${this.doc.layers.map(l => `<option ${l.name === this.currentLayer ? 'selected' : ''}>${E(l.name)}</option>`).join('')}</select></div>`;
            return;
        }
        if (this.inspectorTab === 'qa') {
            const issues = this.checkDrawing();
            host.innerHTML = `<div class="section-label">DRAWING CHECK <span>${issues.length} finding${issues.length !== 1 ? 's' : ''}</span></div>${issues.length ? issues.map(i => `<button class="issue" ${i.entityId ? `data-select-entity="${E(i.entityId)}"` : ''}>${icon(i.severity === 'info' ? 'help' : 'warning')}<span>${E(i.message)}${i.detail ? `<small>${E(i.detail)}</small>` : ''}</span></button>`).join('') : `<div class="list-empty">${icon('check')}<br>No problems found by the implemented checks.</div>`}<div class="hint-box">Checks cover dangling connections, duplicate tags, blocked routes, missing blocks, degenerate geometry and DXF import warnings. This is not engineering or standards certification.</div><div style="margin-top:14px">${btn('reroute', 'Reroute connections', 'connect', 'btn')}${btn('graph', 'Export graph', 'graph', 'btn')}</div>`;
            return;
        }
        const selected = this.selected();
        if (!selected.length) {
            host.innerHTML = `<div class="object-card"><div class="object-preview">${icon('graph')}</div><div class="object-meta"><strong>${E(this.doc.name)}</strong><small>DXF NATIVE · 2D ENGINEERING DRAWING</small></div></div><section class="inspector-section"><h3>Drawing overview</h3><div class="property-list"><div class="property-row"><span>Entities</span><b>${this.doc.entities.length}</b></div><div class="property-row"><span>Symbol instances</span><b>${this.doc.entities.filter(e => e.type === 'INSERT').length}</b></div><div class="property-row"><span>Smart connections</span><b>${this.doc.entities.filter(e => e.connector).length}</b></div><div class="property-row"><span>Units</span><b>${E(this.doc.units)}</b></div><div class="property-row"><span>Current layer</span><b>${E(this.currentLayer)}</b></div></div></section><section class="inspector-section"><h3>Precision tools</h3><div class="operation-grid">${btn('parameters', 'Parameters', 'param')}${btn('precision', 'Draw by values', 'ruler')}${btn('line-styles', 'Line styles', 'line')}${btn('multi-select', 'Multi-select', 'select')}</div></section><section class="inspector-section"><h3>Made for direct editing</h3><div class="hint-box"><strong>Start with a symbol.</strong><br>Drag from the library, or tap one and place it on the canvas. Drag a port to create a routed connection.<br><br>Two fingers pan and zoom. Select an object to reveal its geometry.</div></section><p class="muted-note">Everything stays on this device. Export a project file to preserve constraints, ports and recovery data.</p>`;
            return;
        }
        if (selected.length > 1) {
            let b = emptyBounds();
            for (const e of selected)
                b = union(b, entityBounds(e, this.doc));
            host.innerHTML = `<div class="section-label">${selected.length} OBJECTS SELECTED</div><div class="hint-box">Selection: ${format(b.maxX - b.minX)} × ${format(b.maxY - b.minY)} ${E(this.doc.units)}<br>Shift-click or enable Multi-select to add objects.</div><div class="inspector-section"><h3>Transform & edit</h3><div class="operation-grid">${btn('duplicate', 'Duplicate', 'copy')}${btn('rotate', 'Rotate 90°', 'rotate')}${btn('constraint', 'Constrain', 'param')}${btn('make-symbol', 'Make symbol', 'symbols')}${btn('fillet', 'Fillet', 'fillet')}${btn('trim', 'Trim', 'trim')}${btn('extend', 'Extend', 'extend')}${btn('delete', 'Delete', 'trash')}</div></div>${this.constraintsHTML(selected)}`;
            return;
        }
        const e = selected[0], b = entityBounds(e, this.doc), block = e.type === 'INSERT' ? this.doc.blocks[e.block] : null, anchor = e.type === 'INSERT' ? { x: e.x, y: e.y } : e.c || e.p || e.a || e.points?.[0] || { x: 0, y: 0 };
        let fields = this.field('x', 'Position X', format(anchor.x), false, this.doc.units) + this.field('y', 'Position Y', format(anchor.y), false, this.doc.units);
        if (e.type === 'INSERT') {
            fields += this.field('sx', 'Scale X', format(e.sx ?? 1)) + this.field('sy', 'Scale Y', format(e.sy ?? 1)) + this.field('rotation', 'Rotation', format(e.rotation || 0), true, 'deg');
        }
        if (e.type === 'LINE') {
            fields += this.field('x2', 'End X', format(e.b.x)) + this.field('y2', 'End Y', format(e.b.y)) + this.field('length', 'Length', e.parametric?.length ?? format(distance(e.a, e.b)), true, this.doc.units);
        }
        if (e.r !== undefined)
            fields += this.field('radius', 'Radius', e.parametric?.radius ?? format(e.r), true, this.doc.units);
        if (e.parametric?.kind === 'rectangle')
            fields += this.field('rectWidth', 'Width', e.parametric.width, false, this.doc.units) + this.field('rectHeight', 'Height', e.parametric.height, false, this.doc.units);
        if (['TEXT','MTEXT','ATTDEF','ATTRIB'].includes(e.type))
            fields += (e.calculation?this.field('calculationExpression','Calculated expression',e.calculation.expression,true)+this.field('calculationPrecision','Calculation precision',e.calculation.precision??3)+this.field('calculationPrefix','Calculation prefix',e.calculation.prefix||'',true)+this.field('calculationSuffix','Calculation suffix',e.calculation.suffix||'',true):this.field('text', 'Text', e.text, true)) + this.field('height', 'Text height', format(e.height)) + this.field('rotation', 'Rotation', format(e.rotation || 0));
        if(['ATTDEF','ATTRIB'].includes(e.type))fields+=this.field('attributeTag','Attribute tag',e.attributeTag||e.tag||'',true)+this.field('prompt','Attribute prompt',e.prompt||'',true)+this.field('attributeFlags','Attribute flags · 1 hidden / 2 constant / 4 verify / 8 preset',e.attributeFlags||0,true);
        host.innerHTML = `<div class="object-card"><div class="object-preview">${block ? symbolSVG(block, this.doc) : icon(e.connector ? 'connect' : e.type === 'LINE' ? 'line' : e.type === 'CIRCLE' ? 'circle' : 'rect')}</div><div class="object-meta"><strong>${E(e.tag || block?.symbol?.name || e.type)}</strong><small>${E(e.type)}${e.connector ? ' · ROUTED CONNECTION' : e.type === 'INSERT' ? ' · BLOCK REFERENCE' : ' · CAD ENTITY'}</small></div></div><div class="inspector-section"><h3>Identity</h3><div class="fields">${e.type === 'INSERT' ? this.field('tag', 'Equipment tag', e.tag || '', true) : ''}${e.connector ? this.field('label', 'Line label', e.label || '', true) : ''}<label class="field full">Layer<select data-prop="layer">${this.doc.layers.map(l => `<option ${l.name === e.layer ? 'selected' : ''}>${E(l.name)}</option>`).join('')}</select></label></div></div><div class="inspector-section"><h3>Geometry ${isLocked(e, this.doc) ? '· locked' : ''}</h3><div class="fields">${fields}</div></div>${e.connector ? `<div class="inspector-section"><h3>Connection</h3><div class="property-list"><div class="property-row"><span>Routing</span><b>${E(e.connector.status || 'routed')}</b></div><div class="property-row"><span>Start</span><b>${E(e.connector.from?.port || 'Free endpoint')}</b></div><div class="property-row"><span>End</span><b>${E(e.connector.to?.port || 'Free endpoint')}</b></div></div><div style="margin-top:12px">${btn('reroute', 'Reroute', 'connect', 'btn')}</div></div>` : ''}<div class="inspector-section"><h3>Actions</h3><div class="operation-grid">${btn('duplicate', 'Duplicate', 'copy')}${btn('rotate', 'Rotate 90°', 'rotate')}${btn('offset', 'Offset', 'offset')}${btn('constraint', 'Constrain', 'param')}${e.type === 'INSERT' ? btn('explode', 'Explode', 'symbols') : btn('make-symbol', 'Make symbol', 'symbols')}${btn('delete', 'Delete', 'trash')}</div></div>${this.constraintsHTML(selected)}<p class="muted-note">Numeric fields accept expressions such as <code>valveSize / 2</code>. Named parameters are managed in Parameters.</p>`;
        if (block?.symbol) {
            const section = document.createElement('section'); section.className = 'inspector-section symbol-provenance';
            section.innerHTML = `<h3>Symbol convention</h3><p>${E(block.symbol.standardRefs?.join(' / ') || block.symbol.convention || 'Custom block')}</p><p class="muted-note">Saved geometry revision ${E(block.symbol.geometryRevision || 'custom')} · ${E(block.symbol.review?.dimensionalConformance || 'not-verified')} dimensions</p>${btn('library-guide', 'Conventions & updates', 'help', 'btn')}`;
            host.append(section);
        }
        renderCadEditing(this,e,host);
        renderDrawingInspector(this,e,host);
        host.scrollTop = scroll;
    }
    constraintsHTML(selected) { const ids = new Set(selected.map(e => e.id)), cs = this.doc.constraints.filter(c => (c.entities || [c.entityId]).some(id => ids.has(id))); return cs.length ? `<div class="inspector-section"><h3>Sketch constraints</h3>${cs.map(c => `<div class="constraint-item">${icon('param')}<span>${E(c.type)}${c.value !== undefined ? ' = ' + E(c.value) : ''}</span><button data-constraint-delete="${E(c.id)}" title="Remove constraint">${icon('close')}</button></div>`).join('')}</div>` : ''; }
    onChange(event) {
        const t = event.target;
        try {
            if(nativePropertyChange(this,t))return;
            if(changeCadEditing(this,t))return;
            if(t.id==='dxf-mode'){this.modal.querySelector('#dxf-version').disabled=t.value==='preserve';this.modal.querySelector('#dxf-strict').disabled=t.value==='preserve';return;}
            if (t.id === 'symbol-category') {
                this.category = t.value; this.librarySearch = ''; this.$('#symbol-search').value = '';
                this.renderLibrary(); this.$('.library-scroll').scrollTop = 0; return;
            }
            if (t.dataset.activeLayer !== undefined) {
                this.currentLayer = t.value;
                this.updateStatus();
                return;
            }
            if (t.classList.contains('layout-select')) {
                this.doc.activeLayout = t.value;
                this.selection.clear();
                this.renderer.setDocument(this.doc);
                this.renderer.fit();
                this.updateSelection();
                return;
            }
            if (t.dataset.layerColor) {
                this.edit('Layer color', () => this.doc.layers.find(l => l.name === t.dataset.layerColor).color = t.value);
                return;
            }
            if (t.dataset.prop) {
                const selected = this.selected();
                if (selected.length !== 1)
                    return;
                const e = selected[0];
                if (isLocked(e, this.doc))
                    throw new Error('Unlock the layer before editing geometry');
                this.edit('Edit ' + t.dataset.prop, () => { this.setProperty(e, t.dataset.prop, t.value); this.solveConstraints(); this.reroute(new Set([e.id])); });
            }
        }
        catch (error) {
            this.toast(error.message, true);
            this.renderInspector();
        }
    }
    setProperty(e, key, source) {
        if(key.startsWith('calculation')){if(!e.calculation)throw new Error('No calculated text');const fields={calculationExpression:'expression',calculationPrecision:'precision',calculationPrefix:'prefix',calculationSuffix:'suffix'};if(!fields[key])throw new Error('Unknown calculated text field');e.calculation[fields[key]]=key==='calculationPrecision'?Number(source):source;e.dirty=true;return;}
        if (['tag', 'text', 'label', 'layer', 'attributeTag', 'prompt'].includes(key)) {
            e[key] = source;if(key==='attributeTag')e.tag=source;
            e.dirty = true;
            return;
        }
        const v = this.eval(source);
        if (Math.abs(v) > 1e12)
            throw new Error('Value is outside the supported drawing range');
        const anchor = e.type === 'INSERT' ? { x: e.x, y: e.y } : e.c || e.p || e.a || e.points?.[0];
        if (key === 'x' || key === 'y') {
            if (!anchor)
                throw new Error('Entity has no editable anchor');
            moveEntity(e, key === 'x' ? v - anchor.x : 0, key === 'y' ? v - anchor.y : 0);
        }
        else if (key === 'x2' || key === 'y2') {
            if (e.b)
                e.b[key === 'x2' ? 'x' : 'y'] = v;
        }
        else if (key === 'radius') {
            if (v <= 0)
                throw new Error('Radius must be positive');
            e.r = v;
            e.parametric = { ...e.parametric, radius: source };
        }
        else if (key === 'length') {
            if (v <= 0)
                throw new Error('Length must be positive');
            const d = distance(e.a, e.b) || 1;
            e.b = { x: e.a.x + (e.b.x - e.a.x) * v / d, y: e.a.y + (e.b.y - e.a.y) * v / d };
            e.parametric = { ...e.parametric, length: source };
        }
        else if (key === 'rectWidth' || key === 'rectHeight') {
            if (v <= 0)
                throw new Error('Rectangle dimensions must be positive');
            e.parametric[key === 'rectWidth' ? 'width' : 'height'] = source;
            this.evaluateParametric(e);
        }
        else if (key === 'rotation') {
            e.rotation = v;
        }
        else if (key === 'height') {
            if (v <= 0)
                throw new Error('Text height must be positive');
            e.height = v;
        }
        else if(key==='attributeFlags'){if(!Number.isInteger(v)||v<0||v>15)throw new Error('Attribute flags must be an integer 0–15');e.attributeFlags=v;e.constant=!!(v&2);e.invisible=!!(v&1);}
        else if (key === 'sx' || key === 'sy') {
            if (Math.abs(v) < 1e-8)
                throw new Error('Scale must be nonzero');
            e[key] = v;
        }
        e.dirty = true;
    }
    evaluateParametric(e) {
        const p = e.parametric;
        if (!p)
            return;
        if (p.radius !== undefined) {
            e.r = this.eval(p.radius);
            if (e.r <= 0)
                throw new Error('Radius must be positive');
        }
        if (p.length !== undefined && e.a && e.b) {
            const n = this.eval(p.length), d = distance(e.a, e.b) || 1;
            if (n <= 0)
                throw new Error('Line length must be positive');
            e.b = { x: e.a.x + (e.b.x - e.a.x) * n / d, y: e.a.y + (e.b.y - e.a.y) * n / d };
        }
        if (p.kind === 'rectangle') {
            const w = this.eval(p.width), h = this.eval(p.height);
            if (w <= 0 || h <= 0)
                throw new Error('Rectangle dimensions must be positive');
            const a = e.points[0], angle = Math.atan2(e.points[1].y - a.y, e.points[1].x - a.x), c = Math.cos(angle), s = Math.sin(angle);
            e.points = [{ ...a }, { x: a.x + c * w, y: a.y + s * w }, { x: a.x + c * w - s * h, y: a.y + s * w + c * h }, { x: a.x - s * h, y: a.y + c * h }];
        }
    }
    constraintsForSolve() {const referenced=new Set(this.doc.constraints.filter(c=>!c.suppressed&&!c.reference).flatMap(c=>c.entities||[c.entityId]));return [...this.doc.constraints,...this.doc.entities.filter(e=>!e.locked&&referenced.has(e.id)&&isLocked(e,this.doc)).map(e=>({id:'layer-lock-'+e.id,type:'fixed',entityId:e.id,target:clone(e),visible:false}))];}
    solveConstraints() {
        if (!this.doc.constraints.length) { this.lastSolve=null; return; }
        const result = this.solver.solve(this.doc.entities, this.constraintsForSolve(), this.doc.parameters);
        this.lastSolve = result;
        if (!result.converged)
            throw new Error(`Constraints conflict or did not converge (residual ${result.residual.toPrecision(3)}). The edit was rolled back.`);
    }
    checkDrawing() {
        const issues = [], tags = new Map(), map = new Map(this.doc.entities.map(e => [e.id, e]));
        for (const e of this.doc.entities) {
            if (e.tag) {
                if (tags.has(e.tag))
                    issues.push({ severity: 'warning', entityId: e.id, message: 'Duplicate equipment tag: ' + e.tag });
                tags.set(e.tag, e.id);
            }
            if (e.type === 'INSERT' && !this.doc.blocks[e.block])
                issues.push({ severity: 'warning', entityId: e.id, message: 'Missing block definition: ' + e.block });
            if (e.type === 'LINE' && distance(e.a, e.b) < 1e-7)
                issues.push({ severity: 'warning', entityId: e.id, message: 'Zero-length line' });
            if (e.r !== undefined && e.r <= 0)
                issues.push({ severity: 'warning', entityId: e.id, message: 'Nonpositive radius' });
            if (e.connector) {
                for (const key of ['from', 'to']) {
                    const ref = e.connector[key], target = ref && map.get(ref.entityId);
                    if (!target)
                        issues.push({ severity: 'warning', entityId: e.id, message: `Connection has a free ${key === 'from' ? 'start' : 'end'} endpoint`, detail: e.label || e.id });
                    else if (!ports(target, this.doc).some(p => p.name === ref.port))
                        issues.push({ severity: 'warning', entityId: e.id, message: 'Connection references a missing port' });
                }
                if (e.connector.status === 'blocked')
                    issues.push({ severity: 'warning', entityId: e.id, message: 'No collision-free orthogonal route was found', detail: 'Move equipment or edit the connector route.' });
            }
        }
        const seen = new Set();
        for (const i of this.doc.importDiagnostics || [])
            if (i.severity === 'warning' && !seen.has(i.message)) {
                issues.push(i);
                seen.add(i.message);
            }
        return issues;
    }
    nearby(p, tolerance = 18) { const r = tolerance / this.camera.scale; return this.renderer.scene?.index.search({ minX: p.x - r, minY: p.y - r, maxX: p.x + r, maxY: p.y + r }) || []; }
    hitTest(p, tolerance = 12) {
        let hit = null, best = tolerance / this.camera.scale;
        for (const item of this.nearby(p, tolerance).reverse()) {
            const e = item.entity;
            if (!e || !isVisible(e, this.doc))
                continue;
            const g = entityGeometry(e, this.doc, { tolerance: .5 / this.camera.scale, view:this.camera.viewport });
            let d = Infinity;
            for (const path of g.paths) {
                if(path.clips?.some(polygon=>!filledContains(p,[polygon])))continue;
                for (const contour of path.contours || [path.points]) {
                    for (let i=1;i<contour.length;i++) d=Math.min(d,distanceToSegment(p,contour[i-1],contour[i]));
                    if (path.closed && contour.length>1) d=Math.min(d,distanceToSegment(p,contour.at(-1),contour[0]));
                }
                if (path.fill && filledContains(p,path.contours || [path.points])) d=0;
            }
            if (['INSERT', 'TEXT', 'MTEXT'].includes(e.type) && contains(item, p))
                d = Math.min(d, 3 / this.camera.scale);
            if (d <= best) {
                best = d;
                hit = e;
            }
        }
        return hit;
    }
    portAt(p, { selectedOnly = false, tolerance = 20 } = {}) {
        let found = null, best = tolerance / this.camera.scale;
        for (const item of this.nearby(p, tolerance + 20)) {
            const e = item.entity;
            if (e.type !== 'INSERT' || (selectedOnly && !this.selection.has(e.id)))
                continue;
            for (const port of ports(e, this.doc)) {
                const d = distance(p, port);
                if (d < best) {
                    best = d;
                    found = port;
                }
            }
        }
        return found;
    }
    snapPoint(p, exclude = new Set(), base = null) {
        let best = null, bestDistance = 14 / this.camera.scale;
        this.snap = null;
        if (this.objectSnap) {
            const near = this.nearby(p, 20).filter(i => !exclude.has(i.id)), lines = [];
            for (const item of near) {
                const e = item.entity, candidates = [...snapCandidates(e), ...ports(e, this.doc).map(p => ({ ...p, kind: 'port' }))];
                if (e.type === 'LINE')
                    lines.push(e);
                for (const c of candidates) {
                    const d = distance(c, p);
                    if (d < bestDistance) {
                        bestDistance = d;
                        best = { ...c, entityId: e.id };
                    }
                }
            }
            for (let i = 0; i < Math.min(lines.length, 16); i++)
                for (let j = i + 1; j < Math.min(lines.length, 16); j++) {
                    const q = lineIntersection(lines[i].a, lines[i].b, lines[j].a, lines[j].b);
                    if (q && distance(q, p) < bestDistance) {
                        bestDistance = distance(q, p);
                        best = { x: q.x, y: q.y, kind: 'intersection' };
                    }
                }
        }
        if (best) {
            this.snap = best;
            return { x: best.x, y: best.y };
        }
        let result = { ...p };
        if (this.gridSnap) {
            let step = 10;
            try {
                step = Math.abs(this.eval(this.doc.parameters.grid || 10)) || 10;
            }
            catch { }
            result = { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
        }
        if ((this.ortho || this.shift) && base) {
            if (Math.abs(result.x - base.x) > Math.abs(result.y - base.y))
                result.y = base.y;
            else
                result.x = base.x;
        }
        return result;
    }
    connectionPoint(p) {
        const port = this.portAt(p);
        if (port)
            return { p: { x: port.x, y: port.y, dx: port.dx, dy: port.dy, entityId: port.entityId }, ref: { entityId: port.entityId, port: port.name }, port };
        const hit = this.hitTest(p);
        if (hit?.type === 'INSERT') {
            const nearest = ports(hit, this.doc).sort((a, b) => distance(p, a) - distance(p, b))[0];
            if (nearest)
                return { p: nearest, ref: { entityId: hit.id, port: nearest.name }, port: nearest };
        }
        return { p: this.snapPoint(p), ref: null };
    }
    obstacles() { return this.doc.entities.filter(e => e.type === 'INSERT' && isVisible(e, this.doc)).map(e => { const points = entityGeometry(e, this.doc, { tolerance: 1 }).paths.flatMap(p => p.points); return { ...bounds(points), id: e.id }; }).filter(validBounds); }
    routeConnection(start, end, waypoints = []) {
        const obstacles = this.obstacles();
        return routePorts({ ...start.p, entityId: start.ref?.entityId }, { ...end.p, entityId: end.ref?.entityId }, obstacles, { clearance: 12, lead: 22, waypoints });
    }
    createConnector(start, end) {
        if (distance(start.p, end.p) < 1e-6) {
            this.toast('Choose a different destination.');
            return;
        }
        const style = LINE_STYLES.find(s => s.id === this.lineStyle) || LINE_STYLES[0], route = this.routeConnection(start, end);
        let added;
        this.edit('Create routed connector', () => { added = polyline(route.points, false, { layer: style.layer, color: style.color, width: style.width, dash: style.dash, layout: this.doc.activeLayout, label: '', connector: { from: start.ref, to: end.ref, style: style.id, arrow: style.arrow, status: route.status, waypoints: [] } }); this.doc.entities.push(added); this.selection = new Set([added.id]); });
        if (route.status === 'blocked')
            this.toast('A clear route was not found. The connection is flagged in Check.', true);
        this.connectionStart = null;
        this.preview = null;
        this.updateTools();
        return added;
    }
    reroute(changed = null) {
        this.lastRoutedIds = new Set();
        const obstacles = this.obstacles(), map = new Map(this.doc.entities.map(e => [e.id, e]));
        for (const e of this.doc.entities) {
            const c = e.connector;
            if (!c || (!c.from && !c.to))
                continue;
            if (changed && !changed.has(c.from?.entityId) && !changed.has(c.to?.entityId) && !changed.has(e.id))
                continue;
            const endpoint = (ref, fallback) => { const p = ref && ports(map.get(ref.entityId) || {}, this.doc).find(p => p.name === ref.port); return { p: p || fallback, ref: p ? ref : null }; };
            const a = endpoint(c.from, e.points[0]), b = endpoint(c.to, e.points.at(-1)), obs = obstacles.filter(o => o.id !== a.ref?.entityId && o.id !== b.ref?.entityId);
            const route = routePorts({ ...a.p, entityId: a.ref?.entityId }, { ...b.p, entityId: b.ref?.entityId }, obstacles, { clearance: 12, lead: 22, waypoints: c.waypoints });
            e.points = route.points;
            c.status = route.status;
            e.dirty = true;
            this.lastRoutedIds.add(e.id);
        }
    }
    grips(e) {
        // OCS points cannot be exposed as WCS grips. Projected body dragging is handled by moveEntity.
        const n = e.extrusion;
        if (n && ['CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE', 'TEXT', 'INSERT', 'HATCH', 'SOLID', 'TRACE'].includes(e.type) && (Math.abs(n.x || 0) > 1e-12 || Math.abs(n.y || 0) > 1e-12 || Math.abs((n.z ?? 1) - 1) > 1e-12)) return [];
        const additional=nativeGrips(e);if(additional!==null)return additional;
        if(e.type==='DIMENSION')return e.dimension?.version===1?dimensionGrips(e,this.doc):e.block?[]:[{...e.a,key:'a'},{...e.b,key:'b'}];
        if (e.type === 'LINE' || e.type === 'DIMENSION')
            return [{ ...e.a, key: 'a' }, { ...e.b, key: 'b' }];
        if (e.type === 'CIRCLE' || e.type === 'ARC')
            return [{ ...e.c, key: 'c' }, { x: e.c.x + e.r, y: e.c.y, key: 'radius' }];
        if (e.type === 'INSERT') {
            const custom=dynamicParameterGrips(e,this.doc);if(custom.length)return custom;
            const b = bounds(entityGeometry(e, this.doc, { tolerance: 1 }).paths.flatMap(p => p.points));
            return validBounds(b) ? [{ x: b.maxX, y: b.minY, key: 'scale' }, { x: (b.minX + b.maxX) / 2, y: b.maxY + 25 / this.camera.scale, key: 'rotate' }] : [];
        }
        if (e.points)
            return e.points.map((p, i) => ({ ...p, key: 'point', index: i }));
        if (e.p)
            return [{ ...e.p, key: 'p' }];
        return [];
    }
    pointerDown(p) {
        if (this.modal || !this.renderer.containsPoint(p))
            return;
        this.hideContext();
        this.shift = p.shift;
        const world = this.camera.world(p);
        this.pointer = p;
        this.lastScreen = p;
        this.downScreen = { x: p.x, y: p.y };
        const tolerance = p.pointerType === 'touch' ? 22 : 12;
        if (this.tool === 'pan' || this.space || p.button === 1) {
            this.drag = { kind: 'pan', last: p };
            return;
        }
        if (this.tool === 'select') {
            if (this.selection.size === 1) {
                const e = this.selected()[0];
                if (e && !isLocked(e, this.doc)) {
                    const grip = this.grips(e).find(g => distance(g, world) < tolerance / this.camera.scale);
                    if (grip) {
                        this.history.begin('Edit grip');
                        this.drag = { kind: 'grip', id: e.id, grip, original: clone(e), start: world };
                        return;
                    }
                }
            }
            const port = this.portAt(world, { selectedOnly: true, tolerance: p.pointerType === 'touch' ? 18 : 10 });
            if (port) {
                this.connectionStart = { p: port, ref: { entityId: port.entityId, port: port.name } };
                this.drag = { kind: 'connect-start', fromSelect: true, start: world };
                return;
            }
            const hit = this.hitTest(world, tolerance);
            if (hit) {
                if (p.shift || this.multi) {
                    if (this.selection.has(hit.id))
                        this.selection.delete(hit.id);
                    else
                        this.selection.add(hit.id);
                }
                else if (!this.selection.has(hit.id))
                    this.selection = new Set([hit.id]);
                this.updateSelection();
                if (!isLocked(hit, this.doc) && this.selection.has(hit.id)) {
                    this.history.begin('Move selection');
                    this.drag = { kind: 'move', start: world, originals: this.selected().filter(e => !isLocked(e, this.doc)).map(clone) };
                }
                else
                    this.drag = { kind: 'tap' };
            }
            else {
                if (!p.shift && !this.multi) {
                    this.selection.clear();
                    this.updateSelection();
                }
                this.drag = p.pointerType === 'touch' && !this.multi ? { kind: 'pan', last: p } : { kind: 'marquee', start: world, current: world, additive: p.shift || this.multi };
            }
            return;
        }
        if (this.tool === 'connect') {
            if (!this.connectionStart) {
                this.connectionStart = this.connectionPoint(world);
                this.drag = { kind: 'connect-start', start: world };
            }
            else
                this.drag = { kind: 'connect-end', start: world };
            this.updateTools();
            return;
        }
        if (this.tool === 'insert') {
            this.drag = { kind: 'insert' };
            this.cursor = this.snapPoint(world);
            this.previewSymbol = this.symbolAt(this.pendingSymbol, this.cursor.x, this.cursor.y, false);
            this.renderer.invalidate();
            return;
        }
        if (this.tool === 'text') {
            this.drag = { kind: 'text', p: this.snapPoint(world) };
            return;
        }
        const q = this.snapPoint(world, new Set(), this.draft.at(-1));
        if(this.drawingSession){this.cursor=q;this.drag={kind:'native-draw',start:q};this.preview=drawingPreview(this,q,q);this.renderer.invalidate();return;}
        this.cursor = q;
        this.drag = { kind: 'draw', start: q, wasDraft: !!this.draft.length };
        this.preview = this.makePreview(q, q);
        this.renderer.invalidate();
    }
    pointerMove(p) {
        this.shift = p.shift;
        this.pointer = p;
        this.lastScreen = p;
        const raw = this.camera.world(p), drag = this.drag;
        if (!drag) {
            this.pointerHover(p);
            return;
        }
        if (drag.kind === 'pan') {
            this.camera.pan(p.x - drag.last.x, p.y - drag.last.y);
            drag.last = p;
            this.renderer.invalidate();
            return;
        }
        if (drag.kind === 'move') {
            const start = drag.start;
            let dx = raw.x - start.x, dy = raw.y - start.y;
            const original = drag.originals[0];
            if (original) {
                const anchor = original.type === 'INSERT' ? { x: original.x, y: original.y } : original.a || original.c || original.p || original.points?.[0] || start, q = this.snapPoint({ x: anchor.x + dx, y: anchor.y + dy }, this.selection, anchor);
                dx = q.x - anchor.x;
                dy = q.y - anchor.y;
            }
            for (const old of drag.originals) {
                const i = this.doc.entities.findIndex(e => e.id === old.id), next = clone(old);
                moveEntity(next, dx, dy);
                this.doc.entities[i] = next;
            }
            this.cursor = { x: start.x + dx, y: start.y + dy };
            this.solveConstraints();
            this.reroute(this.selection);
            this.touch(this.selection);
            return;
        }
        if (drag.kind === 'grip') {
            const i = this.doc.entities.findIndex(e => e.id === drag.id), e = clone(drag.original), g = drag.grip, q = this.snapPoint(raw, this.selection);
            if(changeNativeGrip(e,g,q)) {}
            else if(g.key.startsWith('dyn:')) {const name=g.key.slice(4);setDynamicParameters(e,this.doc,{[name]:dynamicGripValue(e,this.doc,name,q)});}
            else if(g.key.startsWith('dim:')) {editDimension(e,this.doc,{[g.key.slice(4)]:q});}
            else if (g.key === 'radius') {
                e.r = Math.max(.001, distance(e.c, q));
                e.parametric = { ...e.parametric, radius: String(e.r) };
            }
            else if (g.key === 'scale') {
                const startLength = distance(drag.start, { x: e.x, y: e.y }) || 1, scale = Math.max(.01, distance(q, { x: e.x, y: e.y }) / startLength);
                e.sx = (e.sx ?? 1) * scale;
                e.sy = (e.sy ?? 1) * scale;
            }
            else if (g.key === 'rotate') {
                const startAngle = Math.atan2(drag.start.y - e.y, drag.start.x - e.x), angle = Math.atan2(q.y - e.y, q.x - e.x);
                e.rotation = (e.rotation || 0) + (angle - startAngle) * 180 / Math.PI;
                if (this.gridSnap)
                    e.rotation = Math.round(e.rotation / 15) * 15;
            }
            else if (g.key === 'point') {
                if (e.parametric?.kind === 'rectangle') {
                    const opposite = e.points[(g.index + 2) % 4], x = Math.min(q.x, opposite.x), y = Math.min(q.y, opposite.y), w = Math.abs(q.x - opposite.x), h = Math.abs(q.y - opposite.y);
                    if (w > .001 && h > .001) {
                        e.points = rect(x, y, w, h).points;
                        e.parametric = { kind: 'rectangle', width: String(w), height: String(h) };
                    }
                }
                else {
                    e.points[g.index] = { ...e.points[g.index], ...q };
                    if (e.connector) {
                        if (g.index === 0)
                            e.connector.from = this.connectionPoint(raw).ref;
                        else if (g.index === e.points.length - 1)
                            e.connector.to = this.connectionPoint(raw).ref;
                        e.connector.waypoints = e.points.slice(1, -1).map(p => ({ ...p }));
                        e.connector.status = 'manual';
                    }
                    e.parametric = undefined;
                }
            }
            else
                e[g.key] = { ...e[g.key], ...q };
            this.doc.entities[i] = e;
            e.dirty = true;
            this.cursor = q;
            this.solveConstraints();
            this.reroute(new Set([e.id]));
            this.touch(new Set([e.id]));
            return;
        }
        if (drag.kind === 'marquee') {
            drag.current = raw;
            this.renderer.invalidate();
            return;
        }
        this.cursor = this.snapPoint(raw, new Set(), this.draft.at(-1) || drag.start);
        if (drag.kind === 'connect-start' || drag.kind === 'connect-end') {
            const end = this.connectionPoint(raw), route = this.routeConnection(this.connectionStart, end), style = LINE_STYLES.find(s => s.id === this.lineStyle);
            this.preview = polyline(route.points, false, { color: style.color, dash: style.dash, width: style.width });
            this.snap = end.port ? { ...end.port, kind: 'port' } : this.snap;
        }
        else if (drag.kind === 'insert')
            this.previewSymbol = this.symbolAt(this.pendingSymbol, this.cursor.x, this.cursor.y, false);
        else if (drag.kind === 'native-draw')
            this.preview = drawingPreview(this,drag.start,this.cursor);
        else if (drag.kind === 'draw')
            this.preview = this.makePreview(this.draft[0] || drag.start, this.cursor);
        this.renderer.invalidate();
    }
    pointerHover(p) {
        this.lastScreen = p;
        this.shift = p.shift;
        const world = this.camera.world(p);
        this.cursor = this.snapPoint(world, new Set(), this.draft.at(-1));
        if (this.tool === 'insert' && this.pendingSymbol)
            this.previewSymbol = this.symbolAt(this.pendingSymbol, this.cursor.x, this.cursor.y, false);
        else if (this.tool === 'connect' && this.connectionStart) {
            const end = this.connectionPoint(world), r = this.routeConnection(this.connectionStart, end), s = LINE_STYLES.find(s => s.id === this.lineStyle);
            this.preview = polyline(r.points, false, { color: s.color, width: s.width, dash: s.dash });
            this.snap = end.port ? { ...end.port, kind: 'port' } : this.snap;
        }
        else if (this.draft.length)
            this.preview = this.makePreview(this.draft[0], this.cursor);
        else if (this.tool === 'select') {
            this.hoveredPort = this.portAt(world, { selectedOnly: true, tolerance: 14 });
        }
        this.renderer.invalidate();
    }
    pointerUp(p) {
        const drag = this.drag;
        if (!drag)
            return;
        const moved = Math.hypot(p.x - this.downScreen.x, p.y - this.downScreen.y), raw = this.camera.world(p);
        this.pointer = null;
        this.drag = null;
        try {
            if (drag.kind === 'move' || drag.kind === 'grip') {
                if (moved > 2) {
                    try {
                        this.solveConstraints();
                        this.reroute(this.selection);
                        this.touch();
                        this.history.commit();
                    }
                    catch (e) {
                        this.history.cancel();
                        throw e;
                    }
                }
                else
                    this.history.cancel();
                this.renderInspector();
                this.preview = null;
                this.snap = null;
                this.renderer.invalidate();
                return;
            }
            if (drag.kind === 'marquee') {
                const b = bounds([drag.start, drag.current]), crossing = drag.current.x < drag.start.x;
                for (const item of this.renderer.scene.index.search(b)) {
                    if (crossing || (item.minX >= b.minX && item.maxX <= b.maxX && item.minY >= b.minY && item.maxY <= b.maxY))
                        this.selection.add(item.id);
                }
                this.updateSelection();
                return;
            }
            if (drag.kind === 'connect-start' || drag.kind === 'connect-end') {
                if (drag.kind === 'connect-end' || moved > 6) {
                    const added = this.createConnector(this.connectionStart, this.connectionPoint(raw));
                    if (added && drag.fromSelect)
                        this.setTool('select');
                }
                else if (drag.fromSelect) {
                    const start = this.connectionStart;
                    this.setTool('connect');
                    this.connectionStart = start;
                }
                this.preview = null;
                this.updateTools();
                this.renderer.invalidate();
                return;
            }
            if (drag.kind === 'insert') {
                const id = this.pendingSymbol;
                this.previewSymbol = null;
                this.placeSymbol(id, this.snapPoint(raw));
                return;
            }
            if (drag.kind === 'text') {
                this.ask('Place text', [{ name: 'text', label: 'Text', value: 'Label' }, { name: 'height', label: 'Text height · ' + this.doc.units, value: '14' }], v => { this.edit('Add text', () => this.doc.entities.push(text(drag.p, v.text, this.eval(v.height), { layer: 'Annotations', layout: this.doc.activeLayout }))); this.setTool('select'); });
                return;
            }
            if (drag.kind === 'native-draw') {
                const end=this.snapPoint(raw,new Set(),this.draft.at(-1)||drag.start);
                drawingPointerUp(this,drag,end,moved);return;
            }
            if (drag.kind === 'draw') {
                const end = this.snapPoint(raw, new Set(), this.draft.at(-1) || drag.start);
                if (this.tool === 'polyline') {
                    if (!this.draft.length)
                        this.draft.push(drag.start);
                    if (moved > 5 || drag.wasDraft) {
                        if (distance(this.draft.at(-1), end) > .001)
                            this.draft.push(end);
                    }
                    this.preview = null;
                    this.updateTools();
                    this.renderer.invalidate();
                    return;
                }
                if (drag.wasDraft) {
                    this.finishShape(this.draft[0], end);
                    this.draft = [];
                }
                else if (moved > 6)
                    this.finishShape(drag.start, end);
                else
                    this.draft = [drag.start];
                this.preview = null;
                this.updateTools();
                this.renderer.invalidate();
            }
        }
        catch (error) {
            if (this.history.pending)
                this.history.cancel();
            this.toast(error.message, true);
        }
    }
    makePreview(a, b) {
        if(this.drawingSession)return drawingPreview(this,a,b);
        const props = { layer: this.currentLayer, color: '#259e87', width: 1.7 };
        if (this.tool === 'line')
            return line(a, b, props);
        if (this.tool === 'polyline')
            return polyline([...this.draft, b], false, props);
        if (this.tool === 'rect')
            return rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y), props);
        if (this.tool === 'circle')
            return circle(a, distance(a, b), props);
        if (this.tool === 'dimension')
            return entity('DIMENSION', { a, b, offset: 30, height: 12, ...props });
        return null;
    }
    finishShape(a, b) {
        if (distance(a, b) < .001)
            return;
        let added = this.makePreview(a, b);
        if (!added)
            return;
        delete added.color;
        added.layout = this.doc.activeLayout;
        if (added.type === 'LWPOLYLINE' && this.tool === 'rect') {
            const box = bounds(added.points);
            if (box.maxX - box.minX < .001 || box.maxY - box.minY < .001)
                return;
            added.parametric = { kind: 'rectangle', width: String(box.maxX - box.minX), height: String(box.maxY - box.minY) };
        }
        if (added.type === 'DIMENSION') {added.layer='Annotations';editDimension(added,this.doc);}
        this.edit('Draw ' + TOOL_INFO[this.tool][0], () => { this.doc.entities.push(added); this.selection = new Set([added.id]); });
        this.updateSelection();
    }
    finishPath() {
        if(finishDrawing(this))return;
        if (this.tool !== 'polyline' || this.draft.length < 2)
            return;
        this.edit('Draw polyline', () => { const e = polyline(this.draft, false, { layer: this.currentLayer, layout: this.doc.activeLayout }); this.doc.entities.push(e); this.selection = new Set([e.id]); });
        this.draft = [];
        this.preview = null;
        this.setTool('select');
    }
    cancelGesture() {
        if (this.history?.pending)
            this.history.cancel();
        this.drag = null;
        this.pointer = null;
        this.preview = null;
        this.snap = null;
        this.renderer?.invalidate();
    }
    drawOverlay(ctx, cam) {
        ctx.save();
        drawParametricOverlay(this,ctx,cam);
        const selected = this.selected();
        for (const e of selected) {
            if (!isVisible(e, this.doc))
                continue;
            const g = entityGeometry(e, this.doc, { tolerance: .4 / cam.scale });
            for (const p of g.paths)
                drawPath(ctx, p, cam, { color: '#279b80', width: 2.3 });
            const b = entityBounds(e, this.doc);
            if (validBounds(b)) {
                const a = cam.screen({ x: b.minX, y: b.maxY }), z = cam.screen({ x: b.maxX, y: b.minY });
                ctx.strokeStyle = '#77bfa8';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(a.x - 7, a.y - 7, z.x - a.x + 14, z.y - a.y + 14);
                ctx.setLineDash([]);
            }
            if (selected.length === 1 && !isLocked(e, this.doc))
                for (const g of this.grips(e)) {
                    const s = cam.screen(g);
                    ctx.fillStyle = '#fff';
                    ctx.strokeStyle = '#16846e';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    if (g.key === 'rotate')
                        ctx.arc(s.x, s.y, 5, 0, TAU);
                    else
                        ctx.rect(s.x - 4, s.y - 4, 8, 8);
                    ctx.fill();
                    ctx.stroke();
                }
        }
        if (this.tool === 'connect' || this.tool === 'select') {
            const visible = this.tool === 'connect' ? this.doc.entities.filter(e => e.type === 'INSERT' && isVisible(e, this.doc)) : selected;
            for (const e of visible)
                for (const port of ports(e, this.doc)) {
                    const s = cam.screen(port);
                    if (s.x < 0 || s.x > cam.width || s.y < 0 || s.y > cam.height)
                        continue;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, this.tool === 'connect' ? 4.5 : 4, 0, TAU);
                    ctx.fillStyle = '#fafffb';
                    ctx.strokeStyle = '#57af91';
                    ctx.lineWidth = 1.4;
                    ctx.fill();
                    ctx.stroke();
                }
        }
        if (this.preview) {
            const g = entityGeometry(this.preview, this.doc, { tolerance: .25 / cam.scale, view:cam.viewport });
            ctx.globalAlpha = .8;
            for (const p of g.paths)
                drawPath(ctx, p, cam, { color: '#239b80', width: 1.8 });
            for (const t of g.texts)
                drawText(ctx, t, cam);
            ctx.globalAlpha = 1;
        }
        if (this.previewSymbol) {
            const g = entityGeometry(this.previewSymbol, this.doc, { tolerance: .25 / cam.scale, view:cam.viewport });
            for (const p of g.paths)
                drawPath(ctx, p, cam, { color: '#28a082', width: 2 });
            for (const port of ports(this.previewSymbol, this.doc)) {
                const s = cam.screen(port);
                ctx.fillStyle = '#1c9c7c';
                ctx.beginPath();
                ctx.arc(s.x, s.y, 3, 0, TAU);
                ctx.fill();
            }
        }
        if (this.drag?.kind === 'marquee') {
            const a = cam.screen(this.drag.start), b = cam.screen(this.drag.current);
            ctx.fillStyle = '#3c9b8514';
            ctx.strokeStyle = '#399e85';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]);
            ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
            ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
            ctx.setLineDash([]);
        }
        if (this.cursor && !['select', 'pan'].includes(this.tool)) {
            const s = cam.screen(this.cursor);
            ctx.strokeStyle = '#7eaf96';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s.x - 12, s.y);
            ctx.lineTo(s.x + 12, s.y);
            ctx.moveTo(s.x, s.y - 12);
            ctx.lineTo(s.x, s.y + 12);
            ctx.stroke();
            if (this.draft.length && this.tool !== 'polyline') {
                const n = distance(this.draft[0], this.cursor);
                ctx.fillStyle = '#f5fff1';
                ctx.fillRect(s.x + 13, s.y - 31, 90, 23);
                ctx.font = '11px ui-monospace,monospace';
                ctx.textAlign = 'left';
                ctx.fillStyle = '#277d61';
                ctx.fillText(`${format(n)} ${this.doc.units}`, s.x + 18, s.y - 15);
            }
        }
        if (this.snap && this.cursor && (this.drag || this.tool !== 'select')) {
            const s = cam.screen(this.snap);
            ctx.strokeStyle = '#d69c45';
            ctx.lineWidth = 2;
            ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
            ctx.font = '10px system-ui';
            ctx.fillStyle = '#9b773f';
            ctx.textAlign = 'left';
            ctx.fillText(this.snap.kind || 'snap', s.x + 11, s.y - 11);
        }
        if (this.pointer?.pointerType === 'touch' && this.drag && this.drag.kind !== 'pan') {
            const screen = this.lastScreen, at = { x: screen.x > cam.width / 2 ? 77 : cam.width - 77, y: 117 }, r = 48, dpr = this.renderer.dpr;
            ctx.save();
            ctx.shadowColor = '#1e533d33';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(at.x, at.y, r, 0, TAU);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.clip();
            const source = this.camera.screen(this.cursor || this.camera.world(screen));
            for (const canvas of [this.renderer.background, this.renderer.canvas])
                try {
                    ctx.drawImage(canvas, (source.x - 24) * dpr, (source.y - 24) * dpr, 48 * dpr, 48 * dpr, at.x - r, at.y - r, r * 2, r * 2);
                }
                catch { }
            ctx.strokeStyle = '#27866d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(at.x - 10, at.y);
            ctx.lineTo(at.x + 10, at.y);
            ctx.moveTo(at.x, at.y - 10);
            ctx.lineTo(at.x, at.y + 10);
            ctx.stroke();
            ctx.restore();
            ctx.strokeStyle = '#64a78a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(at.x, at.y, r, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
    }
    showContext(p) {
        this.cancelGesture();
        const e = this.hitTest(this.camera.world(p), 20);
        if (e)
            this.selection = new Set([e.id]);
        this.updateSelection();
        this.hideContext();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = this.selection.size ? `${btn('duplicate', 'Duplicate', 'copy')}${btn('rotate', 'Rotate', 'rotate')}${btn('constraint', 'Constrain', 'param')}${btn('delete', 'Delete', 'trash')}` : `${btn('toggle-library', 'Symbols', 'symbols')}${btn('precision', 'Draw by values', 'ruler')}${btn('paste', 'Paste', 'copy')}${btn('fit', 'Fit drawing', 'fit')}`;
        menu.style.left = clamp(p.x - 95, 25, this.camera.width - 215) + 'px';
        menu.style.top = clamp(p.y - 75, 25, this.camera.height - 145) + 'px';
        this.$('.canvas-area').append(menu);
    }
    hideContext() { this.$('.context-menu')?.remove(); }
    requireSelection(count = 1) {
        const es = this.selected().filter(e => !isLocked(e, this.doc));
        if (es.length < count)
            throw new Error(`Select ${count === 1 ? 'an editable object' : count + ' editable objects'} first`);
        return es;
    }
    deleteSelection() { const es = this.requireSelection(), ids = new Set(es.map(e => e.id)); this.edit('Delete selection', () => { this.doc.entities = this.doc.entities.filter(e => !ids.has(e.id)); detachReferences(this.doc, ids); this.selection.clear(); }); }
    duplicateSelection() {
        const es = this.requireSelection();
        this.edit('Duplicate selection', () => {
            const map = new Map(es.map(e => [e.id, uid()])), copies = es.map(old => {
                const e = clone(old);
                e.id = map.get(old.id);
                delete e._dxf;
                delete e.feature3d; delete e.model3dConsumed;
                moveEntity(e, 30, -30);
                if (e.tag)
                    e.tag += '-COPY';
                if (e.connector)
                    for (const key of ['from', 'to']) {
                        const ref = e.connector[key];
                        e.connector[key] = ref && map.has(ref.entityId) ? { ...ref, entityId: map.get(ref.entityId) } : null;
                    }
                return e;
            });
            this.doc.entities.push(...copies);
            this.selection = new Set(copies.map(e => e.id));
            this.reroute(this.selection);
        });
    }
    copySelection() { const es = this.requireSelection(); this.clipboard = { entities: clone(es).map(e=>{delete e.feature3d;delete e.model3dConsumed;return e;}), blocks: clone(this.doc.blocks), layers: clone(this.doc.layers) }; this.toast(`${es.length} object${es.length === 1 ? '' : 's'} copied${es.some(e=>e.feature3d)?' as static mesh geometry':''} to the app clipboard`); }
    pasteSelection() {
        if (!this.clipboard)
            throw new Error('Copy objects in this workspace first');
        const cb = this.clipboard;
        this.edit('Paste', () => {
            const merged = mergeClipboardBlocks(this.doc.blocks, cb.blocks, cb.entities);
            for(const [name,block] of Object.entries(merged.blocks))Object.defineProperty(this.doc.blocks,name,{value:block,writable:true,enumerable:true,configurable:true});
            const map = new Map(merged.entities.map(e => [e.id, uid()])), es = merged.entities;
            for (const e of es) {
                e.id = map.get(e.id);
                e.layout = this.doc.activeLayout;
                delete e._dxf;
                delete e.feature3d; delete e.model3dConsumed;
                moveEntity(e, 40, -40);
                if (e.tag)
                    e.tag += '-COPY';
                if (e.connector)
                    for (const key of ['from', 'to']) {
                        const ref = e.connector[key];
                        e.connector[key] = ref && map.has(ref.entityId) ? { ...ref, entityId: map.get(ref.entityId) } : null;
                    }
            }
            for(const layer of cb.layers || [])if(!this.doc.layers.some(l=>l.name===layer.name))this.doc.layers.push(clone(layer));
            this.doc.entities.push(...es);
            this.selection = new Set(es.map(e => e.id));
        });
    }
    rotateSelection(angle) {
        const es = this.requireSelection();
        let b = emptyBounds();
        for (const e of es)
            b = union(b, entityBounds(e, this.doc));
        const origin = es.length === 1 && es[0].type === 'INSERT' ? { x: es[0].x, y: es[0].y } : center(b), m = compose(matrix({ x: origin.x, y: origin.y, rotation: angle }), matrix({ x: -origin.x, y: -origin.y }));
        this.edit('Rotate selection', () => {
            for (const e of es) {
                if (e.type === 'INSERT') {
                    const x = e.x, y = e.y;
                    transformEntity(e, m);
                    if (es.length === 1) {
                        e.x = x;
                        e.y = y;
                    }
                }
                else
                    transformEntity(e, m);
            }
            this.solveConstraints();
            this.reroute(this.selection);
        });
    }
    offsetSelection(amount) {
        const es = this.requireSelection();
        if (!Number.isFinite(amount) || Math.abs(amount) < 1e-9)
            throw new Error('Offset distance must be nonzero');
        this.edit('Offset geometry', () => {
            const created = [];
            for (const e of es) {
                let out;
                if (e.type === 'CIRCLE') {
                    if (e.r + amount <= 0)
                        throw new Error('Offset would make the circle radius nonpositive');
                    out = circle(e.c, e.r + amount, { layer: e.layer });
                }
                else if (e.type === 'LINE') {
                    const p = offsetPolyline([e.a, e.b], amount);
                    out = line(p[0], p[1], { layer: e.layer });
                }
                else if (e.type === 'LWPOLYLINE' && !e.points.some(p => p.bulge)) {
                    out = polyline(offsetPolyline(e.points, amount, e.closed), e.closed, { layer: e.layer });
                }
                else
                    throw new Error('Offset currently supports lines, circles and straight-segment polylines');
                out.layout = this.doc.activeLayout;
                created.push(out);
            }
            this.doc.entities.push(...created);
            this.selection = new Set(created.map(e => e.id));
        });
    }
    trimSelection(extend = false) {
        const es = this.requireSelection(2);
        if (es.length !== 2 || es.some(e => e.type !== 'LINE'))
            throw new Error('Select exactly two lines; the first selected line is the trim/extend target');
        const ordered = [...this.selection].map(id => es.find(e => e.id === id)).filter(Boolean), a = ordered[0], b = ordered[1], hit = lineIntersection(a.a, a.b, b.a, b.b, !extend);
        if (!hit)
            throw new Error(extend ? 'The lines do not intersect' : 'The selected line segments do not cross');
        this.edit(extend ? 'Extend line' : 'Trim line', () => {
            const p = { x: hit.x, y: hit.y };
            if (distance(a.a, p) < distance(a.b, p))
                a.a = p;
            else
                a.b = p;
            a.parametric = undefined;
            this.solveConstraints();
        });
    }
    filletSelection(radius) {
        const es = this.requireSelection(2);
        if (es.length !== 2 || es.some(e => e.type !== 'LINE'))
            throw new Error('Select exactly two lines to fillet');
        const a = es[0], b = es[1], f = filletLines(a.a, a.b, b.a, b.b, radius);
        this.edit('Fillet lines', () => {
            if (distance(a.a, f.p) < distance(a.b, f.p))
                a.a = f.p;
            else
                a.b = f.p;
            if (distance(b.a, f.q) < distance(b.b, f.q))
                b.a = f.q;
            else
                b.b = f.q;
            a.parametric = undefined;
            b.parametric = undefined;
            this.doc.entities.push(entity('ARC', { c: f.c, r: radius, start: f.start, end: f.end, clockwise: f.clockwise, layer: a.layer, layout: this.doc.activeLayout }));
            this.solveConstraints();
        });
    }
    explodeSelection() { const es = this.requireSelection(); this.edit('Explode selected geometry', () => { const ids = new Set(es.map(e => e.id)), newEntities = es.flatMap(e => explodeEntity(e, this.doc).map(x => ({ ...x, layout: e.layout || 'Model' }))); this.doc.entities = this.doc.entities.filter(e => !ids.has(e.id)); detachReferences(this.doc, ids); this.doc.entities.push(...newEntities); this.selection = new Set(newEntities.map(e => e.id)); }); this.toast('Exploded to editable polylines and text. Curves are tessellated.'); }
    makeSymbolDialog() {
        const es = this.requireSelection();
        this.ask('Create a reusable symbol', [{ name: 'name', label: 'Block / symbol name', value: 'Custom component' }], v => {
            const name = v.name.trim().replace(/[<>/\\":;?*|,=`]/g, '_');
            if (!name)
                throw new Error('Enter a block name');
            if (this.doc.blocks[name])
                throw new Error('A block with that name already exists');
            this.edit('Create symbol', () => {
                let b = emptyBounds();
                for (const e of es)
                    b = union(b, entityBounds(e, this.doc));
                const c = center(b), children = es.flatMap(e => explodeEntity(e, this.doc));
                for (const e of children) {
                    moveEntity(e, -c.x, -c.y);
                    e.layer = '0';
                }
                const w = (b.maxX - b.minX) / 2, h = (b.maxY - b.minY) / 2;
                this.doc.blocks[name] = { name, base: { x: 0, y: 0 }, entities: children, ports: [{ name: 'in', x: -w, y: 0, dx: -1, dy: 0 }, { name: 'out', x: w, y: 0, dx: 1, dy: 0 }, { name: 'top', x: 0, y: h, dx: 0, dy: 1 }, { name: 'bottom', x: 0, y: -h, dx: 0, dy: -1 }], symbol: { name, category: 'Custom', labelOffset: h + 20 } };
                const ids = new Set(es.map(e => e.id));
                this.doc.entities = this.doc.entities.filter(e => !ids.has(e.id));
                detachReferences(this.doc, ids);
                const inserted = entity('INSERT', { block: name, x: c.x, y: c.y, sx: 1, sy: 1, rotation: 0, layer: this.currentLayer, layout: this.doc.activeLayout });
                this.doc.entities.push(inserted);
                this.selection = new Set([inserted.id]);
                this.category = 'Custom';
            });
        });
    }
    constraintDialog() { return constraintAuthor(this); }
    parametersDialog() { return parameterManager(this); }
    precisionDialog() {
        this.openModal('Draw with exact values', `<p>World coordinates use the drawing’s ${E(this.doc.units)} units. All values accept named parameter expressions.</p><label class="field">Geometry<select id="precision-type"><option value="line">Line</option><option value="rect">Rectangle</option><option value="circle">Circle</option></select></label><div class="fields"><label class="field">X<input id="precision-x" value="${format(this.camera.x)}" inputmode="decimal"></label><label class="field">Y<input id="precision-y" value="${format(this.camera.y)}" inputmode="decimal"></label><label class="field">End X / width / radius<input id="precision-a" value="100" inputmode="decimal"></label><label class="field">End Y / height<input id="precision-b" value="80" inputmode="decimal"></label></div><div class="error-text"></div>`, { confirm: 'Create geometry', onConfirm: () => {
                const get = id => this.modal.querySelector('#precision-' + id).value, kind = get('type'), x = this.eval(get('x')), y = this.eval(get('y')), a = this.eval(get('a')), b = this.eval(get('b'));
                let e;
                if (kind === 'line')
                    e = line({ x, y }, { x: a, y: b });
                else if (kind === 'circle') {
                    if (a <= 0)
                        throw new Error('Radius must be positive');
                    e = circle({ x, y }, a, { parametric: { radius: get('a') } });
                }
                else {
                    if (a <= 0 || b <= 0)
                        throw new Error('Width and height must be positive');
                    e = rect(x, y, a, b, { parametric: { kind: 'rectangle', width: get('a'), height: get('b') } });
                }
                this.edit('Precision ' + kind, () => { e.layer = this.currentLayer; e.layout = this.doc.activeLayout; this.doc.entities.push(e); this.selection = new Set([e.id]); });
                this.closeModal();
                this.setTool('select');
            } });
    }
    lineStylesDialog() { this.openModal('Line & connection library', `<p>Choose a line type, then connect symbol ports or free points. Every connector is a native DXF polyline with optional application metadata.</p><div class="line-style-list">${LINE_STYLES.map(s => `<button data-style="${s.id}"><svg viewBox="0 0 90 20"><path d="M3 10h84" stroke="${s.color}" stroke-width="${s.width}" ${s.dash.length ? `stroke-dasharray="${s.dash.join(' ')}"` : ''}/>${s.arrow === 'end' ? `<path d="m77 5 9 5-9 5" fill="none" stroke="${s.color}" stroke-width="${s.width}"/>` : ''}</svg><span>${E(s.name)}</span>${s.id === this.lineStyle ? icon('check') : ''}</button>`).join('')}</div>`); }
    moreDialog(shapesOnly = false) {
        const drawing = [['tool-line', 'Line', 'line'], ['tool-polyline', 'Polyline', 'polyline'], ['tool-rect', 'Rectangle', 'rect'], ['tool-circle', 'Circle', 'circle'], ['tool-text', 'Text', 'text'], ['tool-dimension', 'Dimension', 'dimension'], ['tool-pan', 'Pan', 'pan'], ['precision', 'Exact values', 'ruler']];
        const editing = [['3d-tools','3D modeling tools','rect'],['3d-examples','3D example drawings','rect'],['blocks','Block editor','symbols'],['solver-report','Solve status','param'],['parametric-demo','Constrained bracket','param'],['calculated-text','Calculation label','text'],['dynamic-demo','Parametric duct','symbols'],['duplicate','Duplicate','copy'],['rotate-angle','Rotate','rotate'],['offset','Offset','offset'],['trim','Trim','trim'],['extend','Extend','extend'],['fillet','Fillet','fillet'],['constraint','Constraints','param'],['make-symbol','Make symbol','symbols'],['explode','Explode','symbols'],['parameters','Parameters','param'],['multi-select','Multi-select','select'],['select-all','Select all','select'],['delete','Delete','trash'],['command','Command','command'],['help','Help','help']];
        const section = (label, actions) => `<section class="drawing-tool-group"><h3>${E(label)}</h3><div class="operation-grid">${actions.map(([a,l,i]) => btn(a,l,i).replace('<button ', `<button data-tool-search="${E((label+' '+l+' '+a).toLowerCase())}" `)).join('')}</div></section>`;
        this.openModal(shapesOnly ? 'Draw a shape' : 'Drawing & editing tools', `${iconPreferencesMarkup()}${section('Quick drawing',drawing)}${drawingToolSections(this)}${shapesOnly ? '' : section('Edit & organize',editing)}`, { wide: !shapesOnly });
        const body = this.modal.querySelector('.modal-body'), search = body.querySelector('.drawing-tool-search');
        search.querySelector('input').placeholder = shapesOnly ? 'Arc, hatch, spline, dimension…' : 'Find any tool, edit or command…';
        body.prepend(search); bindDrawingSearch(this);
    }
    editText(e) { this.ask('Edit text', [{ name: 'text', label: 'Content', value: e.text || '', multiline: true }], v => this.edit('Edit text', () => { e.text = v.text; e.dirty = true; })); }
    openModal(title, body, { confirm = null, onConfirm = null, wide = false } = {}) {
        this.closeModal();
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML = `<section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${E(title)}</h2>${iconButton('modal-close', 'close', 'Close dialog')}</header><div class="modal-body">${body}</div>${confirm ? `<footer class="modal-foot">${btn('modal-close', 'Cancel', null, 'btn')}${btn('modal-confirm', confirm, 'check', 'btn primary')}</footer>` : ''}</section>`;
        document.body.append(backdrop);
        this.modal = backdrop;
        this.iconography?.prepare(backdrop);
        this.previousFocus = document.activeElement;
        this.modalCleanup = prepareMobileDialog(this, backdrop);
        let confirming = false;
        this.modalConfirm = async () => {
            if (confirming || this.modal !== backdrop) return;
            confirming = true;
            const submit = backdrop.querySelector('[data-action="modal-confirm"]');
            if (submit) submit.disabled = true;
            backdrop.querySelector('.modal').setAttribute('aria-busy', 'true');
            try {
                await onConfirm?.();
            }
            catch (e) {
                const target = backdrop.querySelector('.error-text');
                if (target)
                    { target.textContent = e.message; target.scrollIntoView({ block: 'nearest' }); }
                else
                    this.toast(e.message, true);
            } finally {
                confirming = false;
                if (submit) submit.disabled = false;
                backdrop.querySelector('.modal').removeAttribute('aria-busy');
            }
        };
        let backdropPress = null;
        backdrop.addEventListener('pointerdown', e => { backdropPress = e.target === backdrop ? { x: e.clientX, y: e.clientY } : null; });
        backdrop.addEventListener('pointercancel', () => { backdropPress = null; });
        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) {
                if (backdropPress && Math.hypot(e.clientX - backdropPress.x, e.clientY - backdropPress.y) < 8) this.closeModal();
                backdropPress = null;
                return;
            }
            this.onClick(e);
        });
        backdrop.addEventListener('change', e => this.onChange(e));
        backdrop.addEventListener('keydown', e => {
            if (e.key === 'Enter' && confirm && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') {
                e.preventDefault();
                this.modalConfirm?.();
            }
        });
    }
    closeModal() {
        this.iconography?.hide();
        this.model3d?.clearPreview();
        if (this.modal) {
            this.modalCleanup?.(); this.modalCleanup = null;
            this.modal.remove();
            this.modal = null;
            this.modalConfirm = null;
            if (this.previousFocus?.isConnected && !this.previousFocus.closest('[inert]')) this.previousFocus.focus?.({ preventScroll: true });
            this.updateMobileViewport?.();
        }
    }
    ask(title, fields, onConfirm) { const body = fields.map(f => `<label class="field">${E(f.label)}${f.multiline ? `<textarea data-field="${f.name}">${E(f.value)}</textarea>` : `<input data-field="${f.name}" value="${E(f.value)}" autocomplete="off" spellcheck="false">`}</label>`).join('') + '<div class="error-text"></div>'; this.openModal(title, body, { confirm: 'Apply', onConfirm: async () => { const values = Object.fromEntries([...this.modal.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el.value])); await onConfirm(values); this.closeModal(); } }); }
    toast(message, error = false) { const el = this.$('.toast'); if (this.disposed || !el) return; el.textContent = message; el.classList.toggle('error', error); el.classList.add('show'); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => el.classList.remove('show'), error ? 6500 : 3500); }
    newDialog() {
        this.openModal('Create a drawing', `<p>Creates a new tab. Your other drawings remain open with their own undo history. These are editable concept schematics, not engineered or construction-approved designs.</p><label class="field">Find an industry or drawing type<input id="template-search" type="search" placeholder="Water, hydraulic, single-line, HVAC…" autocomplete="off"></label><div class="template-count" role="status" aria-live="polite">${DRAWING_TYPES.length + EXAMPLES_3D.length} drawing starters</div><div class="export-grid template-grid">${EXAMPLES_3D.map(t=>`<button class="export-option template-card" data-demo="3d:${E(t.id)}" data-search="${E(('3d '+t.name+' '+t.industry+' '+t.description).toLowerCase())}"><span class="template-content"><small class="template-industry">${icon(EXAMPLE_ICONS[t.id] || 'file-3d')}3D · ${E(t.industry)}</small><strong>${E(t.name)}</strong><small>${E(t.description)}</small></span></button>`).join('')}<button class="export-option" data-demo="blank">${icon('new')}<span><strong>Blank drawing</strong><small>Empty model with all symbol libraries.</small></span></button>${DRAWING_TYPES.map(t => `<button class="export-option template-card" data-demo="${E(t.id)}" data-search="${E([t.name, t.industry, t.drawingType, ...t.categories, ...t.standardRefs, t.description].join(' ').toLowerCase())}"><span class="template-content"><small class="template-industry">${E(t.industry)}</small><strong>${E(t.name)}</strong><small>${E(t.drawingType)}</small><span class="template-preview">${t.nodes.slice(0, 3).map(n => this.librarySymbolPreview(SYMBOLS.find(s => s.id === n.symbol))).join('') || icon('graph')}</span><small>${E(t.description)}</small></span></button>`).join('')}</div>`, { wide: true });
        const input = this.modal.querySelector('#template-search');
        input.addEventListener('input', () => {
            const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            let count = 0;
            this.modal.querySelectorAll('[data-search]').forEach(card => { const show = words.every(word => card.dataset.search.includes(word)); card.hidden = !show; if (show) count++; });
            this.modal.querySelector('.template-count').textContent = `${count} matching drawing starters`;
        });
    }
    async newDocument(kind) {
        if(kind.startsWith('3d:')) { const next=create3DExample(kind.slice(3)); return openDocument(this,next,{context:{viewMode:'3d',currentLayer:'Annotations'}}); }
        if (this.initializing) await this.ready;
        const next = kind === 'blank' ? installSymbols(createDocument()) : createDemo(kind);
        const profile = DRAWING_TYPES.find(p => p.id === kind), style = profile?.defaultLineStyle || 'process';
        return openDocument(this, next, { context: {
            category: profile?.categories[0] || 'P&ID', lineStyle: style,
            currentLayer: LINE_STYLES.find(s => s.id === style)?.layer || 'Process'
        } });
    }
    openDocument(document, options = {}) { return openDocument(this, document, options); }
    activateDocument(id) { return activateDocument(this, id); }
    closeDocument(id = this.documents.activeId) { return requestCloseDocument(this, id); }
    saveAllDocuments() { return this.documents.saveAll(); }
    scheduleRecovery() { scheduleRecovery(this); }
    documentChanged() { documentChanged(this); }
    basename() { return (this.doc.name || 'drawing').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_'); }
    exportDialog() { const report = exportReport(this.doc); this.openModal('Export your drawing', `<p>Choose an editable CAD file, a full project, or a presentation format. Files are generated locally.</p><label class="field">DXF target version<select id="dxf-version"><option value="AC1015">AutoCAD 2000 · AC1015</option><option value="AC1018">AutoCAD 2004 · AC1018</option><option value="AC1021">AutoCAD 2007 · AC1021</option><option value="AC1024" selected>AutoCAD 2010 · AC1024</option><option value="AC1027">AutoCAD 2013 · AC1027</option><option value="AC1032">AutoCAD 2018 · AC1032</option></select></label><label class="field">DXF export mode<select id="dxf-mode"><option value="normalized">Normalized editable DXF</option><option value="preserve" ${report.preservationAvailable ? '' : 'disabled'}>Preserve source records · guarded edits</option></select></label><label class="dxf-strict-option"><input id="dxf-strict" type="checkbox"><span>Reject known normalized data loss</span></label><p class="muted-note">Preserving mode keeps the source version and foreign records. Structural edits and dependent geometry are rejected, never silently merged.</p><div class="export-grid"><button class="export-option" data-export="dxf">${icon('line')}<span><strong>DXF drawing</strong><small>ASCII DXF with native dimensions, layouts, meshes and blocks.</small></span></button><button class="export-option" data-export="dxf-binary">${icon('line')}<span><strong>Binary DXF</strong><small>Compact typed DXF, same version and preservation choices.</small></span></button>${report.preservationAvailable ? `<button class="export-option" data-export="dxf-graph">${icon('graph')}<span><strong>DXF object graph</strong><small>Source handles, references and diagnostics as JSON.</small></span></button>` : ''}<button class="export-option" data-export="project">${icon('save')}<span><strong>Conduit project</strong><small>Full document, ports, constraints, parameters and original input.</small></span></button><button class="export-option" data-export="svg">${icon('screen')}<span><strong>SVG vector</strong><small>Scalable engineering artwork and text.</small></span></button><button class="export-option" data-export="png">${icon('rect')}<span><strong>PNG image</strong><small>Full drawing, 2400 pixels wide.</small></span></button><button class="export-option" data-export="bom">${icon('layers')}<span><strong>Equipment schedule</strong><small>CSV: block, tag, layer, position and rotation.</small></span></button><button class="export-option" data-export="graph">${icon('graph')}<span><strong>Connection graph</strong><small>JSON: nodes, ports, edges and adjacency.</small></span></button>${report.originalAvailable ? `<button class="export-option" data-export="original">${icon('folder')}<span><strong>Original DXF</strong><small>Exact imported source, without your edits. Preserves unsupported records.</small></span></button>` : ''}</div>${report.warnings.length ? `<div class="hint-box"><strong>Normalized DXF export limitations</strong><br>${report.warnings.map(E).join('<br>')}</div>` : ''}<p class="muted-note">Conduit metadata is application-specific. Other CAD tools will not automatically solve Conduit constraints or reroute connections. Keep the project file as your editable master.</p>`, { wide: true }); }
    async doExport(format) {
        if(this.blockSession)throw new Error('Save or close the block editor before exporting');
        const name = this.basename(), version = this.modal?.querySelector('#dxf-version')?.value || 'AC1024';
        if (format === 'project')
            downloadFile(name + '.conduit.json', JSON.stringify(this.doc, null, 2), 'application/json');
        else if (format === 'dxf' || format === 'dxf-binary') {
            const report = exportReport(this.doc),mode=this.modal?.querySelector('#dxf-mode')?.value || 'normalized';
            const strict=this.modal?.querySelector('#dxf-strict')?.checked || false;
            const options={version:mode==='preserve'?this.doc.importVersion:version,mode,strict};
            const data=format==='dxf-binary'?writeDXFBinary(this.doc,options):writeDXF(this.doc,options);
            downloadFile(name + (format==='dxf-binary'?'-binary':'') + '.dxf',data,'application/dxf');
            if (report.warnings.length && mode!=='preserve')
                this.toast('DXF exported with the limitations shown in Export. Keep a project copy.', true);
            else
                this.toast('DXF drawing exported');
        }
        else if(format==='dxf-graph')downloadFile(name+'-dxf-graph.json',JSON.stringify(inspectObjectGraph(this.doc),null,2),'application/json');
        else if (format === 'svg')
            downloadFile(name + '.svg', writeSVG(this.doc), 'image/svg+xml');
        else if (format === 'png') {
            downloadFile(name + '.png', await renderPNG(this.doc));
        }
        else if (format === 'bom')
            downloadFile(name + '-equipment.csv', '\uFEFF' + writeBOM(this.doc), 'text/csv;charset=utf-8');
        else if (format === 'graph')
            downloadFile(name + '.graph.json', JSON.stringify(graphFromDocument(this.doc), null, 2), 'application/json');
        else if (format === 'original') {
            if (!this.doc.source)
                throw new Error('No original DXF was imported');
            if (this.doc.source.base64) {
                const s = atob(this.doc.source.base64), bytes = Uint8Array.from(s, c => c.charCodeAt(0));
                downloadFile(name + '-original.dxf', bytes);
            }
            else
                downloadFile(name + '-original.dxf', this.doc.source.text, 'application/dxf');
        }
        else
            throw new Error('Unknown export format');
    }
    openFiles(files) {
        return Promise.all(files.map(file => this.openFile(file)));
    }
    openFile(file) {
        const operation = this.documentImportQueue.catch(() => {}).then(async () => {
            if (this.initializing) await this.ready;
            if (this.disposed) return null;
            return this.importFile(file);
        });
        this.documentImportQueue = operation;
        return operation;
    }
    async importFile(file) {
        if (this.documents.sessions.length >= this.documents.maxDocuments) {
            this.toast('Document limit reached. Close a drawing before importing more files.', true); return null;
        }
        if (file.size > 128 * 1024 * 1024) {
            this.toast('The import limit is 128 MiB.', true);
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'loading';
        overlay.innerHTML = '<div class="spinner"></div><span>Reading drawing on this device…</span>';
        document.body.append(overlay);
        let worker, url;
        try {
            const buffer = await file.arrayBuffer();
            let doc;
            if (/\.(json|conduit)$/i.test(file.name)) {
                doc = validateDocument(JSON.parse(new TextDecoder().decode(buffer)));
            }
            else if (globalThis.__CONDUIT_DXF_WORKER__) {
                url = URL.createObjectURL(new Blob([globalThis.__CONDUIT_DXF_WORKER__], { type: 'text/javascript' }));
                worker = new Worker(url);
                doc = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Import exceeded the safety timeout')), 120000); worker.onmessage = e => { clearTimeout(timer); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.document); }; worker.onerror = e => { clearTimeout(timer); reject(new Error(e.message || 'Import worker failed')); }; worker.postMessage({ buffer, name: file.name.replace(/\.dxf$/i, '') }, [buffer]); });
            }
            else {
                await new Promise(r => setTimeout(r, 0));
                doc = parseDXF(buffer, { name: file.name.replace(/\.dxf$/i, '') });
            }
            if (this.disposed) return null;
            openDocument(this, doc, { context: { currentLayer: doc.layers.find(l => l.visible && !l.locked)?.name || '0' } });
            const warnings = (doc.importDiagnostics || []).filter(i => i.severity === 'warning');
            this.toast(`${file.name} opened · ${doc.entities.length} entities${warnings.length ? ' · ' + warnings.length + ' import warnings (Check)' : ''}`, warnings.length > 0);
            if (warnings.length) {
                this.inspectorTab = 'qa';
                this.renderInspector();
            }
        }
        catch (e) {
            this.toast('Could not open drawing: ' + e.message, true);
        }
        finally {
            worker?.terminate();
            if (url)
                URL.revokeObjectURL(url);
            overlay.remove();
        }
    }
    commandDialog() { this.openModal('Command palette', `<div class="command-input">${icon('code')}<input id="cad-command" placeholder="LINE 0,0 100,50" autocomplete="off" spellcheck="false" aria-label="CAD command"></div><div class="error-text"></div><p class="muted-note">Enter executes. Commands use drawing units and comma-separated point coordinates.</p><table class="keyboard-table"><tr><td>Line with exact endpoints</td><td>LINE 0,0 100,50</td></tr><tr><td>New point-driven tools</td><td>ARC / ELLIPSE / SPLINE / HATCH / MTEXT</td></tr><tr><td>Exact native 3-point arc</td><td>ARC 0,0 50,50 100,0</td></tr><tr><td>Next absolute / relative point</td><td>NEXT 10,20 / NEXT @50&lt;30</td></tr><tr><td>Complete path</td><td>FINISH / CLOSE</td></tr><tr><td>Circle with center and radius</td><td>CIRCLE 0,0 25</td></tr><tr><td>Rectangle · x, y, width, height</td><td>RECT 0 0 120 80</td></tr><tr><td>Move selected objects</td><td>MOVE 10 -20</td></tr><tr><td>Transforms and editing</td><td>ROTATE 45 / OFFSET 10</td></tr><tr><td>Named parameter</td><td>PARAM size=100</td></tr><tr><td>History and view</td><td>UNDO / REDO / FIT</td></tr></table>`, { confirm: 'Run command', onConfirm: () => { this.executeCommand(this.modal.querySelector('#cad-command').value); this.closeModal(); } }); }
    executeCommand(source) {
        const s = source.trim(), split = s.indexOf(' '), cmd = (split < 0 ? s : s.slice(0, split)).toUpperCase(), rest = split < 0 ? '' : s.slice(split + 1).trim(), args = rest.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
        if(cmd==='BEDIT'){startBlockEditor(this,rest||this.selected()[0]?.block);return;}
        if(cmd==='BSAVE'){finishBlockEditor(this,true,true);return;}
        if(cmd==='BCLOSE'){finishBlockEditor(this,rest.toLowerCase()!=='discard');return;}
        if(cmd==='BTEST'||cmd==='BTESTBLOCK'){this.action('block-test');return;}
        if(cmd==='ATTSYNC'){this.action('block-sync-attributes');return;}
        if(cmd==='BSAVEAS'){this.action('block-save-as');return;}
        if(cmd==='PARAMETERS'){parameterManager(this);return;}
        if(cmd==='SOLVE'){this.edit('Solve constraints',()=>this.solveConstraints());return;}
        if(drawingCommand(this,cmd,rest))return;
        const nums = () => args.map(v => this.eval(v));
        if (['LINE', 'L'].includes(cmd)) {
            const n = nums();
            if (n.length !== 4)
                throw new Error('Use LINE x1,y1 x2,y2');
            this.edit('LINE command', () => this.doc.entities.push(line({ x: n[0], y: n[1] }, { x: n[2], y: n[3] }, { layer: this.currentLayer, layout: this.doc.activeLayout })));
        }
        else if (['CIRCLE', 'C'].includes(cmd)) {
            const n = nums();
            if (n.length !== 3 || n[2] <= 0)
                throw new Error('Use CIRCLE x,y radius, with positive radius');
            this.edit('CIRCLE command', () => this.doc.entities.push(circle({ x: n[0], y: n[1] }, n[2], { layer: this.currentLayer, layout: this.doc.activeLayout, parametric: { radius: args[2] } })));
        }
        else if (['RECT', 'RECTANGLE'].includes(cmd)) {
            const n = nums();
            if (n.length !== 4 || n[2] <= 0 || n[3] <= 0)
                throw new Error('Use RECT x y width height with positive dimensions');
            this.edit('RECT command', () => this.doc.entities.push(rect(...n, { layer: this.currentLayer, layout: this.doc.activeLayout, parametric: { kind: 'rectangle', width: args[2], height: args[3] } })));
        }
        else if (cmd === 'MOVE') {
            const n = nums(), es = this.requireSelection();
            if (n.length !== 2)
                throw new Error('Use MOVE dx dy');
            this.edit('MOVE command', () => { es.forEach(e => moveEntity(e, n[0], n[1])); this.solveConstraints(); this.reroute(this.selection); });
        }
        else if (cmd === 'ROTATE')
            this.rotateSelection(this.eval(rest));
        else if (cmd === 'OFFSET')
            this.offsetSelection(this.eval(rest));
        else if (cmd === 'FILLET')
            this.filletSelection(this.eval(rest));
        else if (cmd === 'TRIM')
            this.trimSelection();
        else if (cmd === 'EXTEND')
            this.trimSelection(true);
        else if (cmd === 'PARAM') {
            const m = rest.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
            if (!m || ['__proto__', 'constructor', 'prototype', 'pi'].includes(m[1]))
                throw new Error('Use PARAM name=expression');
            this.edit('Parameter command', () => { this.doc.parameters[m[1]] = m[2]; resolveParameters(this.doc.parameters); this.doc.entities.forEach(e => this.evaluateParametric(e)); this.solveConstraints(); this.reroute(); });
        }
        else if (cmd === 'UNDO')
            this.history.undo();
        else if (cmd === 'REDO')
            this.history.redo();
        else if (cmd === 'FIT' || cmd === 'ZOOM')
            this.renderer.fit();
        else if (cmd === 'DELETE' || cmd === 'ERASE')
            this.deleteSelection();
        else if (cmd === 'SELECT' && rest.toUpperCase() === 'ALL') {
            this.selection = new Set(this.doc.entities.filter(e => isVisible(e, this.doc)).map(e => e.id));
            this.updateSelection();
        }
        else if (cmd === 'LAYER') {
            if (!this.doc.layers.some(l => l.name === rest))
                throw new Error('Unknown layer');
            this.currentLayer = rest;
            this.updateUI();
        }
        else
            throw new Error('Unknown command: ' + cmd);
        this.toast(cmd + ' completed');
    }
    keyDown(e) {
        if (this.initializing || this.disposed) return;        if (documentKeyDown(this, e)) return;
        const input = e.target.closest?.('input,textarea,select,[contenteditable=true]');
        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.modal) {
                this.closeModal();
                return;
            }
            this.closePanels();
            this.setTool('select');
            return;
        }
        if (input || this.modal)
            return;
        const cmd = e.ctrlKey || e.metaKey;
        try {
            if(this.model3d?.active&&!cmd){
                if(e.key.toLowerCase()==='f'){e.preventDefault();this.model3d.fitSelection();return;}
                if(e.key==='Enter'){e.preventDefault();this.model3d.action('3d-edit');return;}
            }
            if (cmd) {
                const key = e.key.toLowerCase();
                if (['z', 'y', 's', 'o', 'n', 'a', 'd', 'c', 'v', 'x', 'k'].includes(key))
                    e.preventDefault();
                switch (key) {
                    case 'z':
                        e.shiftKey ? this.history.redo() : this.history.undo();
                        return;
                    case 'y':
                        this.history.redo();
                        return;
                    case 's':
                        if(this.blockSession){finishBlockEditor(this,true,true);return;}
                        this.doExport('project');
                        return;
                    case 'o':
                        this.$('.file-input').click();
                        return;
                    case 'n':
                        this.newDialog();
                        return;
                    case 'a':
                        this.action('select-all');
                        return;
                    case 'd':
                        this.duplicateSelection();
                        return;
                    case 'c':
                        this.copySelection();
                        return;
                    case 'v':
                        this.pasteSelection();
                        return;
                    case 'x':
                        this.copySelection();
                        this.deleteSelection();
                        return;
                    case 'k':
                        this.commandDialog();
                        return;
                }
            }
            if (e.code === 'Space') {
                e.preventDefault();
                this.space = true;
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (this.draft.length) {
                    if(this.drawingSession)this.drawingSession.undo();else this.draft.pop();
                    this.preview=null;
                    this.updateTools();
                    this.renderer.invalidate();
                }
                else if (this.selection.size)
                    this.deleteSelection();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                this.finishPath();
                return;
            }
            const key = e.key.toLowerCase(), tools = { v: 'select', h: 'pan', l: 'line', p: 'polyline', r: 'rect', c: 'circle', k: 'connect', t: 'text', d: 'dimension', a:'arc', e:'ellipse', b:'spline' };
            if (tools[key]) {
                this.setTool(tools[key]);
                e.preventDefault();
            }
            else if (key === 'f') {
                this.renderer.fit();
                e.preventDefault();
            }
            else if (key === 'g')
                this.action('toggle-grid');
            else if (key === 's')
                this.action('toggle-snap');
            else if (key === 'o')
                this.action('toggle-ortho');
            else if (key === '?' || key === 'f1')
                this.helpDialog();
            else if (key === ':')
                this.commandDialog();
        }
        catch (error) {
            this.toast(error.message, true);
        }
    }
    helpDialog() { const stats = this.renderer.stats; this.openModal('Conduit CAD · 0.9.1', `<p><strong>Touch-first drafting and diagramming, built on native DXF entities.</strong> All drawing, import, routing, rendering and saving run on your device.</p><div class="about-stats"><div><b>${SYMBOLS.length}</b><small>SYMBOL MASTERS</small></div><div><b>19</b><small>ES MODULE PACKAGES</small></div><div><b>${E(stats.compositor || stats.backend)}</b><small>ACTIVE COMPOSITOR</small></div></div>${iconPreferencesMarkup()}<div class="section-label">TOUCH & PEN</div><p>Tap a tool, then tap points or drag to draw. Drag a selected object to move it. Use two fingers to pan and zoom without drawing. Drag the grab handle of a library symbol onto the canvas; a simple tap on its card arms placement. Hold the canvas for object actions. Drag a visible port to connect. A magnifier appears during touch editing.</p><div class="section-label">KEYBOARD</div><table class="keyboard-table">${[['Select / Pan', 'V / H or Space'], ['Line / Polyline / Rectangle', 'L / P / R'], ['Circle / Text / Dimension', 'C / T / D'], ['Arc / Ellipse / Spline', 'A / E / B'], ['Connect / Fit', 'K / F'], ['Grid / Snap / Ortho', 'G / S / O'], ['Add to selection', 'Shift-click'], ['Undo / Redo', 'Ctrl/⌘ Z / Shift Z'], ['Duplicate / Copy / Paste', 'Ctrl/⌘ D / C / V'], ['Open / Save project', 'Ctrl/⌘ O / S'], ['Command palette', 'Ctrl/⌘ K'], ['Complete polyline / Cancel', 'Enter / Escape']].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table><div class="section-label" style="margin-top:20px">COMPATIBILITY BOUNDARY</div><p>This release combines planar drafting with mesh-based 3D feature modeling, not full AutoCAD or Fusion parity. It imports common ASCII/binary DXF entities and preserves the original input. Normalized export is not a lossless rewrite of every DXF feature. DWG, curved boundary-representation modeling, ACIS solids, proprietary Autodesk dynamic-action evaluation, XREF resolution, associative hatch editing, tilted/perspective paper viewports and block XCLIP, complete SHX/MTEXT font fidelity and standards certification remain outside this release. Native hatch edges, island holes, line patterns, OCS projection and mesh wireframes are supported. Shared block editing, constraint-based and action-based Conduit blocks, analytic planar solving and calculated annotations are supported. Unshifted two-color LINEAR gradients render natively; other gradient distributions retain their data with a diagnosed flat preview.</p><div class="section-label">RENDERER DIAGNOSTICS</div><p>${stats.segments.toLocaleString()} compiled segments · ${stats.buildMs.toFixed(2)} ms scene build · ${stats.frameMs.toFixed(2)} ms last CPU frame submission. These are CPU wall times, not GPU timestamps.</p><p class="muted-note">${E(this.rendererMessage || 'No backend initialization warnings.')}<br>Use HTTPS or localhost for the WebGPU path. Fallbacks are selected automatically when initialization or device recovery fails.</p>`, { wide: true }); }
    dispose() { this.model3d?.dispose(); this.input.reset(); this.cancelGesture(); const saved = disposeDocuments(this); this.abort.abort(); this.input.dispose(); this.renderer.dispose(); this.closeModal(); clearTimeout(this.toastTimer); this.root.innerHTML = ''; return saved; }
}
export function mountWorkbench(element, options = {}) { return new Workbench(element, options); }
