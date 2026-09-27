/** Deterministic screen-space packing: dimension badges never intercept another handle.
 * The host keeps all values in an accessible ribbon when a badge cannot fit.
 * Coordinates and sizes are CSS pixels, independent of render-target resolution.
 */
export function layoutHandles3(handles, {width, height, top=60, bottom=height-120, active=null, labels=true}={}) {
    if (![width,height,top,bottom].every(Number.isFinite)) throw new TypeError('Finite viewport bounds are required');
    const size=44,margin=6,minX=margin+size/2,maxX=width-margin-size/2,minY=top+size/2,maxY=bottom-size/2;
    if(maxX<minX || maxY<minY)return handles.map(h=>({id:h.id,visible:false,label:null}));
    const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
    const overlap=(a,b,gap=3)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
    const occupied=[],results=[];
    for(const h of handles){
        if(!Number.isFinite(h.x)||!Number.isFinite(h.y)){results.push({id:h.id,visible:false,label:null});continue;}
        const x=clamp(h.x,minX,maxX),y=clamp(h.y,minY,maxY),candidates=[];
        for(let dy=-3;dy<=3;dy++)for(let dx=-6;dx<=6;dx++){
            const px=clamp(x+dx*50,minX,maxX),py=clamp(y+dy*50,minY,maxY);
            candidates.push({x:px,y:py,d:(px-x)**2+(py-y)**2});
        }
        candidates.sort((a,b)=>a.d-b.d);
        const chosen=candidates.find(c=>!occupied.some(r=>overlap({x:c.x-22,y:c.y-22,w:size,h:size},r)));
        if(!chosen){results.push({id:h.id,visible:false,label:null});continue;}
        occupied.push({x:chosen.x-22,y:chosen.y-22,w:size,h:size});
        results.push({id:h.id,x:chosen.x,y:chosen.y,visible:true,label:null});
    }
    if(!labels)return results;
    const badges=[];
    const order=handles.map((_,i)=>i).sort((a,b)=>(handles[a].id===active?-1:0)-(handles[b].id===active?-1:0));
    for(const i of order){
        const h=handles[i],r=results[i];if(!r.visible||!h.hasLabel||h.hideLabel)continue;
        const w=Math.min(Math.max(94,h.labelWidth||110),154,width-2*margin),hh=Math.max(40,h.labelHeight||44),candidates=[];
        for(let n=0;n<7;n++)for(const sign of n?[-1,1]:[1]){
            const dy=n*sign*(hh+6);
            candidates.push({x:r.x+27,y:r.y-hh/2+dy},{x:r.x-w-27,y:r.y-hh/2+dy});
        }
        candidates.push({x:r.x-w/2,y:r.y-hh-27},{x:r.x-w/2,y:r.y+27});
        const rects=candidates.map(p=>({x:clamp(p.x,margin,width-margin-w),y:clamp(p.y,top,bottom-hh),w,h:hh}));
        const rect=rects.find(p=>p.y>=top&&p.y+p.h<=bottom&&!occupied.some(q=>overlap(p,q))&&!badges.some(q=>overlap(p,q)));
        if(rect){r.label=rect;badges.push(rect);}
    }
    return results;
}
