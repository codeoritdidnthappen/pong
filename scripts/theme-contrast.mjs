/**
 * Regenerates the daisyUI theme allowlist in src/style.css.
 *
 * The canvas paints the ball with `primary`, the paddles with `secondary`, the
 * center line with `base-content`, and the field with `base-100`. A theme whose
 * ball or paddles wash out against its own field is unplayable, so it does not
 * ship. This reads daisyUI's own theme definitions and applies the thresholds
 * below, rather than trusting anybody's eye.
 *
 *   node scripts/theme-contrast.mjs
 */
import fs from "node:fs";
import path from "node:path";

const THEME_DIR = "node_modules/daisyui/theme";

const MIN_BALL = 3.0; // WCAG AA for large graphical objects
const MIN_PADDLE = 3.0;
const MIN_LINE = 2.0; // the center line is decorative, so it may be subtler

/** oklch -> sRGB gamma-encoded 0..1, clamped to gamut. */
function oklchToLinearSrgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function contrast(c1, c2) {
  const [hi, lo] = [luminance(c1), luminance(c2)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

function parseColor(css, name) {
  const decl = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!decl) return null;
  const ok = decl[1].match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)?/);
  if (!ok) return null;
  return oklchToLinearSrgb(
    parseFloat(ok[1]) / 100,
    parseFloat(ok[2]),
    parseFloat(ok[3] ?? "0"),
  );
}

const results = [];
for (const file of fs.readdirSync(THEME_DIR).filter((f) => f.endsWith(".css"))) {
  const theme = path.basename(file, ".css");
  const css = fs.readFileSync(path.join(THEME_DIR, file), "utf8");

  const field = parseColor(css, "base-100");
  const ball = parseColor(css, "primary");
  const paddle = parseColor(css, "secondary");
  const line = parseColor(css, "base-content");
  if (!field || !ball || !paddle || !line) continue;

  results.push({
    theme,
    ball: contrast(ball, field),
    paddle: contrast(paddle, field),
    line: contrast(line, field),
  });
}

results.sort((a, b) => b.ball - a.ball);

const passes = (r) =>
  r.ball >= MIN_BALL && r.paddle >= MIN_PADDLE && r.line >= MIN_LINE;

const fmt = (r) =>
  `${r.theme.padEnd(14)} ball ${r.ball.toFixed(2).padStart(6)}   ` +
  `paddle ${r.paddle.toFixed(2).padStart(6)}   line ${r.line.toFixed(2).padStart(6)}`;

const kept = results.filter(passes);
const dropped = results.filter((r) => !passes(r));

console.log(`KEEP (${kept.length})`);
kept.forEach((r) => console.log("  " + fmt(r)));
console.log(`\nDROP (${dropped.length})`);
dropped.forEach((r) => console.log("  " + fmt(r)));

console.log(
  "\nPaste into src/style.css:\n\n  themes: " +
    kept
      .map((r) => r.theme)
      .sort()
      .join(", ") +
    ";",
);
