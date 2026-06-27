// Canvas 2D drawing helpers (port of utils.draw_block / txt + small shims for
// the pygame.draw.* calls used across the game).
import { Color, rgb, WHITE } from "./constants";
import { Rect } from "./rect";

export type Ctx = CanvasRenderingContext2D;

export function fillRect(ctx: Ctx, col: Color, r: Rect): void {
  ctx.fillStyle = rgb(col);
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** Outline a rect with the given border width, kept inside the rect bounds. */
export function strokeRect(ctx: Ctx, col: Color, r: Rect, w: number): void {
  ctx.strokeStyle = rgb(col);
  ctx.lineWidth = w;
  ctx.strokeRect(r.x + w / 2, r.y + w / 2, r.w - w, r.h - w);
}

export function line(
  ctx: Ctx,
  col: Color,
  a: [number, number],
  b: [number, number],
  w: number,
): void {
  ctx.strokeStyle = rgb(col);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

export function circle(
  ctx: Ctx,
  col: Color,
  x: number,
  y: number,
  rad: number,
): void {
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.arc(x, y, rad, 0, Math.PI * 2);
  ctx.fill();
}

export function polygon(ctx: Ctx, col: Color, pts: [number, number][]): void {
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

/** Draw a voxel-style 3D block (fill + light/shadow edges). */
export function drawBlock(ctx: Ctx, color: Color, rect: Rect, bw = 2): void {
  fillRect(ctx, color, rect);
  const hi: Color = [
    Math.min(color[0] + 70, 255),
    Math.min(color[1] + 70, 255),
    Math.min(color[2] + 70, 255),
  ];
  const sh: Color = [
    Math.max(color[0] - 70, 0),
    Math.max(color[1] - 70, 0),
    Math.max(color[2] - 70, 0),
  ];
  line(ctx, hi, rect.topleft, rect.topright, bw);
  line(ctx, hi, rect.topleft, rect.bottomleft, bw);
  line(ctx, sh, rect.bottomleft, rect.bottomright, bw);
  line(ctx, sh, rect.topright, rect.bottomright, bw);
}

/** Render bold monospace text with its top-left at (x, y). */
export function txt(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  col: Color = WHITE,
  sz = 16,
  bold = true,
): void {
  ctx.font = `${bold ? "bold " : ""}${sz}px monospace`;
  ctx.fillStyle = rgb(col);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(s, x, y);
}
