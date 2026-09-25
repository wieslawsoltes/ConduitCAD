/** Responsive sheets and keyboard-aware viewport. No user-agent/device-name detection. */
export function bindMobileWorkspace(w) {
    const signal = w.abort.signal;
    const media = matchMedia('(max-width:720px), (max-height:540px) and (pointer:coarse)');
    w.mobileMedia = media;
    const updateViewport = () => {
        if (w.disposed) return;
        const viewport = window.visualViewport;
        const height = viewport && Math.abs(viewport.scale - 1) < .01 ? viewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--workspace-vh', `${height}px`);
        document.documentElement.style.setProperty('--workspace-top', `${viewport && Math.abs(viewport.scale - 1) < .01 ? viewport.offsetTop : 0}px`);
        const focused = document.activeElement?.matches('input,textarea,[contenteditable="true"]');
        const keyboard = media.matches && focused && window.innerHeight - height > 120;
        document.documentElement.classList.toggle('workspace-keyboard', !!keyboard);
        w.$('.app').classList.toggle('mobile-workspace', media.matches);
        for (const name of ['library', 'inspector']) {
            const panel = w.$('.' + name);
            panel.inert = media.matches && !panel.classList.contains('open');
        }
        const bar = w.$('.document-bar').getBoundingClientRect();
        w.$('.app').style.setProperty('--sheet-top', `${bar.bottom}px`);
        if (w.modal && keyboard) requestAnimationFrame(() => document.activeElement?.scrollIntoView?.({ block: 'nearest' }));
        w.renderer.resize();
    };
    window.visualViewport?.addEventListener('resize', updateViewport, { signal });
    window.visualViewport?.addEventListener('scroll', updateViewport, { signal });
    window.addEventListener('resize', updateViewport, { signal });
    media.addEventListener('change', () => { w.closePanels(); updateViewport(); }, { signal });
    document.addEventListener('focusin', updateViewport, { signal });
    document.addEventListener('focusout', () => setTimeout(updateViewport, 0), { signal });
    for (const name of ['library', 'inspector']) {
        const panel = w.$('.' + name), handle = document.createElement('button');
        panel.id = 'panel-' + name;
        handle.type = 'button'; handle.className = 'sheet-handle';
        handle.setAttribute('aria-label', `Expand or reduce ${name === 'library' ? 'symbol library' : 'properties'} sheet`);
        handle.setAttribute('aria-expanded', 'false'); handle.innerHTML = '<span></span>';
        panel.prepend(handle);
        let start = null, suppressClick = false;
        const expand = value => { panel.classList.toggle('expanded', value); handle.setAttribute('aria-expanded', String(value)); };
        handle.addEventListener('click', () => { if (suppressClick) { suppressClick = false; return; } expand(!panel.classList.contains('expanded')); }, { signal });
        handle.addEventListener('pointerdown', event => { start = { y: event.clientY, id: event.pointerId }; handle.setPointerCapture(event.pointerId); }, { signal });
        handle.addEventListener('pointerup', event => {
            if (!start || start.id !== event.pointerId) return;
            const delta = event.clientY - start.y; start = null;
            if (Math.abs(delta) < 35) return;
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            if (delta < 0) expand(true);
            else if (panel.classList.contains('expanded')) expand(false);
            else w.closePanels();
        }, { signal });
        handle.addEventListener('pointercancel', () => { start = null; suppressClick = false; }, { signal });
    }
    w.updateMobileViewport = updateViewport;
    updateViewport();
}
export function updateMobilePanels(w, focusName = null) {
    if (!w.mobileMedia) return;
    for (const name of ['library', 'inspector']) {
        const panel = w.$('.' + name), open = panel.classList.contains('open');
        panel.inert = w.mobileMedia.matches && !open;
        for (const control of w.root.querySelectorAll(`[data-action="toggle-${name}"]`)) {
            control.setAttribute('aria-expanded', String(open));
            control.setAttribute('aria-controls', panel.id);
        }
    }
    if (w.mobileMedia.matches && focusName) {
        w.panelPreviousFocus = document.activeElement;
        const focus = w.$(`.${focusName} .sheet-handle`);
        focus?.focus({ preventScroll: true });
    }
}
