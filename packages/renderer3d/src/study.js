import { createDocument } from '@conduitcad/model';
import { addFeature } from '@conduitcad/modeling';
import { MATERIAL_PRESETS, normalizeDisplaySettings } from './visual-styles.js';
/** An editable, native-mesh material/occlusion reference scene, not a baked preview image. */
export function createRenderingStudy() {
    const document=createDocument('3D visual style and material study');
    document.parameters={Radius:'12',Spacing:'36'};
    document.metadata={description:'Compare all viewport styles, section contours, material coefficients and transparent overlap.',modeling:{version:1,preferredMode:'3d'},display3d:normalizeDisplaySettings({style:'realistic',ground:true,grid:false,shadows:true,ambientOcclusion:true,background:'gradient',quality:'balanced'})};
    for(let i=0;i<MATERIAL_PRESETS.length;i++){
        const preset=MATERIAL_PRESETS[i];
        const e=addFeature(document,'sphere',{radius:'Radius',segments:28,x:`${i%3}*Spacing`,y:`${Math.floor(i/3)}*Spacing`,z:'Radius+5'},[],{name:preset.label,color:preset.color});
        e.appearance3d={...preset,emission:0};e.opacity=preset.opacity;
        const stand=addFeature(document,'cylinder',{radius:14,height:4,segments:28,x:`${i%3}*Spacing`,y:`${Math.floor(i/3)}*Spacing`},[],{name:preset.label+' pedestal',color:'#777f82'});
        stand.appearance3d={metallic:.3,roughness:.55,emission:0,opacity:1};
    }
    const frame=addFeature(document,'torus',{major:18,minor:4,segments:40,x:-40,y:36,z:20},[],{name:'Section contour and silhouette ring',color:'#c88455'});
    frame.appearance3d={metallic:1,roughness:.23,opacity:1,emission:0};
    return document;
}
