import { describe, it, expect } from "vitest";
import { FIELD, PADDLE, DIFFICULTY, DT } from "../src/game/constants.js";
import { createPaddle, createBall } from "../src/game/physics.js";
import { humanController, aiController } from "../src/game/controllers.js";
import { createRng } from "../src/game/rng.js";

describe("human controller", () => {
  const keys = new Set();
  const isDown = (k) => keys.has(k);
  const c = humanController(isDown, "w", "s");

  it("maps keys to intent", () => {
    keys.clear();
    expect(c.intent()).toBe(0);
    keys.add("w");
    expect(c.intent()).toBe(-1);
    keys.add("s");
    expect(c.intent()).toBe(0); // both held cancels
    keys.delete("w");
    expect(c.intent()).toBe(1);
  });

  it("runs at the full paddle speed", () => {
    expect(c.maxSpeed).toBe(PADDLE.speed);
  });
});

describe("ai controller", () => {
  it("rejects an unknown difficulty rather than silently guessing", () => {
    expect(() => aiController({ difficulty: "nightmare", rng: createRng(1) })).toThrow();
  });

  it("is never faster than a human paddle", () => {
    for (const difficulty of Object.keys(DIFFICULTY)) {
      const ai = aiController({ difficulty, rng: createRng(1) });
      expect(ai.maxSpeed).toBeLessThanOrEqual(PADDLE.speed);
    }
  });

  it("gets strictly faster as difficulty rises", () => {
    const speed = (d) => aiController({ difficulty: d, rng: createRng(1) }).maxSpeed;
    expect(speed("easy")).toBeLessThan(speed("normal"));
    expect(speed("normal")).toBeLessThan(speed("hard"));
  });

  it("gets strictly more accurate as difficulty rises", () => {
    expect(DIFFICULTY.easy.aimError).toBeGreaterThan(DIFFICULTY.normal.aimError);
    expect(DIFFICULTY.normal.aimError).toBeGreaterThan(DIFFICULTY.hard.aimError);
  });

  it("chases an incoming ball", () => {
    const ai = aiController({ difficulty: "hard", rng: createRng(7) });
    const paddle = createPaddle("right");
    const ball = createBall();
    ball.y = FIELD.h - 50; // well below the centered paddle
    ball.vx = 400; // incoming, on the right
    expect(ai.intent({ ball }, paddle, DT)).toBe(1); // move down
  });

  it("returns to center when the ball is travelling away", () => {
    const ai = aiController({ difficulty: "hard", rng: createRng(7) });
    const paddle = createPaddle("right");
    paddle.y = 0; // parked at the top
    const ball = createBall();
    ball.y = 20;
    ball.vx = -400; // heading away from the right paddle
    expect(ai.intent({ ball }, paddle, DT)).toBe(1); // drift back down to center
  });

  it("holds still inside the deadzone rather than jittering", () => {
    const ai = aiController({ difficulty: "hard", rng: () => 0.5 }); // zero aim error
    const paddle = createPaddle("right");
    const ball = createBall();
    ball.y = paddle.y + PADDLE.h / 2; // exactly on target
    ball.vx = 400;
    expect(ai.intent({ ball }, paddle, DT)).toBe(0);
  });
});
