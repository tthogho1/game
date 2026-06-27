// Game entities (port of entities.py). Each entity exposes update()/draw(ctx)
// and most carry an `active` flag plus a TYPE_DATA table of per-type stats.
import {
  Color,
  PX,
  PY,
  PW,
  PH,
  BLACK,
  CYAN,
  YELLOW,
  WHITE,
  ORANGE,
  RED,
  GREEN,
  GRAY,
  DGRAY,
  LGRAY,
  LGREEN,
  BLUE,
  PURPLE,
  randint,
  uniform,
  choice,
} from "./constants";
import { Rect } from "./rect";
import { Ctx, drawBlock, fillRect, line, circle, polygon, txt } from "./draw";

// ===== VAUS (Paddle) ============================================

export class Vaus {
  static W = 82;
  static H = 14;
  rect: Rect;
  smash_cd = 0;
  power = false; // Power-up state

  constructor() {
    this.rect = new Rect(
      PX + PW / 2 - Vaus.W / 2,
      PY + PH - 44,
      Vaus.W,
      Vaus.H,
    );
  }

  update(mx: number, my: number): void {
    // Follow mouse position (movement limited to lower half)
    this.rect.centerx = mx;
    this.rect.centery = my;
    const area = new Rect(
      PX,
      PY + Math.floor(PH / 3),
      PW,
      Math.floor((PH * 2) / 3),
    );
    this.rect.clampIp(area);
    if (this.smash_cd > 0) this.smash_cd -= 1;
  }

  /** Compute reflection angle based on contact position (30deg-150deg). */
  reflect_ball(ball: Ball): void {
    const rel = (ball.rect.centerx - this.rect.left) / this.rect.w; // 0..1
    const ang = 30 + rel * 120;
    const spd = ball.speed;
    const rad = (ang * Math.PI) / 180;
    ball.vx = Math.cos(rad) * spd;
    ball.vy = -Math.abs(Math.sin(rad) * spd);
    ball.last_hit = performance.now();
  }

  /** Smash shot: strong upward reflection (triggered by space). */
  smash(ball: Ball): boolean {
    if (this.smash_cd === 0) {
      ball.vx = uniform(-1.5, 1.5);
      ball.vy = -ball.speed * 1.6;
      this.smash_cd = 25;
      return true;
    }
    return false;
  }

  draw(ctx: Ctx): void {
    drawBlock(ctx, this.power ? YELLOW : CYAN, this.rect, 2);
    const cx = this.rect.centerx;
    fillRect(ctx, WHITE, new Rect(cx - 5, this.rect.y + 2, 10, Vaus.H - 4));
    if (this.power) {
      fillRect(ctx, ORANGE, new Rect(cx - 3, this.rect.y + 3, 6, Vaus.H - 6));
    }
  }
}

// ===== Ball (reflecting shot) ==================================

export class Ball {
  static R = 6;
  rect: Rect;
  vx: number;
  vy: number;
  speed: number;
  power: boolean;
  active = true;
  last_hit = 0;
  private trail: [number, number][] = [];

  constructor(x: number, y: number, vx = 0, vy = -5, power = false) {
    this.rect = new Rect(x - Ball.R, y - Ball.R, Ball.R * 2, Ball.R * 2);
    this.vx = vx;
    this.vy = vy;
    this.speed = Math.hypot(vx, vy) || 5.0;
    this.power = power; // Attack mode (piercing)
  }

  update(): void {
    this.trail.push([this.rect.centerx, this.rect.centery]);
    if (this.trail.length > 7) this.trail.shift();

    this.rect.x += Math.trunc(this.vx);
    this.rect.y += Math.trunc(this.vy);

    // Wall collision / reflection
    if (this.rect.left < PX) {
      this.rect.left = PX;
      this.vx = Math.abs(this.vx);
    }
    if (this.rect.right > PX + PW) {
      this.rect.right = PX + PW;
      this.vx = -Math.abs(this.vx);
    }
    if (this.rect.top < PY) {
      this.rect.top = PY;
      this.vy = Math.abs(this.vy);
    }
    if (this.rect.top > PY + PH) {
      this.active = false; // Fell below play area
    }
  }

  normalize(spd?: number): void {
    if (spd === undefined) spd = this.speed;
    const m = Math.hypot(this.vx, this.vy);
    if (m > 0) {
      this.vx = (this.vx / m) * spd;
      this.vy = (this.vy / m) * spd;
    }
  }

  draw(ctx: Ctx): void {
    const col: Color = this.power ? YELLOW : CYAN;
    const len = this.trail.length;
    for (let i = 0; i < len; i++) {
      const pos = this.trail[i];
      const r = Math.max(1, Ball.R - (len - i));
      const aCol: Color = [
        Math.floor((col[0] * i) / len),
        Math.floor((col[1] * i) / len),
        Math.floor((col[2] * i) / len),
      ];
      circle(ctx, aCol, pos[0], pos[1], r);
    }
    drawBlock(ctx, col, this.rect, 1);
    if (this.power) {
      circle(ctx, WHITE, this.rect.centerx, this.rect.centery, Ball.R - 2);
    }
  }
}

// ===== Invader bullet ==========================================

export class Bullet {
  static W = 7;
  static H = 16;
  rect: Rect;
  vy: number;
  active = true;

  constructor(x: number, y: number, vy = 3.5) {
    this.rect = new Rect(x - Bullet.W / 2, y, Bullet.W, Bullet.H);
    this.vy = vy;
  }

  update(): void {
    this.rect.y += Math.trunc(this.vy);
    if (this.rect.top > PY + PH) this.active = false;
  }

  draw(ctx: Ctx): void {
    fillRect(ctx, RED, this.rect);
    const inner = this.rect.inflate(-2, -4);
    fillRect(ctx, ORANGE, inner);
    fillRect(ctx, WHITE, new Rect(inner.centerx - 1, inner.top, 2, 3));
  }
}

// ===== Invader =============================================

type InvaderType = "A" | "B" | "C" | "BOSS";
interface InvaderStats {
  col: Color;
  hp: number;
  sc: number;
  w: number;
  h: number;
}

export class Invader {
  static TYPE_DATA: Record<InvaderType, InvaderStats> = {
    A: { col: GREEN, hp: 1, sc: 100, w: 30, h: 22 },
    B: { col: YELLOW, hp: 2, sc: 200, w: 30, h: 22 },
    C: { col: RED, hp: 3, sc: 300, w: 32, h: 24 },
    BOSS: { col: PURPLE, hp: 12, sc: 1500, w: 64, h: 48 },
  };

  rect: Rect;
  itype: InvaderType;
  color: Color;
  hp: number;
  max_hp: number;
  score: number;
  active = true;
  anim: number;
  shoot_cd: number;
  dx = 1;
  flash = 0;

  constructor(x: number, y: number, itype: InvaderType = "A") {
    const d = Invader.TYPE_DATA[itype];
    this.rect = new Rect(x, y, d.w, d.h);
    this.itype = itype;
    this.color = d.col;
    this.hp = d.hp;
    this.max_hp = d.hp;
    this.score = d.sc;
    this.anim = randint(0, 59);
    this.shoot_cd = randint(60, 240);
  }

  update(bullets: Bullet[], hard: boolean): void {
    this.anim = (this.anim + 1) % 60;
    this.flash = Math.max(0, this.flash - 1);
    const spd = hard ? 1.5 : 1.0;

    // Boss moves left/right
    if (this.itype === "BOSS") {
      this.rect.x += Math.trunc(this.dx * 1.0 * spd);
      if (this.rect.right > PX + PW - 4 || this.rect.left < PX + 4) {
        this.dx *= -1;
      }
    }

    // Shooting
    this.shoot_cd -= 1;
    if (this.shoot_cd <= 0) {
      const base = hard ? 50 : 100;
      this.shoot_cd = randint(base, base * 3);
      const nShots = this.itype === "BOSS" ? 3 : 1;
      for (let k = 0; k < nShots; k++) {
        const ox = (k - Math.floor(nShots / 2)) * 20;
        bullets.push(
          new Bullet(this.rect.centerx + ox, this.rect.bottom, 4.5 * spd),
        );
      }
    }
  }

  hit(dmg = 1): boolean {
    this.hp -= dmg;
    this.flash = 8;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  draw(ctx: Ctx): void {
    const c: Color = this.flash % 2 === 1 ? WHITE : this.color;
    drawBlock(ctx, c, this.rect, 2);

    // Eyes
    const ey = this.rect.top + 5;
    for (const ox of [6, this.rect.w - 13]) {
      fillRect(ctx, WHITE, new Rect(this.rect.left + ox, ey, 7, 7));
      fillRect(ctx, BLACK, new Rect(this.rect.left + ox + 2, ey + 2, 3, 3));
    }

    // Animated legs
    const legY = this.rect.bottom - 5;
    const lc: Color = [
      Math.max(this.color[0] - 50, 0),
      Math.max(this.color[1] - 50, 0),
      Math.max(this.color[2] - 50, 0),
    ];
    const phase = Math.floor(this.anim / 15) % 2;
    const offsets: [number, number][] = [
      [3, 10],
      [this.rect.w - 13, this.rect.w - 6],
    ];
    for (const [lo] of offsets) {
      const ox = phase === 0 ? 0 : 4;
      fillRect(ctx, lc, new Rect(this.rect.left + lo + ox, legY, 5, 5));
    }

    // HP gauge (boss / tough enemies)
    if (
      (this.itype === "BOSS" || this.itype === "C") &&
      this.hp < this.max_hp
    ) {
      const bw = this.rect.w;
      fillRect(ctx, DGRAY, new Rect(this.rect.left, this.rect.top - 7, bw, 4));
      const hw = Math.floor((bw * Math.max(0, this.hp)) / this.max_hp);
      fillRect(ctx, GREEN, new Rect(this.rect.left, this.rect.top - 7, hw, 4));
    }
  }
}

// ===== Block =================================================

type BlockType = "normal" | "hard" | "indestr" | "bomb" | "move";
interface BlockStats {
  col: Color;
  hp: number;
  sc: number;
}

export class Block {
  static W = 44;
  static H = 22;
  static TYPE_DATA: Record<BlockType, BlockStats> = {
    normal: { col: BLUE, hp: 1, sc: 50 },
    hard: { col: GRAY, hp: 3, sc: 150 },
    indestr: { col: DGRAY, hp: -1, sc: 0 },
    bomb: { col: ORANGE, hp: 1, sc: 100 },
    move: { col: LGREEN, hp: 1, sc: 80 },
  };

  rect: Rect;
  btype: BlockType;
  base_col: Color;
  color: Color;
  hp: number;
  max_hp: number;
  score: number;
  active = true;
  dx = 1;
  flash = 0;

  constructor(gx: number, gy: number, btype: BlockType = "normal") {
    const d = Block.TYPE_DATA[btype];
    this.rect = new Rect(
      PX + 4 + gx * (Block.W + 4),
      PY + 8 + gy * (Block.H + 4),
      Block.W,
      Block.H,
    );
    this.btype = btype;
    this.base_col = d.col;
    this.color = d.col;
    this.hp = d.hp;
    this.max_hp = Math.max(d.hp, 1);
    this.score = d.sc;
  }

  update(): void {
    this.flash = Math.max(0, this.flash - 1);
    if (this.btype === "move") {
      this.rect.x += this.dx;
      if (this.rect.right > PX + PW - 4 || this.rect.left < PX + 4) {
        this.dx *= -1;
      }
    }
  }

  hit(dmg = 1): boolean {
    if (this.hp === -1) return false;
    this.hp -= dmg;
    this.flash = 6;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  draw(ctx: Ctx): void {
    if (!this.active) return;
    let c: Color;
    if (this.flash % 2 === 1) {
      c = WHITE;
    } else if (this.max_hp > 1 && this.hp >= 0) {
      const r = this.hp / this.max_hp;
      c = [
        Math.floor(this.base_col[0] * r + DGRAY[0] * (1 - r)),
        Math.floor(this.base_col[1] * r + DGRAY[1] * (1 - r)),
        Math.floor(this.base_col[2] * r + DGRAY[2] * (1 - r)),
      ];
    } else {
      c = this.base_col;
    }
    drawBlock(ctx, c, this.rect, 2);

    const cx = this.rect.centerx;
    const cy = this.rect.centery;
    if (this.btype === "indestr") {
      line(ctx, LGRAY, this.rect.topleft, this.rect.bottomright, 2);
      line(ctx, LGRAY, this.rect.topright, this.rect.bottomleft, 2);
    } else if (this.btype === "bomb") {
      circle(ctx, RED, cx, cy, 6);
      circle(ctx, YELLOW, cx, cy, 3);
    } else if (this.btype === "move") {
      polygon(ctx, WHITE, [
        [this.rect.left + 5, cy],
        [this.rect.left + 14, this.rect.top + 4],
        [this.rect.left + 14, this.rect.bottom - 4],
      ]);
    }
  }
}

// ===== Item =================================================

type ItemType = "time" | "attack" | "gauge" | "medal" | "wide";

export class Item {
  static W = 22;
  static H = 22;
  static TYPE_DATA: Record<ItemType, [Color, string]> = {
    time: [LGREEN, "+TIME"],
    attack: [ORANGE, "ATK+"],
    gauge: [YELLOW, "GAGE"],
    medal: [YELLOW, "COIN"],
    wide: [CYAN, "WIDE"],
  };

  rect: Rect;
  itype: ItemType;
  color: Color;
  label: string;
  vy = 1.8;
  active = true;

  constructor(x: number, y: number, itype?: ItemType) {
    if (itype === undefined) {
      itype = choice<ItemType>(
        ["time", "attack", "gauge", "medal", "wide"],
        [3, 3, 2, 4, 2],
      );
    }
    const d = Item.TYPE_DATA[itype];
    this.rect = new Rect(x - Item.W / 2, y, Item.W, Item.H);
    this.itype = itype;
    this.color = d[0];
    this.label = d[1];
  }

  update(): void {
    this.rect.y += Math.trunc(this.vy);
    if (this.rect.top > PY + PH) this.active = false;
  }

  draw(ctx: Ctx): void {
    drawBlock(ctx, this.color, this.rect, 2);
    txt(ctx, this.label, this.rect.x + 1, this.rect.centery - 5, BLACK, 9);
  }
}

// ===== Particle =============================================

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  col: Color;
  sz: number;
}

export class Particle {
  private ps: P[] = [];

  constructor(x: number, y: number, col: Color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = uniform(0, Math.PI * 2);
      const sp = uniform(2, 7);
      this.ps.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: randint(15, 35),
        col,
        sz: randint(2, 5),
      });
    }
  }

  update(): void {
    for (const p of this.ps) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.life -= 1;
    }
    this.ps = this.ps.filter((p) => p.life > 0);
  }

  draw(ctx: Ctx): void {
    for (const p of this.ps) {
      const f = p.life / 35;
      const sz = Math.max(1, Math.floor(p.sz * f));
      fillRect(ctx, p.col, new Rect(Math.floor(p.x), Math.floor(p.y), sz, sz));
    }
  }

  get done(): boolean {
    return this.ps.length === 0;
  }
}
