/** Logical playfield units. The canvas scales; the simulation never does. */
export const FIELD = { w: 960, h: 600 };

export const PADDLE = {
  w: 16,
  h: 96,
  inset: 32, // distance from the paddle's outer edge to the wall
  speed: 620, // units/second, shared ceiling for humans and CPU alike
};

export const BALL = {
  r: 8, // half-extent; the ball is a square, as it should be
  speed: 380, // serve speed, restored at the start of every point
  accel: 1.05, // multiplier per paddle hit
  maxSpeed: 1000,
  serveAngle: (22 * Math.PI) / 180,
};

/**
 * How steeply the ball can leave a paddle. The incoming angle is discarded
 * entirely: where you hit on the paddle is the only thing that sets direction.
 * That is what makes Pong a game of aim.
 */
export const MAX_BOUNCE = (55 * Math.PI) / 180;

/** Table-tennis rules: first to 11, but you must win by two. */
export const MATCH = { target: 11, margin: 2 };

/** Fixed simulation step. Physics never sees a variable delta. */
export const DT = 1 / 120;

/** Seconds between a point being scored and the next serve. */
export const SERVE_DELAY = 0.9;

/**
 * The CPU has exactly two knobs, plus how often it re-aims.
 *  - speedFactor: fraction of PADDLE.speed it may move at.
 *  - aimError:    how far off the ball's true y it aims, in paddle-heights.
 * It tracks the ball's current position; it does not predict the intercept.
 */
export const DIFFICULTY = {
  easy: { speedFactor: 0.6, aimError: 0.85, reactionInterval: 0.3 },
  normal: { speedFactor: 0.82, aimError: 0.45, reactionInterval: 0.16 },
  hard: { speedFactor: 1.0, aimError: 0.16, reactionInterval: 0.07 },
};

export const MODES = {
  "1p": "1 Player",
  "2p": "2 Players",
  "0p": "CPU vs CPU",
};

/**
 * Every theme is selectable; the canvas guarantees legibility at render time
 * (see src/render/legibility.js), so there is no contrast gate on this list.
 * Order: the two signature cabinets, then the custom themes, then every stock
 * daisyUI theme alphabetically. Keep in sync with the `themes:` list and the
 * custom @plugin blocks in src/style.css.
 */
export const THEMES = [
  // Signature
  "arcade",
  "phosphor",
  // Custom
  "chill",
  "validmonkey",
  "mysteryhouse",
  "garmentcoffee",
  "icehouse",
  "demonflip",
  "adcrr",
  // Stock daisyUI
  "abyss",
  "acid",
  "aqua",
  "autumn",
  "black",
  "bumblebee",
  "business",
  "caramellatte",
  "cmyk",
  "coffee",
  "corporate",
  "cupcake",
  "cyberpunk",
  "dark",
  "dim",
  "dracula",
  "emerald",
  "fantasy",
  "forest",
  "garden",
  "halloween",
  "lemonade",
  "light",
  "lofi",
  "luxury",
  "night",
  "nord",
  "pastel",
  "retro",
  "silk",
  "sunset",
  "synthwave",
  "valentine",
  "winter",
  "wireframe",
];

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
