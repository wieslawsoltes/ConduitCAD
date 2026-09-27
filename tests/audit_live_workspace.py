"""Independent ezdxf audit of sample files and actual browser path/parameter exports."""
import json,pathlib,math
import ezdxf
ROOT=pathlib.Path(__file__).resolve().parents[1]
files=sorted((ROOT/'samples/live').glob('*.dxf'))+sorted((ROOT/'artifacts').glob('live-*-*-ascii.dxf'))+sorted((ROOT/'artifacts').glob('live-*-*-binary.dxf'))
assert len(files)>=6,'Generate the sample and execute the live browser suite before auditing.'
checks=[]
for file in files:
 doc=ezdxf.readfile(file);audit=doc.audit()
 assert not audit.errors and not audit.fixes,(file,audit.errors,audit.fixes)
 checks.append({'file':str(file.relative_to(ROOT)),'entities':len(doc.modelspace()),'auditErrors':0,'auditFixes':0})
 if 'parameters-' in file.name:
  circles=list(doc.modelspace().query('CIRCLE'));assert len(circles)==1 and abs(circles[0].dxf.radius-40)<1e-6
 else:
  paths=list(doc.modelspace().query('POLYLINE'));assert len(paths)==1
  path=paths[0];assert path.is_3d_polyline and len(path.vertices)==4
  assert all(math.isfinite(x) for v in path.vertices for x in v.dxf.location)
  assert path.has_xdata('CONDUITCAD')
  if 'workshop' in file.name:assert len(list(doc.modelspace().query('MESH')))==2 and not path.is_closed
  else:assert path.is_closed and abs(path.vertices[-1].dxf.location.z-45)<1e-6
report={'validator':'ezdxf '+ezdxf.__version__,'files':len(checks),'records':checks}
(ROOT/'artifacts/audit-live-workspace.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
