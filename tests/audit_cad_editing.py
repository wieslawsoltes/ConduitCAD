"""Independent native dimension, DSTYLE and evaluated-block interoperability audit."""
import json, subprocess
from pathlib import Path
import ezdxf
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
subprocess.run(['node','--input-type=module','-e',r'''
import {writeFileSync} from 'node:fs';
import {createDocument,entity,line,rect,editDimension} from '@conduitcad/model';
import {writeDXF,writeDXFBinary} from '@conduitcad/dxf';
const p=(x,y)=>({x,y}),d=createDocument('Native regenerated dimensions');
const data=[
{dimtype:32,a:p(0,0),b:p(80,50),definitionPoint:p(0,70),dimensionAngle:0},
{dimtype:33,a:p(0,0),b:p(80,60),offset:30},
{dimtype:34,a:p(0,0),b:p(100,0),defpoint4:p(0,0),definitionPoint:p(0,100),defpoint5:p(20,20)},
{dimtype:35,definitionPoint:p(-40,0),defpoint4:p(40,0)},
{dimtype:36,definitionPoint:p(0,0),defpoint4:p(40,0)},
{dimtype:37,a:p(100,0),b:p(0,100),defpoint4:p(0,0),definitionPoint:p(20,20)},
{dimtype:102,a:p(80,50),b:p(80,90),definitionPoint:p(0,0)}];
for(const props of data){const e=entity('DIMENSION',props);editDimension(e,d,{style:{dimtxt:4,dimasz:2,dimdec:2}});d.entities.push(e);}
d.blocks.Variable={name:'Variable',base:p(0,0),ports:[],entities:[rect(0,0,100,20,{id:'body'})],dynamic:{version:1,parameters:[{name:'Length',type:'distance',default:100,min:1,max:500}],actions:[{type:'stretch',parameter:'Length',box:{minX:50,minY:-1,maxX:500,maxY:21},direction:p(1,0)}]}};
for(const [i,len]of [125,250].entries())d.entities.push(entity('INSERT',{block:'Variable',x:0,y:200+i*50,dynamicParameters:{Length:len}}));
for(const mode of ['ascii','binary']){writeFileSync('artifacts/editing-native-'+mode+'.dxf',mode==='binary'?writeDXFBinary(d):writeDXF(d));}
'''],cwd=ROOT,check=True)
checks=[]
def ok(name,v):
    assert v,name
    checks.append({'name':name,'passed':True})
for mode in ['ascii','binary']:
    d=ezdxf.readfile(OUT/f'editing-native-{mode}.dxf');audit=d.audit()
    ok(f'{mode}: native document has no audit errors or repairs',not audit.errors and not audit.fixes)
    dims=list(d.modelspace().query('DIMENSION'));ok(f'{mode}: seven native dimension subtypes',len(dims)==7)
    expected=[80,100,90,80,40,90,80]
    for i,e in enumerate(dims):
        ok(f'{mode}: subtype {i} type flag',e.dimtype==i)
        # Aligned subtype 1 has no required group 50; measure its native witness points.
        # ezdxf get_measurement projects subtype 1 using an absent angle=0.
        measurement=e.dxf.defpoint2.distance(e.dxf.defpoint3) if i==1 else e.get_measurement()
        measurement=measurement.x if i==6 else measurement
        ok(f'{mode}: subtype {i} independent geometric measurement',abs(measurement-expected[i])<1e-7)
        ok(f'{mode}: subtype {i} native style override',e.override()['dimtxt']==4 and e.override()['dimasz']==2 and e.override()['dimdec']==2)
        picture=d.blocks.get(e.dxf.geometry)
        ok(f'{mode}: subtype {i} editable native picture',len(picture)>0 and bool(list(picture.query('TEXT'))))
    inserts=list(d.modelspace().query('INSERT'))
    ok(f'{mode}: separate native evaluated variants',len(inserts)==2 and inserts[0].dxf.name!=inserts[1].dxf.name)
    for e,expected in zip(inserts,[125,250]):
        b=d.blocks.get(e.dxf.name);body=list(b.query('LWPOLYLINE'))[0]
        ok(f'{mode}: native variant has expected width {expected}',max(p[0] for p in body.get_points())==expected)
report={'checks':checks,'passed':len(checks),'validator':'ezdxf '+ezdxf.__version__,'nativeAutodeskDynamicEvaluator':False}
(OUT/'cad-editing-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
