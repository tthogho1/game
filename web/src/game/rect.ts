/**
 * Minimal replacement for pygame.Rect: an axis-aligned rectangle with the
 * derived edge/center accessors and the few helpers the game relies on.
 */
export class Rect {
  x: number;
  y: number;
  w: number;
  h: number;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  get left(): number {
    return this.x;
  }
  set left(v: number) {
    this.x = v;
  }

  get top(): number {
    return this.y;
  }
  set top(v: number) {
    this.y = v;
  }

  get right(): number {
    return this.x + this.w;
  }
  set right(v: number) {
    this.x = v - this.w;
  }

  get bottom(): number {
    return this.y + this.h;
  }
  set bottom(v: number) {
    this.y = v - this.h;
  }

  get centerx(): number {
    return this.x + this.w / 2;
  }
  set centerx(v: number) {
    this.x = v - this.w / 2;
  }

  get centery(): number {
    return this.y + this.h / 2;
  }
  set centery(v: number) {
    this.y = v - this.h / 2;
  }

  get topleft(): [number, number] {
    return [this.left, this.top];
  }
  get topright(): [number, number] {
    return [this.right, this.top];
  }
  get bottomleft(): [number, number] {
    return [this.left, this.bottom];
  }
  get bottomright(): [number, number] {
    return [this.right, this.bottom];
  }

  colliderect(o: Rect): boolean {
    return (
      this.left < o.right &&
      this.right > o.left &&
      this.top < o.bottom &&
      this.bottom > o.top
    );
  }

  /** Move this rect to lie inside `area` (centered on it if larger). */
  clampIp(area: Rect): void {
    if (this.w >= area.w) {
      this.x = area.x + (area.w - this.w) / 2;
    } else if (this.left < area.left) {
      this.left = area.left;
    } else if (this.right > area.right) {
      this.right = area.right;
    }

    if (this.h >= area.h) {
      this.y = area.y + (area.h - this.h) / 2;
    } else if (this.top < area.top) {
      this.top = area.top;
    } else if (this.bottom > area.bottom) {
      this.bottom = area.bottom;
    }
  }

  /** Return a new rect grown by (dx, dy), keeping the same center. */
  inflate(dx: number, dy: number): Rect {
    return new Rect(this.x - dx / 2, this.y - dy / 2, this.w + dx, this.h + dy);
  }
}
