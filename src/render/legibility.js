/**
 * Keeps the ball and paddles visible on every theme.
 *
 * The canvas paints the ball with the theme's `primary` and the paddles with
 * `secondary`, but a fair number of themes pick a primary or secondary that
 * washes out against their own `base-100` field (a pure-black paddle on a dark
 * field, say). Rather than exclude those themes, we correct at render time:
 * any element that fails the contrast bar is repainted in `base-content`, which
 * is designed to read against the field and does so on every theme measured.
 *
 * These functions are pure so the decision can be tested without a canvas.
 */

/** WCAG AA for large graphical objects. */
export const CONTRAST_THRESHOLD = 3.0;

/** Relative luminance of an sRGB colour given as three 0–255 channels. */
export function relativeLuminance(r, g, b) {
  const linear = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two relative luminances. */
export function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The fallback colour to use when the primary fallback (base-content) somehow
 * also fails — pick pure black or white, whichever contrasts more with the
 * field. In practice base-content always clears the bar, so this is a belt.
 */
function hardFallback(fieldLum) {
  return contrastRatio(0, fieldLum) >= contrastRatio(1, fieldLum)
    ? "#000000"
    : "#ffffff";
}

/**
 * Given the field's luminance and the intended ball/paddle colours (each a
 * `{ color, lum }` pair), return the colours the canvas should actually paint,
 * substituting the fallback for whichever element fails the threshold.
 *
 * Returns `{ ball, paddle, corrected: { ball, paddle } }` where `corrected`
 * flags which elements were substituted — useful for tests and debugging.
 */
export function correctForField(
  { fieldLum, ball, paddle, fallback },
  threshold = CONTRAST_THRESHOLD,
) {
  const legibleFallback =
    contrastRatio(fallback.lum, fieldLum) >= threshold
      ? fallback.color
      : hardFallback(fieldLum);

  const resolve = (element) =>
    contrastRatio(element.lum, fieldLum) >= threshold
      ? element.color
      : legibleFallback;

  return {
    ball: resolve(ball),
    paddle: resolve(paddle),
    corrected: {
      ball: contrastRatio(ball.lum, fieldLum) < threshold,
      paddle: contrastRatio(paddle.lum, fieldLum) < threshold,
    },
  };
}
