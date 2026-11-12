// Runs an ASCII scene off the page's main thread: building a scene takes 100-250ms and each frame
// a few more, which used to stall the boot loader and scrolling. mount.js asks for one frame at a
// time and draws the text (and colours) this sends back.
let ready;
let frame;
let color;

self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    ready = import(data.src).then((piece) => {
      frame = piece.default(data.options);
      color = data.cells ? new Uint8Array(data.cells) : undefined;
    });
    ready.catch(() => self.postMessage({ type: 'error' }));
    return;
  }
  try {
    await ready;
  } catch {
    return;
  }
  const text = frame(data.t, { paper: data.paper, color });
  const colors = color?.slice();
  self.postMessage({ type: 'frame', text, color: colors }, colors ? [colors.buffer] : []);
};
