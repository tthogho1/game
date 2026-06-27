# Arkanoid vs Invaders — Web (React + TypeScript)

A browser port of the Python/Pygame game (in the parent folder), rewritten as a
React + Vite + TypeScript web application. The game renders to a single
`<canvas>` driven by `requestAnimationFrame`; React only hosts the canvas and
the surrounding page UI.

## Run

```bash
npm install
npm run dev      # dev server at http://localhost:5173
```

## Build

```bash
npm run build    # type-check + bundle into dist/
npm run preview  # serve the production build locally
```

`dist/` is a static bundle (`base: "./"`) that can be hosted anywhere —
GitHub Pages, itch.io, Netlify, etc.

## Controls

- Move: mouse
- Smash / Confirm: Space
- Menu: Esc
- Skill select (during selection): 1 / 2 / 3 / 4

Audio starts after the first key press (browser autoplay policy).

## Structure

The `src/game/` modules mirror the original Python files:

| Web (`src/game/`) | Python original | Role |
|---|---|---|
| `constants.ts` | `utils.py` (consts) | Screen/play-area constants, palette, RNG helpers |
| `rect.ts` | `pygame.Rect` | Axis-aligned rect with edge/center accessors |
| `draw.ts` | `utils.draw_block` / `txt` | Canvas 2D drawing helpers |
| `sound.ts` | `utils.make_snd` | Procedural SFX via the Web Audio API |
| `entities.ts` | `entities.py` | `Vaus`, `Ball`, `Bullet`, `Invader`, `Block`, `Item`, `Particle` |
| `stages.ts` | `stages.py` | `makeStage(n)` layouts |
| `game.ts` | `game.py` | `Game` class: state machine, loop, collisions, rendering |

`src/components/GameCanvas.tsx` mounts the canvas and the `Game` instance;
`src/App.tsx` is the page shell.

### Notable porting decisions

- **Loop:** the blocking `while True` + `clock.tick(60)` becomes a
  `requestAnimationFrame` loop with a fixed 60 Hz accumulator, so gameplay speed
  is independent of the display refresh rate (120 Hz monitors don't run 2×).
- **Exit:** there's no process to quit in a browser, so Esc only backs out of
  play to the menu (the original called `sys.exit()`).
- **Audio:** baked-in volume per buffer, created lazily on the first user
  gesture to satisfy browser autoplay policy.
- **Skill state** that the Python code created lazily with `hasattr`
  (`_support_cd`, `_wide_timer`) is declared as normal fields and reset in
  `startStage()`.
