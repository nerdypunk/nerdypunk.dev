import { mount } from './assets/ascii/mount.js';
import * as kyotoDusk from './assets/ascii/kyoto-dusk.js';

// Original scene and renderer by bas3line / ascii.rest (MIT).
// The renderer resizes to its container and pauses offscreen / for reduced motion.
const canvas = document.querySelector('[data-contact-art]');
if (canvas) mount(canvas, kyotoDusk);
