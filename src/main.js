import "./style.css";

import { FIELD, DT } from "./game/constants.js";
import { createGame, stepGame } from "./game/state.js";
import { humanController, aiController } from "./game/controllers.js";
import { createLoop } from "./game/loop.js";
import { createRng } from "./game/rng.js";
import { createRenderer } from "./render/renderer.js";
import { readTheme, applyTheme } from "./render/theme.js";
import {
  createEffects,
  reactToEvents,
  recordTrail,
  updateEffects,
  clearTrail,
} from "./render/effects.js";
import { createAudio } from "./audio/beeps.js";
import { createKeyboard, KEYS } from "./input/keyboard.js";
import { loadSettings, saveSettings } from "./ui/settings.js";
import {
  buildThemePicker,
  menuScreen,
  pauseScreen,
  gameOverScreen,
} from "./ui/menu.js";

const canvas = document.getElementById("field");
const stage = document.getElementById("stage");
const overlay = document.getElementById("overlay");
const themeSelect = document.getElementById("theme");
const muteButton = document.getElementById("mute");
const muteIcon = document.getElementById("mute-icon");

const settings = loadSettings();
const keyboard = createKeyboard();
const audio = createAudio(settings.muted);
const renderer = createRenderer(canvas);
const effects = createEffects();

/** Purely cosmetic randomness (screen shake). Never touches the simulation. */
const cosmeticRng = createRng(0xc0ffee);

let theme = null;
let game = null;
/** "menu" runs the attract match; the others run the player's match. */
let screen = "menu";
let attractSeed = 1;

/* -------------------------------------------------------------------------- */
/* Canvas sizing                                                              */
/* -------------------------------------------------------------------------- */

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = stage.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  renderer.resize(dpr);
}

new ResizeObserver(resize).observe(stage);

/* -------------------------------------------------------------------------- */
/* Games                                                                      */
/* -------------------------------------------------------------------------- */

function controllersFor(mode, rng) {
  const cpu = () => aiController({ difficulty: settings.difficulty, rng });

  if (mode === "2p") {
    return {
      left: humanController(keyboard.isDown, KEYS.leftUp, KEYS.leftDown),
      right: humanController(keyboard.isDown, KEYS.rightUp, KEYS.rightDown),
    };
  }
  if (mode === "0p") return { left: cpu(), right: cpu() };
  return {
    left: humanController(keyboard.isDown, KEYS.leftUp, KEYS.leftDown),
    right: cpu(),
  };
}

function newGame(mode, seed) {
  const rng = createRng(seed);
  clearTrail(effects);
  return createGame({ seed, controllers: controllersFor(mode, rng) });
}

/**
 * The attract match: two CPUs rallying behind the title card, exactly as the
 * cabinet did. A fresh seed each time, so it is never the same match twice.
 */
function newAttractGame() {
  const rng = createRng(attractSeed);
  clearTrail(effects);
  return createGame({
    seed: attractSeed++,
    controllers: {
      left: aiController({ difficulty: "normal", rng }),
      right: aiController({ difficulty: "hard", rng }),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Screens                                                                    */
/* -------------------------------------------------------------------------- */

function showScreen(next) {
  screen = next;

  // Set display directly: the overlay carries `grid`, and relying on utility
  // ordering to let `hidden` win over it is not a bet worth taking.
  if (next === "playing") {
    overlay.style.display = "none";
    overlay.innerHTML = "";
    return;
  }

  overlay.style.display = "grid";
  overlay.innerHTML =
    next === "menu"
      ? menuScreen(settings)
      : next === "paused"
        ? pauseScreen()
        : gameOverScreen(game, settings);
}

function toMenu() {
  game = newAttractGame();
  showScreen("menu");
}

function startMatch() {
  audio.unlock();
  keyboard.clear();
  game = newGame(settings.mode, (Math.random() * 1e9) | 0);
  showScreen("playing");
}

function togglePause() {
  if (screen === "playing") showScreen("paused");
  else if (screen === "paused") showScreen("playing");
}

/* -------------------------------------------------------------------------- */
/* Simulation and rendering                                                   */
/* -------------------------------------------------------------------------- */

function step(dt) {
  // The attract match keeps simulating behind the menu; a paused or finished
  // match does not.
  if (screen === "paused") return;
  if (screen === "over") return;

  const events = stepGame(game, dt);

  if (screen === "menu") {
    // Attract mode is silent and effect-free, and simply restarts when done.
    recordTrail(effects, game.ball, settings);
    if (game.phase === "over") game = newAttractGame();
    return;
  }

  reactToEvents(effects, events, settings);
  recordTrail(effects, game.ball, settings);
  audio.playEvents(events);

  if (game.phase === "over") showScreen("over");
}

function frame() {
  updateEffects(effects, DT);
  renderer.render(game, effects, settings, theme, cosmeticRng);
}

/* -------------------------------------------------------------------------- */
/* Wiring                                                                     */
/* -------------------------------------------------------------------------- */

function refreshTheme() {
  applyTheme(settings.theme);
  // The custom properties resolve on the next style recalc, and
  // getComputedStyle forces one, so this is safe to read immediately.
  theme = readTheme(renderer.ctx);
  renderer.setTheme(theme);
}

function refreshMute() {
  audio.setMuted(settings.muted);
  muteIcon.textContent = settings.muted ? "🔇" : "🔊";
  muteButton.setAttribute("aria-pressed", String(settings.muted));
}

buildThemePicker(themeSelect, settings, (value) => {
  settings.theme = value;
  refreshTheme();
  saveSettings(settings);
});

muteButton.addEventListener("click", () => {
  settings.muted = !settings.muted;
  refreshMute();
  saveSettings(settings);
  audio.unlock();
});

// One delegated listener for every overlay screen, since the overlay's markup
// is replaced wholesale on each transition.
overlay.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode], [data-difficulty], [data-action]");
  if (button) audio.unlock();

  if (button?.dataset.mode) {
    settings.mode = button.dataset.mode;
    saveSettings(settings);
    showScreen("menu");
    return;
  }
  if (button?.dataset.difficulty) {
    settings.difficulty = button.dataset.difficulty;
    saveSettings(settings);
    showScreen("menu");
    return;
  }
  if (button?.dataset.action === "start") return startMatch();
  if (button?.dataset.action === "resume") return showScreen("playing");
  if (button?.dataset.action === "menu") return toMenu();
});

overlay.addEventListener("change", (event) => {
  const toggle = event.target.closest("[data-effect]");
  if (!toggle) return;
  settings.effects[toggle.dataset.effect] = toggle.checked;
  if (!settings.effects.trail) clearTrail(effects);
  saveSettings(settings);
});

keyboard.onPress("Escape", () => {
  if (screen === "menu") return;
  if (screen === "over") return toMenu();
  togglePause();
});
keyboard.onPress("KeyP", togglePause);
keyboard.onPress("KeyM", () => muteButton.click());
keyboard.onPress("Space", () => {
  if (screen === "menu" || screen === "over") startMatch();
});

// The theme's CSS custom properties change with data-theme, and daisyUI also
// swaps them when the OS color scheme changes under a `prefersdark` theme.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refreshTheme);
window.addEventListener("blur", () => {
  if (screen === "playing") showScreen("paused");
});

resize();
refreshTheme();
refreshMute();
toMenu();
createLoop(step, frame).start();

// A window onto the live simulation, for poking at in the console. Vite strips
// this from production builds.
if (import.meta.env.DEV) {
  window.__pong = () => ({ game, screen, settings, theme, effects });
}
