import { describe, it, expect } from "vitest";
import {
  isMatchOver,
  matchWinner,
  isMatchPoint,
  isDeuce,
} from "../src/game/scoring.js";

describe("first to 11, win by 2", () => {
  it("ends at 11 when the margin is met", () => {
    expect(isMatchOver(11, 9)).toBe(true);
    expect(matchWinner(11, 9)).toBe("left");
    expect(matchWinner(4, 11)).toBe("right");
  });

  it("does not end at 11-10", () => {
    expect(isMatchOver(11, 10)).toBe(false);
    expect(matchWinner(11, 10)).toBeNull();
  });

  it("does not end at 10-10", () => {
    expect(isMatchOver(10, 10)).toBe(false);
  });

  it("ends past 11 once someone leads by two", () => {
    expect(isMatchOver(12, 10)).toBe(true);
    expect(isMatchOver(12, 11)).toBe(false);
    expect(isMatchOver(20, 18)).toBe(true);
    expect(matchWinner(18, 20)).toBe("right");
  });

  it("is never over before anyone reaches the target", () => {
    expect(isMatchOver(9, 0)).toBe(false);
    expect(isMatchOver(10, 8)).toBe(false);
  });
});

describe("match point", () => {
  it("recognises the point that would end it", () => {
    expect(isMatchPoint(10, 5)).toBe(true);
    expect(isMatchPoint(5, 10)).toBe(true);
    expect(isMatchPoint(11, 10)).toBe(true); // 12-10 ends it
  });

  it("is false at 10-10, where no single point can end the match", () => {
    expect(isMatchPoint(10, 10)).toBe(false);
  });

  it("is false once the match is already over", () => {
    expect(isMatchPoint(11, 9)).toBe(false);
  });
});

describe("deuce", () => {
  it("starts at 10-10", () => {
    expect(isDeuce(10, 10)).toBe(true);
    expect(isDeuce(11, 11)).toBe(true);
    expect(isDeuce(9, 9)).toBe(false);
    expect(isDeuce(11, 10)).toBe(false);
  });
});

describe("custom rules", () => {
  it("honours a different target and margin", () => {
    const rules = { target: 5, margin: 1 };
    expect(isMatchOver(5, 4, rules)).toBe(true);
    expect(isMatchOver(4, 4, rules)).toBe(false);
  });
});
