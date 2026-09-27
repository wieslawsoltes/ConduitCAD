"""Independently open the actual browser downloads and measure native MESH geometry.
No application parser/modeling package is used by this audit.
"""
import json, math
from pathlib import Path
import ezdxf
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';checks=[];files=[]
def check(name,value):
 assert value,name
 checks.append({'name':name,'passed':True})
def volume(mesh):
 points=np.asarray(mesh.vertices,dtype=float);base=points.mean(axis=0);points=points-base
 return abs(sum(float(np.dot(points[f[0]],np.cross(points[f[j]],points[f[j+1]])))/6 for f in mesh.faces for j in range(1,len(f)-1)))
for backend in ['canvas','webgl2','webgpu']:
 for case in ['counterbore','transform','extrusion']:
  for fmt in ['ascii','binary']:
   path=OUT/f'visual3d-{backend}-{case}-{fmt}.dxf'
   if not path.exists():continue
   label=path.name;doc=ezdxf.readfile(path);audit=doc.audit();space=doc.modelspace();meshes=list(space.query('MESH'));result=meshes[-1]
   check(label+' errors',not audit.errors);check(label+' repairs',not audit.fixes)
   check(label+' native meshes',len(meshes)==(1 if case=='extrusion' else 2))
   check(label+' no fabricated ACIS solid',len(space.query('3DSOLID'))==0)
   verts=np.asarray(result.vertices,dtype=float);check(label+' finite coordinates',bool(np.isfinite(verts).all()))
   v=volume(result)
   if case=='counterbore':expected=100*80*40-12*math.sin(math.tau/24)*(25*12+(81-25)*4)
   elif case=='transform':expected=100*80*40*1.2
   else:expected=70*50*(50+15)
   check(label+' measured volume',math.isclose(v,expected,rel_tol=1e-7,abs_tol=1e-6))
   if case=='extrusion':
    check(label+' lower extent',math.isclose(float(verts[:,2].min()),-15,abs_tol=1e-7));check(label+' upper extent',math.isclose(float(verts[:,2].max()),50,abs_tol=1e-7));check(label+' native source profile',len(space.query('LWPOLYLINE'))==1)
   if case=='transform':
    check(label+' transformed minimum',bool(np.allclose(verts.min(axis=0),[25,-20,0],atol=1e-7)));check(label+' transformed maximum',bool(np.allclose(verts.max(axis=0),[105,100,40],atol=1e-7)))
   files.append({'file':label,'volume':v,'vertices':len(verts),'faces':len(result.faces)})
check('Canvas download inventory complete',len([r for r in files if r['file'].startswith('visual3d-canvas')])==6)
report={'passed':len(checks),'checks':checks,'files':files,'reader':'ezdxf '+ezdxf.__version__,'scope':'Actual native browser downloads; no native Autodesk acceptance'}
(OUT/'visual3d-dxf-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'files':len(files),'passed':len(checks)}))
