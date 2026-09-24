import { mountWorkbench } from '@conduitcad/workbench';
try {
    globalThis.conduit = mountWorkbench(document.getElementById('app'));
    globalThis.conduit.ready.then(() => { document.documentElement.dataset.ready = 'true'; });
}
catch (error) {
    const host = document.getElementById('app');
    host.textContent = 'Conduit CAD could not initialize: ' + error.message;
    console.error(error);
}
if (!globalThis.__CONDUIT_STANDALONE__ && location.protocol !== 'file:' && 'serviceWorker' in navigator && !new URLSearchParams(location.search).has('no-sw'))
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { }); });
