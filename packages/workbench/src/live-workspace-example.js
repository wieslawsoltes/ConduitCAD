import { createDocument, entity, circle, text } from '@conduitcad/model';
import { addFeature, spatialPathPoints } from '@conduitcad/modeling';
/** Original editable example. Native vertices and Conduit expressions coexist in the DXF. */
export function createLiveWorkspaceExample() {
    const doc = createDocument('Parametric path workshop');
    doc.parameters = {
        Span: { expression: '100', unit: 'mm', description: 'Distance between the two risers' },
        Rise: { expression: '70', unit: 'mm', description: 'Height of the route' },
        TubeRadius: { expression: '6', unit: 'mm', description: 'Circular sweep profile radius' },
        PlateThickness: { expression: '10', unit: 'mm', description: 'Base plate height' }
    };
    doc.metadata.description = 'Edit Span / Rise in live Parameters. Edit the native WCS route with XYZ handles; the dependent sweep regenerates. 2D Draw retains the footprint and native profile.';
    const coordinates = [
        { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 'Rise' },
        { x: 'Span', y: 0, z: 'Rise' }, { x: 'Span', y: 0, z: 0 }
    ];
    const path = entity('POLYLINE', { id: 'live-route', layer: 'Process', label: 'Editable WCS route', points: spatialPathPoints(coordinates, doc.parameters), closed: false, flags: 8, parametric: { kind: 'spatial-path', version: 1, coordinates } });
    const profile = circle({ x: 0, y: 0 }, 6, { id: 'live-profile', layer: 'Process', label: 'Tube radius profile', parametric: { radius: 'TubeRadius' } });
    doc.entities.push(path, profile);
    const tube = addFeature(doc, 'sweep', { segments: 24 }, [profile.id, path.id], { name: 'Parametric conduit', layer: 'Equipment', color: '#378c85' });
    tube.id = 'live-sweep';
    const plate = addFeature(doc, 'box', { x: -18, y: -20, z: '-PlateThickness', width: 'Span + 36', depth: 40, height: 'PlateThickness' }, [], { name: 'Parametric mounting plate', layer: 'Equipment', color: '#b4b9b3' });
    plate.id = 'live-plate';
    doc.entities.push(entity('LWPOLYLINE', { id: 'live-footprint', label: 'Editable 2D footprint', layer: 'Annotations', closed: true, points: [{ x: 0, y: 65 }, { x: 100, y: 65 }, { x: 100, y: 95 }, { x: 0, y: 95 }], parametric: { kind: 'rectangle', width: 'Span', height: '30' } }));
    doc.entities.push(text({ x: 0, y: 115 }, 'Span / Rise: live parameters · route: Edit on canvas', 5, { id: 'live-caption', layer: 'Annotations' }));
    return doc;
}
