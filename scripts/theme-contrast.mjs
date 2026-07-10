/**
 * Reports which themes the canvas will auto-correct for legibility.
 *
 * The canvas paints the ball with `primary`, the paddles with `secondary`, and
 * the field with `base-100`. Every theme ships; at render time any ball or
 * paddle that fails the contrast bar below is repainted in `base-content` (see
 * src/render/legibility.js). This script is the offline view of that decision —
 * it doesn't gate anything, it just shows you which themes get corrected and
 * why, across both stock daisyUI themes and the custom ones in src/style.css.
 *
 *   node scripts/theme-contrast.mjs
 */
import fs from "node:fs";
import path from "node:path";

const THEME_DIR = "node_modules/daisyui/theme";
const STYLE = "src/style.css";
const THRESHOLD = 3.0; // must match CONTRAST_THRESHOLD in legibility.js

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
  const ok = decl[1].match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)?/);
  if (!ok) return null;
  let L = parseFloat(ok[1]);
  if (ok[2] === "%") L /= 100;
  else if (L > 1) L /= 100; // some authors write the L as a 0–1 fraction
  return oklchToLinearSrgb(L, parseFloat(ok[3]), parseFloat(ok[4] ?? "0"));
}

function evaluate(name, kind, css) {
  const field = parseColor(css, "base-100");
  const ball = parseColor(css, "primary");
  const paddle = parseColor(css, "secondary");
  if (!field || !ball || !paddle) return null;
  return {
    name,
    kind,
    ball: contrast(ball, field),
    paddle: contrast(paddle, field),
  };
}

const themes = [];

for (const file of fs.readdirSync(THEME_DIR).filter((f) => f.endsWith(".css"))) {
  const t = evaluate(path.basename(file, ".css"), "stock", fs.readFileSync(path.join(THEME_DIR, file), "utf8"));
  if (t) themes.push(t);
}

// Custom @plugin "daisyui/theme" blocks in the stylesheet, comments stripped.
const style = fs.readFileSync(STYLE, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const block = /@plugin\s+"daisyui\/theme"\s*\{([\s\S]*?)\}/g;
let m;
while ((m = block.exec(style))) {
  const nm = m[1].match(/name:\s*"([^"]+)"/);
  if (nm) {
    const t = evaluate(nm[1], "custom", m[1]);
    if (t) themes.push(t);
  }
}

const corrected = themes.filter((t) => t.ball < THRESHOLD || t.paddle < THRESHOLD);
const fine = themes.filter((t) => t.ball >= THRESHOLD && t.paddle >= THRESHOLD);

const fmt = (t) => {
  const flag = (v) => (v < THRESHOLD ? `${v.toFixed(2)}*` : v.toFixed(2)).padStart(7);
  return `  ${t.name.padEnd(14)} ${t.kind.padEnd(6)} ball${flag(t.ball)}   paddle${flag(t.paddle)}`;
};

console.log(`Contrast against each theme's own field (base-100). * = below ${THRESHOLD}:1, repainted in base-content.\n`);
console.log(`AUTO-CORRECTED (${corrected.length}):`);
corrected.sort((a, b) => Math.min(a.ball, a.paddle) - Math.min(b.ball, b.paddle)).forEach((t) => console.log(fmt(t)));
console.log(`\nLEGIBLE AS-IS (${fine.length}):`);
fine.sort((a, b) => a.name.localeCompare(b.name)).forEach((t) => console.log(fmt(t)));
console.log(`\n${themes.length} themes total.`);
