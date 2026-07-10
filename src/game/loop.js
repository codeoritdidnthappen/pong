import { DT } from "./constants.js";

/** Never simulate more than this much wall time in one frame. */
const MAX_FRAME = 0.25;

/**
 * A fixed-timestep accumulator. The simulation only ever advances in DT-sized
 * steps, so a dropped frame or a backgrounded tab cannot teleport the ball
 * through a paddle, and a CPU-vs-CPU match is reproducible from its seed.
 *
 * Rendering happens once per animation frame regardless.
 */
export function createLoop(step, render) {
  let running = false;
  let last = 0;
  let accumulator = 0;
  let frame = 0;

  function tick(now) {
    if (!running) return;
    frame = requestAnimationFrame(tick);

    // Clamping here is what prevents the spiral of death: after a long stall we
    // drop the missed time rather than trying to catch up on it.
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += elapsed;

    while (accumulator >= DT) {
      step(DT);
      accumulator -= DT;
    }

    render();
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      accumulator = 0;
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
    get running() {
      return running;
    },
  };
}
