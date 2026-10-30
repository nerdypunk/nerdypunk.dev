// Logo and capsule effects: WebGPU, powered by shaders (https://github.com/shader-effects-inc/shaders),
// proprietary: Shader Effects License Agreement v1.5, which ships in the npm package. It is loaded
// from jsDelivr rather than vendored because the license forbids redistributing its build artifacts.
// Background: the 3D ("volumetric") version of Rezmason's Matrix digital rain, WebGL, vendored
// in assets/matrix (MIT).
// Everything here is progressive: with reduced motion or on phones (same test as effects.js uses
// to drop the code rain) nothing loads, and without WebGL / WebGPU the page keeps its original
// CSS background, logo and capsule image untouched.
const SHADERS_URL = 'https://cdn.jsdelivr.net/npm/shaders@3.2.473/dist/js/bundle.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobilePerformanceMode = window.matchMedia(
  '(max-width: 760px), (max-width: 1024px) and (hover: none) and (pointer: coarse)'
).matches;

// Frame budget. The library renders on every display frame by default, which fights the
// trailer video for the GPU; these effects read fine at a lower, film-like rate.
const SHADER_FPS = 15;

// Matrix's 3D preset in the site's sober palette: glyphs fade from navy through steel blue to a
// pale cyan, on the page's navy. Full device resolution, 60fps for smooth motion, and calmer
// than the preset: slower fall, a slow drift towards the camera, and glyphs that rarely change.
const rgb = (...values) => ({ space: 'rgb', values });
const MATRIX = {
  version: '3d',
  resolution: 1,
  fps: 60,
  fallSpeed: 0.14, // preset 0.5
  forwardSpeed: 0.04, // preset 0.25: how fast glyphs approach the camera
  cycleSpeed: 0.005, // preset 0.03; applied per rendered frame, so this is ~0.3 changes/s at 60fps
  backgroundColor: rgb(0.008, 0.015, 0.035),
  palette: [
    { color: rgb(0, 0, 0), at: 0 },
    { color: rgb(0.03, 0.07, 0.14), at: 0.2 },
    { color: rgb(0.25, 0.45, 0.62), at: 0.7 },
    { color: rgb(0.45, 0.68, 0.82), at: 0.8 },
  ],
  cursorColor: rgb(0.7, 0.86, 0.95),
  cursorIntensity: 1.5,
};

// Logo with a liquid ripple under the cursor and the occasional glitch burst.
const logoPreset = (url) => ({
  components: [
    {
      type: 'Glitch', id: 'logo-glitch',
      props: { intensity: 0.12, speed: 0.6, rgbShift: 4, blockDensity: 14, colorBarIntensity: 0.35, mirrorAmount: 0.1, scanlineIntensity: 0.15 },
      children: [
        {
          type: 'CursorRipples', id: 'logo-ripples',
          props: { intensity: 9, decay: 7, radius: 0.45, chromaticSplit: 2.2, edges: 'transparent' },
          children: [{ type: 'ImageTexture', id: 'logo-image', props: { url, objectFit: 'contain' } }],
        },
      ],
    },
  ],
});

// Steam capsule playing on a worn VHS tape inside a CRT; hovering jams the signal.
const capsulePreset = (url) => ({
  components: [
    {
      type: 'CRTScreen', id: 'capsule-crt',
      props: { pixelSize: 96, colorShift: 1.4, scanlineIntensity: 0.35, scanlineFrequency: 320, brightness: 1.15, contrast: 1.08, vignetteIntensity: 0.7, vignetteRadius: 0.35 },
      children: [
        {
          type: 'Glitch', id: 'capsule-glitch',
          props: { intensity: 0, speed: 1.4, rgbShift: 9, blockDensity: 18, colorBarIntensity: 0.5, mirrorAmount: 0.3, scanlineIntensity: 0.3 },
          children: [
            {
              type: 'VHS', id: 'capsule-vhs',
              props: { wobble: 0.6, scanlineNoise: 0.45, smear: 0.35, speed: 0.8 },
              children: [{ type: 'ImageTexture', id: 'capsule-image', props: { url, objectFit: 'cover' } }],
            },
          ],
        },
      ],
    },
  ],
});

// One clock for every throttled shader, so they all land in the same display frame and the
// compositor repaints the page (glass blurs included) SHADER_FPS times a second, not once
// per shader per tick.
const clockTicks = new Set();
let clockTimer = 0;
const startClock = () => {
  clockTimer ||= setInterval(() => clockTicks.forEach((tick) => tick()), 1000 / SHADER_FPS);
};

// Caps a shader's frame rate from outside: resume() starts the library's rAF loop, and
// pausing on our own next rAF (which runs after theirs) lets exactly one frame through.
// Rendering stops entirely while `target` is offscreen or the tab is hidden; boost(true)
// hands control back to the library for full-rate rendering during interaction.
const throttle = (shader, target) => {
  let visible = !target;
  let boosted = false;

  const tick = () => {
    shader.resume();
    requestAnimationFrame(() => { if (!boosted) shader.pause(); });
  };
  const sync = () => {
    clockTicks.delete(tick);
    if (!visible || document.hidden) shader.pause();
    else if (boosted) shader.resume();
    else clockTicks.add(tick);
  };
  startClock();

  if (target) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { rootMargin: '100px 0px' }).observe(target);
  }
  document.addEventListener('visibilitychange', sync);
  sync();

  return { boost: (on) => { boosted = on; sync(); } };
};

const boostWhileHovered = (control, trigger) => {
  trigger.addEventListener('pointerenter', () => control.boost(true));
  trigger.addEventListener('pointerleave', () => control.boost(false));
};

const waitForImage = (img) =>
  img.complete && img.naturalWidth ? Promise.resolve() : new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  });

// Lays a canvas over an <img>, keeping the image as layout + fallback until the shader draws.
const overlayImage = async (createShader, img, presetFor, options) => {
  await waitForImage(img);
  if (!img.naturalWidth) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'shader-overlay';
  canvas.setAttribute('aria-hidden', 'true');
  img.after(canvas);

  // Track the image's box so the canvas follows every responsive layout change.
  const syncBox = () => {
    Object.assign(canvas.style, {
      left: `${img.offsetLeft}px`,
      top: `${img.offsetTop}px`,
      width: `${img.offsetWidth}px`,
      height: `${img.offsetHeight}px`,
    });
  };
  syncBox();
  const observer = new ResizeObserver(syncBox);
  observer.observe(img);
  observer.observe(img.offsetParent ?? document.body);

  const fallBack = () => {
    observer.disconnect();
    img.classList.remove('is-shaded');
    canvas.remove();
  };

  try {
    return await createShader(canvas, presetFor(img.currentSrc || img.src), {
      ...options,
      onReady: () => img.classList.add('is-shaded'),
      onError: fallBack,
    });
  } catch {
    fallBack();
    return null;
  }
};

const mountBackground = async () => {
  const canvas = document.createElement('canvas');
  canvas.className = 'shader-backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  try {
    const { default: runMatrix } = await import('./assets/matrix/matrix-rain.js');
    await runMatrix(canvas, MATRIX);
  } catch {
    canvas.remove(); // no WebGL, or the files failed to load
    return;
  }
  // Fade in from the first rendered frame, and let it replace the CSS code rain.
  canvas.classList.add('is-ready');
  document.body.classList.add('has-matrix');
};

// Short burst of tape damage that eases back to a clean signal.
const glitchOnHover = (shader, trigger, id) => {
  let frame = 0;
  let level = 0;
  const settle = () => {
    level = Math.max(0, level - 0.025);
    shader.update(id, { intensity: level });
    frame = level > 0 ? requestAnimationFrame(settle) : 0;
  };
  const jam = () => {
    level = 0.75;
    shader.update(id, { intensity: level });
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(settle);
  };
  trigger.addEventListener('pointerenter', jam);
  trigger.addEventListener('focus', jam);
};

const start = async () => {
  if (reducedMotion || mobilePerformanceMode || !('gpu' in navigator)) return;

  let lib;
  try {
    lib = await import(SHADERS_URL);
  } catch {
    return;
  }
  const { createShader, createSharedDevice, isWebGPUSupported } = lib;
  if (!isWebGPUSupported()) return;

  // One device for every effect on the page: pipelines compile once and resources pool.
  const gpu = (await createSharedDevice()) ?? undefined;
  const options = { gpu, disableTelemetry: true };

  const logo = document.querySelector('.hero-panel__logo');
  if (logo) {
    overlayImage(createShader, logo, logoPreset, options).then((shader) => {
      if (shader) boostWhileHovered(throttle(shader, logo), logo.parentElement);
    });
  }

  const capsule = document.querySelector('.steam-card__capsule');
  if (capsule) {
    const shader = await overlayImage(createShader, capsule, capsulePreset, options);
    if (shader) {
      const trigger = capsule.closest('.steam-card__content') ?? capsule;
      boostWhileHovered(throttle(shader, capsule), trigger);
      glitchOnHover(shader, trigger, 'capsule-glitch');
    }
  }
};

const backgroundShown = reducedMotion || mobilePerformanceMode ? Promise.resolve() : mountBackground();

// Let the boot loader, first paint and the rain's first frame land before pulling in the GPU
// bundle: its shader compiles otherwise hold the rain back by seconds.
const idle = (cb) => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 300));
const loaded = document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
Promise.all([loaded, backgroundShown]).then(() => idle(start));
