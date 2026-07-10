import { THEMES } from "../game/constants.js";

const KEY = "pong.settings.v1";

export const DEFAULTS = {
  mode: "1p",
  difficulty: "normal",
  theme: "arcade",
  muted: false,
  effects: {
    shake: true,
    scanlines: true,
    trail: true,
    flash: true,
  },
};

/**
 * Merge over the defaults rather than trusting the stored blob, so adding a new
 * toggle in a later version does not leave an old visitor with it undefined.
 */
export function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    stored = {}; // corrupt or unavailable; the defaults are fine
  }

  const settings = {
    ...DEFAULTS,
    ...stored,
    effects: { ...DEFAULTS.effects, ...(stored.effects ?? {}) },
  };

  // A theme removed from the allowlist (for failing contrast) must not persist.
  if (!THEMES.includes(settings.theme)) settings.theme = DEFAULTS.theme;
  if (!["easy", "normal", "hard"].includes(settings.difficulty)) {
    settings.difficulty = DEFAULTS.difficulty;
  }
  if (!["1p", "2p", "0p"].includes(settings.mode)) settings.mode = DEFAULTS.mode;

  return settings;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        mode: settings.mode,
        difficulty: settings.difficulty,
        theme: settings.theme,
        muted: settings.muted,
        effects: settings.effects,
      }),
    );
  } catch {
    // Private browsing, quota, disabled storage. The game still plays.
  }
}
