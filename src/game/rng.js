/**
 * mulberry32. Seeded so that a CPU-vs-CPU match replays identically, which is
 * what lets the soak test assert anything at all about the simulation.
 */
export function createRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform in [-1, 1). */
export const bipolar = (rng) => rng() * 2 - 1;
