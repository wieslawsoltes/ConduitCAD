import { OrbitCamera as Camera } from './camera.js';
import { buildScene3D as build, pick3D as pick } from './scene.js';
import { SpatialRenderer as Renderer } from './renderer.js';
export const OrbitCamera = Camera;
export const buildScene3D = build;
export const pick3D = pick;
export const SpatialRenderer = Renderer;

import { VISUAL_STYLES as styles, ENVIRONMENTS as environments, MATERIAL_PRESETS as materials, DEFAULT_DISPLAY_SETTINGS as defaults, normalizeDisplaySettings as normalize, normalizeMaterial as material, visualStyle as findStyle } from './visual-styles.js';
export const VISUAL_STYLES=styles;
export const ENVIRONMENTS=environments;
export const MATERIAL_PRESETS=materials;
export const DEFAULT_DISPLAY_SETTINGS=defaults;
export const normalizeDisplaySettings=normalize;
export const normalizeMaterial=material;
export const visualStyle=findStyle;
import { createRenderingStudy as study } from './study.js';
export const createRenderingStudy = study;
