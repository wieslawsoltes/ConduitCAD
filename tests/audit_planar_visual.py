"""Independently inspect real browser exports and the native visual-drafting sample."""
import json,math
from pathlib import Path
import ezdxf
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';checks=[];files=[]
def ok(name,v):
 assert v,name
 checks.append({'name':name,'passed':True})
def near(a,b):return math.isclose(a,b,rel_tol=1e-7,abs_tol=1e-6)
fixtures=['line','circle','spline','lwpolyline','hatch','text','mtext','dimension','fillet','section','measurement']
for backend in ['canvas','webgl2','webgpu']:
 for name in fixtures:
  for encoding in ['ascii','binary']:
   path=OUT/f'planar-{backend}-{name}-{encoding}.dxf'
   if not path.exists():
    if backend=='canvas':raise AssertionError('Required browser download missing: '+path.name)
    continue
   doc=ezdxf.readfile(path);msp=doc.modelspace();audit=doc.audit();prefix=path.name
   ok(prefix+' zero DXF audit errors',not audit.errors);ok(prefix+' zero implicit repairs',not audit.fixes);ok(prefix+' native database not empty',len(msp)>0)
   native={'line':'LINE','circle':'CIRCLE','spline':'SPLINE','lwpolyline':'LWPOLYLINE','hatch':'HATCH','text':'TEXT','mtext':'MTEXT','dimension':'DIMENSION','fillet':'ARC','section':'LINE','measurement':'LINE'}[name]
   entities=list(msp.query(native));ok(prefix+' retains '+native,bool(entities))
   if name=='line':
    e=entities[0];ok(prefix+' exact length 150',near((e.dxf.end-e.dxf.start).magnitude,150));ok(prefix+' exact angle 30',near(math.degrees(math.atan2(e.dxf.end.y-e.dxf.start.y,e.dxf.end.x-e.dxf.start.x)),30))
   if name=='circle':ok(prefix+' parameter-driven radius 60',near(entities[0].dxf.radius,60))
   if name=='spline':
    e=entities[0];ok(prefix+' degree/knots retained',e.dxf.degree==2 and list(e.knots)==[0,0,0,1,1,1]);ok(prefix+' native rational weights retained',list(e.weights)==[1,.8,1]);ok(prefix+' edited control Y=70',near(e.control_points[1][1],70))
   if name=='lwpolyline':ok(prefix+' bulge retained',near(entities[0].get_points('xyb')[1][2],.2));ok(prefix+' closed topology retained',entities[0].closed)
   if name=='hatch':ok(prefix+' edited polygon boundary retained',near(entities[0].paths[0].vertices[2][1],80))
   if name in ['text','mtext']:
    e=entities[0];value=e.dxf.text if name=='text' else e.text;ok(prefix+' actual user text retained','Flow label' in value);ok(prefix+' text height 16',near(e.dxf.height if name=='text' else e.dxf.char_height,16))
   if name=='mtext':ok(prefix+' native paragraph break retained','\\PSecond line' in entities[0].text)
   if name=='dimension':
    e=entities[0];ok(prefix+' native linear dimension subtype',e.dxf.dimtype&15==0);ok(prefix+' anonymous picture block resolves',e.dxf.geometry in doc.blocks);ok(prefix+' native custom text',e.dxf.text=='<> mm')
   if name=='fillet':ok(prefix+' radius 15',near(entities[0].dxf.radius,15));ok(prefix+' two native tangent lines',len(list(msp.query('LINE')))==2)
   if name=='section':ok(prefix+' WCS Z=10 cutting lines retained',any(near(e.dxf.start.z,10) and near(e.dxf.end.z,10) for e in entities));ok(prefix+' original body meshes retained',len(list(msp.query('MESH')))>0)
   if name=='measurement':
    candidates=[e for e in entities if near(e.dxf.start.x,0) and near(e.dxf.start.y,0) and near(e.dxf.start.z,0) and near(e.dxf.end.x,3) and near(e.dxf.end.y,4) and near(e.dxf.end.z,12)]
    ok(prefix+' exact native 3-4-12 world-space line',len(candidates)==1);ok(prefix+' Euclidean length 13',near((candidates[0].dxf.end-candidates[0].dxf.start).magnitude,13))
   files.append({'file':str(path.relative_to(ROOT)),'entities':len(msp),'auditErrors':0,'auditRepairs':0})
for path in sorted((ROOT/'samples/visual').glob('*.dxf')):
 doc=ezdxf.readfile(path);audit=doc.audit();ok(path.name+' example independently audits',not audit.errors and not audit.fixes);ok(path.name+' 15 native example entities',len(doc.modelspace())==15);ok(path.name+' dynamic block picture resolves',doc.modelspace().query('INSERT')[0].dxf.name in doc.blocks);files.append({'file':str(path.relative_to(ROOT)),'entities':15,'auditErrors':0,'auditRepairs':0})
report={'validator':'ezdxf '+ezdxf.__version__,'files':files,'checks':checks,'passed':len(checks),'nativeAutoCADAcceptance':False};(OUT/'planar-visual-dxf-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'files':len(files),'passed':len(checks),'auditErrors':0,'auditRepairs':0}))
