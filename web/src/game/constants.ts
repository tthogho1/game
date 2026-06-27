// Shared constants for Arkanoid vs Invaders (port of utils.py).

export const SCREEN_W = 800;
export const SCREEN_H = 600;
export const FPS = 60;

// Play area
export const PX = 40;
export const PY = 78;
export const PW = 720;
export const PH = 490;

export type Color = [number, number, number];

// Voxel-style color palette
export const BLACK: Color = [0, 0, 0];
export const WHITE: Color = [255, 255, 255];
export const GRAY: Color = [140, 140, 140];
export const DGRAY: Color = [50, 50, 60];
export const LGRAY: Color = [200, 200, 210];
export const RED: Color = [220, 50, 50];
export const GREEN: Color = [60, 200, 80];
export const LGREEN: Color = [120, 240, 130];
export const BLUE: Color = [60, 110, 220];
export const CYAN: Color = [0, 220, 230];
export const YELLOW: Color = [240, 210, 0];
export const ORANGE: Color = [240, 140, 0];
export const PURPLE: Color = [170, 40, 220];
export const PINK: Color = [240, 100, 190];
export const DBLUE: Color = [10, 10, 25];

export function rgb(c: Color): string {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

// Random helpers mirroring Python's random module.
export const randint = (a: number, b: number): number =>
  Math.floor(Math.random() * (b - a + 1)) + a;

export const uniform = (a: number, b: number): number =>
  Math.random() * (b - a) + a;

/** Weighted single choice, like random.choices(items, weights=...)[0]. */
export function choice<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
