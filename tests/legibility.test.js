import { describe, it, expect } from "vitest";
import {
  relativeLuminance,
  contrastRatio,
  correctForField,
  CONTRAST_THRESHOLD,
} from "../src/render/legibility.js";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 6);
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 6);
  });

  it("ranks a mid grey between the two", () => {
    const g = relativeLuminance(128, 128, 128);
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThan(1);
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white", () => {
    const black = relativeLuminance(0, 0, 0);
    const white = relativeLuminance(255, 255, 255);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
  });

  it("is 1:1 for a colour on itself and order-independent", () => {
    const g = relativeLuminance(90, 90, 90);
    expect(contrastRatio(g, g)).toBeCloseTo(1, 6);
    expect(contrastRatio(0.4, 0.02)).toBeCloseTo(contrastRatio(0.02, 0.4), 9);
  });
});

describe("correctForField", () => {
  const white = relativeLuminance(255, 255, 255);
  const black = relativeLuminance(0, 0, 0);

  it("leaves legible colours untouched", () => {
    // White ball and paddles on a black field: the arcade case.
    const out = correctForField({
      fieldLum: black,
      ball: { color: "white", lum: white },
      paddle: { color: "white", lum: white },
      fallback: { color: "content", lum: white },
    });
    expect(out.ball).toBe("white");
    expect(out.paddle).toBe("white");
    expect(out.corrected).toEqual({ ball: false, paddle: false });
  });

  it("substitutes the fallback for an element that washes out", () => {
    // validmonkey's case: a near-black paddle on a dark field, legible ball.
    const darkField = relativeLuminance(40, 70, 68);
    const out = correctForField({
      fieldLum: darkField,
      ball: { color: "primary", lum: relativeLuminance(120, 220, 210) },
      paddle: { color: "black", lum: black },
      fallback: { color: "base-content", lum: white },
    });
    expect(out.ball).toBe("primary"); // legible, kept
    expect(out.paddle).toBe("base-content"); // invisible, replaced
    expect(out.corrected).toEqual({ ball: false, paddle: true });
  });

  it("corrects both when both fail", () => {
    const field = relativeLuminance(235, 220, 245); // pale field (cupcake-like)
    const pale = relativeLuminance(225, 210, 235);
    const out = correctForField({
      fieldLum: field,
      ball: { color: "primary", lum: pale },
      paddle: { color: "secondary", lum: pale },
      fallback: { color: "base-content", lum: black },
    });
    expect(out.ball).toBe("base-content");
    expect(out.paddle).toBe("base-content");
    expect(out.corrected).toEqual({ ball: true, paddle: true });
  });

  it("falls back to black or white when even base-content fails", () => {
    // Pathological: base-content itself doesn't contrast with the field.
    const field = relativeLuminance(10, 10, 10); // near-black field
    const out = correctForField({
      fieldLum: field,
      ball: { color: "primary", lum: relativeLuminance(20, 20, 20) },
      paddle: { color: "secondary", lum: relativeLuminance(20, 20, 20) },
      fallback: { color: "base-content", lum: relativeLuminance(25, 25, 25) },
    });
    // A near-black field must yield white, not the failing base-content.
    expect(out.ball).toBe("#ffffff");
    expect(out.paddle).toBe("#ffffff");
  });

  it("treats exactly the threshold as legible", () => {
    // Construct luminances whose ratio is exactly the threshold.
    const fieldLum = 0.05;
    const target = CONTRAST_THRESHOLD * (fieldLum + 0.05) - 0.05;
    const out = correctForField({
      fieldLum,
      ball: { color: "primary", lum: target },
      paddle: { color: "secondary", lum: target },
      fallback: { color: "base-content", lum: 1 },
    });
    expect(out.corrected).toEqual({ ball: false, paddle: false });
  });
});
