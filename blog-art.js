import { mount } from './assets/ascii/mount.js';
import * as earthrise from './assets/ascii/earthrise.js';
import * as tokyoRain from './assets/ascii/tokyo-rain.js';

// Original scenes and renderer by bas3line / ascii.rest (MIT).
// Resize, offscreen pausing, and reduced motion are handled by the renderer; each scene is built
// and run in a worker (src), off the main thread.
const blogCanvas = document.querySelector('[data-blog-art]');
if (blogCanvas) mount(blogCanvas, earthrise, { src: './assets/ascii/earthrise.js' });

const linksCanvas = document.querySelector('[data-links-art]');
if (linksCanvas) mount(linksCanvas, tokyoRain, { src: './assets/ascii/tokyo-rain.js' });
