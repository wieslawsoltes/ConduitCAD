import { V3, add3, sub3, mul3, dot3, length3, finite3 } from '@conduitcad/geometry3d';
import { perpendicularAxes3 } from './gestures.js';
/** Exact world-space measurement, never a screen-projected distance. */
export function measurePoints3(first, second) {
    const a=finite3(first),b=finite3(second),delta=sub3(b,a),distance=length3(delta),horizontal=Math.hypot(delta.x,delta.y);
    if(!Number.isFinite(distance)||distance>1e15)throw new RangeError('Measurement exceeds the supported range');
    return {a,b,delta,distance,horizontal,inclination:distance?Math.atan2(delta.z,horizontal)*180/Math.PI:0,midpoint:add3(a,mul3(delta,.5))};
}
/** A finite plane guide around the visible scene. offset follows n·p = offset. */
export function sectionFrame3(normal, offset, center=V3(), span=100) {
    normal=finite3(normal);center=finite3(center);const length=length3(normal);
    if(length<1e-12||!Number.isFinite(offset)||!Number.isFinite(span)||span<=0||span>1e15)throw new RangeError('Invalid section plane or guide span');
    normal=mul3(normal,1/length);offset/=length;
    const origin=add3(center,mul3(normal,offset-dot3(center,normal))),{u,v}=perpendicularAxes3(normal);
    const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add3(origin,add3(mul3(u,x*span/2),mul3(v,y*span/2))));
    return {normal,offset,origin,u,v,corners};
}
