import { FIELD, PADDLE, SERVE_DELAY, MATCH } from "./constants.js";
import { createBall, createPaddle, movePaddle, serveBall, stepBall } from "./physics.js";
import { matchWinner } from "./scoring.js";
import { createRng } from "./rng.js";

/**
 * The whole game is this object plus `stepGame`. It touches no canvas, no DOM
 * and no clock, so a full match can be simulated in a test in milliseconds.
 */
export function createGame({ controllers, seed = 1, rules = MATCH }) {
  const rng = createRng(seed);
  const game = {
    rng,
    rules,
    ball: createBall(),
    paddles: [createPaddle("left"), createPaddle("right")],
    controllers, // { left, right }
    score: { left: 0, right: 0 },
    phase: "serving", // serving | playing | over
    serveTimer: SERVE_DELAY,
    winner: null,
    rallyHits: 0,
    events: [],
  };

  // Decide the serve up front, so the CPU has a velocity to read while the
  // serve timer runs down and the paddles visibly prepare.
  serveBall(game.ball, rng() < 0.5 ? "left" : "right", rng);
  freezeBall(game);
  return game;
}

/** Park the ball at center, remembering the velocity it will launch with. */
function freezeBall(game) {
  game.pending = { vx: game.ball.vx, vy: game.ball.vy };
  game.ball.x = FIELD.w / 2;
  game.ball.y = FIELD.h / 2;
  game.ball.vx = 0;
  game.ball.vy = 0;
}

function beginServe(game, towards) {
  serveBall(game.ball, towards, game.rng);
  freezeBall(game);
  game.serveTimer = SERVE_DELAY;
  game.phase = "serving";
  game.rallyHits = 0;
}

/**
 * One fixed step. `dt` must be the constant DT; nothing here is written to
 * tolerate a variable delta, and that is deliberate.
 */
export function stepGame(game, dt) {
  game.events.length = 0;
  if (game.phase === "over") return game.events;

  for (const paddle of game.paddles) {
    const controller = game.controllers[paddle.side];
    const intent = controller.intent(game, paddle, dt) || 0;
    movePaddle(paddle, intent, dt, controller.maxSpeed);
  }

  if (game.phase === "serving") {
    game.serveTimer -= dt;
    if (game.serveTimer <= 0) {
      game.ball.vx = game.pending.vx;
      game.ball.vy = game.pending.vy;
      game.phase = "playing";
    }
    return game.events;
  }

  const { events, scored } = stepBall(game.ball, game.paddles, dt);
  for (const e of events) {
    if (e.type === "paddle") game.rallyHits++;
    game.events.push(e);
  }

  if (scored) {
    game.score[scored]++;
    game.events.push({ type: "score", side: scored });

    const winner = matchWinner(game.score.left, game.score.right, game.rules);
    if (winner) {
      game.winner = winner;
      game.phase = "over";
      game.events.push({ type: "match", side: winner });
    } else {
      // The player who conceded receives the next serve.
      beginServe(game, scored === "left" ? "right" : "left");
    }
  }

  return game.events;
}

/** Fresh scores, same controllers. Used by Rematch and by attract mode. */
export function resetMatch(game) {
  game.score.left = 0;
  game.score.right = 0;
  game.winner = null;
  for (const paddle of game.paddles) paddle.y = (FIELD.h - PADDLE.h) / 2;
  beginServe(game, game.rng() < 0.5 ? "left" : "right");
  return game;
}
