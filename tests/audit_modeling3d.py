"""Independent ezdxf readback of all 3D example ASCII/binary files.
Checks native records, XYZ coordinates, polygon topology and independent mass integrals.
This is not a native AutoCAD/Fusion acceptance test.
"""
import json
from pathlib import Path
import numpy as np
import ezdxf
ROOT=Path(__file__).resolve().parents[1]
checks=[];files=[]
def ok(name,value):
    assert value,name
    checks.append({'name':name,'passed':True})
for project in sorted((ROOT/'samples/3d').glob('*.conduit.json')):
    source=json.loads(project.read_text());name=project.name.split('.')[0]
    for binary in [False,True]:
        path=project.with_name(name+('-binary' if binary else '')+'.dxf')
        drawing=ezdxf.readfile(path);audit=drawing.audit();native=list(drawing.modelspace());label=path.name
        ok(label+' opens with no repairs or errors',not audit.errors and not audit.fixes)
        ok(label+' uses DXF R2018 version',drawing.dxfversion=='AC1032')
        ok(label+' preserves entity count',len(native)==len(source['entities']))
        meshes=[]
        for index,(actual,expected) in enumerate(zip(native,source['entities'])):
            prefix=f'{label} entity {index}'
            ok(prefix+' retains native entity type',actual.dxftype()==expected['type'])
            if actual.dxftype()=='MESH':
                vertices=np.asarray(actual.vertices,dtype=float);faces=[list(f) for f in actual.faces]
                ok(prefix+' exact XYZ readback',vertices.shape==(len(expected['points']),3) and np.allclose(vertices,[[p['x'],p['y'],p.get('z',0)]for p in expected['points']],rtol=1e-12,atol=1e-10))
                ok(prefix+' native polygon indices match',faces==expected['faces'])
                ok(prefix+' no false subdivision level',actual.dxf.subdivision_levels==0)
                incidences={}
                for face in faces:
                    for i,a in enumerate(face):
                        b=face[(i+1)%len(face)];key=tuple(sorted([a,b]));count,sign=incidences.get(key,(0,0));incidences[key]=(count+1,sign+(1 if a<b else -1))
                ok(prefix+' closed oriented topology',all(count==2 and sign==0 for count,sign in incidences.values()))
                # Signed tetrahedral volume can use polygon fans independently of display triangulation.
                origin=(vertices.min(0)+vertices.max(0))/2;q=vertices-origin;volume=0.
                for face in faces:
                    for j in range(1,len(face)-1):volume+=np.dot(q[face[0]],np.cross(q[face[j]],q[face[j+1]]))/6
                ok(prefix+' positive independent volume',np.isfinite(volume) and volume>0)
                ok(prefix+' hidden construction stock flag matches',bool(actual.dxf.invisible)==bool(expected.get('hidden') or expected.get('model3dConsumed') or expected.get('feature3d',{}).get('suppressed')))
                meshes.append({'index':index,'vertices':len(vertices),'faces':len(faces),'volume':float(volume)})
            elif actual.dxftype()=='POLYLINE' and expected.get('flags',0)&8:
                ok(prefix+' retains spatial polyline flag',actual.is_3d_polyline)
                points=[list(v.dxf.location)for v in actual.vertices]
                ok(prefix+' retains every path Z',np.allclose(points,[[p['x'],p['y'],p.get('z',0)]for p in expected['points']]))
            elif actual.dxftype()=='CIRCLE':
                ok(prefix+' retains circle elevation',abs(actual.dxf.center.z-expected['c'].get('z',0))<1e-10)
        files.append({'file':label,'entities':len(native),'meshes':meshes,'auditErrors':len(audit.errors),'auditRepairs':len(audit.fixes)})
manifest=json.loads((ROOT/'artifacts/modeling-samples.json').read_text())
assert len(files)==2*len(manifest) and len(manifest)>=13,'Every registered 3D example must have both native encodings'
assert {f['file'].removesuffix('-binary.dxf').removesuffix('.dxf') for f in files}=={e['id'] for e in manifest},'Example audit must match generated manifest'
(ROOT/'artifacts/modeling3d-dxf-audit.json').write_text(json.dumps({'files':files,'passed':len(checks),'checks':checks,'reader':'ezdxf '+ezdxf.__version__,'nativeAutodeskValidation':False},indent=2))
print(json.dumps({'files':len(files),'checks':len(checks),'errors':0,'repairs':0}))
