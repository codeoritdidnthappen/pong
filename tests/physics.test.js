import { describe, it, expect } from "vitest";
import { FIELD, PADDLE, BALL, MAX_BOUNCE } from "../src/game/constants.js";
import {
  createBall,
  createPaddle,
  movePaddle,
  serveBall,
  stepBall,
  sweepPaddle,
  bounceOffPaddle,
  ballSpeed,
  paddleX,
} from "../src/game/physics.js";

const paddles = () => [createPaddle("left"), createPaddle("right")];

/** Put the ball dead-center on a paddle's face, moving toward it. */
function facing(side, speed) {
  const ball = createBall();
  ball.y = FIELD.h / 2;
  ball.x = side === "left" ? PADDLE.inset + PADDLE.w + BALL.r + 40 : paddleX("right") - BALL.r - 40;
  ball.vx = side === "left" ? -speed : speed;
  ball.vy = 0;
  return ball;
}

describe("swept collision", () => {
  it("catches a ball that would cross the whole paddle in one step", () => {
    // 20000 u/s over a 1/120s step is 166 units of travel against a 16-unit
    // paddle. A discrete overlap test sees nothing at either endpoint.
    const ball = facing("right", 20000);
    const hit = sweepPaddle(ball, createPaddle("right"), 1 / 120);
    expect(hit).not.toBeNull();
    expect(hit.axis).toBe("x");
  });

  it("does not tunnel: the ball never reaches the wall behind a paddle", () => {
    const ball = facing("right", 20000);
    const { scored } = stepBall(ball, paddles(), 1 / 120);
    expect(scored).toBeNull();
    expect(ball.vx).toBeLessThan(0); // sent back the way it came
  });

  it("reports no hit when the ball passes above the paddle", () => {
    const ball = facing("right", 900);
    ball.y = 10; // near the top wall, well clear of a centered paddle
    expect(sweepPaddle(ball, createPaddle("right"), 1 / 120)).toBeNull();
  });

  it("never leaves the ball inside a paddle", () => {
    const ball = facing("right", 5000);
    const ps = paddles();
    stepBall(ball, ps, 1 / 120);
    const right = ps[1];
    const inside =
      ball.x > right.x - BALL.r &&
      ball.x < right.x + PADDLE.w + BALL.r &&
      ball.y > right.y - BALL.r &&
      ball.y < right.y + PADDLE.h + BALL.r;
    expect(inside).toBe(false);
  });

  it("ejects a ball that a moving paddle has swallowed", () => {
    const ball = createBall();
    const right = createPaddle("right");
    ball.x = right.x + PADDLE.w / 2; // fully engulfed
    ball.y = right.y + PADDLE.h / 2;
    ball.vx = 100;
    ball.vy = 0;

    stepBall(ball, [createPaddle("left"), right], 1 / 120);
    expect(ball.x).toBeLessThan(right.x - BALL.r);
    expect(ball.vx).toBeLessThan(0);
  });
});

describe("the Atari bounce", () => {
  it("discards the incoming angle entirely", () => {
    // Two balls at identical speed and identical contact points, arriving at
    // wildly different angles, must leave along exactly the same vector.
    const right = createPaddle("right");
    const contactY = right.y + PADDLE.h * 0.3;
    const speed = 500;

    const outgoing = (angleDeg) => {
      const a = (angleDeg * Math.PI) / 180;
      const ball = createBall();
      ball.x = right.x - BALL.r;
      ball.y = contactY;
      ball.vx = speed * Math.cos(a);
      ball.vy = speed * Math.sin(a);
      bounceOffPaddle(ball, right);
      return { vx: ball.vx, vy: ball.vy };
    };

    const shallow = outgoing(5);
    const steep = outgoing(-40);
    expect(steep.vx).toBeCloseTo(shallow.vx, 9);
    expect(steep.vy).toBeCloseTo(shallow.vy, 9);
  });

  it("sends a dead-center hit straight back", () => {
    const right = createPaddle("right");
    const ball = createBall();
    ball.x = right.x - BALL.r;
    ball.y = right.y + PADDLE.h / 2; // exactly on the paddle's midline
    ball.vx = 400;
    ball.vy = 0;

    bounceOffPaddle(ball, right);
    expect(ball.vx).toBeLessThan(0);
    expect(Math.abs(ball.vy)).toBeLessThan(1e-9);
  });

  it("lets the incoming path shift the contact point, and so the outgoing angle", () => {
    // A ball falling steeply meets the paddle slightly lower than it started,
    // and is deflected accordingly. This is aim, not a bug.
    const right = createPaddle("right");
    const ball = createBall();
    ball.y = right.y + PADDLE.h / 2;
    ball.x = right.x - BALL.r - 1;
    ball.vx = 400;
    ball.vy = 300; // drifting downward on the way in

    stepBall(ball, [createPaddle("left"), right], 1 / 120);
    expect(ball.vx).toBeLessThan(0);
    expect(ball.vy).toBeGreaterThan(0); // contacted below center, deflects down
    expect(Math.abs(ball.vy)).toBeLessThan(20); // but only just below center
  });

  it("deflects upward off the top of the paddle and downward off the bottom", () => {
    for (const [offset, expected] of [
      [-PADDLE.h / 2 + 2, -1],
      [PADDLE.h / 2 - 2, 1],
    ]) {
      const right = createPaddle("right");
      const ball = createBall();
      ball.y = right.y + PADDLE.h / 2 + offset;
      ball.x = right.x - BALL.r - 1;
      ball.vx = 400;
      ball.vy = 0;

      stepBall(ball, [createPaddle("left"), right], 1 / 120);
      expect(Math.sign(ball.vy)).toBe(expected);
      expect(ball.vx).toBeLessThan(0);
    }
  });

  it("never exceeds the maximum bounce angle", () => {
    const right = createPaddle("right");
    const ball = createBall();
    ball.y = right.y; // the very top corner of the paddle face
    ball.x = right.x - BALL.r - 1;
    ball.vx = 400;
    ball.vy = 0;

    stepBall(ball, [createPaddle("left"), right], 1 / 120);
    const angle = Math.atan2(Math.abs(ball.vy), Math.abs(ball.vx));
    expect(angle).toBeLessThanOrEqual(MAX_BOUNCE + 1e-6);
  });
});

describe("ball speed", () => {
  it("steps up on each paddle hit", () => {
    const right = createPaddle("right");
    const ball = createBall();
    ball.y = right.y + PADDLE.h / 2;
    ball.x = right.x - BALL.r - 1;
    ball.vx = 400;
    ball.vy = 0;

    const before = ballSpeed(ball);
    stepBall(ball, [createPaddle("left"), right], 1 / 120);
    expect(ballSpeed(ball)).toBeCloseTo(before * BALL.accel, 4);
  });

  it("is capped", () => {
    const right = createPaddle("right");
    const ball = createBall();
    ball.y = right.y + PADDLE.h / 2;
    ball.x = right.x - BALL.r - 1;
    ball.vx = BALL.maxSpeed;
    ball.vy = 0;

    stepBall(ball, [createPaddle("left"), right], 1 / 120);
    expect(ballSpeed(ball)).toBeLessThanOrEqual(BALL.maxSpeed + 1e-6);
  });

  it("resets to the base speed on every serve", () => {
    const ball = createBall();
    ball.vx = BALL.maxSpeed;
    serveBall(ball, "left", () => 0.5);
    expect(ballSpeed(ball)).toBeCloseTo(BALL.speed, 4);
    expect(ball.vx).toBeLessThan(0); // served toward the left player
  });
});

describe("walls", () => {
  it("reflects vy and preserves speed", () => {
    const ball = createBall();
    ball.x = FIELD.w / 2;
    ball.y = BALL.r + 1;
    ball.vx = 200;
    ball.vy = -600;

    const speed = ballSpeed(ball);
    const { events } = stepBall(ball, paddles(), 1 / 120);
    expect(events.some((e) => e.type === "wall")).toBe(true);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ballSpeed(ball)).toBeCloseTo(speed, 6);
    expect(ball.y).toBeGreaterThanOrEqual(BALL.r);
  });

  it("keeps the ball inside the field across a long, steep rally", () => {
    const ball = createBall();
    ball.vx = 260;
    ball.vy = 980; // steeper than the ball can ever legally be, on purpose
    const ps = paddles();
    for (let i = 0; i < 5000; i++) {
      stepBall(ball, ps, 1 / 120);
      expect(ball.y).toBeGreaterThanOrEqual(BALL.r - 1e-3);
      expect(ball.y).toBeLessThanOrEqual(FIELD.h - BALL.r + 1e-3);
    }
  });
});

describe("scoring detection", () => {
  it("awards the point to the far side when the ball exits", () => {
    const ball = createBall();
    ball.x = 5;
    ball.vx = -5000;
    expect(stepBall(ball, [], 1 / 120).scored).toBe("right");

    const ball2 = createBall();
    ball2.x = FIELD.w - 5;
    ball2.vx = 5000;
    expect(stepBall(ball2, [], 1 / 120).scored).toBe("left");
  });
});

describe("paddles", () => {
  it("clamps to the field and obeys its own speed ceiling", () => {
    const p = createPaddle("left");
    for (let i = 0; i < 500; i++) movePaddle(p, -1, 1 / 120, PADDLE.speed);
    expect(p.y).toBe(0);
    for (let i = 0; i < 500; i++) movePaddle(p, 1, 1 / 120, PADDLE.speed);
    expect(p.y).toBe(FIELD.h - PADDLE.h);
  });

  it("moves at most maxSpeed * dt", () => {
    const p = createPaddle("left");
    const before = p.y;
    movePaddle(p, 1, 1 / 120, 300);
    expect(p.y - before).toBeCloseTo(300 / 120, 6);
  });
});
