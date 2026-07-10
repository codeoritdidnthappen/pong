/**
 * Physical key codes, not `key`, so W/S work on AZERTY and Dvorak layouts
 * without the player having to think about it.
 */
export const KEYS = {
  leftUp: "KeyW",
  leftDown: "KeyS",
  rightUp: "ArrowUp",
  rightDown: "ArrowDown",
};

const SWALLOW = new Set([
  "ArrowUp",
  "ArrowDown",
  "Space", // would scroll the page
]);

export function createKeyboard(target = window) {
  const down = new Set();
  const pressHandlers = new Map();

  target.addEventListener("keydown", (event) => {
    if (SWALLOW.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    down.add(event.code);
    pressHandlers.get(event.code)?.(event);
  });

  target.addEventListener("keyup", (event) => down.delete(event.code));

  // A key held while the tab loses focus would otherwise stay held forever.
  target.addEventListener("blur", () => down.clear());

  return {
    isDown: (code) => down.has(code),
    onPress(code, handler) {
      pressHandlers.set(code, handler);
    },
    clear: () => down.clear(),
  };
}
