import pygame
import sys
import random
from utils import *
from entities import Vaus, Ball, Bullet, Invader, Block, Item, Particle
from stages import make_stage


class Game:
    S_MENU = "menu"
    S_SKILL = "skill"
    S_PLAY = "play"
    S_CLEAR = "clear"
    S_OVER = "over"
    S_ALLCLEAR = "allclear"

    MAX_STAGES = 5

    def __init__(self):
        pygame.init()
        pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)
        self.screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
        pygame.display.set_caption("アルカノイドvsインベーダー")
        self.clock = pygame.time.Clock()
        pygame.mouse.set_visible(False)

        self._init_sounds()
        self._init_game()

    # ------------------------------------------------------------------ Initialization

    def _init_sounds(self):
        self.snd = {}
        defs = {
            "reflect": (440, 0.08, 0.4, "sq"),
            "smash": (660, 0.12, 0.5, "sq"),
            "block": (300, 0.10, 0.3, "sq"),
            "destroy": (180, 0.18, 0.5, "noise"),
            "attack": (880, 0.25, 0.6, "sq"),
            "item": (550, 0.15, 0.4, "sine"),
            "clear": (523, 0.60, 0.5, "sine"),
            "gameover": (110, 0.80, 0.5, "tri"),
            "bomb": (150, 0.30, 0.6, "noise"),
        }
        for name, args in defs.items():
            try:
                self.snd[name] = make_snd(*args)
            except Exception as e:
                print(f"Sound '{name}' failed: {e}")

    def play(self, name):
        if name in self.snd:
            try:
                self.snd[name].play()
            except:
                pass

    def _init_game(self):
        self.state = self.S_MENU
        self.stage_num = 1
        self.total_score = 0
        self.hard_mode = False
        self.skill = None
        self.menu_anim = 0

    # ------------------------------------------------------------------ Stage start

    def _start_stage(self):
        self.vaus = Vaus()
        inv, blk, self.target, tlim = make_stage(self.stage_num)
        self.invaders = inv
        self.blocks = blk
        self.time_limit = tlim
        self.timer = tlim * FPS

        self.bullets = []  # Invader bullets
        self.balls = []  # Reflecting balls
        self.items = []
        self.particles = []

        self.score = 0
        self.combo = 0
        self.combo_cd = 0
        self.atk_gauge = 0
        self.atk_max = 100
        self.atk_mode = False
        self.atk_ball = None

        self.result_cd = 0
        self.state = self.S_PLAY

    # ------------------------------------------------------------------ Main loop

    def run(self):
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
                if event.type == pygame.KEYDOWN:
                    if not self._handle_key(event.key):
                        pygame.quit()
                        sys.exit()

            if self.state == self.S_MENU:
                self._update_menu()
            elif self.state == self.S_SKILL:
                self._draw_skill()
            elif self.state == self.S_PLAY:
                self._update_play()
            elif self.state == self.S_CLEAR:
                self._update_clear()
            elif self.state == self.S_OVER:
                self._update_over()
            elif self.state == self.S_ALLCLEAR:
                self._update_allclear()

            pygame.display.flip()
            self.clock.tick(FPS)

    # ------------------------------------------------------------------ Key input

    def _handle_key(self, key):
        if key == pygame.K_ESCAPE:
            if self.state == self.S_PLAY:
                self.state = self.S_MENU
                return True
            return False  # Quit

        if self.state == self.S_MENU:
            if key in (pygame.K_SPACE, pygame.K_RETURN):
                self.stage_num = 1
                self.total_score = 0
                self.state = self.S_SKILL
            elif key == pygame.K_h:
                self.hard_mode = True
            elif key == pygame.K_n:
                self.hard_mode = False

        elif self.state == self.S_SKILL:
            skill_map = {
                pygame.K_1: "SUPPORT",
                pygame.K_2: "BOOST",
                pygame.K_3: "CHARGE",
                pygame.K_4: "HOMING",
            }
            if key in skill_map:
                self.skill = skill_map[key]
                self._start_stage()
            elif key in (pygame.K_SPACE, pygame.K_RETURN):
                self.skill = None
                self._start_stage()

        elif self.state == self.S_PLAY:
            if key == pygame.K_SPACE:
                # Smash: launch the front-most ball strongly upward
                active_balls = [b for b in self.balls if b.active]
                if active_balls:
                    target = min(active_balls, key=lambda b: b.rect.y)
                    if self.vaus.smash(target):
                        self.play("smash")
                elif self.atk_mode:
                    pass  # Automatic while in attack mode

        elif self.state in (self.S_CLEAR, self.S_OVER, self.S_ALLCLEAR):
            if key == pygame.K_SPACE:
                if self.state == self.S_CLEAR:
                    if self.stage_num >= self.MAX_STAGES:
                        self.state = self.S_ALLCLEAR
                    else:
                        self.stage_num += 1
                        self.state = self.S_SKILL
                else:
                    self._init_game()

        return True

    # ------------------------------------------------------------------ Gameplay update

    def _update_play(self):
        mx, my = pygame.mouse.get_pos()
        self.vaus.update(mx, my)

        # Timer
        self.timer -= 1
        if self.timer <= 0:
            self.play("gameover")
            self.state = self.S_OVER
            return

        # Combo timeout
        if self.combo_cd > 0:
            self.combo_cd -= 1
        else:
            self.combo = 0

        # Update invaders
        for inv in self.invaders:
            if inv.active:
                inv.update(self.bullets, self.hard_mode)

        # Update blocks
        for b in self.blocks:
            if b.active:
                b.update()

        # Update bullets
        for b in self.bullets:
            b.update()

        # Update balls & collisions
        for ball in self.balls:
            ball.update()
            if ball.active:
                self._ball_vs_blocks(ball)
                self._ball_vs_invaders(ball)

        # Vaus collides with bullet -> convert to ball
        now = pygame.time.get_ticks()
        for bul in self.bullets:
            if bul.active and self.vaus.rect.colliderect(bul.rect):
                nb = Ball(bul.rect.centerx, bul.rect.top, power=self.atk_mode)
                nb.speed = 5.5 + self.stage_num * 0.3
                if self.hard_mode:
                    nb.speed *= 1.2
                self.vaus.reflect_ball(nb)
                # Skill: BOOST -> +20% speed
                if self.skill == "BOOST":
                    nb.speed *= 1.2
                nb.normalize(nb.speed)
                self.balls.append(nb)
                bul.active = False
                self.atk_gauge = min(self.atk_max, self.atk_gauge + 12)
                self.combo += 1
                self.combo_cd = 150
                self.play("reflect")
                self.particles.append(
                    Particle(bul.rect.centerx, bul.rect.centery, CYAN, 8)
                )

        # Extra reflection: returning balls
        for ball in self.balls:
            if ball.active and ball.vy > 0:
                if self.vaus.rect.colliderect(ball.rect):
                    if pygame.time.get_ticks() - ball.last_hit > 300:
                        self.vaus.reflect_ball(ball)
                        self.play("reflect")
                        self.particles.append(
                            Particle(ball.rect.centerx, ball.rect.top, CYAN, 5)
                        )

        # Attack gauge full -> enter attack mode
        if self.atk_gauge >= self.atk_max and not self.atk_mode:
            self.atk_mode = True
            self.play("attack")
            # Fire piercing attack ball
            ab = Ball(
                self.vaus.rect.centerx,
                self.vaus.rect.top - 8,
                vx=random.uniform(-2, 2),
                vy=-8,
                power=True,
            )
            ab.speed = 8
            self.atk_ball = ab
            self.balls.append(ab)
            self.particles.append(
                Particle(self.vaus.rect.centerx, self.vaus.rect.top, YELLOW, 20)
            )

        # End attack mode when attack ball inactive
        if self.atk_mode and self.atk_ball and not self.atk_ball.active:
            self.atk_mode = False
            self.atk_gauge = 0
            self.atk_ball = None

        # Skill: CHARGE -> auto increase gauge
        if self.skill == "CHARGE" and not self.atk_mode:
            self.atk_gauge = min(self.atk_max, self.atk_gauge + 0.3)

        # Skill: SUPPORT -> periodically fire support ball
        if self.skill == "SUPPORT":
            if not hasattr(self, "_support_cd"):
                self._support_cd = 0
            self._support_cd -= 1
            if self._support_cd <= 0:
                self._support_cd = 180
                for inv in self.invaders:
                    if inv.active:
                        sb = Ball(inv.rect.centerx, inv.rect.bottom + 5, vx=0, vy=-6)
                        sb.speed = 6
                        self.balls.append(sb)
                        break

        # Update items
        for it in self.items:
            it.update()
            if it.active and self.vaus.rect.colliderect(it.rect):
                self._apply_item(it)
                it.active = False

        # Update particles
        for p in self.particles:
            p.update()

        # Remove dead objects
        self.bullets = [b for b in self.bullets if b.active]
        self.balls = [b for b in self.balls if b.active]
        self.items = [i for i in self.items if i.active]
        self.particles = [p for p in self.particles if not p.done]

        # Check for clear
        if self._check_clear():
            self.total_score += self.score
            self.result_cd = FPS * 2
            self.state = self.S_CLEAR
            self.play("clear")

        self._draw_play()

    def _ball_vs_blocks(self, ball):
        """Handle collisions between a ball and blocks."""
        for blk in self.blocks:
            if not blk.active:
                continue
            if not ball.rect.colliderect(blk.rect):
                continue

            dmg = 2 if ball.power else 1
            if blk.btype == "bomb":
                # 爆発: 周囲ブロックも破壊
                self.play("bomb")
                for b2 in self.blocks:
                    if b2.active and b2.btype != "indestr":
                        if (
                            abs(b2.rect.centerx - blk.rect.centerx) < 100
                            and abs(b2.rect.centery - blk.rect.centery) < 80
                        ):
                            b2.hit(99)
                            self.score += b2.score
                            self.particles.append(
                                Particle(b2.rect.centerx, b2.rect.centery, ORANGE, 12)
                            )
                self.particles.append(
                    Particle(blk.rect.centerx, blk.rect.centery, RED, 24)
                )

            destroyed = blk.hit(dmg)
            if destroyed and blk.score > 0:
                self.score += blk.score * max(1, self.combo)
                self.combo += 1
                self.combo_cd = 150
                self.play("block")
                if random.random() < 0.28:
                    self.items.append(Item(blk.rect.centerx, blk.rect.centery))
                self.particles.append(
                    Particle(blk.rect.centerx, blk.rect.centery, blk.base_col, 10)
                )
            elif not destroyed:
                self.play("block")

            if not ball.power:
                ovx = min(
                    abs(ball.rect.right - blk.rect.left),
                    abs(blk.rect.right - ball.rect.left),
                )
                ovy = min(
                    abs(ball.rect.bottom - blk.rect.top),
                    abs(blk.rect.bottom - ball.rect.top),
                )
                if ovx < ovy:
                    ball.vx *= -1
                else:
                    ball.vy *= -1
            break  # 1フレーム1衝突

    def _ball_vs_invaders(self, ball):
        """Handle collisions between a ball and invaders."""
        for inv in self.invaders:
            if not inv.active:
                continue
            if not ball.rect.colliderect(inv.rect):
                continue

            dmg = 3 if ball.power else 1
            destroyed = inv.hit(dmg)
            if destroyed:
                self.score += inv.score * max(1, self.combo)
                self.combo += 1
                self.combo_cd = 150
                self.atk_gauge = min(self.atk_max, self.atk_gauge + 18)
                self.play("destroy")
                if random.random() < 0.45:
                    self.items.append(Item(inv.rect.centerx, inv.rect.centery))
                self.particles.append(
                    Particle(inv.rect.centerx, inv.rect.centery, inv.color, 18)
                )
            else:
                self.play("block")
                self.particles.append(
                    Particle(inv.rect.centerx, inv.rect.centery, RED, 6)
                )

            if not ball.power:
                ball.vx *= -1
                ball.vy *= -1
                ball.rect.x += int(ball.vx)
                ball.rect.y += int(ball.vy)
            break

    def _apply_item(self, it):
        self.play("item")
        if it.itype == "time":
            self.timer = min(self.timer + FPS * 15, self.time_limit * FPS)
        elif it.itype == "attack":
            self.atk_gauge = min(self.atk_max, self.atk_gauge + 35)
        elif it.itype == "gauge":
            self.atk_gauge = self.atk_max
        elif it.itype == "medal":
            self.score += 500 * max(1, self.combo)
        elif it.itype == "wide":
            self.vaus.power = True
            if not hasattr(self, "_wide_timer"):
                self._wide_timer = 0
            self._wide_timer = FPS * 12

    def _check_clear(self):
        alive_inv = [i for i in self.invaders if i.active]
        alive_blk = [b for b in self.blocks if b.active and b.btype != "indestr"]
        if self.target == "invader":
            return len(alive_inv) == 0
        if self.target == "block":
            return len(alive_blk) == 0
        return len(alive_inv) == 0 or len(alive_blk) == 0

    # ------------------------------------------------------------------ Drawing

    def _draw_play(self):
        self.screen.fill(DBLUE)

        # Grid background
        for gx in range(0, PW, 16):
            pygame.draw.line(
                self.screen, (18, 18, 32), (PX + gx, PY), (PX + gx, PY + PH)
            )
        for gy in range(0, PH, 16):
            pygame.draw.line(
                self.screen, (18, 18, 32), (PX, PY + gy), (PX + PW, PY + gy)
            )

        # Play area frame (voxel-style)
        pygame.draw.rect(
            self.screen, CYAN, pygame.Rect(PX - 3, PY - 3, PW + 6, PH + 6), 3
        )

        # Blocks -> Invaders -> Bullets/Balls -> Items -> Particles -> Vaus
        for b in self.blocks:
            b.draw(self.screen)
        for i in self.invaders:
            if i.active:
                i.draw(self.screen)
        for b in self.bullets:
            b.draw(self.screen)
        for b in self.balls:
            b.draw(self.screen)
        for i in self.items:
            i.draw(self.screen)
        for p in self.particles:
            p.draw(self.screen)
        self.vaus.draw(self.screen)

        # ===== HUD =====
        pygame.draw.rect(self.screen, (20, 20, 30), pygame.Rect(0, 0, SCREEN_W, 74))
        pygame.draw.line(self.screen, CYAN, (0, 74), (SCREEN_W, 74), 2)

        # Score
        txt(self.screen, f"SCORE {self.score:07d}", 8, 6, WHITE, 18)
        txt(self.screen, f"TOTAL {self.total_score+self.score:07d}", 8, 30, GRAY, 13)

        # Stage / Mode
        txt(
            self.screen,
            f"STAGE {self.stage_num}/{self.MAX_STAGES}",
            SCREEN_W // 2 - 55,
            6,
            YELLOW,
            18,
        )
        mc, ms = (RED, "HARD") if self.hard_mode else (GREEN, "NORMAL")
        txt(self.screen, ms, SCREEN_W // 2 - 35, 30, mc, 14)
        if self.skill:
            txt(self.screen, f"SKL:{self.skill}", SCREEN_W // 2 + 40, 30, PINK, 12)

        # Timer
        secs = self.timer // FPS
        tc = RED if secs < 15 else YELLOW if secs < 30 else WHITE
        txt(self.screen, f"TIME {secs:3d}", SCREEN_W - 155, 6, tc, 18)
        bw = 130
        pygame.draw.rect(self.screen, DGRAY, pygame.Rect(SCREEN_W - 148, 32, bw, 10))
        ratio = self.timer / (self.time_limit * FPS)
        pygame.draw.rect(
            self.screen, tc, pygame.Rect(SCREEN_W - 148, 32, int(bw * ratio), 10)
        )

        # Combo
        if self.combo > 1:
            txt(self.screen, f"COMBO x{self.combo}", 8, 52, ORANGE, 14)

        # Attack gauge
        gx0 = SCREEN_W // 2 - 85
        txt(self.screen, "ATK", gx0, 52, WHITE, 12)
        pygame.draw.rect(self.screen, DGRAY, pygame.Rect(gx0 + 32, 54, 110, 13))
        gfill = int(110 * self.atk_gauge / self.atk_max)
        gc = YELLOW if not self.atk_mode else ORANGE
        pygame.draw.rect(self.screen, gc, pygame.Rect(gx0 + 32, 54, gfill, 13))
        if self.atk_mode:
            if (pygame.time.get_ticks() // 200) % 2 == 0:
                txt(self.screen, "!! ATTACK !!", gx0 + 32, 53, RED, 13)

        # Controls hint
        txt(
            self.screen,
            "MOUSE:移動  SPACE:スマッシュ  ESC:メニュー",
            8,
            SCREEN_H - 20,
            DGRAY,
            11,
        )

        # Clear / Time-up overlay
        if self.state == self.S_CLEAR:
            self._draw_overlay("STAGE CLEAR!", YELLOW)
        elif self.state == self.S_OVER:
            self._draw_overlay("TIME UP!", RED)

    def _draw_overlay(self, msg, col):
        ov = pygame.Surface((460, 90), pygame.SRCALPHA)
        ov.fill((0, 0, 0, 190))
        self.screen.blit(ov, (SCREEN_W // 2 - 230, SCREEN_H // 2 - 45))
        txt(self.screen, msg, SCREEN_W // 2 - 140, SCREEN_H // 2 - 36, col, 36)
        txt(
            self.screen,
            f"Score: {self.score:,}",
            SCREEN_W // 2 - 80,
            SCREEN_H // 2 + 8,
            WHITE,
            20,
        )
        txt(
            self.screen,
            "SPACE で続ける",
            SCREEN_W // 2 - 90,
            SCREEN_H // 2 + 34,
            GRAY,
            14,
        )

    # ------------------------------------------------------------------ Menu

    def _update_menu(self):
        self.menu_anim += 1
        self.screen.fill((5, 5, 15))

        # Title (rainbow)
        colors = [RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, PURPLE, PINK]
        title = "ARKANOID"
        for i, ch in enumerate(title):
            c = colors[(i + self.menu_anim // 6) % len(colors)]
            txt(self.screen, ch, 40 + i * 90, 60, c, 72)

        txt(self.screen, "vs  SPACE  INVADERS", SCREEN_W // 2 - 220, 158, WHITE, 28)

        # Demo enemies
        t = self.menu_anim // 10
        demo = [(170, 250, "A", GREEN), (370, 250, "B", YELLOW), (570, 250, "C", RED)]
        for dx, dy, _, col in demo:
            pulse = int(abs(math.sin(self.menu_anim * 0.05 + dx)) * 6)
            r = pygame.Rect(dx, dy - pulse, 32, 24)
            draw_block(self.screen, col, r, 2)
            for ox, oy in [(6, 6), (19, 6)]:
                pygame.draw.rect(
                    self.screen, WHITE, pygame.Rect(r.x + ox, r.y + oy, 7, 7)
                )
                pygame.draw.rect(
                    self.screen, BLACK, pygame.Rect(r.x + ox + 2, r.y + oy + 2, 3, 3)
                )

        # Blinking PRESS SPACE
        if (self.menu_anim // 22) % 2 == 0:
            txt(
                self.screen, "PRESS SPACE TO START", SCREEN_W // 2 - 168, 330, WHITE, 22
            )

        mc, ms = (RED, "HARD") if self.hard_mode else (GREEN, "NORMAL")
        txt(
            self.screen,
            f"H: HARD   N: NORMAL   Mode={ms}",
            SCREEN_W // 2 - 240,
            380,
            mc,
            17,
        )

        txt(
            self.screen,
            f"Total Score: {self.total_score:,}",
            SCREEN_W // 2 - 100,
            420,
            YELLOW,
            16,
        )

        txt(
            self.screen,
            "Inspired by TAITO's Arkanoid vs Space Invaders",
            SCREEN_W // 2 - 310,
            SCREEN_H - 36,
            DGRAY,
            13,
        )

    # ------------------------------------------------------------------ Skill selection

    def _draw_skill(self):
        self.screen.fill((5, 5, 15))
        txt(self.screen, "SKILL  SELECT", SCREEN_W // 2 - 130, 30, YELLOW, 32)
        txt(
            self.screen,
            f"STAGE {self.stage_num}  —  コインでスキルを選択",
            SCREEN_W // 2 - 220,
            78,
            WHITE,
            15,
        )

        skills = [
            ("1", "SUPPORT", "援護射撃", "定期的に援護ボールを発射", LGREEN),
            ("2", "BOOST", "反射加速", "反射後ボール速度 +20%", CYAN),
            ("3", "CHARGE", "ゲージ充填", "アタックゲージ自動増加", YELLOW),
            ("4", "HOMING", "ショット誘導", "（将来実装）敵に近づく弾", ORANGE),
        ]
        for i, (key, sid, jp, desc, col) in enumerate(skills):
            y = 120 + i * 80
            sel = self.skill == sid
            bgc = (40, 40, 70) if sel else (25, 25, 45)
            pygame.draw.rect(self.screen, bgc, pygame.Rect(90, y, 620, 68))
            pygame.draw.rect(self.screen, col, pygame.Rect(90, y, 620, 68), 2)
            txt(self.screen, f"[{key}]  {jp}  ({sid})", 110, y + 8, col, 20)
            txt(self.screen, desc, 110, y + 36, GRAY, 14)

        txt(
            self.screen,
            "1/2/3/4 でスキル選択   SPACE でスキップ",
            SCREEN_W // 2 - 240,
            SCREEN_H - 50,
            WHITE,
            16,
        )

    # ------------------------------------------------------------------ Clear / Game Over updates

    def _update_clear(self):
        self._draw_play()
        self.result_cd -= 1

    def _update_over(self):
        self._draw_play()

    def _update_allclear(self):
        self.screen.fill((5, 5, 15))
        t = pygame.time.get_ticks() // 500
        colors = [RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, PURPLE]
        msg = "ALL  CLEAR !!"
        for i, ch in enumerate(msg):
            txt(self.screen, ch, 80 + i * 50, 180, colors[(i + t) % len(colors)], 48)
        txt(
            self.screen,
            f"TOTAL SCORE  {self.total_score:,}",
            SCREEN_W // 2 - 180,
            300,
            YELLOW,
            28,
        )
        txt(self.screen, "Thank you for playing!", SCREEN_W // 2 - 160, 360, WHITE, 20)
        if (pygame.time.get_ticks() // 400) % 2 == 0:
            txt(self.screen, "SPACE でタイトルへ", SCREEN_W // 2 - 130, 430, GRAY, 18)
