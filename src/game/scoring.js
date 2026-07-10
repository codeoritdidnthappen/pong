import { MATCH } from "./constants.js";

/**
 * First to 11, win by 2. At 10-10 the match continues until someone leads by
 * two, which is where every good Pong match ends up.
 */
export function isMatchOver(left, right, rules = MATCH) {
  const reached = left >= rules.target || right >= rules.target;
  return reached && Math.abs(left - right) >= rules.margin;
}

export function matchWinner(left, right, rules = MATCH) {
  if (!isMatchOver(left, right, rules)) return null;
  return left > right ? "left" : "right";
}

/** True once either side is one point from taking the match. */
export function isMatchPoint(left, right, rules = MATCH) {
  if (isMatchOver(left, right, rules)) return false;
  return (
    isMatchOver(left + 1, right, rules) || isMatchOver(left, right + 1, rules)
  );
}

/** Both sides at or past target and level: the deuce that win-by-2 creates. */
export function isDeuce(left, right, rules = MATCH) {
  return left === right && left >= rules.target - 1;
}
