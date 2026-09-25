"""Independent ezdxf verification of every master and all twenty editable starters.
This verifies DXF structure/analytic primitive retention, not normative symbol dimensions.
"""
from pathlib import Path
import json
import ezdxf
ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT/'artifacts/symbol-manifest.json').read_text())
starters = json.loads((ROOT/'artifacts/drawing-templates.json').read_text())
reports = []
def audit(path):
    doc = ezdxf.readfile(path)
    a = doc.audit()
    report = dict(file=str(path.relative_to(ROOT)), entities=len(doc.modelspace()), errors=[str(i.message) for i in a.errors], repairs=[str(i.message) for i in a.fixes])
    reports.append(report)
    assert not report['errors'] and not report['repairs'], report
    return doc
catalogue = audit(ROOT/'artifacts/symbol-catalog.dxf')
assert len(catalogue.modelspace().query('INSERT')) == 223
for master in manifest:
    block = catalogue.blocks.get(master['block'])
    types = [e.dxftype() for e in block]
    assert types == master['entities'], (master['id'], types, master['entities'])
    if 'SPLINE' in types:
        for spline in block.query('SPLINE'):
            assert len(spline.control_points) == 4 and spline.dxf.degree == 3
    assert block.block.has_xdata('CONDUITCAD'), master['id']
    meta = json.loads(''.join(t.value for t in block.block.get_xdata('CONDUITCAD') if t.code == 1000))
    assert meta['ports'] == master['ports'], master['id']
    assert meta['symbol']['geometryRevision'] == 3
    assert meta['symbol']['standardRefs'] == master['refs']
for starter in starters:
    document = audit(ROOT/starter['file'])
    assert len(document.modelspace()) == starter['entities']
    assert len(document.modelspace().query('INSERT')) == starter['nodes']
assert len(reports) == 21 and len(manifest) == 223
result = dict(ezdxfVersion=ezdxf.__version__, mastersVerified=len(manifest), templatesVerified=len(starters), errors=0, repairs=0, normativeCertification=False, files=reports)
(ROOT/'artifacts/symbol-dxf-audit.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, indent=2))
