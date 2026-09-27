/** One explicitly aligned frame contract is shared by WebGL2/std140 and WGSL. */
export const FRAME_FLOATS = 116;
export const WGSL = `
struct Frame {
 matrix:mat4x4<f32>, shadowMatrix:mat4x4<f32>, section:vec4<f32>, eye:vec4<f32>, light:vec4<f32>,
 background:vec4<f32>, backgroundTop:vec4<f32>, edge:vec4<f32>, hidden:vec4<f32>,
 mode:vec4<f32>, lines:vec4<f32>, switches:vec4<f32>, shading:vec4<f32>, viewport:vec4<f32>, camera:vec4<f32>,
 right:vec4<f32>, up:vec4<f32>, back:vec4<f32>, ao:vec4<f32>, effects:vec4<f32>, ground:vec4<f32>, material:vec4<f32>, cap:vec4<f32>
};
@group(0) @binding(0) var<uniform> f:Frame;
@group(1) @binding(0) var normalDepth:texture_2d<f32>;
@group(1) @binding(1) var shadowDepth:texture_depth_2d;
@group(1) @binding(2) var opaqueImage:texture_2d<f32>;
@group(1) @binding(3) var accumulation:texture_2d<f32>;
@group(1) @binding(4) var revealage:texture_2d<f32>;
struct Surface {
 @builtin(position) position:vec4<f32>, @location(0) world:vec3<f32>, @location(1) normal:vec3<f32>,
 @location(2) flatNormal:vec3<f32>, @location(3) color:vec3<f32>, @location(4) material:vec4<f32>, @location(5) flags:f32
};
fn clipPosition(p:vec3<f32>)->vec4<f32>{let q=f.matrix*vec4<f32>(p,1);return vec4<f32>(q.xy,(q.z+q.w)*.5,q.w);}
@vertex fn surfaceVertex(@location(0) p:vec3<f32>,@location(1) n:vec3<f32>,@location(2) flat:vec3<f32>,@location(3) color:vec3<f32>,@location(4) material:vec4<f32>,@location(5) flags:f32)->Surface{
 var o:Surface;o.position=clipPosition(p);o.world=p;o.normal=n;o.flatNormal=flat;o.color=color;o.material=material;o.flags=flags;return o;
}
@vertex fn shadowVertex(@location(0) p:vec3<f32>,@location(1) n:vec3<f32>,@location(2) flat:vec3<f32>,@location(3) color:vec3<f32>,@location(4) material:vec4<f32>,@location(5) flags:f32)->Surface{
 var o:Surface;let q=f.shadowMatrix*vec4<f32>(p,1);o.position=vec4<f32>(q.xy,(q.z+q.w)*.5,q.w);o.world=p;o.normal=n;o.flatNormal=flat;o.color=color;o.material=material;o.flags=flags;return o;
}
fn rejected(s:Surface)->bool{return (s.flags>1.5 && f.switches.y<.5)||(s.flags<1.5 && dot(s.world,f.section.xyz)>f.section.w+f.camera.w*1e-6)||s.material.z<.001;}
fn alpha(s:Surface)->f32{if(s.flags>.5 || f.mode.x<.5){return 1;}return min(s.material.z,f.lines.x);}
fn bg(p:vec2<f32>)->vec3<f32>{return mix(f.background.rgb,mix(f.backgroundTop.rgb,f.background.rgb,clamp(p.y/f.viewport.y,0,1)),f.background.w);}
fn normal(s:Surface)->vec3<f32>{var n=normalize(select(s.flatNormal,s.normal,f.shading.z>.5));let v=select(f.back.xyz,normalize(f.eye.xyz-s.world),f.camera.z>.5);if(f.mode.x<5.5&&dot(n,v)<0){n=-n;}return n;}
fn shadow(p:vec3<f32>,n:vec3<f32>)->f32{
 if(f.switches.z<.5){return 1;}let q=f.shadowMatrix*vec4<f32>(p,1);let ndc=q.xyz/q.w;let uv=vec2<f32>(ndc.x*.5+.5,.5-ndc.y*.5);let z=ndc.z*.5+.5;
 if(any(uv<vec2<f32>(0))||any(uv>vec2<f32>(1))||z<=0||z>=1){return 1;}
 let dim=vec2<i32>(textureDimensions(shadowDepth));let px=vec2<i32>(uv*vec2<f32>(dim));var sum=0.;let bias=.0004+.0008*(1-abs(dot(n,f.light.xyz)));
 for(var y=-1;y<=1;y++){for(var x=-1;x<=1;x++){let d=textureLoad(shadowDepth,clamp(px+vec2<i32>(x,y),vec2<i32>(0),dim-vec2<i32>(1)),0);sum+=select(1.,0.,z-bias>d);}}
 return .25+.75*sum/9.;
}
fn ambient(s:Surface,n:vec3<f32>)->f32{
 if(f.switches.w<.5 || f.mode.x<.5){return 1;}let depth=dot(f.eye.xyz-s.world,f.back.xyz);let radius=f.ao.x;let pixels=clamp(radius*f.viewport.y/select(f.camera.w,max(.00001,depth*.82842712),f.camera.z>.5),2.,80.);var sum=0.;
 for(var i=0;i<12;i++) {let a=f32(i)*2.39996323;let d=sqrt((f32(i)+.5)/12.);let xy=clamp(vec2<i32>(s.position.xy+vec2<f32>(cos(a),sin(a))*pixels*d),vec2<i32>(0),vec2<i32>(f.viewport.xy)-vec2<i32>(1));let sample=textureLoad(normalDepth,xy,0);if(sample.w<=0){continue;}
 let z=sample.w*f.camera.w;let halfExtent=select(f.camera.w*.5,z*.41421356,f.camera.z>.5);let uv=(vec2<f32>(xy)+vec2<f32>(.5))/f.viewport.xy;let p=f.eye.xyz+f.right.xyz*((uv.x*2-1)*halfExtent*f.viewport.x/f.viewport.y)+f.up.xyz*((1-uv.y*2)*halfExtent)-f.back.xyz*z;let delta=p-s.world;let len=length(delta);if(len>radius*.015&&len<radius){sum+=max(0.,dot(n,delta)/len-.05)*(1-len/radius);}}
 return clamp(1-f.ao.y*sum*.33,.12,1.);
}
fn env(n:vec3<f32>,rough:f32)->vec3<f32>{
 var sky=vec3<f32>(.66,.76,.92);var floor=vec3<f32>(.16,.18,.22);
 if(f.shading.y>.5&&f.shading.y<1.5){sky=vec3<f32>(.85,.87,.9);floor=vec3<f32>(.3,.32,.35);}
 if(f.shading.y>1.5&&f.shading.y<2.5){sky=vec3<f32>(.44,.66,1);floor=vec3<f32>(.24,.21,.17);}
 if(f.shading.y>2.5){sky=vec3<f32>(.25,.29,.4);floor=vec3<f32>(.04,.045,.065);}
 let panel=pow(max(0.,dot(n,f.light.xyz)),2+100*(1-rough)*(1-rough))*(1-rough)*3;return mix(floor,sky,clamp(n.z*.5+.5,0,1))+vec3<f32>(panel);
}
fn shade(s:Surface)->vec3<f32>{
 let n=normal(s);let l=f.light.xyz;let nl=max(0.,dot(n,l));let ao=ambient(s,n);let sh=shadow(s.world,n);var base=s.color;var result=base;
 if(s.flags>1.5){base=f.ground.rgb;return clamp(base*(.45*ao+.55*nl*sh)*exp2(f.shading.x),vec3<f32>(0),vec3<f32>(1));}
 if(s.flags>.5){let hatch=fract(dot(s.world,vec3<f32>(1,.71,.43))/max(.00001,f.ao.w));return f.cap.rgb*select(1.,.65,f.cap.w>.5&&hatch<.12);}
 if(f.mode.x<.5){return bg(s.position.xy);}
 if(f.mode.x>5.5){return n*.5+vec3<f32>(.5);}
 if(f.mode.x>2.5&&f.mode.x<3.5){let t=dot(n,l)*.5+.5;result=mix(vec3<f32>(.04,.2,.44)+base*.25,vec3<f32>(.78,.58,.2)+base*.35,t)*(.7+.3*sh)*ao;}
 else if(f.mode.x>1.5&&f.mode.x<2.5){
 let b=pow(base,vec3<f32>(2.2));let rough=max(.04,s.material.y);let metal=s.material.x;let v=select(f.back.xyz,normalize(f.eye.xyz-s.world),f.camera.z>.5);let nv=max(.001,dot(n,v));let h=normalize(l+v);let nh=max(0.,dot(n,h));let vh=max(0.,dot(v,h));let a=rough*rough;let a2=a*a;let den=nh*nh*(a2-1)+1;let D=a2/(3.14159265*den*den);let k=(rough+1)*(rough+1)/8;let G=nv/(nv*(1-k)+k)*nl/(nl*(1-k)+k);let f0=mix(vec3<f32>(.04),b,metal);let F=f0+(vec3<f32>(1)-f0)*pow(1-vh,5.);let ibl=env(2*nv*n-v,rough);let amb=env(n,1.);let diffuse=(vec3<f32>(1)-F)*(1-metal)*b/3.14159265;let spec=D*G*F/max(.004,4*nv*nl);result=(diffuse+spec)*nl*3*sh+(amb*b*(1-metal)*.45+ibl*f0*(1-.6*rough))*ao+b*s.material.w;
 let x=result*exp2(f.shading.x);return pow(clamp(x*(2.51*x+vec3<f32>(.03))/(x*(2.43*x+vec3<f32>(.59))+vec3<f32>(.14)),vec3<f32>(0),vec3<f32>(1)),vec3<f32>(1/2.2));
 }else{if(f.mode.x>3.5&&f.mode.x<4.5){base=vec3<f32>(dot(base,vec3<f32>(.2126,.7152,.0722)));}if(f.mode.x>4.5){base=vec3<f32>(.76862745,.7490196,.6862745);}result=base*(.45*ao+.55*nl*sh);}
 return clamp(result*exp2(f.shading.x),vec3<f32>(0),vec3<f32>(1));
}
@fragment fn depthFragment(s:Surface)->@location(0) vec4<f32>{if(rejected(s)){discard;}return vec4<f32>(normal(s),dot(f.eye.xyz-s.world,f.back.xyz)/f.camera.w);}
@fragment fn shadowFragment(s:Surface){if(rejected(s)||s.flags>1.5||s.material.z<.98){discard;}}
@fragment fn opaqueFragment(s:Surface)->@location(0) vec4<f32>{if(rejected(s)||alpha(s)<.999){discard;}return vec4<f32>(shade(s),1);}
@fragment fn accumulateFragment(s:Surface)->@location(0) vec4<f32>{let a=alpha(s);if(rejected(s)||a>=.999){discard;}let weight=max(.01,a*a*8);return vec4<f32>(shade(s)*a*weight,a*weight);}
@fragment fn revealFragment(s:Surface)->@location(0) vec4<f32>{let a=alpha(s);if(rejected(s)||a>=.999){discard;}return vec4<f32>(0,0,0,a);}
struct Fullscreen {@builtin(position) position:vec4<f32>};
@vertex fn fullscreen(@builtin(vertex_index) i:u32)->Fullscreen{var o:Fullscreen;let x=f32((i<<1u)&2u);let y=f32(i&2u);o.position=vec4<f32>(x*2-1,y*2-1,0,1);return o;}
@fragment fn backgroundFragment(s:Fullscreen)->@location(0) vec4<f32>{return vec4<f32>(bg(s.position.xy),1);}
@fragment fn compositeFragment(s:Fullscreen)->@location(0) vec4<f32>{let xy=clamp(vec2<i32>(s.position.xy),vec2<i32>(0),vec2<i32>(f.viewport.xy)-vec2<i32>(1));let base=textureLoad(opaqueImage,xy,0);if(f.mode.y<.5){return vec4<f32>(base.rgb,1); }let acc=textureLoad(accumulation,xy,0);let rev=clamp(textureLoad(revealage,xy,0).r,0,1);return vec4<f32>(mix(acc.rgb/max(acc.a,.00001),base.rgb,rev),1);}
struct Edge { @builtin(position) position:vec4<f32>, @location(0) local:vec2<f32>, @location(1) color:vec4<f32>, @location(2) @interpolate(flat) width:f32, @location(3) @interpolate(flat) flags:f32 };
@vertex fn edgeVertex(@builtin(vertex_index) vertex:u32,@location(0) a:vec3<f32>,@location(1) b:vec3<f32>,@location(2) n:vec3<f32>,@location(3) n2:vec3<f32>,@location(4) color:vec4<f32>,@location(5) flags:f32,@location(6) info:vec4<f32>)->Edge{
 var o:Edge;var p0=a;var p1=b;var reject=false;
 if(flags>2.5&&f.switches.x<.5){reject=true;}
 let view=select(f.back.xyz,f.eye.xyz-(a+b)*.5,f.camera.z>.5);let sil=flags==1&&(info.y<1.5||dot(n,view)*dot(n2,view)<=0);
 if(flags==1){if(f.mode.z<.5&&f.mode.w<.5){reject=true;}if(f.shading.w<.5&&(info.x>.5||(f.shading.z>.5&&info.y==2&&dot(n,n2)>=f.lines.w&&!sil))){reject=true;}}
 let planeN=array<vec3<f32>,3>(f.back.xyz,-f.back.xyz,f.section.xyz);let planeW=array<f32,3>(dot(f.eye.xyz,f.back.xyz)-f.camera.x,-dot(f.eye.xyz,f.back.xyz)+f.camera.y,f.section.w+f.camera.w*1e-6);
 for(var k=0;k<3;k++){if(k==2&&flags>2.5){continue;}let da=dot(p0,planeN[k])-planeW[k];let db=dot(p1,planeN[k])-planeW[k];if(da>0&&db>0){reject=true;}if(da*db<0){let q=mix(p0,p1,da/(da-db));if(da>0){p0=q;}else{p1=q;}}}
 let bias=f.camera.w*.00006;p0+=f.back.xyz*bias;p1+=f.back.xyz*bias;let c0=clipPosition(p0);let c1=clipPosition(p1);let s0=c0.xy/c0.w*f.viewport.xy*.5;let s1=c1.xy/c1.w*f.viewport.xy*.5;let len=max(.001,length(s1-s0));let dir=(s1-s0)/len;let perp=vec2<f32>(-dir.y,dir.x);let end=array<f32,6>(0,1,0,0,1,1)[vertex];let side=array<f32,6>(-1,-1,1,1,-1,1)[vertex];let width=select(f.lines.y,max(f.lines.y,f.lines.z),sil);let sketch=f.effects.x*select(0.,1.,flags<2.5);let jitter=sin(info.w*123.+end*17.)*sketch;let over=f.effects.y*select(0.,1.,flags<2.5);let along=end*len+(end*2-1)*over;var pos=mix(c0,c1,end);pos=vec4<f32>(pos.xy+(perp*(side*(width*.5+.8)+jitter)+dir*((end*2-1)*over))*2/f.viewport.xy*pos.w,pos.zw);
 if(reject){pos=vec4<f32>(2,2,2,1);}o.position=pos;o.local=vec2<f32>(along,side*(width*.5+.8))*pos.w;o.width=width;o.flags=flags;o.color=vec4<f32>(select(select(color.rgb,f.edge.rgb,flags==1),vec3<f32>(.8588235,.52549,.117647),info.z>.5),color.a);return o;
}
@fragment fn edgeFragment(s:Edge)->@location(0) vec4<f32>{let p=s.local*s.position.w;let a=1-smoothstep(s.width*.5-.45,s.width*.5+.6,abs(p.y));return vec4<f32>(s.color.rgb,a*s.color.a);}
@fragment fn hiddenFragment(s:Edge)->@location(0) vec4<f32>{if(f.mode.w<.5||s.flags>1.5){discard;}let p=s.local*s.position.w;if(f.mode.w<1.5&&fract(p.x/f.effects.z)>.55){discard;}let a=(1-smoothstep(s.width*.5-.45,s.width*.5+.6,abs(p.y)))*select(.7,1.,f.mode.w>1.5);return vec4<f32>(select(f.hidden.rgb,s.color.rgb,f.mode.w>1.5),a*s.color.a);}
`;
export const GLSL_FRAME = `layout(std140) uniform FrameBlock {
 mat4 matrix;mat4 shadowMatrix;vec4 section;vec4 eye;vec4 light;vec4 background;vec4 backgroundTop;vec4 edge;vec4 hidden;
 vec4 mode;vec4 lines;vec4 switches;vec4 shading;vec4 viewport;vec4 camera;vec4 right;vec4 up;vec4 back;vec4 ao;vec4 effects;vec4 ground;vec4 material;vec4 cap;
} f;`;
export const GLSL_SURFACE_VERTEX = `#version 300 es
precision highp float;
${GLSL_FRAME}
layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec3 flatN;layout(location=3)in vec3 base;layout(location=4)in vec4 mat;layout(location=5)in float flag;
out vec3 world;out vec3 normalV;out vec3 flatNormal;out vec3 color;out vec4 materialV;out float flags;
void main(){gl_Position=PROJECTION*vec4(p,1.);world=p;normalV=n;flatNormal=flatN;color=base;materialV=mat;flags=flag;}`;
export const GLSL_SURFACE_FRAGMENT = `#version 300 es
precision highp float;precision highp sampler2D;
${GLSL_FRAME}
uniform sampler2D normalDepth;uniform sampler2D shadowDepth;
in vec3 world;in vec3 normalV;in vec3 flatNormal;in vec3 color;in vec4 materialV;in float flags;
#if PASS != 2
out vec4 outputColor;
#endif
vec2 pixel(){return vec2(gl_FragCoord.x,f.viewport.y-gl_FragCoord.y);}
vec3 bg(){return mix(f.background.rgb,mix(f.backgroundTop.rgb,f.background.rgb,clamp(pixel().y/f.viewport.y,0.,1.)),f.background.w);}
bool rejected(){return (flags>1.5&&f.switches.y<.5)||(flags<1.5&&dot(world,f.section.xyz)>f.section.w+f.camera.w*1e-6)||materialV.z<.001;}
float alpha(){return (flags>.5||f.mode.x<.5)?1.:min(materialV.z,f.lines.x);}
vec3 normal(){vec3 n=normalize(f.shading.z>.5?normalV:flatNormal);vec3 v=f.camera.z>.5?normalize(f.eye.xyz-world):f.back.xyz;return f.mode.x<5.5&&dot(n,v)<0.?-n:n;}
float shadow(vec3 p,vec3 n){if(f.switches.z<.5)return 1.;vec4 q=f.shadowMatrix*vec4(p,1.);vec3 ndc=q.xyz/q.w;vec2 uv=ndc.xy*.5+.5;float z=ndc.z*.5+.5;if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))||z<=0.||z>=1.)return 1.;ivec2 dim=textureSize(shadowDepth,0);ivec2 px=ivec2(uv*vec2(dim));float sum=0.;float bias=.0004+.0008*(1.-abs(dot(n,f.light.xyz)));for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){float d=texelFetch(shadowDepth,clamp(px+ivec2(x,y),ivec2(0),dim-1),0).r;sum+=z-bias>d?0.:1.;}return .25+.75*sum/9.;}
float ambient(vec3 n){if(f.switches.w<.5||f.mode.x<.5)return 1.;float depth=dot(f.eye.xyz-world,f.back.xyz),radius=f.ao.x;float pixels=clamp(radius*f.viewport.y/(f.camera.z>.5?max(.00001,depth*.82842712):f.camera.w),2.,80.);float sum=0.;for(int i=0;i<12;i++){float a=float(i)*2.39996323,d=sqrt((float(i)+.5)/12.);ivec2 xy=clamp(ivec2(pixel()+vec2(cos(a),sin(a))*pixels*d),ivec2(0),ivec2(f.viewport.xy)-1);vec4 sampled=texelFetch(normalDepth,ivec2(xy.x,int(f.viewport.y)-1-xy.y),0);if(sampled.w<=0.)continue;float z=sampled.w*f.camera.w,halfExtent=f.camera.z>.5?z*.41421356:f.camera.w*.5;vec2 uv=(vec2(xy)+.5)/f.viewport.xy;vec3 p=f.eye.xyz+f.right.xyz*((uv.x*2.-1.)*halfExtent*f.viewport.x/f.viewport.y)+f.up.xyz*((1.-uv.y*2.)*halfExtent)-f.back.xyz*z;vec3 delta=p-world;float len=length(delta);if(len>radius*.015&&len<radius)sum+=max(0.,dot(n,delta)/len-.05)*(1.-len/radius);}return clamp(1.-f.ao.y*sum*.33,.12,1.);}
vec3 env(vec3 n,float rough){vec3 sky=vec3(.66,.76,.92),floor=vec3(.16,.18,.22);if(f.shading.y>.5&&f.shading.y<1.5){sky=vec3(.85,.87,.9);floor=vec3(.3,.32,.35);}if(f.shading.y>1.5&&f.shading.y<2.5){sky=vec3(.44,.66,1);floor=vec3(.24,.21,.17);}if(f.shading.y>2.5){sky=vec3(.25,.29,.4);floor=vec3(.04,.045,.065);}float panel=pow(max(0.,dot(n,f.light.xyz)),2.+100.*(1.-rough)*(1.-rough))*(1.-rough)*3.;return mix(floor,sky,clamp(n.z*.5+.5,0.,1.))+panel;}
vec3 shade(){vec3 n=normal(),l=f.light.xyz;float nl=max(0.,dot(n,l)),ao=ambient(n),sh=shadow(world,n);vec3 base=color,result=base;if(flags>1.5){base=f.ground.rgb;return clamp(base*(.45*ao+.55*nl*sh)*exp2(f.shading.x),0.,1.);}if(flags>.5){float hatch=fract(dot(world,vec3(1.,.71,.43))/max(.00001,f.ao.w));return f.cap.rgb*((f.cap.w>.5&&hatch<.12)?.65:1.);}if(f.mode.x<.5)return bg();if(f.mode.x>5.5)return n*.5+.5;
 if(f.mode.x>2.5&&f.mode.x<3.5){float t=dot(n,l)*.5+.5;result=mix(vec3(.04,.2,.44)+base*.25,vec3(.78,.58,.2)+base*.35,t)*(.7+.3*sh)*ao;}
 else if(f.mode.x>1.5&&f.mode.x<2.5){vec3 b=pow(base,vec3(2.2));float rough=max(.04,materialV.y),metal=materialV.x;vec3 v=f.camera.z>.5?normalize(f.eye.xyz-world):f.back.xyz;float nv=max(.001,dot(n,v));vec3 h=normalize(l+v);float nh=max(0.,dot(n,h)),vh=max(0.,dot(v,h)),a=rough*rough,a2=a*a,den=nh*nh*(a2-1.)+1.,D=a2/(3.14159265*den*den),k=(rough+1.)*(rough+1.)/8.,G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);vec3 f0=mix(vec3(.04),b,metal),F=f0+(1.-f0)*pow(1.-vh,5.),ibl=env(2.*nv*n-v,rough),amb=env(n,1.),diffuse=(1.-F)*(1.-metal)*b/3.14159265,spec=D*G*F/max(.004,4.*nv*nl);result=(diffuse+spec)*nl*3.*sh+(amb*b*(1.-metal)*.45+ibl*f0*(1.-.6*rough))*ao+b*materialV.w;vec3 x=result*exp2(f.shading.x);return pow(clamp(x*(2.51*x+.03)/(x*(2.43*x+.59)+.14),0.,1.),vec3(1./2.2));}
 else{if(f.mode.x>3.5&&f.mode.x<4.5)base=vec3(dot(base,vec3(.2126,.7152,.0722)));if(f.mode.x>4.5)base=vec3(.76862745,.7490196,.6862745);result=base*(.45*ao+.55*nl*sh);}return clamp(result*exp2(f.shading.x),0.,1.);}
void main(){if(rejected())discard;
#if PASS == 0
 if(alpha()<.999)discard;outputColor=vec4(shade(),1.);
#elif PASS == 1
 outputColor=vec4(normal(),dot(f.eye.xyz-world,f.back.xyz)/f.camera.w);
#elif PASS == 2
 if(flags>1.5||materialV.z<.98)discard;
#elif PASS == 3
 float a=alpha();if(a>=.999)discard;float w=max(.01,a*a*8.);outputColor=vec4(shade()*a*w,a*w);
#elif PASS == 4
 float a=alpha();if(a>=.999)discard;outputColor=vec4(0.,0.,0.,a);
#endif
}`;
export const GLSL_FULLSCREEN_VERTEX = `#version 300 es
precision highp float;void main(){float x=float((gl_VertexID<<1)&2),y=float(gl_VertexID&2);gl_Position=vec4(x*2.-1.,y*2.-1.,0.,1.);}`;
export const GLSL_FULLSCREEN_FRAGMENT = `#version 300 es
precision highp float;precision highp sampler2D;
${GLSL_FRAME}
uniform sampler2D opaqueImage;uniform sampler2D accumulation;uniform sampler2D revealage;out vec4 outputColor;
void main(){
#if COMPOSITE == 1
 ivec2 xy=ivec2(gl_FragCoord.xy);vec4 base=texelFetch(opaqueImage,xy,0);if(f.mode.y<.5){outputColor=vec4(base.rgb,1.);return;}vec4 acc=texelFetch(accumulation,xy,0);float rev=clamp(texelFetch(revealage,xy,0).r,0.,1.);outputColor=vec4(mix(acc.rgb/max(acc.a,.00001),base.rgb,rev),1.);
#else
 vec3 c=mix(f.background.rgb,mix(f.backgroundTop.rgb,f.background.rgb,clamp(1.-gl_FragCoord.y/f.viewport.y,0.,1.)),f.background.w);outputColor=vec4(c,1.);
#endif
}`;
export const GLSL_EDGE_VERTEX = `#version 300 es
precision highp float;
${GLSL_FRAME}
layout(location=0)in vec3 a;layout(location=1)in vec3 b;layout(location=2)in vec3 n;layout(location=3)in vec3 n2;layout(location=4)in vec4 color;layout(location=5)in float flags;layout(location=6)in vec4 info;
out vec2 local;out vec4 edgeColor;flat out float widthV;flat out float flagV;
void main(){vec3 p0=a,p1=b;bool reject=false;if(flags>2.5&&f.switches.x<.5)reject=true;vec3 view=f.camera.z>.5?f.eye.xyz-(a+b)*.5:f.back.xyz;bool sil=flags==1.&&(info.y<1.5||dot(n,view)*dot(n2,view)<=0.);if(flags==1.){if(f.mode.z<.5&&f.mode.w<.5)reject=true;if(f.shading.w<.5&&(info.x>.5||(f.shading.z>.5&&info.y==2.&&dot(n,n2)>=f.lines.w&&!sil)))reject=true;}
 vec3 planeN[3]=vec3[3](f.back.xyz,-f.back.xyz,f.section.xyz);float planeW[3]=float[3](dot(f.eye.xyz,f.back.xyz)-f.camera.x,-dot(f.eye.xyz,f.back.xyz)+f.camera.y,f.section.w+f.camera.w*1e-6);for(int k=0;k<3;k++){if(k==2&&flags>2.5)continue;float da=dot(p0,planeN[k])-planeW[k],db=dot(p1,planeN[k])-planeW[k];if(da>0.&&db>0.)reject=true;if(da*db<0.){vec3 q=mix(p0,p1,da/(da-db));if(da>0.)p0=q;else p1=q;}}
 float bias=f.camera.w*.00006;p0+=f.back.xyz*bias;p1+=f.back.xyz*bias;vec4 c0=f.matrix*vec4(p0,1.),c1=f.matrix*vec4(p1,1.);vec2 s0=c0.xy/c0.w*f.viewport.xy*.5,s1=c1.xy/c1.w*f.viewport.xy*.5;float len=max(.001,length(s1-s0));vec2 dir=(s1-s0)/len,perp=vec2(-dir.y,dir.x);float ends[6]=float[6](0.,1.,0.,0.,1.,1.),sides[6]=float[6](-1.,-1.,1.,1.,-1.,1.);float end=ends[gl_VertexID],side=sides[gl_VertexID],width=sil?max(f.lines.y,f.lines.z):f.lines.y,sketch=flags<2.5?f.effects.x:0.,jitter=sin(info.w*123.+end*17.)*sketch,over=flags<2.5?f.effects.y:0.,along=end*len+(end*2.-1.)*over;vec4 pos=mix(c0,c1,end);pos.xy+=(perp*(side*(width*.5+.8)+jitter)+dir*((end*2.-1.)*over))*2./f.viewport.xy*pos.w;if(reject)pos=vec4(2.,2.,2.,1.);gl_Position=pos;local=vec2(along,side*(width*.5+.8))*pos.w;widthV=width;flagV=flags;edgeColor=vec4(info.z>.5?vec3(.8588235,.52549,.117647):(flags==1.?f.edge.rgb:color.rgb),color.a);}`;
export const GLSL_EDGE_FRAGMENT = `#version 300 es
precision highp float;
${GLSL_FRAME}
in vec2 local;in vec4 edgeColor;flat in float widthV;flat in float flagV;out vec4 outputColor;
void main(){vec2 p=local*gl_FragCoord.w;float a=1.-smoothstep(widthV*.5-.45,widthV*.5+.6,abs(p.y));
#if HIDDEN == 1
 if(f.mode.w<.5||flagV>1.5)discard;if(f.mode.w<1.5&&fract(p.x/f.effects.z)>.55)discard;outputColor=vec4(f.mode.w>1.5?edgeColor.rgb:f.hidden.rgb,a*(f.mode.w>1.5?1.:.7)*edgeColor.a);
#else
 outputColor=vec4(edgeColor.rgb,a*edgeColor.a);
#endif
}`;
