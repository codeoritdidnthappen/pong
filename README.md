# Pong

Browser Pong. Vanilla ES modules on a 2D canvas, themed with daisyUI.

```bash
npm install
cp .env.example .env    # optional; see below
npm run dev             # http://localhost:3000 by default
npm test                # the physics and scoring suite
npm run build           # static output in dist/
```

## Local configuration

The dev server's port is read from a gitignored `.env`. Copy the example and
edit it if 3000 is taken, or if you just want a port of your own:

```bash
cp .env.example .env
```

```ini
# .env
PONG_PORT=3000
```

Set `PONG_PORT=0` to let the OS pick any free port. This affects `npm run dev`
only; it has no effect on `npm run build`, and nothing in `.env` reaches the
browser, because the name has no `VITE_` prefix and so is never inlined into the
client bundle. [vite.config.js](vite.config.js) reads it explicitly with
`loadEnv(mode, process.cwd(), '')`, whose empty third argument is what makes
unprefixed variables visible to the config — see
[Using Environment Variables in Config](https://vite.dev/config/#using-environment-variables-in-config).

It is `PONG_PORT` and not `PORT` on purpose. That empty prefix also merges the
entire ambient environment over your `.env` file, and a stray `export PORT=8080`
from some other project would silently win.

Give it a value that isn't a number and Vite discards it and starts on **5173**,
its own default, without complaint. So if the server comes up somewhere you did
not expect, check `.env` for a typo before anything else.

The server runs with `strictPort`, so an occupied port is a loud failure rather
than a silent hop to the next one. A silently moved port leaves your bookmarks —
and `.claude/launch.json` — pointing at a server that isn't there. If you change
`PONG_PORT`, update the `port` in `.claude/launch.json` to match; that file is
committed, because it is how the browser tooling starts the dev server, and it
cannot read `.env`.

## Deployment

Hosted on Vercel at **https://pong.daviddean.dev** as its own project, connected
to this GitHub repo:

- A merge to `main` deploys production; every branch and PR gets its own preview
  URL, so a change can be reviewed on a real deployed page before it merges.
- The build command is `npm test && npm run build` (in [vercel.json](vercel.json)),
  so a failing suite blocks the deploy — neither a preview nor production can
  ship red.
- Fingerprinted assets under `/assets/` are cached for a year and immutable;
  `index.html` is never cached, so a new deploy is picked up immediately.

The build needs no environment variables: `PONG_PORT` configures the local dev
server only and is irrelevant to the production build.

DNS for `daviddean.dev` is managed by Vercel (the nameservers point at
`vercel-dns.com`), so the `pong` subdomain is added inside Vercel and needs no
change at the domain registrar.

## Playing

| | |
|---|---|
| Left paddle | <kbd>W</kbd> / <kbd>S</kbd> |
| Right paddle | <kbd>↑</kbd> / <kbd>↓</kbd> |
| Pause | <kbd>Esc</kbd> or <kbd>P</kbd> |
| Mute | <kbd>M</kbd> |
| Start / rematch | <kbd>Space</kbd> |

Three modes — one player against the CPU, two players on one keyboard, or CPU
against CPU. A CPU-vs-CPU match runs behind the title screen as an attract mode,
exactly as the cabinet did.

First to 11, win by two.

## Design decisions

**The ball's angle comes from where it hits the paddle, not from the angle it
arrived at.** This is the 1972 rule, and it is the whole game: hitting near the
edge of the paddle deflects the ball steeply, hitting the middle sends it flat.
A physically-honest mirror reflection would give the player no control over the
ball and rallies would never develop. See `bounceOffPaddle` in
[physics.js](src/game/physics.js).

**The ball accelerates on every paddle hit and resets on every serve.** Without
this, two competent players deadlock at deuce forever; with it, every rally
self-terminates and every point starts fair. `tests/match.test.js` asserts that
every seeded CPU-vs-CPU pairing actually finishes.

**Fixed timestep, swept collision.** The simulation only advances in 1/120 s
steps, and the ball's path is intersected against the paddle analytically rather
than tested for overlap at frame boundaries. A dropped frame or a 1000 unit/s
ball therefore cannot tunnel through a paddle. This is not hypothetical: it is
the bug you would otherwise ship, because it appears roughly once per fifty
rallies and is near-impossible to reproduce by hand.

**Paddles are driven by interchangeable controllers.** A controller answers one
question per tick — up, down, or hold — and owns its own speed ceiling. Nothing
downstream knows whether a human or the CPU is behind it, which is why 1P, 2P
and CPU-vs-CPU are one code path and not three.

**The CPU loses because it is slow and slightly wrong, not because it throws the
match.** It always knows exactly where the ball is. It simply has a capped
paddle speed and aims at a point that is not quite the ball, and it does not
predict the intercept — so a steep shot beats it. Difficulty tunes exactly two
numbers, in [constants.js](src/game/constants.js). `tests/match.test.js` checks
that Hard actually beats Easy, so the difficulty menu cannot quietly become a
lie.

**The canvas is painted from the active daisyUI theme.** The ball is `primary`,
the paddles are `secondary`, the field is `base-100`, the center line is
`base-content`. A theme whose ball or paddles wash out against its own field is
unplayable, so only themes clearing a 3:1 contrast ratio ship:

```bash
node scripts/theme-contrast.mjs
```

That script reads daisyUI's own theme definitions and computes the real ratios.
It rejects 17 of the 35 stock themes — including `retro`, whose ball scores
1.53:1 against its cream field, and `luxury`, which pairs a brilliant white ball
with navy paddles you cannot see. Neither stock theme is monochrome anyway, so
the authentic cabinet ships as two custom themes: **arcade** (white on black,
the default) and **phosphor** (amber CRT).

## Layout

```
src/game/      pure simulation — no canvas, no DOM, no clock
  constants.js   the tunable numbers, in one place
  physics.js     swept collision and the Atari bounce
  scoring.js     first to 11, win by 2
  controllers.js human and CPU intent
  state.js       the game object and its one step function
  loop.js        fixed-timestep accumulator
src/render/    canvas painting, CRT effects, theme colour resolution
src/audio/     three square-wave beeps, as per the original board
src/ui/        daisyUI menu and localStorage settings
tests/         vitest over src/game — the logic is pure, so this is enough
```

The simulation is deterministic given a seed, which is what makes the soak test
in `tests/match.test.js` meaningful: it runs ten thousand frames of CPU-vs-CPU
and asserts the ball never leaves the field, never rests inside a paddle, and
never exceeds its speed cap.
