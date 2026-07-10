import { MODES, THEMES, DIFFICULTY } from "../game/constants.js";

const EFFECT_LABELS = {
  shake: "Screen shake",
  scanlines: "CRT scanlines",
  trail: "Ball trail",
  flash: "Paddle flash",
};

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/** Populate the always-visible theme picker in the header. */
export function buildThemePicker(select, settings, onChange) {
  select.innerHTML = THEMES.map(
    (theme) =>
      `<option value="${escape(theme)}"${theme === settings.theme ? " selected" : ""}>${escape(theme)}</option>`,
  ).join("");
  select.addEventListener("change", () => onChange(select.value));
}

function modeButtons(settings) {
  return Object.entries(MODES)
    .map(
      ([mode, label]) => `
      <button
        class="btn ${settings.mode === mode ? "btn-primary" : "btn-outline"} join-item"
        data-mode="${mode}"
      >${escape(label)}</button>`,
    )
    .join("");
}

function difficultyButtons(settings) {
  return Object.keys(DIFFICULTY)
    .map(
      (level) => `
      <button
        class="btn btn-sm ${settings.difficulty === level ? "btn-secondary" : "btn-outline"} join-item capitalize"
        data-difficulty="${level}"
      >${escape(level)}</button>`,
    )
    .join("");
}

function effectToggles(settings) {
  return Object.entries(EFFECT_LABELS)
    .map(
      ([key, label]) => `
      <label class="label cursor-pointer justify-start gap-3 py-1">
        <input
          type="checkbox"
          class="toggle toggle-sm"
          data-effect="${key}"
          ${settings.effects[key] ? "checked" : ""}
        />
        <span class="label-text text-sm">${escape(label)}</span>
      </label>`,
    )
    .join("");
}

/**
 * The title screen. CPU-vs-CPU plays behind it, so the menu is translucent and
 * the field stays visible; the overlay never fully hides the game.
 */
export function menuScreen(settings) {
  const needsDifficulty = settings.mode !== "2p";
  return `
    <div class="card w-full max-w-md bg-base-200/90 shadow-xl">
      <div class="card-body gap-4">
        <h2 class="text-center text-3xl font-bold tracking-[0.35em] uppercase">Pong</h2>

        <div class="join grid grid-cols-3">${modeButtons(settings)}</div>

        <div class="${needsDifficulty ? "" : "invisible"}">
          <div class="mb-1 text-center text-xs uppercase tracking-widest opacity-60">
            CPU difficulty
          </div>
          <div class="join grid grid-cols-3">${difficultyButtons(settings)}</div>
        </div>

        <button class="btn btn-primary btn-block" data-action="start">Start</button>

        <div class="collapse collapse-arrow border border-base-content/20">
          <input type="checkbox" />
          <div class="collapse-title text-sm font-medium">Effects</div>
          <div class="collapse-content">${effectToggles(settings)}</div>
        </div>
      </div>
    </div>`;
}

export function pauseScreen() {
  return `
    <div class="card w-full max-w-xs bg-base-200/90 shadow-xl">
      <div class="card-body items-center gap-4">
        <h2 class="text-2xl font-bold tracking-[0.3em] uppercase">Paused</h2>
        <button class="btn btn-primary btn-block" data-action="resume">Resume</button>
        <button class="btn btn-ghost btn-block" data-action="menu">Main menu</button>
      </div>
    </div>`;
}

export function gameOverScreen(game, settings) {
  const names =
    settings.mode === "1p"
      ? { left: "You", right: "CPU" }
      : settings.mode === "2p"
        ? { left: "Player 1", right: "Player 2" }
        : { left: "CPU 1", right: "CPU 2" };

  const winner = names[game.winner];
  const { left, right } = game.score;

  return `
    <div class="card w-full max-w-sm bg-base-200/90 shadow-xl">
      <div class="card-body items-center gap-3">
        <h2 class="text-center text-2xl font-bold uppercase tracking-[0.2em]">
          ${escape(winner)} ${game.winner === "left" && settings.mode === "1p" ? "win" : "wins"}
        </h2>
        <p class="font-mono text-4xl tabular-nums">${left} &ndash; ${right}</p>
        <button class="btn btn-primary btn-block" data-action="start">Rematch</button>
        <button class="btn btn-ghost btn-block" data-action="menu">Main menu</button>
      </div>
    </div>`;
}
