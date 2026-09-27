"""Independent native-DXF audit of the editable rendering/material study.

Checks DXF-native mesh, color, transparency and topology using ezdxf. Conduit
metadata round trips are tested separately; this is not Autodesk acceptance.
"""
import json
from pathlib import Path
import ezdxf
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'samples/rendering/material-study.conduit.json').read_text())
checks, files = [], []

def check(name, condition):
    assert condition, name
    checks.append({'name': name, 'passed': True})

for binary in (False, True):
    name = 'material-study' + ('-binary' if binary else '') + '.dxf'
    path = ROOT / 'samples/rendering' / name
    drawing = ezdxf.readfile(path)
    audit = drawing.audit()
    native = list(drawing.modelspace())
    check(name + ' no audit errors or repairs', not audit.errors and not audit.fixes)
    check(name + ' DXF R2018', drawing.dxfversion == 'AC1032')
    check(name + ' all 19 authored meshes retained', len(native) == len(source['entities']) == 19)
    for index, (actual, expected) in enumerate(zip(native, source['entities'])):
        prefix = f'{name} entity {index}'
        check(prefix + ' native MESH, never a mislabeled ACIS solid', actual.dxftype() == expected['type'] == 'MESH')
        points = np.asarray(actual.vertices, dtype=float)
        expected_points = np.asarray([[p['x'], p['y'], p['z']] for p in expected['points']], dtype=float)
        faces = [list(face) for face in actual.faces]
        check(prefix + ' XYZ coordinates unchanged', points.shape == expected_points.shape and np.allclose(points, expected_points, rtol=1e-12, atol=1e-10))
        check(prefix + ' complete native polygon topology', faces == expected['faces'])
        check(prefix + ' no false subdivision levels', actual.dxf.subdivision_levels == 0)
        check(prefix + ' native true color', actual.dxf.true_color == int(expected['color'][1:], 16))
        check(prefix + ' native transparency within 8-bit quantization', abs(actual.transparency - (1 - expected.get('opacity', 1))) <= 1 / 255 + 1e-10)
        check(prefix + ' authoring metadata retained as application data', actual.has_xdata('CONDUITCAD'))
        incidence = {}
        for face in faces:
            for j, a in enumerate(face):
                b = face[(j + 1) % len(face)]
                key = tuple(sorted((a, b)))
                count, sign = incidence.get(key, (0, 0))
                incidence[key] = (count + 1, sign + (1 if a < b else -1))
        check(prefix + ' closed oriented topology', all(count == 2 and sign == 0 for count, sign in incidence.values()))
        q = points - (points.min(0) + points.max(0)) / 2
        volume = sum(np.dot(q[face[0]], np.cross(q[face[j]], q[face[j + 1]])) / 6 for face in faces for j in range(1, len(face) - 1))
        check(prefix + ' positive finite independent volume', np.isfinite(volume) and volume > 0)
    files.append({'file': name, 'entities': len(native), 'errors': len(audit.errors), 'repairs': len(audit.fixes)})

report = {'passed': len(checks), 'files': files, 'checks': checks, 'reader': 'ezdxf ' + ezdxf.__version__, 'nativeAutodeskValidation': False}
(ROOT / 'artifacts/rendering-dxf-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'checks': len(checks), 'files': len(files), 'errors': 0, 'repairs': 0}))
