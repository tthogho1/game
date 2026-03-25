# Arkanoid vs Invaders

A small hybrid Arkanoid / Space Invaders game implemented in Python + Pygame.
This repository contains a refactored, modular version of the original single-file script.

## Quick Start (Windows PowerShell)

1. Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install the dependency:

```powershell
python -m pip install --upgrade pip
python -m pip install pygame
```

3. Run the game:

```powershell
python arkanoid_vs_invaders.py
```

## Files / Structure

- `arkanoid_vs_invaders.py` — Lightweight launcher (entrypoint).
- `game.py` — `Game` class: main loop, state handling, drawing, and gameplay logic.
- `entities.py` — Game entities: `Vaus`, `Ball`, `Invader`, `Block`, `Item`, `Particle`, etc.
- `stages.py` — `make_stage()` function: stage layouts and generation.
- `utils.py` — Shared constants (screen/play area), helpers, and small sound generator.

## Controls

- Move: mouse
- Smash / Confirm: Space
- Menu / Quit: Esc
- Skill select (during selection): keys 1/2/3/4

## Notes

- Tested with Python 3.11+ and pygame 2.6.x. The repo was developed using a local `.venv`.
- Comments and many inline notes are in English; some in-game UI strings remain in Japanese.

## Next steps

If you want, I can:

- Translate in-game Japanese UI strings to English.
- Add a `requirements.txt` file.
- Add a package `__main__` entry for `python -m game` style launching.

Enjoy — tell me which next step you'd like.
