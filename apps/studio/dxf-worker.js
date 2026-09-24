import { parseDXF } from '@conduitcad/dxf';
self.onmessage = event => {
    try {
        const { buffer, name, encoding } = event.data;
        self.postMessage({ document: parseDXF(buffer, { name, encoding }) });
    }
    catch (error) {
        self.postMessage({ error: error.message || String(error) });
    }
};
