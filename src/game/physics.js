import { FIELD, PADDLE, BALL, MAX_BOUNCE, clamp } from "./constants.js";

/** Nudge the ball off a surface after resolving, so it cannot re-collide. */
const EPS = 1e-4;

/** Substeps per fixed tick. A ball wedged in a corner needs a few. */
const MAX_RESOLUTIONS = 6;

export const paddleX = (side) =>
  side === "left" ? PADDLE.inset : FIELD.w - PADDLE.inset - PADDLE.w;

export function createPaddle(side) {
  return { side, x: paddleX(side), y: (FIELD.h - PADDLE.h) / 2 };
}

export function createBall() {
  return { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0 };
}

export const ballSpeed = (ball) => Math.hypot(ball.vx, ball.vy);

/**
 * Move a paddle by an intent of -1 (up), 0, or +1 (down), clamped to the field.
 * maxSpeed is the paddle's own ceiling: this is the single place where a CPU
 * paddle's handicap is applied, so a CPU can never out-move a human's ceiling.
 */
export function movePaddle(paddle, intent, dt, maxSpeed) {
  paddle.y = clamp(paddle.y + intent * maxSpeed * dt, 0, FIELD.h - PADDLE.h);
  return paddle;
}

/**
 * Place the ball at center and serve it toward `towards`, at the base speed.
 * Speed resets every point, so being behind never means facing a faster ball.
 */
export function serveBall(ball, towards, rng) {
  const angle = (rng() * 2 - 1) * BALL.serveAngle;
  const dir = towards === "left" ? -1 : 1;
  ball.x = FIELD.w / 2;
  ball.y = FIELD.h / 2;
  ball.vx = dir * BALL.speed * Math.cos(angle);
  ball.vy = BALL.speed * Math.sin(angle);
  return ball;
}

/**
 * The Atari bounce. The outgoing angle is a pure function of where on the
 * paddle the ball landed; the incoming angle is thrown away. Speed steps up by
 * `accel` on every paddle contact, up to a ceiling, so no rally lasts forever.
 */
export function bounceOffPaddle(ball, paddle) {
  const center = paddle.y + PADDLE.h / 2;
  const reach = PADDLE.h / 2 + BALL.r;
  const offset = clamp((ball.y - center) / reach, -1, 1);
  const angle = offset * MAX_BOUNCE;

  const speed = Math.min(ballSpeed(ball) * BALL.accel, BALL.maxSpeed);
  const dir = paddle.side === "left" ? 1 : -1;

  ball.vx = dir * speed * Math.cos(angle);
  ball.vy = speed * Math.sin(angle);
  ball.x =
    paddle.side === "left"
      ? paddle.x + PADDLE.w + BALL.r + EPS
      : paddle.x - BALL.r - EPS;

  return { offset, speed };
}

/**
 * Swept test of the ball's center (a moving point) against a paddle expanded by
 * the ball's radius. Returns the fraction of `dt` at which they touch and which
 * axis was crossed, or null.
 *
 * A discrete overlap test would let a fast ball straddle the paddle between two
 * frames and score. This cannot: it finds the crossing time analytically.
 */
export function sweepPaddle(ball, paddle, dt) {
  const minX = paddle.x - BALL.r;
  const maxX = paddle.x + PADDLE.w + BALL.r;
  const minY = paddle.y - BALL.r;
  const maxY = paddle.y + PADDLE.h + BALL.r;

  let tEnter = 0;
  let tExit = dt;
  let axis = "x";

  for (const [pos, vel, lo, hi, name] of [
    [ball.x, ball.vx, minX, maxX, "x"],
    [ball.y, ball.vy, minY, maxY, "y"],
  ]) {
    if (Math.abs(vel) < 1e-12) {
      if (pos < lo || pos > hi) return null; // parallel and outside the slab
      continue;
    }
    let t1 = (lo - pos) / vel;
    let t2 = (hi - pos) / vel;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tEnter) {
      tEnter = t1;
      axis = name;
    }
    if (t2 < tExit) tExit = t2;
    if (tEnter > tExit) return null;
  }

  if (tEnter > dt || tExit < 0) return null;
  return { t: Math.max(0, tEnter), axis };
}

/** True when the ball's center already sits inside the expanded paddle box. */
function overlapping(ball, paddle) {
  return (
    ball.x > paddle.x - BALL.r &&
    ball.x < paddle.x + PADDLE.w + BALL.r &&
    ball.y > paddle.y - BALL.r &&
    ball.y < paddle.y + PADDLE.h + BALL.r
  );
}

/**
 * A paddle that moves into a stationary-ish ball can swallow it. Eject the ball
 * along x, away from the paddle's own half of the field, before sweeping.
 */
function depenetrate(ball, paddle) {
  ball.x =
    paddle.side === "left"
      ? paddle.x + PADDLE.w + BALL.r + EPS
      : paddle.x - BALL.r - EPS;
  return bounceOffPaddle(ball, paddle);
}

/**
 * Advance the ball one fixed step against the walls and both paddles.
 * Returns the collision events that occurred (for audio and effects) and which
 * side, if any, has just scored.
 */
export function stepBall(ball, paddles, dt) {
  const events = [];

  for (const paddle of paddles) {
    if (overlapping(ball, paddle)) {
      depenetrate(ball, paddle);
      events.push({ type: "paddle", side: paddle.side, trapped: true });
    }
  }

  let remaining = dt;
  for (let i = 0; i < MAX_RESOLUTIONS && remaining > 1e-9; i++) {
    let best = { t: remaining, kind: null };

    if (ball.vy < 0) {
      const t = (BALL.r - ball.y) / ball.vy;
      if (t >= 0 && t < best.t) best = { t, kind: "wall", snapY: BALL.r };
    } else if (ball.vy > 0) {
      const t = (FIELD.h - BALL.r - ball.y) / ball.vy;
      if (t >= 0 && t < best.t)
        best = { t, kind: "wall", snapY: FIELD.h - BALL.r };
    }

    for (const paddle of paddles) {
      const hit = sweepPaddle(ball, paddle, remaining);
      if (hit && hit.t < best.t)
        best = { t: hit.t, kind: "paddle", axis: hit.axis, paddle };
    }

    ball.x += ball.vx * best.t;
    ball.y += ball.vy * best.t;
    remaining -= best.t;

    if (best.kind === null) break;

    if (best.kind === "wall") {
      ball.y = best.snapY;
      ball.vy = -ball.vy;
      ball.y += Math.sign(ball.vy) * EPS;
      events.push({ type: "wall" });
    } else if (best.axis === "x") {
      bounceOffPaddle(ball, best.paddle);
      events.push({ type: "paddle", side: best.paddle.side });
    } else {
      // Clipped the paddle's top or bottom edge: a plain reflection, no aim
      // control and no speed-up. Rare, and it feels right when it happens.
      ball.vy = -ball.vy;
      ball.y =
        ball.vy > 0
          ? best.paddle.y + PADDLE.h + BALL.r + EPS
          : best.paddle.y - BALL.r - EPS;
      events.push({ type: "paddle", side: best.paddle.side, edge: true });
    }
  }

  let scored = null;
  if (ball.x + BALL.r < 0) scored = "right";
  else if (ball.x - BALL.r > FIELD.w) scored = "left";

  return { events, scored };
}
