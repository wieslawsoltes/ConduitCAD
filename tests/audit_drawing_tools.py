"""Independent ezdxf verification of native records made by the drawing factories."""
import json, math, subprocess
from pathlib import Path
import ezdxf
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
subprocess.run(['node','scripts/drawing-tool-samples.mjs'],cwd=ROOT,check=True)
expected=json.loads((OUT/'drawing-tools-expected.json').read_text());checks=[]
def check(name,value):
    assert value,name
    checks.append({'name':name,'passed':True})
def near(a,b):return abs(a-b)<1e-7
def xy(v,p):return near(v[0],p['x']) and near(v[1],p['y'])
for encoding in ['ascii','binary']:
    d=ezdxf.readfile(OUT/f'drawing-tools-{encoding}.dxf');audit=d.audit();roots=list(d.modelspace())
    check(encoding+': zero audit errors or repairs',not audit.errors and not audit.fixes)
    check(encoding+': one native record per tool plus curved hatch',len(roots)==29)
    for native,spec in zip(roots,expected):
        e=spec['entity'];prefix=encoding+'/'+spec['id']
        check(prefix+': native entity type',native.dxftype()==e['type'])
        if e['type'] in ['ARC','CIRCLE']:
            check(prefix+': native center and radius',xy(native.dxf.center,e['c']) and near(native.dxf.radius,e['r']))
            if e['type']=='ARC':
                start,end=(e['end'],e['start']) if e.get('clockwise') else (e['start'],e['end'])
                check(prefix+': CCW DXF angles preserve requested sweep',near(native.dxf.start_angle,start*180/math.pi) and near(native.dxf.end_angle,end*180/math.pi))
        elif e['type']=='ELLIPSE':
            check(prefix+': major vector, ratio and parameter interval',xy(native.dxf.major_axis,e['major']) and near(native.dxf.ratio,e['ratio']) and near(native.dxf.start_param,e['start']) and near(native.dxf.end_param,e['end']))
        elif e['type']=='SPLINE':
            check(prefix+': native controls and knots',native.dxf.degree==3 and len(native.knots)==len(e['knots']) and all(near(a,b) for a,b in zip(native.knots,e['knots'])) and all(xy(v,p) for v,p in zip(native.control_points,e['controlPoints'])))
            check(prefix+': sampled NURBS endpoints',xy(native.construction_tool().point(0),e['controlPoints'][0]) and xy(native.construction_tool().point(e['knots'][-1]),e['controlPoints'][-1]))
        elif e['type']=='LWPOLYLINE':
            pts=list(native.get_points('xyb'));check(prefix+': native polyline closure and bulges',native.closed and len(pts)==len(e['points']) and all(xy(v,p) and near(v[2],p.get('bulge',0)) for v,p in zip(pts,e['points'])))
            if spec['id']=='donut':check(prefix+': donut retains native stroke width',near(native.dxf.const_width,20))
        elif e['type'] in ['SOLID','3DFACE']:
            # SOLID's storage order swaps the third and fourth corner; 3DFACE does not.
            order=[0,1,3,2] if e['type']=='SOLID' else [0,1,2,3]
            check(prefix+': native vertex ordering',all(xy(getattr(native.dxf,'vtx'+str(i)),e['points'][j]) for i,j in enumerate(order)))
        elif e['type']=='HATCH':
            check(prefix+': user-defined hatch pattern and boundary',not native.dxf.solid_fill and len(native.pattern.lines)==2 and len(native.paths)==1)
            check(prefix+': pattern line angles and spacing',near(native.pattern.lines[0].angle,30) and near(math.hypot(*native.pattern.lines[0].offset),10))
        elif e['type']=='WIPEOUT':
            verts=list(native.boundary_path_wcs());check(prefix+': normalized mask maps back to drawing polygon',len(verts)==5 and all(xy(v,p) for v,p in zip(verts,[{'x':0,'y':0},{'x':80,'y':0},{'x':60,'y':50},{'x':0,'y':40},{'x':0,'y':0}])) )
        elif e['type'] in ['RAY','XLINE']:
            check(prefix+': native origin and unit direction',xy(native.dxf.start,e['p']) and near(native.dxf.unit_vector.magnitude,1))
        elif e['type']=='POINT':check(prefix+': native point coordinates',xy(native.dxf.location,e['p']))
        elif e['type']=='MTEXT':check(prefix+': multiline text and native width',native.text==r'Native MTEXT\PSecond line' and near(native.dxf.width,100) and native.dxf.attachment_point==1)
        elif e['type']=='LEADER':check(prefix+': vertices and arrow',len(native.vertices)==3 and native.dxf.has_arrowhead==1 and all(xy(v,p) for v,p in zip(native.vertices,e['points'])))
        elif e['type']=='DIMENSION':
            check(prefix+': native dimension subtype and picture',native.dxf.dimtype==e['dimtype'] and len(d.blocks[native.dxf.geometry])>0)
            expected_measure={'dim-aligned':math.hypot(100,50),'dim-horizontal':100,'dim-vertical':50,'dim-radius':40,'dim-diameter':80,'dim-angular':90,'dim-angular-lines':90,'dim-ordinate-x':40,'dim-ordinate-y':50}[spec['id']]
            actual=native.dxf.actual_measurement
            # DXF actual_measurement is in degrees for the writer's angular contract.
            check(prefix+': regenerated measurement',near(actual,expected_measure))
    h=roots[-1]
    check(encoding+': native circle and ellipse hatch edges retained',len(h.paths)==2 and h.paths[0].edges[0].EDGE_TYPE=='ArcEdge' and h.paths[1].edges[0].EDGE_TYPE=='EllipseEdge')
report={'checks':checks,'passed':len(checks),'files':2,'validator':'ezdxf '+ezdxf.__version__,'errors':0,'repairs':0,'scope':'Independent native field and geometry readback; not a vendor conformance certification'}
(OUT/'drawing-tools-native-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='checks'},indent=2))
