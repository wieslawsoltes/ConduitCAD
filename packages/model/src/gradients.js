/** Portable native LINEAR gradient descriptor. Unknown distributions are not approximated silently. */
export function linearHatchGradient(tags,contours,frame) {
    if(!Array.isArray(tags))return null;
    const value=(code,fallback)=>tags.find(p=>p[0]===code)?.[1]??fallback;
    if(value(450,0)!==1||value(470,'LINEAR')!=='LINEAR'||value(461,0)!==0||value(453,2)!==2)return null;
    const colors=tags.filter(p=>p[0]===421).map(p=>p[1]);
    if(colors.length!==2||colors.some(c=>!Number.isInteger(c)||c<0||c>0xffffff))return null;
    const rotation=value(460,0);if(!Number.isFinite(rotation))return null;
    const u={x:Math.cos(rotation),y:Math.sin(rotation)};
    let lo=Infinity,hi=-Infinity;
    for(const polygon of contours)for(const p of polygon){const t=p.x*u.x+p.y*u.y;lo=Math.min(lo,t);hi=Math.max(hi,t);}
    if(!Number.isFinite(lo)||hi-lo<1e-12)return null;
    return {kind:'linear',start:{x:u.x*lo,y:u.y*lo},end:{x:u.x*hi,y:u.y*hi},frame:frame.slice(),colors:colors.map(c=>'#'+c.toString(16).padStart(6,'0'))};
}
