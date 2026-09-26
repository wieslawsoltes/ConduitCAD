import { ICON_GROUPS } from '@conduitcad/icons';
import { actionIcon, fieldIcon, headingIcon } from './icon-map.js';
import { icon, commandContent, escapeHTML as E } from './icons.js';

const IDS = Object.freeze({'author-add-parameter':'param','author-add-action':'plus','manager-insert':'block',
    'manager-delete':'trash','manager-create':'plus','add-parameter':'plus'});
const EXPORTS = Object.freeze({dxf:'file-cad','dxf-binary':'file-code','dxf-graph':'graph',project:'save',svg:'file-image',
    png:'file-image',bom:'file-table',graph:'graph',original:'file'});
let instanceId = 0;
const titleOf = name => name.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
/** Run only at UI render boundaries, never on camera frames or against drawing SVGs. */
export function decorateIconography(host) {
    if (!host) return;
    for (const b of host.querySelectorAll('button')) {
        if (b.matches('.symbol-card,.template-card,.model3d-example,.document-list-open,[role="tab"][data-document-id]')) continue;
        let glyph = b.dataset.iconName || IDS[b.id];
        if (b.dataset.inspector) glyph = ({properties:'properties',layers:'layers',qa:'check-circle'})[b.dataset.inspector];
        if (b.dataset.export) glyph = EXPORTS[b.dataset.export];
        if (b.hasAttribute('data-constraint-delete') || b.classList.contains('remove-param')) {
            glyph = 'trash'; b.setAttribute('aria-label', b.classList.contains('remove-param') ? 'Remove parameter' : 'Remove constraint');
            if(b.querySelector(':scope > .icon')?.dataset.icon !== glyph) b.innerHTML = icon(glyph, 'command-icon'); b.classList.add('icon-btn');
        } else if (b.dataset.constraintOperation) glyph = ({edit:'feature-edit',suppress:'feature-off',remove:'trash'})[b.dataset.constraintOperation];
        if (!glyph && b.dataset.action && !b.querySelector('.icon')) glyph = actionIcon(b.dataset.action);
        if (!glyph) continue;
        const old = b.querySelector(':scope > .icon');
        if (old && old.dataset.icon !== glyph) { old.outerHTML = icon(glyph, 'command-icon'); }
        else if (old) old.classList.add('command-icon');
        else if (b.children.length === 0) { b.innerHTML = commandContent('', b.textContent, glyph); }
        else b.insertAdjacentHTML('afterbegin', icon(glyph, 'command-icon'));
        if (!b.title && !b.hasAttribute('data-icon-tooltip-title') && b.textContent.trim()) b.title = b.getAttribute('aria-label') || b.textContent.trim();
    }
    for (const h of host.querySelectorAll('.inspector-content h3,.inspector-section h3,.modal h2,.modal h3')) {
        const glyph = headingIcon(h.textContent);
        if (glyph && !h.querySelector(':scope > .icon')) { h.classList.add('icon-heading'); h.insertAdjacentHTML('afterbegin',icon(glyph)); }
    }
    for (const label of host.querySelectorAll('label.field')) {
        if (label.querySelector(':scope > .field-caption')) continue;
        const input = label.querySelector('input,select,textarea,output');
        if (!input || input.matches('[type="checkbox"],[type="radio"]')) continue;
        const name = input.dataset.prop || input.dataset.modelField || input.dataset.field || input.dataset.dim || input.name || '';
        const nodes = [...label.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
        const existing = label.querySelector(':scope > span:not(.unit)');
        const text = existing?.textContent || nodes.map(n=>n.textContent).join('').trim();
        const glyph = fieldIcon(name, text);
        if (!glyph || !text) continue;
        const caption = existing || document.createElement('span');
        if (!existing) { label.insertBefore(caption, label.firstChild); for (const node of nodes) caption.append(node); }
        caption.classList.add('field-caption'); caption.insertAdjacentHTML('afterbegin',icon(glyph));
    }
}

export function iconPreferencesMarkup() {
    return `<div class="icon-preferences"><label>${icon('labels')}<span>Labels</span><select data-icon-label-mode aria-label="Toolbar label style"><option value="auto">Adaptive</option><option value="labels">Icons and labels</option><option value="compact">Compact icons</option></select></label><button type="button" class="btn" data-action="icon-guide">${commandContent('icon-guide','Icon guide')}</button></div>`;
}

export function bindIconography(w) {
    let mode = 'auto', tooltip = null, owner = null, timer = 0, hideTimer = 0, title = null;
    const signal = w.abort.signal, tooltipId = 'conduit-command-tooltip-' + (++instanceId);
    try { const saved = localStorage.getItem('conduit-toolbar-labels'); if (['auto','labels','compact'].includes(saved)) mode = saved; } catch { /* A preference must never prevent startup in restricted storage. */ }
    const setMode = value => {
        if (!['auto','labels','compact'].includes(value)) throw new RangeError('Unknown toolbar label style');
        mode = value;
        w.root.setAttribute('data-icon-labels',mode);
        w.$('.app')?.setAttribute('data-icon-labels',mode);
        w.modal?.setAttribute('data-icon-labels',mode);
        for (const root of [w.root,w.modal]) root?.querySelectorAll('[data-icon-label-mode]').forEach(e=>{e.value=mode;});
        try { localStorage.setItem('conduit-toolbar-labels',mode); } catch { /* Optional preference only. */ }
    };
    const hide = () => {
        clearTimeout(timer); clearTimeout(hideTimer);
        if (owner) {
            const tokens=(owner.getAttribute('aria-describedby') || '').split(/\s+/).filter(t=>t && t!==tooltipId);
            if (tokens.length) owner.setAttribute('aria-describedby',tokens.join(' ')); else owner.removeAttribute('aria-describedby');
            const latestTitle = owner.getAttribute('data-icon-tooltip-title') ?? title;
            if (latestTitle !== null && !owner.hasAttribute('title')) owner.setAttribute('title',latestTitle);
            owner.removeAttribute('data-icon-tooltip-title');
        }
        tooltip?.remove(); tooltip=null; owner=null; title=null;
    };
    const position = () => {
        if (!owner?.isConnected || owner.closest('[inert]') || !owner.getClientRects().length) { hide(); return; }
        const box=owner.getBoundingClientRect(), r=tooltip.getBoundingClientRect(), vv=window.visualViewport;
        const x=vv?.offsetLeft || 0, y=vv?.offsetTop || 0, width=vv?.width || innerWidth, height=vv?.height || innerHeight;
        tooltip.style.left=Math.max(x+8,Math.min(box.x+box.width/2-r.width/2,x+width-r.width-8))+'px';
        const top=box.bottom+7+r.height <= y+height-8 ? box.bottom+7 : box.top-r.height-7;
        tooltip.style.top=Math.max(y+8,top)+'px';
    };
    const show = b => {
        hide();
        if (!b.isConnected || b.disabled || b.closest('[inert]')) return;
        const text=b.title || b.getAttribute('aria-label') || b.textContent.trim();
        if (!text) return;
        owner=b; title=b.hasAttribute('title') ? b.title : null;
        if (title!==null) { b.dataset.iconTooltipTitle=title; b.removeAttribute('title'); } // Avoid simultaneous browser and custom popups.
        tooltip=document.createElement('div'); tooltip.className='command-tooltip'; tooltip.id=tooltipId;
        tooltip.setAttribute('role','tooltip'); tooltip.textContent=text;
        (w.modal?.contains(b) ? w.modal.querySelector('.modal') : w.$('.app')).append(tooltip);
        b.setAttribute('aria-describedby', [...new Set((b.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).concat(tooltipId))].join(' '));
        tooltip.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
        tooltip.addEventListener('pointerleave',()=>{hideTimer=setTimeout(hide,100);});
        position();
    };
    const trigger = event => {
        const b=event.target?.closest?.('button');
        if (!b || !(w.root.contains(b)||w.modal?.contains(b)) || !b.querySelector('.icon')) return null;
        if (b.matches('.symbol-card,.template-card,.model3d-example,.document-list-open')) return null;
        return b;
    };
    document.addEventListener('pointerover',e=>{
        if(e.pointerType==='touch')return;
        const b=trigger(e); if(b===owner){clearTimeout(hideTimer);return;} if(!b || b.contains(e.relatedTarget))return;
        clearTimeout(timer); clearTimeout(hideTimer); timer=setTimeout(()=>show(b),350);
    },{signal});
    document.addEventListener('pointerout',e=>{
        const b=trigger(e); if(!b || b.contains(e.relatedTarget))return;
        clearTimeout(timer); hideTimer=setTimeout(hide,140);
    },{signal});
    document.addEventListener('focusin',e=>{const b=trigger(e);if(b && b.matches(':focus-visible'))show(b);},{signal});
    document.addEventListener('focusout',()=>{hideTimer=setTimeout(hide,0);},{signal});
    document.addEventListener('pointerdown',hide,{signal,capture:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && tooltip){hide();e.preventDefault();e.stopImmediatePropagation();}},{signal,capture:true});
    document.addEventListener('scroll',hide,{signal,capture:true,passive:true});
    window.addEventListener('resize',hide,{signal,passive:true});
    document.addEventListener('change',e=>{if(e.target.matches?.('[data-icon-label-mode]') && (w.root.contains(e.target)||w.modal?.contains(e.target)))setMode(e.target.value);},{signal});
    signal.addEventListener('abort',hide,{once:true});
    const prepare = host => { decorateIconography(host); host?.setAttribute('data-icon-labels',mode); host?.querySelectorAll('[data-icon-label-mode]').forEach(e=>{e.value=mode;}); };
    const guide = () => {
        w.openModal('Icon guide & toolbar labels', `<p>One icon family across drawing, modeling and editing. Adaptive mode keeps unfamiliar commands labeled and compacts navigation on small screens. Choose Icons and labels to keep toolbar captions visible.</p>${iconPreferencesMarkup().replace(/<button[\s\S]*?<\/button>/,'')}<label class="field">Find an icon<input type="search" data-icon-search placeholder="Extrude, hole, dimension, block…" aria-label="Find an icon"></label><div class="icon-guide-grid">${Object.entries(ICON_GROUPS).map(([group,names])=>`<section><h3>${E(group)}</h3><div class="icon-guide-items">${names.map(name=>`<div class="icon-guide-item" data-icon-search-text="${E((name+' '+group).toLowerCase())}">${icon(name)}<span>${E(titleOf(name))}</span></div>`).join('')}</div></section>`).join('')}</div>`,{wide:true});
        w.modal.querySelector('[data-icon-search]').addEventListener('input', e=>{ const words=e.target.value.toLowerCase().split(/\s+/); for(const item of w.modal.querySelectorAll('[data-icon-search-text]'))item.hidden=!words.every(v=>item.dataset.iconSearchText.includes(v)); for(const group of w.modal.querySelectorAll('.icon-guide-grid section'))group.hidden=![...group.querySelectorAll('.icon-guide-item')].some(i=>!i.hidden); });
    };
    setMode(mode); prepare(w.root);
    return {prepare,setMode,guide,hide,dispose:hide,get mode(){return mode;}};
}
