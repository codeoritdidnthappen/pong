import { defineConfig } from "vitest/config";

// The game logic is deliberately free of canvas and DOM, so the tests run in
// plain node with no environment shim.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
