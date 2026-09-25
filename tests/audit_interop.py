"""Independent native-DXF validation, separate from Conduit's own round-trip tests."""
import json, subprocess
from pathlib import Path
import ezdxf
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
subprocess.run(['node','--input-type=module','-e',r'''
import {readFileSync,writeFileSync} from 'node:fs';
import {parseDXF,writeDXF,writeDXFBinary} from './packages/dxf/src/index.js';
import {createDocument,entity} from './packages/model/src/index.js';
const d=parseDXF(readFileSync('tests/fixtures/interop.dxf'));
for(const [name,value] of [['normalized',writeDXF(d)],['binary',writeDXFBinary(d)],['preserved',writeDXF(d,{mode:'preserve'})],['preserved-binary',writeDXFBinary(d,{mode:'preserve'})]])writeFileSync('artifacts/interop-'+name+'.dxf',value);
const authored=createDocument();authored.entities.push(entity('DIMENSION',{a:{x:5,y:10},b:{x:105,y:10},offset:20}));writeFileSync('artifacts/interop-authored-dimension.dxf',writeDXF(authored));
'''],cwd=ROOT,check=True)
source=ezdxf.readfile(ROOT/'tests/fixtures/interop.dxf');checks=[];files=[]
def ok(name,value):
    assert value,name
    checks.append({'name':name,'passed':True})
def almost(a,b):return abs(a-b)<1e-8
for name in ['normalized','binary','preserved','preserved-binary']:
    d=ezdxf.readfile(OUT/f'interop-{name}.dxf');audit=d.audit();ok(name+': zero audit errors/repairs',not audit.errors and not audit.fixes)
    files.append({'name':name,'errors':len(audit.errors),'repairs':len(audit.fixes)})
    ok(name+': all layout names',d.layouts.names()==source.layouts.names())
    for layout in source.layouts:
        other=d.layouts.get(layout.name)
        ok(name+': entity sequence '+layout.name,[e.dxftype()for e in other]==[e.dxftype()for e in layout])
    dims=list(d.modelspace().query('DIMENSION'));originals=list(source.modelspace().query('DIMENSION'))
    ok(name+': seven native subtypes',set(x.dimtype for x in dims)==set(range(7)))
    for a,b in zip(dims,originals):
        ok(name+': DIMENSION '+str(a.dimtype),a.dxf.dimtype==b.dxf.dimtype and a.get_geometry_block() is not None and a.dxf.defpoint.isclose(b.dxf.defpoint))
    mesh=d.modelspace().query('MESH').first;ref=source.modelspace().query('MESH').first
    ok(name+': native mesh topology',list(mesh.faces)==list(ref.faces) and list(mesh.edges)==list(ref.edges))
    ok(name+': native mesh Z',all(all(almost(x,y)for x,y in zip(a,b))for a,b in zip(mesh.vertices,ref.vertices)))
    h=d.modelspace().query('HELIX').first;ref=source.modelspace().query('HELIX').first
    ok(name+': helix analytic properties',all(almost(h.dxf.get(k),ref.dxf.get(k))for k in ['radius','turns','turn_height']))
    ok(name+': helix spline controls',len(h.control_points)==len(ref.control_points) and all(all(almost(x,y)for x,y in zip(a,b))for a,b in zip(h.control_points,ref.control_points)))
    w=d.modelspace().query('WIPEOUT').first;ref=source.modelspace().query('WIPEOUT').first
    ok(name+': wipeout WCS polygon',all(a.isclose(b)for a,b in zip(w.boundary_path_wcs(),ref.boundary_path_wcs())))
    ok(name+': Unicode text',d.modelspace().query('TEXT').first.dxf.text==source.modelspace().query('TEXT').first.dxf.text)
    ok(name+': Unicode MTEXT',d.modelspace().query('MTEXT').first.text==source.modelspace().query('MTEXT').first.text)
    for layout in ['Sheet A','Sheet B']:
        vp=[v for v in d.layouts.get(layout).query('VIEWPORT')if v.dxf.id>1][0]
        ref=[v for v in source.layouts.get(layout).query('VIEWPORT')if v.dxf.id>1][0]
        ok(name+': frozen layer '+layout,vp.frozen_layers==ref.frozen_layers)
        ok(name+': view transform '+layout,all(almost(a,b)for a,b in zip(vp.get_transformation_matrix(),ref.get_transformation_matrix())))
        if layout=='Sheet B':ok(name+': resolved polygon clip',d.entitydb.get(vp.dxf.clipping_boundary_handle).dxftype()=='LWPOLYLINE')
    if name.startswith('preserved'):
        x=d.rootdict.get('ACME_DATA');ref=source.rootdict.get('ACME_DATA')
        ok(name+': arbitrary XRECORD int64/binary payload',x.tags==ref.tags)
        line=[e for e in d.modelspace().query('LINE')if e.has_extension_dict][0]
        ok(name+': extension dictionary identity',line.get_extension_dict()['ACME_FEATURE'].dxf.handle==[e for e in source.modelspace().query('LINE')if e.has_extension_dict][0].get_extension_dict()['ACME_FEATURE'].dxf.handle)
a=ezdxf.readfile(OUT/'interop-authored-dimension.dxf');audit=a.audit();ok('authored aligned dimension has zero errors/repairs',not audit.errors and not audit.fixes)
d=a.modelspace().query('DIMENSION').first;ok('authored DIMENSION picture and measurement',d.dimtype==1 and almost(d.get_measurement(),100) and len(d.get_geometry_block())>3)
report={'validator':'ezdxf '+ezdxf.__version__,'checks':checks,'passed':len(checks),'files':files,'scope':'Independent native field, topology, graph and ownership checks; not AutoCAD/physical-GPU certification.'}
(OUT/'interop-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
