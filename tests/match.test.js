import { describe, it, expect } from "vitest";
import { FIELD, PADDLE, BALL, DT } from "../src/game/constants.js";
import { createGame, stepGame } from "../src/game/state.js";
import { aiController } from "../src/game/controllers.js";
import { createRng } from "../src/game/rng.js";
import { isMatchOver } from "../src/game/scoring.js";

/** A CPU-vs-CPU game whose every outcome is a function of `seed`. */
function cpuMatch(seed, left = "normal", right = "normal") {
  const rng = createRng(seed);
  return createGame({
    seed,
    controllers: {
      left: aiController({ difficulty: left, rng }),
      right: aiController({ difficulty: right, rng }),
    },
  });
}

/** Run until the match ends or we exceed `maxFrames`. */
function playOut(game, maxFrames = 120 * 60 * 20) {
  let frames = 0;
  while (game.phase !== "over" && frames < maxFrames) {
    stepGame(game, DT);
    frames++;
  }
  return frames;
}

const MAX_SPEED_PER_STEP = BALL.maxSpeed * DT;

describe("simulation invariants", () => {
  it("keeps the ball inside the field for 10,000 frames", () => {
    const game = cpuMatch(12345, "hard", "hard");
    for (let i = 0; i < 10_000; i++) {
      stepGame(game, DT);
      if (game.phase === "over") break;

      // The ball may travel one step beyond the goal line before the point is
      // awarded; it may never be deeper than that, and never outside vertically.
      expect(game.ball.x).toBeGreaterThan(-MAX_SPEED_PER_STEP - BALL.r * 2);
      expect(game.ball.x).toBeLessThan(FIELD.w + MAX_SPEED_PER_STEP + BALL.r * 2);
      expect(game.ball.y).toBeGreaterThanOrEqual(BALL.r - 1e-3);
      expect(game.ball.y).toBeLessThanOrEqual(FIELD.h - BALL.r + 1e-3);
    }
  });

  it("never lets the ball rest inside a paddle", () => {
    const game = cpuMatch(999, "hard", "hard");
    for (let i = 0; i < 10_000; i++) {
      stepGame(game, DT);
      if (game.phase === "over") break;
      for (const p of game.paddles) {
        const inside =
          game.ball.x > p.x - BALL.r &&
          game.ball.x < p.x + PADDLE.w + BALL.r &&
          game.ball.y > p.y - BALL.r &&
          game.ball.y < p.y + PADDLE.h + BALL.r;
        expect(inside).toBe(false);
      }
    }
  });

  it("never exceeds the ball speed cap", () => {
    const game = cpuMatch(555, "hard", "hard");
    for (let i = 0; i < 10_000; i++) {
      stepGame(game, DT);
      if (game.phase === "over") break;
      expect(Math.hypot(game.ball.vx, game.ball.vy)).toBeLessThanOrEqual(
        BALL.maxSpeed + 1e-6,
      );
    }
  });

  it("keeps paddles within the field", () => {
    const game = cpuMatch(31337, "hard", "easy");
    for (let i = 0; i < 10_000; i++) {
      stepGame(game, DT);
      if (game.phase === "over") break;
      for (const p of game.paddles) {
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(FIELD.h - PADDLE.h);
      }
    }
  });
});

describe("matches terminate", () => {
  // Deuce plus a constant ball speed would deadlock. This is the test that
  // proves per-rally acceleration actually resolves it.
  it("ends within 20 simulated minutes, for every seed and pairing", () => {
    for (const seed of [1, 2, 3, 7, 42, 1000, 65535]) {
      for (const [l, r] of [
        ["hard", "hard"],
        ["normal", "normal"],
        ["easy", "easy"],
        ["hard", "easy"],
      ]) {
        const game = cpuMatch(seed, l, r);
        playOut(game);
        expect(game.phase, `seed ${seed} ${l} v ${r} did not terminate`).toBe("over");
        expect(isMatchOver(game.score.left, game.score.right)).toBe(true);
        expect(game.winner).toBe(
          game.score.left > game.score.right ? "left" : "right",
        );
      }
    }
  });

  it("resolves a deuce by two clear points", () => {
    // Any match that got past 10-10 must finish with a two-point margin.
    for (const seed of [4, 8, 15, 16, 23, 42]) {
      const game = cpuMatch(seed, "hard", "hard");
      playOut(game);
      const { left, right } = game.score;
      if (left >= 11 && right >= 11) expect(Math.abs(left - right)).toBe(2);
    }
  });
});

describe("difficulty is real", () => {
  // If Hard does not reliably beat Easy, the two knobs are not doing anything
  // and the difficulty menu is a lie.
  it("hard beats easy across a series", () => {
    let hardWins = 0;
    const series = 12;
    for (let seed = 1; seed <= series; seed++) {
      const game = cpuMatch(seed * 77, "hard", "easy");
      playOut(game);
      if (game.winner === "left") hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(series - 1);
  });

  it("normal beats easy across a series", () => {
    let normalWins = 0;
    const series = 12;
    for (let seed = 1; seed <= series; seed++) {
      const game = cpuMatch(seed * 31, "normal", "easy");
      playOut(game);
      if (game.winner === "left") normalWins++;
    }
    expect(normalWins).toBeGreaterThan(series / 2);
  });
});

describe("determinism", () => {
  it("replays identically from the same seed", () => {
    const a = cpuMatch(2024, "hard", "normal");
    const b = cpuMatch(2024, "hard", "normal");
    playOut(a);
    playOut(b);
    expect(a.score).toEqual(b.score);
    expect(a.winner).toBe(b.winner);
    expect(a.ball.x).toBeCloseTo(b.ball.x, 9);
  });

  it("produces different matches from different seeds", () => {
    const a = cpuMatch(1, "normal", "normal");
    const b = cpuMatch(2, "normal", "normal");
    playOut(a);
    playOut(b);
    expect(a.score).not.toEqual(b.score);
  });
});

describe("serving", () => {
  it("resets the ball speed and serves to the player who conceded", () => {
    const game = cpuMatch(3, "easy", "easy");
    let served = false;
    for (let i = 0; i < 120 * 60 && !served; i++) {
      const events = stepGame(game, DT);
      const scored = events.find((e) => e.type === "score");
      if (scored && game.phase === "serving") {
        // The conceding side is the opposite of the scorer, and receives.
        const towards = scored.side === "left" ? "right" : "left";
        const dir = Math.sign(game.pending.vx);
        expect(dir).toBe(towards === "left" ? -1 : 1);
        expect(Math.hypot(game.pending.vx, game.pending.vy)).toBeCloseTo(BALL.speed, 4);
        served = true;
      }
    }
    expect(served).toBe(true);
  });

  it("holds the ball still until the serve timer expires", () => {
    const game = cpuMatch(11, "easy", "easy");
    expect(game.phase).toBe("serving");
    expect(game.ball.vx).toBe(0);
    stepGame(game, DT);
    expect(game.ball.x).toBe(FIELD.w / 2);
  });
});
