/**
 * The canvas takes its colors from whichever daisyUI theme is active, so the
 * field is themed by exactly the same mechanism as the buttons around it.
 *
 *   ball   -> primary
 *   paddles-> secondary
 *   line   -> base-content
 *   field  -> base-100
 */
const FALLBACK = {
  field: "#000000",
  line: "#ffffff",
  ball: "#ffffff",
  paddle: "#ffffff",
};

const VARS = {
  field: "--color-base-100",
  line: "--color-base-content",
  ball: "--color-primary",
  paddle: "--color-secondary",
};

/**
 * daisyUI emits oklch(). Every browser that ships `oklch` in CSS also accepts
 * it as a canvas fillStyle, but a fillStyle the canvas cannot parse is silently
 * ignored — which would paint the ball in whatever color was set last. So we
 * check, once, and fall back to legible monochrome if the check fails.
 */
function usable(ctx, color) {
  ctx.fillStyle = "#123456";
  ctx.fillStyle = color;
  return ctx.fillStyle !== "#123456";
}

/**
 * Relative luminance of any CSS color, by asking a 1x1 canvas to paint it and
 * reading the pixel back. The canvas already knows how to parse oklch(); we do
 * not need to.
 */
const probe = document.createElement("canvas");
probe.width = probe.height = 1;
const probeCtx = probe.getContext("2d", { willReadFrequently: true });

export function luminance(color) {
  probeCtx.fillStyle = "#000000";
  probeCtx.fillStyle = color;
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data;
  const linear = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function readTheme(ctx) {
  const style = getComputedStyle(document.documentElement);
  const theme = {};
  for (const [key, variable] of Object.entries(VARS)) {
    const value = style.getPropertyValue(variable).trim();
    theme[key] = value && usable(ctx, value) ? value : FALLBACK[key];
  }
  // A CRT overlay tuned for a black tube turns a white field into gray sludge.
  // Light fields get a far gentler scanline and vignette.
  theme.light = luminance(theme.field) > 0.5;
  return theme;
}

export function applyTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
}
