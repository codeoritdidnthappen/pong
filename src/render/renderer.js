import { FIELD, PADDLE, BALL } from "../game/constants.js";
import {
  shakeOffset,
  createScanlinePattern,
  createVignette,
} from "./effects.js";

/**
 * Seven-segment digits, drawn as overlapping rectangles in a 1 x 2 unit box.
 * A web font would be one more thing to load and one more thing to look wrong;
 * these are always crisp and always period-correct.
 *
 *      a
 *    f   b
 *      g
 *    e   c
 *      d
 */
const TH = 0.2; // segment thickness, in units of digit width

const SEGMENTS = {
  a: [0, 0, 1, TH],
  b: [1 - TH, 0, TH, 1],
  c: [1 - TH, 1, TH, 1],
  d: [0, 2 - TH, 1, TH],
  e: [0, 1, TH, 1],
  f: [0, 0, TH, 1],
  g: [0, 1 - TH / 2, 1, TH],
};

const DIGITS = {
  0: "abcdef",
  1: "bc",
  2: "abged",
  3: "abcdg",
  4: "fgbc",
  5: "afgcd",
  6: "afgecd",
  7: "abc",
  8: "abcdefg",
  9: "abcdfg",
};

function drawDigit(ctx, digit, x, y, size) {
  for (const seg of DIGITS[digit] ?? "") {
    const [sx, sy, sw, sh] = SEGMENTS[seg];
    ctx.fillRect(x + sx * size, y + sy * size, sw * size, sh * size);
  }
}

/** Right-aligned for the left player, left-aligned for the right player. */
function drawScore(ctx, value, centerX, y, size) {
  const chars = String(value);
  const gap = size * 0.35;
  const totalWidth = chars.length * size + (chars.length - 1) * gap;
  let x = centerX - totalWidth / 2;
  for (const char of chars) {
    drawDigit(ctx, char, x, y, size);
    x += size + gap;
  }
}

function drawCenterLine(ctx, theme) {
  const dashHeight = 22;
  const dashGap = 18;
  const width = 6;
  ctx.fillStyle = theme.line;
  ctx.globalAlpha = 0.45;
  for (let y = dashGap / 2; y < FIELD.h; y += dashHeight + dashGap) {
    ctx.fillRect(
      FIELD.w / 2 - width / 2,
      y,
      width,
      Math.min(dashHeight, FIELD.h - y),
    );
  }
  ctx.globalAlpha = 1;
}

/**
 * Cached per-canvas overlays. Both depend only on device pixel dimensions, so
 * they are rebuilt on resize and never per frame.
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let scanlines = null;
  let vignette = null;
  let scale = 1;
  let dpr = 1;
  let light = false;

  /** The CRT overlays depend on device size and on whether the field is light. */
  function rebuildOverlays() {
    scale = canvas.width / FIELD.w;
    scanlines = createScanlinePattern(ctx, dpr, light);
    vignette = createVignette(ctx, canvas.width, canvas.height, light);
  }

  function resize(nextDpr) {
    dpr = nextDpr;
    rebuildOverlays();
  }

  function setTheme(theme) {
    if (theme.light === light && scanlines) return;
    light = theme.light;
    rebuildOverlays();
  }

  function render(game, effects, settings, theme, rng) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Field. Painted in device space so the scanlines and vignette are not
    // stretched by the field-unit transform.
    ctx.fillStyle = theme.field;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const shake = settings.effects.shake
      ? shakeOffset(effects, rng)
      : { x: 0, y: 0 };

    ctx.setTransform(scale, 0, 0, scale, shake.x * scale, shake.y * scale);

    drawCenterLine(ctx, theme);

    const scoreSize = 46;
    ctx.fillStyle = theme.line;
    ctx.globalAlpha = 0.75;
    drawScore(ctx, game.score.left, FIELD.w / 2 - 90, 40, scoreSize);
    drawScore(ctx, game.score.right, FIELD.w / 2 + 90, 40, scoreSize);
    ctx.globalAlpha = 1;

    // Phosphor persistence: older ball positions, fading out behind it.
    if (settings.effects.trail && effects.trail.length > 1) {
      ctx.fillStyle = theme.ball;
      for (let i = 0; i < effects.trail.length - 1; i++) {
        const point = effects.trail[i];
        ctx.globalAlpha = (i / effects.trail.length) * 0.35;
        ctx.fillRect(
          point.x - BALL.r,
          point.y - BALL.r,
          BALL.r * 2,
          BALL.r * 2,
        );
      }
      ctx.globalAlpha = 1;
    }

    for (const paddle of game.paddles) {
      const flashing = settings.effects.flash && effects.flash[paddle.side] > 0;
      ctx.fillStyle = flashing ? theme.ball : theme.paddle;
      ctx.fillRect(paddle.x, paddle.y, PADDLE.w, PADDLE.h);
    }

    // The ball is hidden during the serve pause, so the pause reads as a pause.
    if (game.phase !== "serving") {
      ctx.fillStyle = theme.ball;
      ctx.fillRect(
        game.ball.x - BALL.r,
        game.ball.y - BALL.r,
        BALL.r * 2,
        BALL.r * 2,
      );
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (settings.effects.scanlines) {
      ctx.fillStyle = scanlines;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  return { ctx, resize, setTheme, render };
}
