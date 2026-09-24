"""Independent native DXF audit and field comparison; no self-roundtrip-only oracle."""
from pathlib import Path
import json, math, subprocess
import ezdxf
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import{parseDXF,writeDXF}from'@conduitcad/dxf'; const d=parseDXF(fs.readFileSync('tests/fixtures/fidelity.dxf'));fs.writeFileSync('artifacts/fidelity-normalized.dxf',writeDXF(d));"],cwd=ROOT,check=True)
a=ezdxf.readfile(ROOT/'tests/fixtures/fidelity.dxf');b=ezdxf.readfile(OUT/'fidelity-normalized.dxf');audit=b.audit()
assert not audit.errors and not audit.fixes,([str(x) for x in audit.errors],[str(x) for x in audit.fixes])
checks=[]
def eq(a,b,label):
 if isinstance(a,(float,int)) and isinstance(b,(float,int)):assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-9),(label,a,b)
 elif isinstance(a,(list,tuple)):
  assert len(a)==len(b),(label,len(a),len(b))
  for i,(x,y) in enumerate(zip(a,b)):eq(x,y,label+':'+str(i))
 else:assert a==b,(label,a,b)
def vec(v):return list(v)
assert len(a.modelspace())==len(b.modelspace())==37
for index,(original,copy) in enumerate(zip(a.modelspace(),b.modelspace())):
 name=f'{index}:{original.dxftype()}';eq(original.dxftype(),copy.dxftype(),name)
 kind=original.dxftype()
 if kind=='HATCH':
  eq(original.dxf.solid_fill,copy.dxf.solid_fill,name);eq(original.dxf.hatch_style,copy.dxf.hatch_style,name)
  eq(len(original.paths),len(copy.paths),name)
  for p,q in zip(original.paths,copy.paths):
   eq(p.path_type_flags,q.path_type_flags,name)
   if hasattr(p,'vertices'):eq(p.vertices,q.vertices,name)
   else:
    eq(len(p.edges),len(q.edges),name)
    for e,f in zip(p.edges,q.edges):
     eq(e.EDGE_TYPE,f.EDGE_TYPE,name)
     for key in ['center','radius','major_axis','ratio','ccw','start_angle','end_angle','degree','rational','periodic','knot_values','weights']:
      if hasattr(e,key):
       x,y=getattr(e,key),getattr(f,key);eq(vec(x) if hasattr(x,'x') else x,vec(y) if hasattr(y,'x') else y,name+':'+key)
     for key in ['control_points','fit_points']:
      if hasattr(e,key):eq([vec(v) for v in getattr(e,key)],[vec(v) for v in getattr(f,key)],name+':'+key)
  if original.pattern:
   for e,f in zip(original.pattern.lines,copy.pattern.lines):
    eq(e.angle,f.angle,name);eq(vec(e.base_point),vec(f.base_point),name);eq(vec(e.offset),vec(f.offset),name);eq(e.dash_length_items,f.dash_length_items,name)
  if original.gradient:
   for key in ['name','rotation','color1','color2','one_color','tint']:
    eq(getattr(original.gradient,key),getattr(copy.gradient,key),name+':'+key)
 if kind=='LWPOLYLINE':eq(list(original.get_points('xyseb')),list(copy.get_points('xyseb')),name)
 if kind=='POLYLINE':
  eq(original.dxf.flags,copy.dxf.flags,name);eq(len(original.vertices),len(copy.vertices),name)
  for e,f in zip(original.vertices,copy.vertices):
   eq(vec(e.dxf.location),vec(f.dxf.location),name)
   for key in ['vtx0','vtx1','vtx2','vtx3']:eq(e.dxf.get(key,0),f.dxf.get(key,0),name)
 if kind=='MTEXT':
  eq(original.text,copy.text,name);eq(original.get_rotation(),copy.get_rotation(),name)
  for key in ['width','char_height','attachment_point','style','color','bg_fill','bg_fill_true_color','box_fill_scale']:
   default={'style':'STANDARD','color':256,'bg_fill':0,'box_fill_scale':1.5}.get(key);eq(original.dxf.get(key,default),copy.dxf.get(key,default),name+':'+key)
 if kind=='TEXT':
  for key in ['text','height','style','halign','valign','width','rotation']:eq(original.dxf.get(key,0),copy.dxf.get(key,0),name+':'+key)
  eq(vec(original.dxf.align_point),vec(copy.dxf.align_point),name)
 if original.dxf.hasattr('transparency'):eq(original.transparency,copy.transparency,name)
 checks.append({'entity':name,'passed':True})
report={'validator':'ezdxf '+ezdxf.__version__,'entities':37,'errors':[],'repairs':[],'checks':checks,'scope':'Compared native hatch edges/patterns/gradients, text properties, meshes, wide polylines and opacity. Not an AutoCAD rendering certification.'}
(OUT/'fidelity-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
