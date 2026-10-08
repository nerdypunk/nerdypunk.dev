import { mount } from './assets/ascii/mount.js';
import * as earthrise from './assets/ascii/earthrise.js';

// Original scene and renderer by bas3line / ascii.rest (MIT).
// Resize, offscreen pausing, and reduced motion are handled by the renderer.
document.querySelectorAll('[data-blog-art], [data-links-art]').forEach((canvas) => {
  mount(canvas, earthrise);
});
