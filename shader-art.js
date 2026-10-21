// WebGPU effects powered by shaders (https://github.com/shader-effects-inc/shaders), proprietary:
// Shader Effects License Agreement v1.5, which ships in the npm package. It is loaded from
// jsDelivr rather than vendored because the license forbids redistributing its build artifacts.
// Everything here is progressive: without WebGPU, with reduced motion, or on phones (same
// test as effects.js uses to drop the code rain), the page keeps its original CSS
// background, logo and capsule image untouched and never downloads the shader bundle.
const SHADERS_URL = 'https://cdn.jsdelivr.net/npm/shaders@3.2.473/dist/js/bundle.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobilePerformanceMode = window.matchMedia(
  '(max-width: 760px), (max-width: 1024px) and (hover: none) and (pointer: coarse)'
).matches;

// Frame budget. The library renders on every display frame by default, which fights the
// trailer video for the GPU; these effects read fine at a lower, film-like rate.
const SHADER_FPS = 15;

const NEON = { violet: '#663af3', pink: '#ff3bd4', cyan: '#62e6ff' };

// Ambient neon aurora behind the desktop. It is soft enough to render at low resolution.
const backgroundPreset = {
  components: [
    {
      type: 'Aurora', id: 'bg-aurora',
      props: {
        colorA: NEON.violet, colorB: NEON.pink, colorC: NEON.cyan,
        intensity: 95, curtainCount: 3, speed: 2, waviness: 90,
        rayDensity: 45, height: 150, balance: 45, center: { x: 0.5, y: 0 }, seed: 17,
      },
    },
  ],
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

// The library sizes its raster from the canvas's parent, so the backdrop lives in a frame
// laid out at a fraction of the viewport and scaled up in CSS (see .shader-backdrop):
// far fewer pixels to shade for the same coverage.
const mountBackground = async (createShader, options) => {
  const frame = document.createElement('div');
  frame.className = 'shader-backdrop';
  frame.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  frame.appendChild(canvas);
  document.body.prepend(frame);

  try {
    const shader = await createShader(canvas, backgroundPreset, {
      ...options,
      onReady: () => frame.classList.add('is-ready'),
      onError: () => frame.remove(),
    });
    // Its first measurement uses the transformed (full-size) box; pin it to the layout size.
    const fit = () => shader.resize(frame.offsetWidth, frame.offsetHeight);
    fit();
    window.addEventListener('resize', fit);
    throttle(shader);
  } catch {
    frame.remove();
  }
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

  mountBackground(createShader, options);

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

// Let the boot loader and first paint finish before pulling in the GPU bundle.
const idle = (cb) => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 300));
if (document.readyState === 'complete') idle(start);
else window.addEventListener('load', () => idle(start), { once: true });
