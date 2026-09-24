"""Rebuild the original independent ezdxf fixture. Tests consume the checked-in files."""
from pathlib import Path
import json, math
import ezdxf
from ezdxf.enums import TextEntityAlignment
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'tests/fixtures';OUT.mkdir(exist_ok=True)
d=ezdxf.new('R2010');m=d.modelspace();d.header['$LTSCALE']=2.5
entries=[]
def item(name,e,**extra): entries.append(dict(name=name,handle=e.dxf.handle,type=e.dxftype(),**extra));return e
def poly(x,y,w,h):return [(x,y),(x+w,y),(x+w,y+h),(x,y+h)]
for style in range(3):
 h=item('islands-'+str(style),m.add_hatch(color=1));h.dxf.hatch_style=style
 for i,p in enumerate([poly(style*130,0,100,100),poly(style*130+20,20,60,60),poly(style*130+35,35,30,30)]):h.paths.add_polyline_path(p,is_closed=True,flags=1 if i==0 else 0)
h=item('pattern',m.add_hatch(color=3));h.set_pattern_fill('USER',style=0,definition=[(30,(0,0),(-5,8.660254037844387),[10,-5,0,-5])]);h.paths.add_polyline_path(poly(0,150,130,100),is_closed=True);h.paths.add_polyline_path(poly(35,175,60,50),is_closed=True,flags=0)
for clockwise in [False,True]:
 h=item('arc-'+str(clockwise),m.add_hatch(color=4));e=h.paths.add_edge_path()
 a=e.add_arc((180 if not clockwise else 320,190),40,25,150,ccw=not clockwise)
 e.add_line(a.real_end_point,a.real_start_point);entries[-1].update(start=list(a.real_start_point),end=list(a.real_end_point))
for clockwise in [False,True]:
 h=item('ellipse-'+str(clockwise),m.add_hatch(color=5));e=h.paths.add_edge_path()
 a=e.add_ellipse((60 if not clockwise else 230,310),(55,12),.45,20,200,ccw=not clockwise)
 e.add_line(a.real_end_point,a.real_start_point);entries[-1].update(start=list(a.real_start_point),end=list(a.real_end_point))
h=item('spline',m.add_hatch(color=6));edge=h.paths.add_edge_path();edge.add_spline(control_points=[(340,280),(370,360),(400,280)],knot_values=[0,0,0,1,1,1],weights=[1,.5,1],degree=2);edge.add_line((400,280),(340,280))
h=item('gradient',m.add_hatch());h.set_gradient(color1=(200,10,20),color2=(10,20,200),rotation=35);h.paths.add_polyline_path(poly(440,0,90,90),is_closed=True)
item('wide-polyline',m.add_lwpolyline([(0,420,4,18,.7),(100,420,0,0,0)],format='xyseb'))
item('poly3d',m.add_polyline3d([(160,410,3),(200,450,7),(250,410,12)],close=True))
f=item('polyface',m.add_polyface());f.append_faces([[(280,410,0),(325,410,8),(325,455,16),(280,455,8)]])
mesh=item('polygon-mesh',m.add_polymesh((2,3)))
for i in range(2):
 for j in range(3):mesh.set_mesh_vertex((i,j),(360+40*i,400+25*j,2*i+j))
item('face-hidden-edge',m.add_3dface([(450,410,3),(500,410,4),(500,455,5),(450,455,6)],dxfattribs={'invisible_edges':2}))
item('negative-ocs-circle',m.add_circle((30,520,8),20,dxfattribs={'extrusion':(0,0,-1)}))
item('oblique-ocs-circle',m.add_circle((55,0,12),20,dxfattribs={'extrusion':(.3,.4,.8660254037844386)}))
item('negative-ocs-ellipse',m.add_ellipse((100,530,3),major_axis=(30,0,0),ratio=.4,start_param=0,end_param=math.pi,dxfattribs={'extrusion':(0,0,-1)}))
d.styles.new('FIDELITY',dxfattribs={'font':'DejaVuSans.ttf','width':.8,'oblique':12})
for attachment in range(1,10):
 item('mtext-'+str(attachment),m.add_mtext(r'{\C1;CONTROL} \H1.3x;VALVE\P100 % OPEN',dxfattribs={'insert':(550+((attachment-1)%3)*160,40+((attachment-1)//3)*100),'char_height':10,'width':120,'attachment_point':attachment,'style':'FIDELITY','rotation':15}))
mt=item('mtext-mask',m.add_mtext('BACKGROUND',dxfattribs={'insert':(600,380),'char_height':14,'width':150,'color':3}));mt.set_bg_color((235,210,155),scale=1.2)
for name,alignment in [('middle-center',TextEntityAlignment.MIDDLE_CENTER),('baseline-right',TextEntityAlignment.RIGHT),('aligned',TextEntityAlignment.ALIGNED),('fit',TextEntityAlignment.FIT)]:
 t=item('text-'+name,m.add_text('ΔP 25 bar',dxfattribs={'height':12,'style':'FIDELITY','width':.8,'rotation':20}));t.set_placement((600,500+len(entries)*3),(800,500+len(entries)*3),align=alignment)
d.linetypes.new('LEADING_DOTS',dxfattribs={'pattern':[16,-3,0,-3,5,-5]})
item('signed-dashes',m.add_line((440,200),(520,200),dxfattribs={'linetype':'LEADING_DOTS','ltscale':2,'lineweight':50}))
e=item('transparency',m.add_line((440,225),(520,225),dxfattribs={'color':2}));e.transparency=.4
item('leader',m.add_leader([(450,270,0),(480,305,0),(520,305,0)]))
item('ray',m.add_ray((0,-70,0),(1,.2,0)))
item('xline',m.add_xline((0,-100,0),(1,0,0)))
assert not d.audit().has_errors
d.saveas(OUT/'fidelity.dxf');(OUT/'fidelity.json').write_text(json.dumps(entries,indent=2))
print('Generated',len(entries),'independent entities.')
