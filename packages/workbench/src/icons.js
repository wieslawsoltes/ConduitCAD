import { icon as renderIcon } from '@conduitcad/icons';
import { actionIcon, toolIcon as lookupToolIcon, entityIcon as lookupEntityIcon } from './icon-map.js';
export function icon(name, cls = '') { return renderIcon(name, cls); }
export function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function toolIcon(name, fallback) { return lookupToolIcon(name, fallback); }
export function entityIcon(entity) { return lookupEntityIcon(entity); }
/** Labels stay in the accessibility tree, even when visually compacted. */
export function commandContent(action, label, glyph = '') {
    return `${icon(glyph || actionIcon(action), 'command-icon')}<span class="command-label">${escapeHTML(label)}</span>`;
}
/** extra is trusted internal attribute markup, never untrusted document data. */
export function commandButton(action, label, cls = '', extra = '', glyph = '') {
    return `<button type="button" class="${escapeHTML(cls)}" data-action="${escapeHTML(action)}" title="${escapeHTML(label)}" ${extra}>${commandContent(action, label, glyph)}</button>`;
}
/** Preserve node identity, focus, listeners and selection state on unchanged syncs. */
export function setCommandLabel(button, label, glyph = '') {
    if (!button) return;
    let caption = button.querySelector(':scope > .command-label');
    if (!caption) { button.innerHTML = commandContent(button.dataset.action || '', label, glyph); caption = button.querySelector('.command-label'); }
    if (caption.textContent !== label) caption.textContent = label;
    const key = glyph || actionIcon(button.dataset.action || '');
    const current = button.querySelector(':scope > .icon');
    if (current?.dataset.icon !== key) {
        if (current) current.outerHTML = icon(key, 'command-icon');
        else button.insertAdjacentHTML('afterbegin', icon(key, 'command-icon'));
    }
    // Keep explicitly supplied accessible names synchronized with changing state labels.
    if (button.hasAttribute('aria-label')) button.setAttribute('aria-label', label);
    if (button.hasAttribute('data-icon-tooltip-title')) {
        if (button.dataset.iconTooltipTitle !== label) button.dataset.iconTooltipTitle = label;
    } else if (button.title !== label) button.title = label;
}
