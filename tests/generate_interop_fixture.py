"""Independent fixture author. All geometry is original; no application writer is used."""
from pathlib import Path
import ezdxf
ROOT=Path(__file__).resolve().parents[1]
doc=ezdxf.new('R2010');doc.units=4
m=doc.modelspace();doc.layers.new('Frozen',dxfattribs={'color':1})
doc.styles.new('UnicodeStyle',dxfattribs={'font':'sans-serif.ttf'})
m.add_line((-100,0,3),(100,0,7),dxfattribs={'color':5})
m.add_circle((0,0),30,dxfattribs={'layer':'Frozen'})
m.add_text('Zażółć ΔP 温度 😀',dxfattribs={'insert':(0,60),'height':8,'style':'UnicodeStyle'})
mt=m.add_mtext('Αβ 日本語 😀 '*50,dxfattribs={'insert':(0,90),'char_height':3,'width':100})
# All seven documented DIMENSION subtypes, each with a real anonymous picture.
for index,dim in enumerate([m.add_linear_dim(base=(0,20),p1=(0,0),p2=(40,0),angle=0),
            m.add_aligned_dim(p1=(50,0),p2=(90,15),distance=20),
            m.add_angular_dim_2l(base=(20,40),line1=((0,0),(40,0)),line2=((0,0),(30,30))),
            m.add_diameter_dim(center=(150,0),radius=20,angle=0),
            m.add_radius_dim(center=(200,0),radius=20,angle=30),
            m.add_angular_dim_3p(base=(240,30),center=(230,0),p1=(260,0),p2=(230,30)),
            m.add_ordinate_dim(feature_location=(30,80),offset=(0,20),dtype=1,origin=(0,0))]):
    dim.render()
    if index==1:dim.dimension.dxf.dimtype=33
mesh=m.add_mesh()
with mesh.edit_data() as data:
    data.vertices=[(0,-80,0),(30,-80,0),(30,-50,0),(0,-50,0),(15,-65,25)]
    data.faces=[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)]
    data.edges=[(0,1),(1,2)];data.edge_crease_values=[0,1]
m.add_helix(radius=12,pitch=7,turns=3).translate(80,-70,0)
m.add_wipeout([(115,-85),(145,-85),(145,-55),(125,-60)])
# Extended and arbitrary objects remain source data; not a fabricated native model.
x=doc.rootdict.add_xrecord('ACME_DATA');x.reset([(1,'opaque application data'),(160,9223372036854775807),(310,b'\x00\xff\x80')])
ext=m.add_line((300,0),(350,10));extension=ext.new_extension_dict();record=extension.add_xrecord('ACME_FEATURE');record.reset([(1,'linked custom semantics'),(330,ext.dxf.handle)])
for name,twist in [('Sheet A',0),('Sheet B',30)]:
    p=doc.layouts.new(name);p.page_setup(size=(210,148),margins=(5,5,5,5))
    p.add_text(name,dxfattribs={'insert':(10,130),'height':5})
    vp=p.add_viewport(center=(100,65),size=(130,100),view_center_point=(20,0),view_height=180,dxfattribs={'view_twist_angle':twist,'view_target_point':(15,5,0)})
    vp.freeze('Frozen')
    if name=='Sheet B':
        clip=p.add_lwpolyline([(50,20),(150,20),(110,100),(70,100)],close=True)
        vp.dxf.clipping_boundary_handle=clip.dxf.handle
        vp.dxf.flags=vp.dxf.flags|65536
path=ROOT/'tests/fixtures/interop.dxf';doc.saveas(path)
print(path,len(list(m)),doc.layouts.names())
