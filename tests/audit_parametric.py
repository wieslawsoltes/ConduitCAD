"""Independent ezdxf checks for shared edits, attributes and constrained block variants."""
import json, subprocess
from pathlib import Path
import ezdxf
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
subprocess.run(['node','--input-type=module','-e',r'''
import {writeFileSync} from 'node:fs';
import {createDocument,entity,line,editDimension,createBlockDefinition,beginBlockEdit,editedBlockDefinition,updateBlockDefinition,syncInsertAttributes,setDynamicParameters} from '@conduitcad/model';
import {writeDXF,writeDXFBinary} from '@conduitcad/dxf';
const p=(x,y)=>({x,y}),d=createDocument('Shared and constrained native blocks');
createBlockDefinition(d,'Shared',{entities:[line(p(0,0),p(80,0),{id:'edge'}),entity('ATTDEF',{id:'part',attributeTag:'PART_NO',text:'DEFAULT',p:p(20,10),height:4,prompt:'Part number',attributeFlags:8})],ports:[{name:'out',x:80,y:0,dx:1,dy:0,anchor:{entityId:'edge',point:'b'}}]});
createBlockDefinition(d,'Wrapper',{entities:[entity('INSERT',{block:'Shared',x:5,y:6,sx:1,sy:1})]});
for(const [block,x]of [['Shared',10],['Shared',210],['Wrapper',410]]){const e=entity('INSERT',{block,x,y:20,sx:1,sy:1});syncInsertAttributes(e,d);d.entities.push(e);}
d.entities[0].attributes[0].text='SOURCE-CUSTOM';
const session=beginBlockEdit(d,'Shared');session.draft.entities[0].b.x=150;session.draft.entities.push(entity('ATTDEF',{attributeTag:'FIXED_LABEL',constant:true,attributeFlags:2,text:'CONSTANT',p:p(10,30),height:4}));updateBlockDefinition(d,'Shared',editedBlockDefinition(session));
const edge=line(p(0,0),p(100,0),{id:'driven'}),dim=entity('DIMENSION',{id:'dim',dimtype:33,a:p(0,0),b:p(100,0),offset:25});editDimension(dim,d);dim.dimension.references={a:{entityId:'driven',point:'a'},b:{entityId:'driven',point:'b'}};
createBlockDefinition(d,'Constrained',{entities:[edge,dim,entity('TEXT',{id:'label',p:p(0,-20),height:5,text:'',calculation:{expression:'Width',precision:0,prefix:'Span='}}),entity('ATTDEF',{id:'calc-attribute',attributeTag:'CALCULATED',p:p(25,10),height:4,text:'',calculation:{expression:'Width*2',precision:0}})],dynamic:{version:2,parameters:[{name:'Width',type:'distance',default:100,min:10,max:500},{name:'HalfWidth',type:'distance',default:50,expression:'Width/2'}],actions:[{type:'move',parameter:'Width',entities:['calc-attribute'],direction:p(1,0)}],constraints:[{type:'fixed-point',entityId:'driven',pointA:'a',target:p(0,0)},{type:'horizontal',entityId:'driven'},{type:'length',entityId:'driven',name:'spanMeasured',value:'Width'}]}});
const e=entity('INSERT',{block:'Constrained',x:10,y:200,sx:1,sy:1});setDynamicParameters(e,d,{Width:180});d.entities.push(e);
for(const encoding of ['ascii','binary'])for(const metadata of [true,false]){
 const options={includeMetadata:metadata},name=`artifacts/parametric-native-${encoding}-${metadata?'editable':'baked'}.dxf`;
 writeFileSync(name,encoding==='binary'?writeDXFBinary(d,options):writeDXF(d,options));
}
'''],cwd=ROOT,check=True)
checks=[]
def check(name,value):
    assert value,name
    checks.append({'name':name,'passed':True})
for encoding in ['ascii','binary']:
  for mode in ['editable','baked']:
    prefix=f'{encoding}/{mode}'
    d=ezdxf.readfile(OUT/f'parametric-native-{encoding}-{mode}.dxf');audit=d.audit()
    check(prefix+': zero native audit errors and repairs',not audit.errors and not audit.fixes)
    shared=d.blocks.get('Shared');edge=list(shared.query('LINE'))[0]
    check(prefix+': shared definition edit preserves native endpoint',abs(edge.dxf.end.x-150)<1e-7)
    roots=list(d.modelspace().query('INSERT'));uses=[e for e in roots if e.dxf.name=='Shared']
    check(prefix+': shared references are not exploded',len(uses)==2)
    check(prefix+': per-instance user values survive synchronization',uses[0].get_attrib_text('PART_NO')=='SOURCE-CUSTOM' and uses[1].get_attrib_text('PART_NO')=='DEFAULT')
    check(prefix+': native ATTDEF tag and prompt retained',shared.get_attdef('PART_NO').dxf.prompt=='Part number')
    check(prefix+': preset flag retained',shared.get_attdef('PART_NO').dxf.flags&8==8)
    check(prefix+': constant attribute remains native and uninstantiated',shared.get_attdef('FIXED_LABEL').is_const and all(e.get_attrib('FIXED_LABEL') is None for e in uses))
    check(prefix+': nested inserts remain shared native references',list(d.blocks.get('Wrapper').query('INSERT'))[0].dxf.name=='Shared')
    insert=next(e for e in roots if e.dxf.insert.y==200);block=d.blocks.get(insert.dxf.name)
    check(prefix+': parameterized instance uses an evaluated anonymous block',insert.dxf.name.startswith('*U'))
    check(prefix+': independent solved native line measurement',abs(list(block.query('LINE'))[0].dxf.end.x-180)<1e-5)
    dimension=list(block.query('DIMENSION'))[0]
    check(prefix+': native dimension witnesses follow the solved sketch',abs(dimension.dxf.defpoint3.distance(dimension.dxf.defpoint2)-180)<1e-5)
    check(prefix+': dimension retains a native picture',len(d.blocks.get(dimension.dxf.geometry))>0)
    check(prefix+': calculated annotation is portable native text',any(t.dxf.text=='Span=180' for t in block.query('TEXT')))
    attribute=insert.get_attrib('CALCULATED')
    check(prefix+': calculated attribute text is regenerated',attribute.dxf.text=='360')
    check(prefix+': dynamic action moves native attribute position',abs(attribute.dxf.insert.x-115)<1e-7 and abs(attribute.dxf.insert.y-210)<1e-7)
(OUT/'parametric-native-audit.json').write_text(json.dumps({'checks':checks,'passed':len(checks),'validator':'ezdxf '+ezdxf.__version__,'files':4,'errors':0,'repairs':0,'scope':'Independent readback of Conduit-authored native fields; not an Autodesk action-graph evaluation'},indent=2))
print(json.dumps({'passed':len(checks),'files':4,'errors':0,'repairs':0},indent=2))
