import { color3, ENVIRONMENTS, visualStyle, normalizeMaterial } from './visual-styles.js';
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit = a => { const l=Math.hypot(...a)||1;return a.map(x=>x/l); };
const mix = (a,b,t)=>a.map((x,i)=>x*(1-t)+b[i]*t);
export function background3D(settings, y) { const a=color3(settings.backgroundColor),b=color3(settings.backgroundTop);return settings.background==='gradient'?mix(b,a,clamp(y)):a; }
export function environment3D(direction, roughness, environment) {
    const t=clamp(direction[2]*.5+.5), sky=mix(environment.floor, environment.sky, t);
    const l=unit(environment.light), power=2+100*(1-roughness)**2, panel=Math.pow(Math.max(0,dot(direction,l)),power)*(1-roughness)*3;
    return sky.map(v=>v+panel);
}
/** Shared reference shading. Realistic mode evaluates a bounded GGX BRDF in linear light. */
export function shadeSurface3D(t, normal, view, settings, { selected=false, ao=1, shadow=1, y=.5 }={}) {
    const mode=visualStyle(settings.style), env=ENVIRONMENTS.find(e=>e.id===settings.environment), l=unit(env.light);
    let n=unit([normal.x,normal.y,normal.z]), v=unit([view.x,view.y,view.z]);
    if(mode.faces!=='normals'&&dot(n,v)<0)n=n.map(x=>-x);
    const material=t.material||normalizeMaterial({},t.color), base=color3(selected?'#f0b359':t.ground?settings.groundColor:t.cap?settings.capColor:material.color), nl=Math.max(0,dot(n,l));
    let rgb;
    if(mode.faces==='none'&&!t.ground&&!t.cap)return background3D(settings,y);
    if(t.cap) {rgb=base;}
    else if(mode.faces==='normals'&&!t.ground) return n.map(x=>x*.5+.5);
    else if(mode.faces==='gooch'&&!t.ground) { const f=dot(n,l)*.5+.5;rgb=base.map((b,i)=>([.04,.2,.44][i]+b*.25)*(1-f)+([.78,.58,.2][i]+b*.35)*f);rgb=rgb.map(x=>x*(.7+.3*shadow)*ao); }
    else if(mode.faces==='pbr'&&!t.ground) {
        const b=base.map(x=>Math.pow(x,2.2)), rough=Math.max(.04,material.roughness), metal=material.metallic, nv=Math.max(.001,dot(n,v)), h=unit(l.map((x,i)=>x+v[i]));
        const nh=Math.max(0,dot(n,h)),vh=Math.max(0,dot(v,h)),a=rough*rough,a2=a*a,den=nh*nh*(a2-1)+1,D=a2/(Math.PI*den*den),k=(rough+1)**2/8,G=nv/(nv*(1-k)+k)*nl/(nl*(1-k)+k),f0=mix([.04,.04,.04],b,metal),F=f0.map(x=>x+(1-x)*(1-vh)**5);
        const reflection=n.map((x,i)=>2*nv*x-v[i]), ibl=environment3D(reflection,rough,env), ambient=environment3D(n,1,env);
        rgb=b.map((c,i)=> {const diffuse=(1-F[i])*(1-metal)*c/Math.PI,spec=D*G*F[i]/Math.max(.004,4*nv*nl);return (diffuse+spec)*nl*3*shadow+(ambient[i]*c*(1-metal)*.45+ibl[i]*f0[i]*(1-.6*rough))*ao+c*material.emission;});
        rgb=rgb.map(x=>{x*=2**settings.exposure;const mapped=clamp(x*(2.51*x+.03)/(x*(2.43*x+.59)+.14));return Math.pow(mapped,1/2.2);});return rgb;
    }
    else {let color=base;if(mode.faces==='gray') {const lum=dot(base,[.2126,.7152,.0722]);color=[lum,lum,lum];}if(mode.faces==='clay')color=color3('#c4bfaf');rgb=color.map(x=>x*(.45*ao+.55*nl*shadow));}
    return rgb.map(x=>clamp(x*2**settings.exposure));
}
