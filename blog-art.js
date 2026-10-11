import { mount } from './assets/ascii/mount.js';
import * as earthrise from './assets/ascii/earthrise.js';
import * as tokyoRain from './assets/ascii/tokyo-rain.js';

// Original scenes and renderer by bas3line / ascii.rest (MIT).
// Resize, offscreen pausing, and reduced motion are handled by the renderer.
const blogCanvas = document.querySelector('[data-blog-art]');
if (blogCanvas) mount(blogCanvas, earthrise);

const linksCanvas = document.querySelector('[data-links-art]');
if (linksCanvas) mount(linksCanvas, tokyoRain);
