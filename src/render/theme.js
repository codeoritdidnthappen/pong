import { relativeLuminance, correctForField } from "./legibility.js";

/**
 * The canvas takes its colors from whichever daisyUI theme is active, so the
 * field is themed by exactly the same mechanism as the buttons around it.
 *
 *   ball   -> primary
 *   paddles-> secondary
 *   line   -> base-content
 *   field  -> base-100
 *
 * Every theme ships, including ones whose primary/secondary wash out against
 * their own field. correctForField (see legibility.js) repaints the ball or
 * paddles in base-content on those, so the game is playable on all of them.
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
 * A 1x1 canvas that parses any CSS color for us — including oklch() — so the
 * luminance math doesn't need its own colour-space conversion.
 */
const probe = document.createElement("canvas");
probe.width = probe.height = 1;
const probeCtx = probe.getContext("2d", { willReadFrequently: true });

function probeRgb(color) {
  probeCtx.fillStyle = "#000000";
  probeCtx.fillStyle = color;
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

export function luminance(color) {
  return relativeLuminance(...probeRgb(color));
}

export function readTheme(ctx) {
  const style = getComputedStyle(document.documentElement);
  const raw = {};
  for (const [key, variable] of Object.entries(VARS)) {
    const value = style.getPropertyValue(variable).trim();
    raw[key] = value && usable(ctx, value) ? value : FALLBACK[key];
  }

  const fieldLum = luminance(raw.field);

  // Guarantee a visible ball and paddles: substitute base-content for either
  // one when the theme's primary/secondary can't be seen on the field.
  const fixed = correctForField({
    fieldLum,
    ball: { color: raw.ball, lum: luminance(raw.ball) },
    paddle: { color: raw.paddle, lum: luminance(raw.paddle) },
    fallback: { color: raw.line, lum: luminance(raw.line) },
  });

  return {
    field: raw.field,
    line: raw.line,
    ball: fixed.ball,
    paddle: fixed.paddle,
    corrected: fixed.corrected,
    // A CRT overlay tuned for a black tube turns a white field into gray
    // sludge, so light fields get a far gentler scanline and vignette.
    light: fieldLum > 0.5,
  };
}

export function applyTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
}
