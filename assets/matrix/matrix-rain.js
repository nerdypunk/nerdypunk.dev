// Adapted from js/regl/main.js in Rezmason's Matrix digital rain (https://github.com/Rezmason/matrix,
// MIT, see LICENSE) to run as a page background: only the rain, bloom and palette passes; no
// fullscreen-on-double-click, no window.onresize takeover; the canvas follows its own box; and the
// screen is only redrawn on frames that were actually rendered.
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
	const fullScreenQuad = makeFullScreenQuad(regl);
	const context = { regl, config, lkg };
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, makePalettePass]);
	const drawToScreen = regl({ uniforms: { tex: pipeline[pipeline.length - 1].outputs.primary } });
	await Promise.all(pipeline.map((step) => step.ready));

	const targetFrameTimeMilliseconds = 1000 / config.fps;
	const size = { width: 0, height: 0 };
	let last = NaN;
	let firstFrame;
	const shown = new Promise((resolve) => (firstFrame = resolve));

	regl.frame(({ viewportWidth, viewportHeight }) => {
		const now = regl.now() * 1000;
		if (isNaN(last)) last = now - targetFrameTimeMilliseconds;
		const resized = size.width !== viewportWidth || size.height !== viewportHeight;
		// At 60fps or more, draw every display frame (as upstream does): a time gate would skip
		// refreshes unevenly on 75/144Hz screens and judder. Below that, leaving a frame undrawn
		// keeps the last one on screen, so the page isn't recomposited.
		const throttled = config.fps < 60 && now - last < targetFrameTimeMilliseconds;
		if (throttled && !resized) return;
		while (now - targetFrameTimeMilliseconds > last) last += targetFrameTimeMilliseconds;

		if (resized) {
			size.width = viewportWidth;
			size.height = viewportHeight;
			for (const step of pipeline) step.setSize(viewportWidth, viewportHeight);
		}
		fullScreenQuad(() => {
			for (const step of pipeline) step.execute(true);
			drawToScreen();
		});
		firstFrame();
	});

	return shown;
};
