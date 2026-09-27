import { createDocument, entity, line, circle, polyline, text, editDimension, regenerateDimensions } from '@conduitcad/model';
/** Native, offline example shared by the workbench and DXF sample generator. */
export function createVisualDraftingExample() {
    const doc=createDocument('Visual drafting workshop');doc.parameters={Width:'120',Height:'60',Radius:'22',BarLength:'80'};
    const p=(x,y)=>({x,y}),label=(id,x,y,value)=>text(p(x,y),value,6,{id,layer:'Annotations'});
    const rectangle=polyline([p(0,0),p(120,0),p(120,60),p(0,60)],true,{id:'plate',layer:'Equipment',parametric:{kind:'rectangle',width:'Width',height:'Height'}});
    const round=circle(p(60,30),22,{id:'hole-profile',layer:'Process',parametric:{radius:'Radius'}});
    const edge=line(p(0,105),p(120,105),{id:'driven-edge',layer:'Process'});
    const dim=entity('DIMENSION',{id:'associated-length',dimtype:33,a:p(0,105),b:p(120,105),offset:20,layer:'Annotations',dimension:{version:1,references:{a:{entityId:edge.id,point:'a'},b:{entityId:edge.id,point:'b'}}}});
    editDimension(dim,doc,{style:{dimtxt:5,dimasz:3,dimgap:2}});
    doc.constraints=[{id:'edge-length',type:'length',entityId:edge.id,value:'Width'}];
    doc.blocks.AdjustableBar={name:'AdjustableBar',base:p(0,0),ports:[],entities:[line(p(0,0),p(80,0),{id:'bar-edge',layer:'0'}),line(p(0,-6),p(0,6),{id:'bar-start',layer:'0'}),line(p(80,-6),p(80,6),{id:'bar-end',layer:'0'})],dynamic:{version:1,parameters:[{name:'Length',type:'distance',default:80,min:10,max:300,grip:{base:p(0,0),direction:p(1,0)}}],actions:[{type:'stretch',parameter:'Length',entities:['bar-edge','bar-end'],direction:p(1,0),box:{minX:79,minY:-10,maxX:81,maxY:10}}]}};
    doc.entities=[rectangle,round,edge,dim,
        entity('INSERT',{id:'adjustable-bar',block:'AdjustableBar',x:175,y:105,rotation:15,sx:1,sy:1,layer:'Equipment'}),
        entity('ARC',{id:'arc',c:p(200,30),r:28,start:0,end:Math.PI*1.5,layer:'Process'}),
        entity('ELLIPSE',{id:'ellipse',c:p(285,30),major:p(36,12),ratio:.5,start:0,end:Math.PI*2,layer:'Process'}),
        entity('SPLINE',{id:'spline',degree:3,controlPoints:[p(170,-60),p(190,-15),p(240,-100),p(290,-45)],knots:[0,0,0,0,1,1,1,1],weights:[1,1,1,1],layer:'Equipment'}),
        entity('MTEXT',{id:'multiline',p:p(0,-32),text:'Tap text to edit\\PNative MTEXT · no modal',height:6,mtextWidth:130,attachment:1,layer:'Annotations'}),
        label('title',0,165,'EDIT ON CANVAS · choose an entity, drag, type, Apply'),
        label('plate-label',0,76,'Rectangle + circle / persistent dimensions'),
        label('driver-label',0,143,'Driven length + associated dimension'),
        label('bar-label',175,143,'Dynamic block / native parameter grip'),
        label('curves-label',172,76,'Native arc / ellipse'),
        label('spline-label',170,-90,'Weighted spline controls')];
    doc.metadata={...doc.metadata,visualEditing:{version:1,description:'A native 2D editing workshop; select an object then Edit on canvas. Includes shared blocks and managed dimensions.'}};
    regenerateDimensions(doc);return doc;
}
