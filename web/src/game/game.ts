// Main game class (port of game.py). Owns the state machine, the fixed-timestep
// loop, all collision/scoring logic, and rendering to the canvas.
import {
  SCREEN_W,
  SCREEN_H,
  FPS,
  PX,
  PY,
  PW,
  PH,
  Color,
  BLACK,
  WHITE,
  GRAY,
  DGRAY,
  LGRAY,
  RED,
  GREEN,
  LGREEN,
  BLUE,
  CYAN,
  YELLOW,
  ORANGE,
  PURPLE,
  PINK,
  DBLUE,
  rgb,
  uniform,
} from "./constants";
import { Rect } from "./rect";
import { Ctx, drawBlock, fillRect, strokeRect, line, txt } from "./draw";
import {
  Vaus,
  Ball,
  Bullet,
  Invader,
  Block,
  Item,
  Particle,
} from "./entities";
import { makeStage, Target } from "./stages";
import { SoundManager } from "./sound";

type State = "menu" | "skill" | "play" | "clear" | "over" | "allclear";
type ItemType = "time" | "attack" | "gauge" | "medal" | "wide";

// Normalized key tokens produced from the DOM KeyboardEvent.
type KeyToken =
  | "esc"
  | "space"
  | "enter"
  | "h"
  | "n"
  | "1"
  | "2"
  | "3"
  | "4"
  | null;

export class Game {
  static readonly S_MENU: State = "menu";
  static readonly S_SKILL: State = "skill";
  static readonly S_PLAY: State = "play";
  static readonly S_CLEAR: State = "clear";
  static readonly S_OVER: State = "over";
  static readonly S_ALLCLEAR: State = "allclear";
  static readonly MAX_STAGES = 5;

  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private snd = new SoundManager();

  // ---- loop state ----
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private acc = 0;

  // ---- input ----
  private mouseX = SCREEN_W / 2;
  private mouseY = SCREEN_H / 2;

  // ---- game state ----
  private state: State = Game.S_MENU;
  private stage_num = 1;
  private total_score = 0;
  private hard_mode = false;
  private skill: string | null = null;
  private menu_anim = 0;

  // ---- per-stage state (set in startStage) ----
  private vaus!: Vaus;
  private invaders: Invader[] = [];
  private blocks: Block[] = [];
  private target: Target = "invader";
  private time_limit = 60;
  private timer = 0;
  private bullets: Bullet[] = [];
  private balls: Ball[] = [];
  private items: Item[] = [];
  private particles: Particle[] = [];
  private score = 0;
  private combo = 0;
  private combo_cd = 0;
  private atk_gauge = 0;
  private atk_max = 100;
  private atk_mode = false;
  private atk_ball: Ball | null = null;
  private result_cd = 0;
  private support_cd = 0;
  private wide_timer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    document.title = "アルカノイド vs インベーダー";
    this.initGame();
  }

  // ------------------------------------------------------------------ Lifecycle

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener("keydown", this.onKeyDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    // Touch: drag on the canvas moves the paddle (smartphone support).
    this.canvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
  }

  private loop = (t: number): void => {
    if (!this.running) return;
    let dt = t - this.lastTime;
    this.lastTime = t;
    if (dt > 250) dt = 250; // avoid spiral-of-death after tab was backgrounded
    this.acc += dt;
    const step = 1000 / FPS;
    let steps = 0;
    while (this.acc >= step && steps < 5) {
      this.tick();
      this.acc -= step;
      steps++;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  /** One fixed 60Hz update+draw (the body of the original run() loop). */
  private tick(): void {
    switch (this.state) {
      case Game.S_MENU:
        this.updateMenu();
        break;
      case Game.S_SKILL:
        this.drawSkill();
        break;
      case Game.S_PLAY:
        this.updatePlay();
        break;
      case Game.S_CLEAR:
        this.updateClear();
        break;
      case Game.S_OVER:
        this.updateOver();
        break;
      case Game.S_ALLCLEAR:
        this.updateAllclear();
        break;
    }
  }

  // ------------------------------------------------------------------ Input

  private onMouseMove = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = (e.clientX - r.left) * (SCREEN_W / r.width);
    this.mouseY = (e.clientY - r.top) * (SCREEN_H / r.height);
  };

  // ----- Touch (smartphone) -----

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault(); // stop page scroll/zoom and synthetic mouse events
    // First gesture unlocks the audio context (browser autoplay policy).
    this.snd.init();
    this.snd.resume();
    this.updateTouch(e);
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    this.updateTouch(e);
  };

  /** Map the active touch point to canvas coords, reusing the mouse pipeline. */
  private updateTouch(e: TouchEvent): void {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (!t) return;
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = (t.clientX - r.left) * (SCREEN_W / r.width);
    this.mouseY = (t.clientY - r.top) * (SCREEN_H / r.height);
  }

  /**
   * Trigger a key action from an on-screen touch button. Phones have no
   * keyboard, so the UI buttons in GameCanvas route through here, reusing the
   * exact same dispatch as physical keys (a Space-key alternative for touch).
   */
  press(token: NonNullable<KeyToken>): void {
    this.snd.init();
    this.snd.resume();
    this.handleKey(token);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = this.tokenFor(e);
    if (key === null) return;
    e.preventDefault();
    // First gesture unlocks the audio context (browser autoplay policy).
    this.snd.init();
    this.snd.resume();
    this.handleKey(key);
  };

  private tokenFor(e: KeyboardEvent): KeyToken {
    if (e.code === "Space" || e.key === " ") return "space";
    if (e.key === "Enter") return "enter";
    if (e.key === "Escape") return "esc";
    const k = e.key.toLowerCase();
    if (k === "h") return "h";
    if (k === "n") return "n";
    if (k === "1" || k === "2" || k === "3" || k === "4") return k;
    return null;
  }

  private play(name: string): void {
    this.snd.play(name);
  }

  // ------------------------------------------------------------------ Init

  private initGame(): void {
    this.state = Game.S_MENU;
    this.stage_num = 1;
    this.total_score = 0;
    this.hard_mode = false;
    this.skill = null;
    this.menu_anim = 0;
  }

  private startStage(): void {
    this.vaus = new Vaus();
    const { invaders, blocks, target, tlim } = makeStage(this.stage_num);
    this.invaders = invaders;
    this.blocks = blocks;
    this.target = target;
    this.time_limit = tlim;
    this.timer = tlim * FPS;

    this.bullets = [];
    this.balls = [];
    this.items = [];
    this.particles = [];

    this.score = 0;
    this.combo = 0;
    this.combo_cd = 0;
    this.atk_gauge = 0;
    this.atk_max = 100;
    this.atk_mode = false;
    this.atk_ball = null;

    this.support_cd = 0;
    this.wide_timer = 0;
    this.result_cd = 0;
    this.state = Game.S_PLAY;
  }

  // ------------------------------------------------------------------ Key dispatch

  private handleKey(key: NonNullable<KeyToken>): void {
    if (key === "esc") {
      // On web there is no process to quit; Esc only backs out of play.
      if (this.state === Game.S_PLAY) this.state = Game.S_MENU;
      return;
    }

    if (this.state === Game.S_MENU) {
      if (key === "space" || key === "enter") {
        this.stage_num = 1;
        this.total_score = 0;
        this.state = Game.S_SKILL;
      } else if (key === "h") {
        this.hard_mode = true;
      } else if (key === "n") {
        this.hard_mode = false;
      }
    } else if (this.state === Game.S_SKILL) {
      const skillMap: Record<string, string> = {
        "1": "SUPPORT",
        "2": "BOOST",
        "3": "CHARGE",
        "4": "HOMING",
      };
      if (key in skillMap) {
        this.skill = skillMap[key];
        this.startStage();
      } else if (key === "space" || key === "enter") {
        this.skill = null;
        this.startStage();
      }
    } else if (this.state === Game.S_PLAY) {
      if (key === "space") {
        const activeBalls = this.balls.filter((b) => b.active);
        if (activeBalls.length > 0) {
          const target = activeBalls.reduce((a, b) =>
            b.rect.y < a.rect.y ? b : a,
          );
          if (this.vaus.smash(target)) this.play("smash");
        }
      }
    } else if (
      this.state === Game.S_CLEAR ||
      this.state === Game.S_OVER ||
      this.state === Game.S_ALLCLEAR
    ) {
      if (key === "space") {
        if (this.state === Game.S_CLEAR) {
          if (this.stage_num >= Game.MAX_STAGES) {
            this.state = Game.S_ALLCLEAR;
          } else {
            this.stage_num += 1;
            this.state = Game.S_SKILL;
          }
        } else {
          this.initGame();
        }
      }
    }
  }

  // ------------------------------------------------------------------ Gameplay

  private updatePlay(): void {
    this.vaus.update(this.mouseX, this.mouseY);

    // Timer
    this.timer -= 1;
    if (this.timer <= 0) {
      this.play("gameover");
      this.state = Game.S_OVER;
      return;
    }

    // Combo timeout
    if (this.combo_cd > 0) this.combo_cd -= 1;
    else this.combo = 0;

    for (const inv of this.invaders) {
      if (inv.active) inv.update(this.bullets, this.hard_mode);
    }
    for (const b of this.blocks) {
      if (b.active) b.update();
    }
    for (const b of this.bullets) b.update();

    for (const ball of this.balls) {
      ball.update();
      if (ball.active) {
        this.ballVsBlocks(ball);
        this.ballVsInvaders(ball);
      }
    }

    // Vaus collides with bullet -> convert to ball
    for (const bul of this.bullets) {
      if (bul.active && this.vaus.rect.colliderect(bul.rect)) {
        const nb = new Ball(bul.rect.centerx, bul.rect.top, 0, -5, this.atk_mode);
        nb.speed = 5.5 + this.stage_num * 0.3;
        if (this.hard_mode) nb.speed *= 1.2;
        this.vaus.reflect_ball(nb);
        if (this.skill === "BOOST") nb.speed *= 1.2;
        nb.normalize(nb.speed);
        this.balls.push(nb);
        bul.active = false;
        this.atk_gauge = Math.min(this.atk_max, this.atk_gauge + 12);
        this.combo += 1;
        this.combo_cd = 150;
        this.play("reflect");
        this.particles.push(
          new Particle(bul.rect.centerx, bul.rect.centery, CYAN, 8),
        );
      }
    }

    // Extra reflection: returning balls
    for (const ball of this.balls) {
      if (ball.active && ball.vy > 0) {
        if (this.vaus.rect.colliderect(ball.rect)) {
          if (performance.now() - ball.last_hit > 300) {
            this.vaus.reflect_ball(ball);
            this.play("reflect");
            this.particles.push(
              new Particle(ball.rect.centerx, ball.rect.top, CYAN, 5),
            );
          }
        }
      }
    }

    // Attack gauge full -> enter attack mode
    if (this.atk_gauge >= this.atk_max && !this.atk_mode) {
      this.atk_mode = true;
      this.play("attack");
      const ab = new Ball(
        this.vaus.rect.centerx,
        this.vaus.rect.top - 8,
        uniform(-2, 2),
        -8,
        true,
      );
      ab.speed = 8;
      this.atk_ball = ab;
      this.balls.push(ab);
      this.particles.push(
        new Particle(this.vaus.rect.centerx, this.vaus.rect.top, YELLOW, 20),
      );
    }

    if (this.atk_mode && this.atk_ball && !this.atk_ball.active) {
      this.atk_mode = false;
      this.atk_gauge = 0;
      this.atk_ball = null;
    }

    // Skill: CHARGE -> auto increase gauge
    if (this.skill === "CHARGE" && !this.atk_mode) {
      this.atk_gauge = Math.min(this.atk_max, this.atk_gauge + 0.3);
    }

    // Skill: SUPPORT -> periodically fire support ball
    if (this.skill === "SUPPORT") {
      this.support_cd -= 1;
      if (this.support_cd <= 0) {
        this.support_cd = 180;
        for (const inv of this.invaders) {
          if (inv.active) {
            const sb = new Ball(inv.rect.centerx, inv.rect.bottom + 5, 0, -6);
            sb.speed = 6;
            this.balls.push(sb);
            break;
          }
        }
      }
    }

    // Wide power-up timeout
    if (this.wide_timer > 0) {
      this.wide_timer -= 1;
      if (this.wide_timer === 0) this.vaus.power = false;
    }

    // Items
    for (const it of this.items) {
      it.update();
      if (it.active && this.vaus.rect.colliderect(it.rect)) {
        this.applyItem(it);
        it.active = false;
      }
    }

    for (const p of this.particles) p.update();

    // Remove dead objects
    this.bullets = this.bullets.filter((b) => b.active);
    this.balls = this.balls.filter((b) => b.active);
    this.items = this.items.filter((i) => i.active);
    this.particles = this.particles.filter((p) => !p.done);

    if (this.checkClear()) {
      this.total_score += this.score;
      this.result_cd = FPS * 2;
      this.state = Game.S_CLEAR;
      this.play("clear");
    }

    this.drawPlay();
  }

  private ballVsBlocks(ball: Ball): void {
    for (const blk of this.blocks) {
      if (!blk.active) continue;
      if (!ball.rect.colliderect(blk.rect)) continue;

      const dmg = ball.power ? 2 : 1;
      if (blk.btype === "bomb") {
        // Explosion: destroy surrounding blocks too
        this.play("bomb");
        for (const b2 of this.blocks) {
          if (b2.active && b2.btype !== "indestr") {
            if (
              Math.abs(b2.rect.centerx - blk.rect.centerx) < 100 &&
              Math.abs(b2.rect.centery - blk.rect.centery) < 80
            ) {
              b2.hit(99);
              this.score += b2.score;
              this.particles.push(
                new Particle(b2.rect.centerx, b2.rect.centery, ORANGE, 12),
              );
            }
          }
        }
        this.particles.push(
          new Particle(blk.rect.centerx, blk.rect.centery, RED, 24),
        );
      }

      const destroyed = blk.hit(dmg);
      if (destroyed && blk.score > 0) {
        this.score += blk.score * Math.max(1, this.combo);
        this.combo += 1;
        this.combo_cd = 150;
        this.play("block");
        if (Math.random() < 0.28) {
          this.items.push(new Item(blk.rect.centerx, blk.rect.centery));
        }
        this.particles.push(
          new Particle(blk.rect.centerx, blk.rect.centery, blk.base_col, 10),
        );
      } else if (!destroyed) {
        this.play("block");
      }

      if (!ball.power) {
        const ovx = Math.min(
          Math.abs(ball.rect.right - blk.rect.left),
          Math.abs(blk.rect.right - ball.rect.left),
        );
        const ovy = Math.min(
          Math.abs(ball.rect.bottom - blk.rect.top),
          Math.abs(blk.rect.bottom - ball.rect.top),
        );
        if (ovx < ovy) ball.vx *= -1;
        else ball.vy *= -1;
      }
      break; // one collision per frame
    }
  }

  private ballVsInvaders(ball: Ball): void {
    for (const inv of this.invaders) {
      if (!inv.active) continue;
      if (!ball.rect.colliderect(inv.rect)) continue;

      const dmg = ball.power ? 3 : 1;
      const destroyed = inv.hit(dmg);
      if (destroyed) {
        this.score += inv.score * Math.max(1, this.combo);
        this.combo += 1;
        this.combo_cd = 150;
        this.atk_gauge = Math.min(this.atk_max, this.atk_gauge + 18);
        this.play("destroy");
        if (Math.random() < 0.45) {
          this.items.push(new Item(inv.rect.centerx, inv.rect.centery));
        }
        this.particles.push(
          new Particle(inv.rect.centerx, inv.rect.centery, inv.color, 18),
        );
      } else {
        this.play("block");
        this.particles.push(
          new Particle(inv.rect.centerx, inv.rect.centery, RED, 6),
        );
      }

      if (!ball.power) {
        ball.vx *= -1;
        ball.vy *= -1;
        ball.rect.x += Math.trunc(ball.vx);
        ball.rect.y += Math.trunc(ball.vy);
      }
      break;
    }
  }

  private applyItem(it: Item): void {
    this.play("item");
    const itype = it.itype as ItemType;
    if (itype === "time") {
      this.timer = Math.min(
        this.timer + FPS * 15,
        this.time_limit * FPS,
      );
    } else if (itype === "attack") {
      this.atk_gauge = Math.min(this.atk_max, this.atk_gauge + 35);
    } else if (itype === "gauge") {
      this.atk_gauge = this.atk_max;
    } else if (itype === "medal") {
      this.score += 500 * Math.max(1, this.combo);
    } else if (itype === "wide") {
      this.vaus.power = true;
      this.wide_timer = FPS * 12;
    }
  }

  private checkClear(): boolean {
    const aliveInv = this.invaders.filter((i) => i.active);
    const aliveBlk = this.blocks.filter(
      (b) => b.active && b.btype !== "indestr",
    );
    if (this.target === "invader") return aliveInv.length === 0;
    if (this.target === "block") return aliveBlk.length === 0;
    return aliveInv.length === 0 || aliveBlk.length === 0;
  }

  // ------------------------------------------------------------------ Drawing

  private fill(col: Color): void {
    this.ctx.fillStyle = rgb(col);
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  private fillRGB(r: number, g: number, b: number): void {
    this.ctx.fillStyle = `rgb(${r},${g},${b})`;
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }

  private drawPlay(): void {
    const ctx = this.ctx;
    this.fill(DBLUE);

    // Grid background
    for (let gx = 0; gx < PW; gx += 16) {
      line(ctx, [18, 18, 32], [PX + gx, PY], [PX + gx, PY + PH], 1);
    }
    for (let gy = 0; gy < PH; gy += 16) {
      line(ctx, [18, 18, 32], [PX, PY + gy], [PX + PW, PY + gy], 1);
    }

    // Play area frame
    strokeRect(ctx, CYAN, new Rect(PX - 3, PY - 3, PW + 6, PH + 6), 3);

    for (const b of this.blocks) b.draw(ctx);
    for (const i of this.invaders) if (i.active) i.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const b of this.balls) b.draw(ctx);
    for (const i of this.items) i.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    this.vaus.draw(ctx);

    // ===== HUD =====
    fillRect(ctx, [20, 20, 30], new Rect(0, 0, SCREEN_W, 74));
    line(ctx, CYAN, [0, 74], [SCREEN_W, 74], 2);

    txt(ctx, `SCORE ${pad(this.score, 7)}`, 8, 6, WHITE, 18);
    txt(
      ctx,
      `TOTAL ${pad(this.total_score + this.score, 7)}`,
      8,
      30,
      GRAY,
      13,
    );

    txt(
      ctx,
      `STAGE ${this.stage_num}/${Game.MAX_STAGES}`,
      SCREEN_W / 2 - 55,
      6,
      YELLOW,
      18,
    );
    const [mc, ms]: [Color, string] = this.hard_mode
      ? [RED, "HARD"]
      : [GREEN, "NORMAL"];
    txt(ctx, ms, SCREEN_W / 2 - 35, 30, mc, 14);
    if (this.skill) {
      txt(ctx, `SKL:${this.skill}`, SCREEN_W / 2 + 40, 30, PINK, 12);
    }

    // Timer
    const secs = Math.floor(this.timer / FPS);
    const tc: Color = secs < 15 ? RED : secs < 30 ? YELLOW : WHITE;
    txt(ctx, `TIME ${String(secs).padStart(3, " ")}`, SCREEN_W - 155, 6, tc, 18);
    const bw = 130;
    fillRect(ctx, DGRAY, new Rect(SCREEN_W - 148, 32, bw, 10));
    const ratio = this.timer / (this.time_limit * FPS);
    fillRect(
      ctx,
      tc,
      new Rect(SCREEN_W - 148, 32, Math.floor(bw * ratio), 10),
    );

    if (this.combo > 1) {
      txt(ctx, `COMBO x${this.combo}`, 8, 52, ORANGE, 14);
    }

    // Attack gauge
    const gx0 = SCREEN_W / 2 - 85;
    txt(ctx, "ATK", gx0, 52, WHITE, 12);
    fillRect(ctx, DGRAY, new Rect(gx0 + 32, 54, 110, 13));
    const gfill = Math.floor((110 * this.atk_gauge) / this.atk_max);
    const gc: Color = this.atk_mode ? ORANGE : YELLOW;
    fillRect(ctx, gc, new Rect(gx0 + 32, 54, gfill, 13));
    if (this.atk_mode && Math.floor(performance.now() / 200) % 2 === 0) {
      txt(ctx, "!! ATTACK !!", gx0 + 32, 53, RED, 13);
    }

    txt(
      ctx,
      "MOUSE:移動  SPACE:スマッシュ  ESC:メニュー",
      8,
      SCREEN_H - 20,
      DGRAY,
      11,
    );

    if (this.state === Game.S_CLEAR) this.drawOverlay("STAGE CLEAR!", YELLOW);
    else if (this.state === Game.S_OVER) this.drawOverlay("TIME UP!", RED);
  }

  private drawOverlay(msg: string, col: Color): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.745)";
    ctx.fillRect(SCREEN_W / 2 - 230, SCREEN_H / 2 - 45, 460, 90);
    txt(ctx, msg, SCREEN_W / 2 - 140, SCREEN_H / 2 - 36, col, 36);
    txt(
      ctx,
      `Score: ${this.score.toLocaleString()}`,
      SCREEN_W / 2 - 80,
      SCREEN_H / 2 + 8,
      WHITE,
      20,
    );
    txt(ctx, "SPACE で続ける", SCREEN_W / 2 - 90, SCREEN_H / 2 + 34, GRAY, 14);
  }

  // ------------------------------------------------------------------ Menu

  private updateMenu(): void {
    const ctx = this.ctx;
    this.menu_anim += 1;
    this.fillRGB(5, 5, 15);

    const colors: Color[] = [RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, PURPLE, PINK];
    const title = "ARKANOID";
    for (let i = 0; i < title.length; i++) {
      const c = colors[(i + Math.floor(this.menu_anim / 6)) % colors.length];
      txt(ctx, title[i], 40 + i * 90, 60, c, 72);
    }

    txt(ctx, "vs  SPACE  INVADERS", SCREEN_W / 2 - 220, 158, WHITE, 28);

    // Demo enemies
    const demo: [number, number, Color][] = [
      [170, 250, GREEN],
      [370, 250, YELLOW],
      [570, 250, RED],
    ];
    for (const [dx, dy, col] of demo) {
      const pulse = Math.floor(Math.abs(Math.sin(this.menu_anim * 0.05 + dx)) * 6);
      const r = new Rect(dx, dy - pulse, 32, 24);
      drawBlock(ctx, col, r, 2);
      for (const [ox, oy] of [
        [6, 6],
        [19, 6],
      ]) {
        fillRect(ctx, WHITE, new Rect(r.x + ox, r.y + oy, 7, 7));
        fillRect(ctx, BLACK, new Rect(r.x + ox + 2, r.y + oy + 2, 3, 3));
      }
    }

    if (Math.floor(this.menu_anim / 22) % 2 === 0) {
      txt(ctx, "PRESS SPACE TO START", SCREEN_W / 2 - 168, 330, WHITE, 22);
    }

    const [mc, ms]: [Color, string] = this.hard_mode
      ? [RED, "HARD"]
      : [GREEN, "NORMAL"];
    txt(
      ctx,
      `H: HARD   N: NORMAL   Mode=${ms}`,
      SCREEN_W / 2 - 240,
      380,
      mc,
      17,
    );

    txt(
      ctx,
      `Total Score: ${this.total_score.toLocaleString()}`,
      SCREEN_W / 2 - 100,
      420,
      YELLOW,
      16,
    );

    txt(
      ctx,
      "Inspired by TAITO's Arkanoid vs Space Invaders",
      SCREEN_W / 2 - 310,
      SCREEN_H - 36,
      DGRAY,
      13,
    );
  }

  // ------------------------------------------------------------------ Skill select

  private drawSkill(): void {
    const ctx = this.ctx;
    this.fillRGB(5, 5, 15);
    txt(ctx, "SKILL  SELECT", SCREEN_W / 2 - 130, 30, YELLOW, 32);
    txt(
      ctx,
      `STAGE ${this.stage_num}  —  コインでスキルを選択`,
      SCREEN_W / 2 - 220,
      78,
      WHITE,
      15,
    );

    const skills: [string, string, string, string, Color][] = [
      ["1", "SUPPORT", "援護射撃", "定期的に援護ボールを発射", LGREEN],
      ["2", "BOOST", "反射加速", "反射後ボール速度 +20%", CYAN],
      ["3", "CHARGE", "ゲージ充填", "アタックゲージ自動増加", YELLOW],
      ["4", "HOMING", "ショット誘導", "（将来実装）敵に近づく弾", ORANGE],
    ];
    skills.forEach(([key, sid, jp, desc, col], i) => {
      const y = 120 + i * 80;
      const sel = this.skill === sid;
      this.ctx.fillStyle = sel ? "rgb(40,40,70)" : "rgb(25,25,45)";
      this.ctx.fillRect(90, y, 620, 68);
      strokeRect(ctx, col, new Rect(90, y, 620, 68), 2);
      txt(ctx, `[${key}]  ${jp}  (${sid})`, 110, y + 8, col, 20);
      txt(ctx, desc, 110, y + 36, GRAY, 14);
    });

    txt(
      ctx,
      "1/2/3/4 でスキル選択   SPACE でスキップ",
      SCREEN_W / 2 - 240,
      SCREEN_H - 50,
      WHITE,
      16,
    );
  }

  // ------------------------------------------------------------------ Result screens

  private updateClear(): void {
    this.drawPlay();
    this.result_cd -= 1;
  }

  private updateOver(): void {
    this.drawPlay();
  }

  private updateAllclear(): void {
    const ctx = this.ctx;
    this.fillRGB(5, 5, 15);
    const t = Math.floor(performance.now() / 500);
    const colors: Color[] = [RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, PURPLE];
    const msg = "ALL  CLEAR !!";
    for (let i = 0; i < msg.length; i++) {
      txt(ctx, msg[i], 80 + i * 50, 180, colors[(i + t) % colors.length], 48);
    }
    txt(
      ctx,
      `TOTAL SCORE  ${this.total_score.toLocaleString()}`,
      SCREEN_W / 2 - 180,
      300,
      YELLOW,
      28,
    );
    txt(ctx, "Thank you for playing!", SCREEN_W / 2 - 160, 360, WHITE, 20);
    if (Math.floor(performance.now() / 400) % 2 === 0) {
      txt(ctx, "SPACE でタイトルへ", SCREEN_W / 2 - 130, 430, GRAY, 18);
    }
  }
}

/** Zero-pad a non-negative integer to `width` digits (like Python %07d). */
function pad(n: number, width: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, "0");
}
