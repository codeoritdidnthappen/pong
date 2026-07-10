import { BALL } from "../game/constants.js";

const SHAKE_DURATION = 0.32;
const SHAKE_MAGNITUDE = 11;
const FLASH_DURATION = 0.09;
const TRAIL_LENGTH = 9;

/**
 * Everything here is period-appropriate: a cabinet knock on a goal, phosphor
 * persistence behind the ball, an inverted paddle on contact, and scanlines.
 * No particles. Each is independently switchable from the menu.
 */
export function createEffects() {
  return {
    shake: 0,
    flash: { left: 0, right: 0 },
    trail: [],
  };
}

export function reactToEvents(effects, events, settings) {
  for (const event of events) {
    if (event.type === "paddle" && settings.effects.flash) {
      effects.flash[event.side] = FLASH_DURATION;
    }
    if (event.type === "score" && settings.effects.shake) {
      effects.shake = SHAKE_DURATION;
    }
  }
}

/** Called once per fixed simulation step, so the trail spacing is stable. */
export function recordTrail(effects, ball, settings) {
  if (!settings.effects.trail) {
    if (effects.trail.length) effects.trail.length = 0;
    return;
  }
  effects.trail.push({ x: ball.x, y: ball.y });
  if (effects.trail.length > TRAIL_LENGTH) effects.trail.shift();
}

export function updateEffects(effects, dt) {
  effects.shake = Math.max(0, effects.shake - dt);
  effects.flash.left = Math.max(0, effects.flash.left - dt);
  effects.flash.right = Math.max(0, effects.flash.right - dt);
}

export function clearTrail(effects) {
  effects.trail.length = 0;
}

/** Decaying random offset, in field units. */
export function shakeOffset(effects, rng) {
  if (effects.shake <= 0) return { x: 0, y: 0 };
  const decay = effects.shake / SHAKE_DURATION;
  const magnitude = SHAKE_MAGNITUDE * decay * decay;
  return {
    x: (rng() * 2 - 1) * magnitude,
    y: (rng() * 2 - 1) * magnitude,
  };
}

/**
 * A 1-in-3 scanline pattern, built once at device resolution. Drawing it as a
 * cached pattern costs one fill per frame; drawing 200 individual lines does
 * not, which is why it is cached.
 *
 * `light` fields need a much fainter line: at the alpha that reads as a CRT on
 * black, the same overlay reads as dirt on white.
 */
export function createScanlinePattern(ctx, dpr, light) {
  const period = Math.max(3, Math.round(3 * dpr));
  const tile = document.createElement("canvas");
  tile.width = 1;
  tile.height = period;

  const tctx = tile.getContext("2d");
  tctx.fillStyle = light ? "rgba(0, 0, 0, 0.05)" : "rgba(0, 0, 0, 0.16)";
  tctx.fillRect(0, 0, 1, Math.max(1, Math.round(dpr)));

  return ctx.createPattern(tile, "repeat");
}

export function createVignette(ctx, width, height, light) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  const edge = light ? 0.14 : 0.55;
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${edge})`);
  return gradient;
}

export const TRAIL_MAX = TRAIL_LENGTH;
export const BALL_SIZE = BALL.r * 2;
