/** Shared touch/compact layout policy. Also covers portrait tablets and split-screen hosts. */
export const MOBILE_MEDIA = '(max-width:720px), (max-width:1100px) and (pointer:coarse), (max-height:540px) and (pointer:coarse)';

/** Pure viewport calculation, deliberately not interpreting accessibility pinch zoom as a keyboard. */
export function mobileViewportMetrics({ width, height, visualHeight = height, visualTop = 0, scale = 1, focused = false, baselineHeight = height }) {
    const unzoomed = Number.isFinite(scale) && Math.abs(scale - 1) < .01;
    const visibleHeight = unzoomed && Number.isFinite(visualHeight) && visualHeight > 0 ? Math.min(height, visualHeight) : height;
    return {
        width, height: visibleHeight,
        top: unzoomed && Number.isFinite(visualTop) ? Math.max(0, visualTop) : 0,
        keyboard: !!focused && unzoomed && Math.max(height, baselineHeight) - visibleHeight > 120
    };
}
const textInput = element => element?.matches('textarea,input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="button"]),[contenteditable="true"]');
const focusable = root => [...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')]
    .filter(el => !el.closest('[hidden],[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');

/** Resize events are coalesced; host chrome is measured instead of assuming a fixed toolbar height. */
export function bindMobileWorkspace(w) {
    const signal = w.abort.signal, app = w.$('.app');
    const media = matchMedia(MOBILE_MEDIA);
    w.mobileMedia = media;
    let frame = 0, lastSize = '', baselineHeight = innerHeight, lastWidth = innerWidth;
    const updateViewport = () => {
        frame = 0;
        if (w.disposed || signal.aborted) return;
        const focused = textInput(document.activeElement);
        // Rotation / split-screen is a new baseline; keyboard animation on the same width is not.
        if (Math.abs(innerWidth - lastWidth) > 80) baselineHeight = innerHeight;
        if (!focused) baselineHeight = innerHeight;
        lastWidth = innerWidth;
        const v = mobileViewportMetrics({ width: innerWidth, height: innerHeight, visualHeight: window.visualViewport?.height, visualTop: window.visualViewport?.offsetTop, scale: window.visualViewport?.scale, focused, baselineHeight });
        const mobile = media.matches, keyboard = mobile && v.keyboard;
        app.classList.toggle('mobile-workspace', mobile);
        app.classList.toggle('workspace-keyboard', keyboard);
        app.classList.toggle('mobile-landscape', mobile && innerWidth > baselineHeight && baselineHeight <= 540);
        const values = { '--workspace-vh': `${v.height}px`, '--workspace-top': `${v.top}px` };
        for (const [key, value] of Object.entries(values)) {
            if (app.style.getPropertyValue(key) !== value) app.style.setProperty(key, value);
            w.modal?.style.setProperty(key, value);
        }
        w.modal?.classList.toggle('mobile-dialog', mobile);
        w.modal?.classList.toggle('keyboard-dialog', keyboard);
        const canvas = w.$('.canvas-area').getBoundingClientRect();
        app.style.setProperty('--sheet-top', `${canvas.top}px`);
        const bottom = Math.max(0, innerHeight - canvas.bottom);
        app.style.setProperty('--sheet-bottom', `${bottom}px`);
        updateMobilePanels(w);
        const size = `${canvas.width}:${canvas.height}`;
        if (size !== lastSize) { lastSize = size; w.renderer.resize(); }
        // Scroll only the local scrolling region, not the body or the CAD camera.
        if (keyboard && focused) {
            const input = document.activeElement, scroller = input.closest('.modal-body,.inspector-content,.library-scroll');
            if (scroller) {
                const a = input.getBoundingClientRect(), b = scroller.getBoundingClientRect();
                if (a.bottom > b.bottom - 16) scroller.scrollTop += a.bottom - b.bottom + 16;
                else if (a.top < b.top + 16) scroller.scrollTop -= b.top + 16 - a.top;
            }
        }
    };
    const schedule = () => { if (!frame && !signal.aborted) frame = requestAnimationFrame(updateViewport); };
    window.visualViewport?.addEventListener('resize', schedule, { signal });
    window.visualViewport?.addEventListener('scroll', schedule, { signal });
    window.addEventListener('resize', schedule, { signal });
    media.addEventListener('change', () => {
        // A queued media event can arrive after the user explicitly opens a sheet.
        // Preserve that intent across resizing instead of hiding the active editor.
        const library = w.$('.library'), inspector = w.$('.inspector');
        if (media.matches && library.classList.contains('open') && inspector.classList.contains('open'))
            library.classList.remove('open');
        w.$('.sheet-backdrop').classList.toggle('visible', media.matches &&
            (library.classList.contains('open') || inspector.classList.contains('open')));
        updateMobilePanels(w);
        schedule();
    }, { signal });
    document.addEventListener('focusin', schedule, { signal });
    document.addEventListener('focusout', schedule, { signal });
    const observer = new ResizeObserver(schedule);
    for (const node of [app, w.$('.canvas-area'), w.$('.document-bar')]) observer.observe(node);
    signal.addEventListener('abort', () => { observer.disconnect(); cancelAnimationFrame(frame); }, { once: true });
    for (const name of ['library', 'inspector']) {
        const panel = w.$('.' + name), handle = document.createElement('button');
        panel.id = 'panel-' + name;
        handle.type = 'button'; handle.className = 'sheet-handle';
        handle.setAttribute('aria-expanded', 'false'); handle.setAttribute('aria-controls', panel.id);
        handle.innerHTML = `<span class="sheet-grip" aria-hidden="true"></span><span class="sheet-name">${name === 'library' ? 'Symbol library' : 'Drawing properties'}</span><span class="sheet-size" aria-hidden="true">Expand</span>`;
        panel.prepend(handle);
        let start = null, suppressClick = false, resetTimer = 0;
        const expand = value => {
            panel.classList.toggle('expanded', value);
            handle.setAttribute('aria-expanded', String(value));
            handle.setAttribute('aria-label', `${value ? 'Reduce' : 'Expand'} ${name === 'library' ? 'symbol library' : 'properties'} sheet`);
            handle.querySelector('.sheet-size').textContent = value ? 'Reduce' : 'Expand';
            schedule();
        };
        expand(false);
        handle.addEventListener('click', () => { if (suppressClick) { suppressClick = false; return; } expand(!panel.classList.contains('expanded')); }, { signal });
        handle.addEventListener('pointerdown', event => {
            if (!event.isPrimary || event.button !== 0) return;
            start = { y: event.clientY, id: event.pointerId }; handle.setPointerCapture(event.pointerId);
        }, { signal });
        handle.addEventListener('pointerup', event => {
            if (!start || start.id !== event.pointerId) return;
            const delta = event.clientY - start.y; start = null;
            if (Math.abs(delta) < 35) return;
            suppressClick = true;
            clearTimeout(resetTimer); resetTimer = setTimeout(() => { suppressClick = false; }, 250);
            if (delta < 0) expand(true);
            else if (panel.classList.contains('expanded')) expand(false);
            else w.closePanels();
        }, { signal });
        for (const type of ['pointercancel', 'lostpointercapture']) handle.addEventListener(type, () => { start = null; }, { signal });
        signal.addEventListener('abort', () => clearTimeout(resetTimer), { once: true });
    }
    // Arrow navigation never commits a CAD edit; native Enter/Space activates the chosen inspector view.
    const tabs = w.$('.inspector-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Drawing inspector views');
    tabs.addEventListener('keydown', event => {
        const items = [...tabs.querySelectorAll('[data-inspector]')], index = items.indexOf(event.target);
        if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + items.length) % items.length;
        items.forEach((node, i) => { node.tabIndex = i === next ? 0 : -1; }); items[next].focus({ preventScroll: true });
    }, { signal });
    w.updateMobileViewport = schedule;
    updateViewport();
}

export function updateMobilePanels(w, focusName = null) {
    if (!w.mobileMedia) return;
    for (const name of ['library', 'inspector']) {
        const panel = w.$('.' + name), open = panel.classList.contains('open');
        panel.inert = w.mobileMedia.matches && !open;
        for (const control of w.root.querySelectorAll(`[data-action="toggle-${name}"]`)) {
            control.setAttribute('aria-expanded', String(open)); control.setAttribute('aria-controls', panel.id);
        }
    }
    for (const tab of w.root.querySelectorAll('[data-inspector]')) {
        const selected = tab.dataset.inspector === w.inspectorTab;
        tab.setAttribute('role', 'tab'); tab.id = 'inspector-tab-' + tab.dataset.inspector;
        tab.setAttribute('aria-selected', String(selected)); tab.setAttribute('aria-controls', 'inspector-panel');
        if (!tab.parentElement.contains(document.activeElement)) tab.tabIndex = selected ? 0 : -1;
    }
    const content = w.$('.inspector-content');
    content.id = 'inspector-panel'; content.setAttribute('role', 'tabpanel'); content.setAttribute('aria-labelledby', 'inspector-tab-' + w.inspectorTab);
    if (w.mobileMedia.matches && focusName) {
        if (!document.activeElement?.closest('.library,.inspector')) w.panelPreviousFocus = document.activeElement;
        w.$(`.${focusName} .sheet-handle`)?.focus({ preventScroll: true });
    }
}

/** Shared by every dialog, including dynamic block / solver forms with wide native tables. */
export function prepareMobileDialog(w, backdrop) {
    const controller = new AbortController(), { signal } = controller;
    const app = w.$('.app'), previousInert = app.inert, dialog = backdrop.querySelector('.modal');
    app.inert = true;
    backdrop.classList.toggle('mobile-dialog', w.isMobile());
    for (const key of ['--workspace-vh', '--workspace-top']) backdrop.style.setProperty(key, app.style.getPropertyValue(key));
    const heading = backdrop.querySelector('h2'); heading.tabIndex = -1;
    const error = backdrop.querySelector('.error-text'); if (error) { error.setAttribute('role', 'alert'); error.setAttribute('aria-live', 'assertive'); }
    for (const table of backdrop.querySelectorAll('table')) {
        const region = document.createElement('div'); region.className = 'touch-table-region';
        region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', `${heading.textContent} table, scroll horizontally for all columns`);
        table.before(region); region.append(table);
    }
    for (const input of backdrop.querySelectorAll('input,textarea')) {
        input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off');
        if (input.type === 'number' && !input.hasAttribute('inputmode')) input.inputMode = 'decimal';
    }
    // Keep common command footers outside the scrolling document body.
    const actions = backdrop.querySelector('.document-list-footer');
    if (actions && !backdrop.querySelector('.modal-foot')) {
        const footer = document.createElement('footer'); footer.className = 'modal-foot'; footer.append(actions); dialog.append(footer);
    }
    const trap = event => {
        if (w.modal !== backdrop || event.key !== 'Tab') return;
        const items = focusable(backdrop), index = items.indexOf(document.activeElement);
        if (!items.length) { event.preventDefault(); heading.focus(); return; }
        if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length - 1) {
            event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0]).focus({ preventScroll: true });
        }
    };
    backdrop.addEventListener('keydown', trap, { signal });
    document.addEventListener('focusin', event => {
        if (w.modal === backdrop && !backdrop.contains(event.target)) heading.focus({ preventScroll: true });
    }, { signal });
    const focusTimer = setTimeout(() => {
        if (w.modal !== backdrop || backdrop.contains(document.activeElement)) return;
        // Do not summon the software keyboard just to browse tools or drawings.
        (w.isMobile() ? heading : backdrop.querySelector('input:not([type="checkbox"]):not(:disabled),textarea:not(:disabled),select:not(:disabled)') || heading).focus({ preventScroll: true });
    }, 30);
    w.updateMobileViewport?.();
    return () => { clearTimeout(focusTimer); controller.abort(); app.inert = previousInert; };
}
