import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileViewportMetrics, MOBILE_MEDIA } from '../packages/workbench/src/mobile-workspace.js';

test('mobile media covers coarse portrait tablets without forcing wide desktop touch laptops', () => {
    assert.match(MOBILE_MEDIA, /max-width:1100px\) and \(pointer:coarse/);
});
for (const [name, input, expected] of [
    ['ordinary viewport', { width:390, height:844 }, { height:844, top:0, keyboard:false }],
    ['software keyboard', { width:390, height:844, visualHeight:380, focused:true }, { height:380, top:0, keyboard:true }],
    ['resized layout keyboard', { width:390, height:380, baselineHeight:844, focused:true }, { height:380, top:0, keyboard:true }],
    ['browser toolbar is not keyboard', { width:390, height:844, visualHeight:780, focused:true }, { height:780, top:0, keyboard:false }],
    ['accessibility zoom', { width:390, height:844, visualHeight:300, visualTop:50, scale:2, focused:true }, { height:844, top:0, keyboard:false }],
    ['panned keyboard', { width:390, height:844, visualHeight:360, visualTop:28, focused:true }, { height:360, top:28, keyboard:true }],
    ['missing visual viewport', { width:820, height:1180, visualHeight:undefined }, { height:1180, top:0, keyboard:false }],
    ['invalid metrics', { width:390, height:844, visualHeight:NaN, visualTop:-40 }, { height:844, top:0, keyboard:false }],
    ['no focused input', { width:390, height:844, visualHeight:350 }, { height:350, top:0, keyboard:false }]
]) test(name, () => assert.deepEqual(mobileViewportMetrics(input), { width:input.width, ...expected }));
