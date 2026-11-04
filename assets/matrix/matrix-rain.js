// Adapted from js/regl/main.js in Rezmason's Matrix digital rain (https://github.com/Rezmason/matrix,
// MIT, see LICENSE) to run as a page background: only the rain, bloom and palette passes; no
// fullscreen-on-double-click, no window.onresize takeover; the canvas follows its own box; the
// screen is only redrawn on frames that were actually rendered; and it runs on its own clock.
import makeConfig from "./js/config.js";
import makeRain from "./js/regl/rainPass.js";
import makeBloomPass from "./js/regl/bloomPass.js";
import makePalettePass from "./js/regl/palettePass.js";
import getLKG from "./js/regl/lkgHelper.js";
import { makeFullScreenQuad, makePipeline } from "./js/regl/utils.js";

const loadScript = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = new URL(src, import.meta.url).href;
		document.head.appendChild(tag);
	});

// Resolves once the first frame is on screen.
export default async (canvas, { version, ...overrides } = {}) => {
	await Promise.all([loadScript("lib/regl.min.js"), loadScript("lib/gl-matrix.js")]);
	const config = { ...makeConfig({ version }), ...overrides };

	const resize = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * config.resolution);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * config.resolution);
	};
	new ResizeObserver(resize).observe(canvas);
	resize();

	const extensions = ["OES_texture_half_float", "OES_texture_half_float_linear"];
	// These extensions are also needed, but Safari misreports that they are missing
	const optionalExtensions = ["EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "OES_standard_derivatives"];
	const regl = createREGL({ canvas, pixelRatio: 1, extensions, optionalExtensions });

	const lkg = await getLKG(false, true);
	// Every pass reads time and tick from this scope's context, so this clock drives the animation.
	const clock = { time: 0, tick: 0 };
	const fullScreenQuad = makeFullScreenQuad(regl, {}, { time: () => clock.time, tick: () => clock.tick });
	const context = { regl, config, lkg };
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, makePalettePass]);
	const drawToScreen = regl({ uniforms: { tex: pipeline[pipeline.length - 1].outputs.primary } });
	await Promise.all(pipeline.map((step) => step.ready));

	const targetFrameTimeMilliseconds = 1000 / config.fps;
	const size = { width: 0, height: 0 };
	// Render on every Nth display refresh, the N that keeps closest to config.fps without going
	// under it: every refresh at 60/75Hz, every 2nd at 120/144Hz. Even spacing, so no judder.
	const intervals = [];
	let previousFrame = NaN;
	let refreshCount = 0;
	let lastRendered = NaN;
	let firstFrame;
	const shown = new Promise((resolve) => (firstFrame = resolve));

	regl.frame(({ viewportWidth, viewportHeight }) => {
		const now = regl.now() * 1000;
		if (!isNaN(previousFrame)) {
			intervals.push(now - previousFrame);
			if (intervals.length > 30) intervals.shift();
		}
		previousFrame = now;
		const refresh = [...intervals].sort((a, b) => a - b)[intervals.length >> 1] || targetFrameTimeMilliseconds;
		const everyNth = Math.max(1, Math.floor(targetFrameTimeMilliseconds / refresh + 0.05));
		const resized = size.width !== viewportWidth || size.height !== viewportHeight;
		// A skipped refresh leaves the last frame on screen, so the page isn't recomposited.
		if (refreshCount++ % everyNth !== 0 && !resized) return;

		if (resized) {
			size.width = viewportWidth;
			size.height = viewportHeight;
			for (const step of pipeline) step.setSize(viewportWidth, viewportHeight);
		}
		clock.time += Math.min(isNaN(lastRendered) ? 0 : now - lastRendered, 100) / 1000;
		clock.tick += 1;
		lastRendered = now;
		fullScreenQuad(() => {
			for (const step of pipeline) step.execute(true);
			drawToScreen();
		});
		firstFrame();
	});

	return shown;
};
