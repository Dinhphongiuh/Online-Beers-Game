import * as THREE from 'three';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  DepthOfFieldEffect,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  LensDistortionEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';

/**
 * "Quắc Cần Câu" post-processing pipeline (pmndrs/postprocessing).
 *
 *   RenderPass → HDR clamp → [DoF] → bloom + exposure + lens warp + ACES + vignette
 *              → [double vision] → [chromatic aberration]
 *
 * Passes in [] are switched off while sober, so a sober frame costs the same as the
 * old bloom-only composer. All drunk parameters are smoothed so alcohol spikes
 * (a shot of rượu đế) ease in instead of popping.
 */

export interface DrunkVisionParams {
  /** 0 - 100, the user's Độ Cồn. */
  alcohol: number;
  /** Cold towel / ice water clears the eyes temporarily. */
  clearEyes: boolean;
  /** Passed out, faceplanted on the table, or a breathalyzer in the face → cinematic DoF. */
  focusPull: boolean;
  /** Distance (world units) the DoF keeps sharp when focusPull is on. */
  focusDistance?: number;
  /** Extra multiplier for the drunk ride home (return_drunk_fpp_drive): sees 1 hẻm as 3. */
  drivingBoost?: number;
}

// Tames specular fireflies / NaNs before bloom, otherwise one hot pixel blooms into a white blob
class HdrClampEffect extends Effect {
  constructor(maxValue = 3.0) {
    super(
      'HdrClampEffect',
      /* glsl */ `
        uniform float maxValue;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          vec3 c = inputColor.rgb;
          if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
          outputColor = vec4(min(c, vec3(maxValue)), inputColor.a);
        }
      `,
      { uniforms: new Map([['maxValue', new THREE.Uniform(maxValue)]]) }
    );
  }
}

// The renderer's toneMappingExposure is skipped when rendering into the composer's
// buffers, so the old 1.15 exposure is applied here, right before ACES.
class ExposureEffect extends Effect {
  constructor(exposure: number) {
    super(
      'ExposureEffect',
      /* glsl */ `
        uniform float exposure;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
        }
      `,
      { uniforms: new Map([['exposure', new THREE.Uniform(exposure)]]) }
    );
  }
}

/** Double vision ghosting + wavy "nhìn 1 thành 3" warp. Convolution: owns its pass. */
class DoubleVisionEffect extends Effect {
  constructor() {
    super(
      'DoubleVisionEffect',
      /* glsl */ `
        uniform float ghost;
        uniform float wobble;
        uniform float clock;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          vec2 warp = vec2(
            sin(uv.y * 9.0 + clock * 1.7) * 0.006,
            cos(uv.x * 7.0 + clock * 1.3) * 0.004
          ) * wobble;
          vec2 base = uv + warp;
          vec2 drift = vec2(sin(clock * 0.83), cos(clock * 0.61) * 0.35) * ghost * 0.032;
          vec3 center = texture2D(inputBuffer, base).rgb;
          vec3 left = texture2D(inputBuffer, base + drift).rgb;
          vec3 right = texture2D(inputBuffer, base - drift * 0.7).rgb;
          float mixAmt = clamp(ghost * 1.6, 0.0, 0.62);
          vec3 c = mix(center, (left + right) * 0.5, mixAmt);
          outputColor = vec4(c, inputColor.a);
        }
      `,
      {
        attributes: EffectAttribute.CONVOLUTION,
        uniforms: new Map<string, THREE.Uniform>([
          ['ghost', new THREE.Uniform(0)],
          ['wobble', new THREE.Uniform(0)],
          ['clock', new THREE.Uniform(0)],
        ]),
      }
    );
  }
}

export interface DrunkVisionPipeline {
  render: (delta: number) => void;
  setSize: (w: number, h: number) => void;
  setPixelRatio: (ratio: number) => void;
  update: (params: DrunkVisionParams, time: number, delta: number) => void;
  dispose: () => void;
}

export function createDrunkVisionPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  exposure = 1.15
): DrunkVisionPipeline {
  // The composer applies tone mapping itself (ToneMappingEffect)
  renderer.toneMapping = THREE.NoToneMapping;

  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: Math.min(4, renderer.capabilities.maxSamples),
  });

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera, new HdrClampEffect(3.0)));

  const dof = new DepthOfFieldEffect(camera, {
    worldFocusDistance: 1.2,
    worldFocusRange: 0.9,
    bokehScale: 0,
  });
  const dofPass = new EffectPass(camera, dof);
  dofPass.enabled = false;
  composer.addPass(dofPass);

  const bloom = new BloomEffect({
    intensity: 1.45,
    // Lit surfaces under the table spotlight reach ~2.5; emissives get clamped to 3.0,
    // so only neon, bulbs, signs and lamps cross this threshold
    luminanceThreshold: 2.9,
    luminanceSmoothing: 0.05,
    mipmapBlur: true,
    radius: 0.62,
  });
  const lens = new LensDistortionEffect({
    distortion: new THREE.Vector2(0, 0),
    principalPoint: new THREE.Vector2(0, 0),
    focalLength: new THREE.Vector2(1, 1),
    skew: 0,
  });
  const exposureFx = new ExposureEffect(exposure);
  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const vignette = new VignetteEffect({ offset: 0.35, darkness: 0.35 });
  const mainPass = new EffectPass(camera, bloom, lens, exposureFx, toneMapping, vignette);
  composer.addPass(mainPass);

  const doubleVision = new DoubleVisionEffect();
  const doubleVisionPass = new EffectPass(camera, doubleVision);
  doubleVisionPass.enabled = false;
  composer.addPass(doubleVisionPass);

  const chroma = new ChromaticAberrationEffect({
    blendFunction: BlendFunction.NORMAL,
    offset: new THREE.Vector2(0, 0),
    radialModulation: true,
    modulationOffset: 0.18,
  });
  const chromaPass = new EffectPass(camera, chroma);
  chromaPass.enabled = false;
  composer.addPass(chromaPass);

  // pmndrs only flags the pass added last as renderToScreen; since the tail passes switch
  // on/off with alcohol, hand the flag to whichever pass is the last enabled one.
  const tail = [mainPass, doubleVisionPass, chromaPass];
  const syncRenderToScreen = () => {
    let last = mainPass;
    for (const pass of tail) if (pass.enabled) last = pass;
    for (const pass of tail) pass.renderToScreen = pass === last;
  };
  syncRenderToScreen();

  // Smoothed values
  let level = 0; // 0..1 effective drunkenness
  let focus = 0; // 0..1 DoF blend

  const u = (fx: Effect, name: string) => fx.uniforms.get(name)!;

  return {
    render: (delta) => composer.render(delta),
    setSize: (w, h) => composer.setSize(w, h),
    setPixelRatio: () => {
      // EffectComposer reads the renderer's pixel ratio on setSize
    },
    update: (params, time, delta) => {
      const raw = params.clearEyes ? 0 : Math.max(0, (params.alcohol - 25) / 75);
      const target = Math.min(1.25, raw * (params.drivingBoost ?? 1));
      level = THREE.MathUtils.damp(level, target, 1.6, delta);
      focus = THREE.MathUtils.damp(focus, params.focusPull ? 1 : 0, 3, delta);

      const k = Math.max(0, level);
      // Barrel/pincushion breathing: the alley bends in and out
      const breathe = Math.sin(time * 0.9) * 0.5 + 0.5;
      const warp = k * (0.12 + breathe * 0.18);
      lens.distortion.set(warp, warp * 0.85);
      lens.focalLength.set(1 - warp * 0.25, 1 - warp * 0.25);

      vignette.darkness = 0.35 + k * 0.4 + focus * 0.25;
      vignette.offset = 0.35 - k * 0.12;

      // Above ~60% the eyes stop agreeing with each other
      const ghost = Math.max(0, k - 0.45) * 0.9;
      doubleVisionPass.enabled = k > 0.02;
      u(doubleVision, 'ghost').value = ghost;
      u(doubleVision, 'wobble').value = k;
      u(doubleVision, 'clock').value = time;

      const ca = k * k * 0.0065;
      chromaPass.enabled = ca > 0.0002;
      chroma.offset.set(
        ca * (1 + Math.sin(time * 1.9) * 0.4),
        ca * 0.55 * Math.cos(time * 1.3)
      );

      dofPass.enabled = focus > 0.02;
      if (dofPass.enabled) {
        dof.cocMaterial.worldFocusDistance = params.focusDistance ?? 1.2;
        dof.cocMaterial.worldFocusRange = 0.9;
        dof.bokehScale = focus * 4.5;
      }
      syncRenderToScreen();
    },
    dispose: () => {
      composer.dispose();
    },
  };
}
