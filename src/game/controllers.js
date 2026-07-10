import { FIELD, PADDLE, DIFFICULTY } from "./constants.js";
import { bipolar } from "./rng.js";

/**
 * A controller answers one question per tick: up, down, or hold. It also owns
 * the paddle's maxSpeed. Nothing downstream knows or cares whether a human or
 * the CPU is on the other end of it, which is the whole reason 1P, 2P and
 * CPU-vs-CPU are the same code path.
 */

/** `isDown(key)` is injected so this stays testable without a DOM. */
export function humanController(isDown, upKey, downKey) {
  return {
    type: "human",
    maxSpeed: PADDLE.speed,
    intent() {
      return (isDown(downKey) ? 1 : 0) - (isDown(upKey) ? 1 : 0);
    },
  };
}

/**
 * Capped speed plus aim error. The CPU always knows exactly where the ball is;
 * it simply cannot always get there, and it aims at a point that is not quite
 * the ball. It never predicts the intercept, so a steep shot beats it — which
 * is precisely the shot the Atari bounce rewards you for learning to hit.
 *
 * When the ball is travelling away, it eases back toward center. That is both
 * correct play and a readable tell.
 */
export function aiController({ difficulty = "normal", rng }) {
  const cfg = DIFFICULTY[difficulty];
  if (!cfg) throw new Error(`unknown difficulty: ${difficulty}`);

  let cooldown = 0;
  let target = FIELD.h / 2;

  return {
    type: "ai",
    difficulty,
    maxSpeed: PADDLE.speed * cfg.speedFactor,

    intent(game, paddle, dt) {
      cooldown -= dt;
      if (cooldown <= 0) {
        cooldown = cfg.reactionInterval;
        const incoming =
          paddle.side === "left" ? game.ball.vx < 0 : game.ball.vx > 0;
        target = incoming
          ? game.ball.y + bipolar(rng) * cfg.aimError * PADDLE.h
          : FIELD.h / 2;
      }

      // A deadzone the width of a fraction of the paddle, or it jitters on
      // target forever and looks broken.
      const center = paddle.y + PADDLE.h / 2;
      const deadzone = PADDLE.h * 0.08;
      if (target > center + deadzone) return 1;
      if (target < center - deadzone) return -1;
      return 0;
    },
  };
}
