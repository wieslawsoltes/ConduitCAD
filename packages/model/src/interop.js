import { matrix, compose, bounds, splinePoints } from '@conduitcad/geometry';
import { inPolygon } from './fidelity.js';
/** Top-view WCS -> paper DCS. Twist is applied before the DCS center offset. */
export function viewportTransform(e) {
    const d=e.viewDirection||{x:0,y:0,z:1};
    if((e.viewportFlags&7)||Math.abs(d.x)>1e-9||Math.abs(d.y)>1e-9||d.z<=0) return null;
    const s=e.viewportHeight/e.viewHeight;
    if(!(s>0)||!Number.isFinite(s))return null;
    const c=e.viewCenter||{x:0,y:0},target=e.viewTarget||{x:0,y:0};
    return compose(matrix({x:e.c.x-c.x*s,y:e.c.y-c.y*s}),compose(matrix({sx:s,sy:s,rotation:e.viewTwist||0}),matrix({x:-target.x,y:-target.y})));
}
export function viewportRectangle(e) {
    const {x,y}=e.c,w=e.viewportWidth/2,h=e.viewportHeight/2;
    return [{x:x-w,y:y-h},{x:x+w,y:y-h},{x:x+w,y:y+h},{x:x-w,y:y+h}];
}
export function insideClips(p,clips) {
    return !clips || clips.every(polygon=>inPolygon(p,polygon));
}
export function wipeoutPoints(e) {
    let vertices=e.boundary||[];
    if(e.boundaryType===1&&vertices.length===2) {
        const [a,b]=vertices;vertices=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];
    }
    const p=e.p,u=e.uPixel,v=e.vPixel,height=e.imageSize?.y??1;
    return vertices.map(q=>({x:p.x+u.x*(q.x+.5)+v.x*(height-q.y-.5),y:p.y+u.y*(q.x+.5)+v.y*(height-q.y-.5)}));
}
export function helixPoints(e,tolerance=.25) {
    const spline=e.helixSpline;
    if(spline?.controlPoints?.length && spline.knots?.length)return splinePoints(spline,tolerance);
    const a=e.axis||{x:0,y:0,z:1},l=Math.hypot(a.x,a.y,a.z);if(!l)return [];
    const n={x:a.x/l,y:a.y/l,z:a.z/l},b=e.axisBase,s=e.startPoint;
    if(!b||!s||!(e.radius>0)||!Number.isFinite(e.turns)||!Number.isFinite(e.turnHeight))return [];
    const v={x:s.x-b.x,y:s.y-b.y,z:(s.z||0)-(b.z||0)},dot=v.x*n.x+v.y*n.y+v.z*n.z;
    const radial={x:v.x-dot*n.x,y:v.y-dot*n.y,z:v.z-dot*n.z},r=Math.hypot(radial.x,radial.y,radial.z);if(!r)return [];
    const u={x:radial.x/r*e.radius,y:radial.y/r*e.radius,z:radial.z/r*e.radius};
    const w={x:n.y*u.z-n.z*u.y,y:n.z*u.x-n.x*u.z,z:n.x*u.y-n.y*u.x};
    const steps=Math.min(8192,Math.max(16,Math.ceil(Math.abs(e.turns)*Math.PI*2*Math.sqrt(e.radius/Math.max(tolerance,1e-8))))),sign=e.handedness===false?-1:1;
    return Array.from({length:steps+1},(_,i)=>{const f=i/steps,theta=sign*f*e.turns*Math.PI*2,z=f*e.turns*e.turnHeight;return {x:s.x-u.x+u.x*Math.cos(theta)+w.x*Math.sin(theta)+n.x*z,y:s.y-u.y+u.y*Math.cos(theta)+w.y*Math.sin(theta)+n.y*z,z:(s.z||0)-u.z+u.z*Math.cos(theta)+w.z*Math.sin(theta)+n.z*z};});
}
