import pygame
import math
import random
from utils import (
    PX,
    PY,
    PW,
    PH,
    draw_block,
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
)

# ===== VAUS (Paddle) ============================================


class Vaus:
    W, H = 82, 14

    def __init__(self):
        self.rect = pygame.Rect(
            PX + PW // 2 - self.W // 2, PY + PH - 44, self.W, self.H
        )
        self.smash_cd = 0
        self.power = False  # Power-up state

    def update(self, mx, my):
        # Follow mouse position (movement limited to lower half)
        self.rect.centerx = mx
        self.rect.centery = my
        # Clamp inside play area
        area = pygame.Rect(PX, PY + PH // 3, PW, PH * 2 // 3)
        self.rect.clamp_ip(area)
        if self.smash_cd > 0:
            self.smash_cd -= 1

    def reflect_ball(self, ball):
        """Compute reflection angle based on contact position (30°–150°)."""
        rel = (ball.rect.centerx - self.rect.left) / self.rect.width  # 0..1
        ang = 30 + rel * 120  # left 30° -> right 150°
        spd = ball.speed
        rad = math.radians(ang)
        ball.vx = math.cos(rad) * spd
        ball.vy = -abs(math.sin(rad) * spd)
        ball.last_hit = pygame.time.get_ticks()

    def smash(self, ball):
        """Smash shot: strong upward reflection (triggered by space)."""
        if self.smash_cd == 0:
            ball.vx = random.uniform(-1.5, 1.5)
            ball.vy = -ball.speed * 1.6
            self.smash_cd = 25
            return True
        return False

    def draw(self, surf):
        col = CYAN if not self.power else YELLOW
        draw_block(surf, col, self.rect, 2)
        # Center notch
        cx = self.rect.centerx
        pygame.draw.rect(
            surf, WHITE, pygame.Rect(cx - 5, self.rect.y + 2, 10, self.H - 4)
        )
        if self.power:
            pygame.draw.rect(
                surf, ORANGE, pygame.Rect(cx - 3, self.rect.y + 3, 6, self.H - 6)
            )


# ===== Ball (reflecting shot) ==================================


class Ball:
    R = 6

    def __init__(self, x, y, vx=0.0, vy=-5.0, power=False):
        self.rect = pygame.Rect(x - self.R, y - self.R, self.R * 2, self.R * 2)
        self.vx = float(vx)
        self.vy = float(vy)
        self.speed = math.hypot(vx, vy) or 5.0
        self.power = power  # Attack mode (piercing)
        self.active = True
        self.last_hit = 0
        self._trail = []

    def update(self):
        self._trail.append(tuple(self.rect.center))
        if len(self._trail) > 7:
            self._trail.pop(0)

        self.rect.x += int(self.vx)
        self.rect.y += int(self.vy)

        # Wall collision / reflection
        if self.rect.left < PX:
            self.rect.left = PX
            self.vx = abs(self.vx)
        if self.rect.right > PX + PW:
            self.rect.right = PX + PW
            self.vx = -abs(self.vx)
        if self.rect.top < PY:
            self.rect.top = PY
            self.vy = abs(self.vy)
        if self.rect.top > PY + PH:
            self.active = False  # Fell below play area -> deactivate

    def normalize(self, spd=None):
        if spd is None:
            spd = self.speed
        m = math.hypot(self.vx, self.vy)
        if m > 0:
            self.vx = self.vx / m * spd
            self.vy = self.vy / m * spd

    def draw(self, surf):
        col = YELLOW if self.power else CYAN
        for i, pos in enumerate(self._trail):
            r = max(1, self.R - (len(self._trail) - i))
            a_col = tuple(int(c * i / len(self._trail)) for c in col)
            pygame.draw.circle(surf, a_col, pos, r)
        draw_block(surf, col, self.rect, 1)
        if self.power:
            pygame.draw.circle(surf, WHITE, self.rect.center, self.R - 2)


# ===== Invader bullet ==========================================


class Bullet:
    W, H = 7, 16

    def __init__(self, x, y, vy=3.5):
        self.rect = pygame.Rect(x - self.W // 2, y, self.W, self.H)
        self.vy = vy
        self.active = True

    def update(self):
        self.rect.y += int(self.vy)
        if self.rect.top > PY + PH:
            self.active = False

    def draw(self, surf):
        pygame.draw.rect(surf, RED, self.rect)
        inner = self.rect.inflate(-2, -4)
        pygame.draw.rect(surf, ORANGE, inner)
        # Tip pixel
        pygame.draw.rect(surf, WHITE, pygame.Rect(inner.centerx - 1, inner.top, 2, 3))


# ===== Invader =============================================


class Invader:
    TYPE_DATA = {
        "A": {"col": GREEN, "hp": 1, "sc": 100, "w": 30, "h": 22},
        "B": {"col": YELLOW, "hp": 2, "sc": 200, "w": 30, "h": 22},
        "C": {"col": RED, "hp": 3, "sc": 300, "w": 32, "h": 24},
        "BOSS": {"col": PURPLE, "hp": 12, "sc": 1500, "w": 64, "h": 48},
    }

    def __init__(self, x, y, itype="A"):
        d = self.TYPE_DATA[itype]
        self.rect = pygame.Rect(x, y, d["w"], d["h"])
        self.itype = itype
        self.color = d["col"]
        self.hp = d["hp"]
        self.max_hp = d["hp"]
        self.score = d["sc"]
        self.active = True
        self.anim = random.randint(0, 59)
        self.shoot_cd = random.randint(60, 240)
        self.dx = 1
        self.flash = 0

    def update(self, bullets, hard):
        self.anim = (self.anim + 1) % 60
        self.flash = max(0, self.flash - 1)
        spd = 1.5 if hard else 1.0

        # Boss moves left/right
        if self.itype == "BOSS":
            self.rect.x += int(self.dx * 1.0 * spd)
            if self.rect.right > PX + PW - 4 or self.rect.left < PX + 4:
                self.dx *= -1

        # Shooting
        self.shoot_cd -= 1
        if self.shoot_cd <= 0:
            base = 50 if hard else 100
            self.shoot_cd = random.randint(base, base * 3)
            n_shots = 3 if self.itype == "BOSS" else 1
            for k in range(n_shots):
                ox = (k - n_shots // 2) * 20
                bullets.append(
                    Bullet(self.rect.centerx + ox, self.rect.bottom, vy=4.5 * spd)
                )

    def hit(self, dmg=1):
        self.hp -= dmg
        self.flash = 8
        if self.hp <= 0:
            self.active = False
            return True
        return False

    def draw(self, surf):
        c = WHITE if self.flash % 2 == 1 else self.color
        draw_block(surf, c, self.rect, 2)

        # Eyes
        ey = self.rect.top + 5
        for ox in (6, self.rect.width - 13):
            pygame.draw.rect(surf, WHITE, pygame.Rect(self.rect.left + ox, ey, 7, 7))
            pygame.draw.rect(
                surf, BLACK, pygame.Rect(self.rect.left + ox + 2, ey + 2, 3, 3)
            )

        # Animated legs
        leg_y = self.rect.bottom - 5
        lc = tuple(max(v - 50, 0) for v in self.color)
        phase = (self.anim // 15) % 2
        offsets = [(3, 10), (self.rect.width - 13, self.rect.width - 6)]
        for lo, hi in offsets:
            ox = 0 if phase == 0 else 4
            pygame.draw.rect(
                surf, lc, pygame.Rect(self.rect.left + lo + ox, leg_y, 5, 5)
            )

        # HP gauge (boss / tough enemies)
        if self.itype in ("BOSS", "C") and self.hp < self.max_hp:
            bw = self.rect.width
            pygame.draw.rect(
                surf, DGRAY, pygame.Rect(self.rect.left, self.rect.top - 7, bw, 4)
            )
            hw = int(bw * max(0, self.hp) / self.max_hp)
            pygame.draw.rect(
                surf, GREEN, pygame.Rect(self.rect.left, self.rect.top - 7, hw, 4)
            )


# ===== Block =================================================


class Block:
    W, H = 44, 22
    TYPE_DATA = {
        "normal": {"col": BLUE, "hp": 1, "sc": 50},
        "hard": {"col": GRAY, "hp": 3, "sc": 150},
        "indestr": {"col": DGRAY, "hp": -1, "sc": 0},
        "bomb": {"col": ORANGE, "hp": 1, "sc": 100},
        "move": {"col": LGREEN, "hp": 1, "sc": 80},
    }

    def __init__(self, gx, gy, btype="normal"):
        d = self.TYPE_DATA[btype]
        self.rect = pygame.Rect(
            PX + 4 + gx * (self.W + 4), PY + 8 + gy * (self.H + 4), self.W, self.H
        )
        self.btype = btype
        self.base_col = d["col"]
        self.color = d["col"]
        self.hp = d["hp"]
        self.max_hp = max(d["hp"], 1)
        self.score = d["sc"]
        self.active = True
        self.dx = 1
        self.flash = 0

    def update(self):
        self.flash = max(0, self.flash - 1)
        if self.btype == "move":
            self.rect.x += self.dx
            if self.rect.right > PX + PW - 4 or self.rect.left < PX + 4:
                self.dx *= -1

    def hit(self, dmg=1):
        if self.hp == -1:
            return False
        self.hp -= dmg
        self.flash = 6
        if self.hp <= 0:
            self.active = False
            return True
        return False

    def draw(self, surf):
        if not self.active:
            return
        if self.flash % 2 == 1:
            c = WHITE
        elif self.max_hp > 1 and self.hp >= 0:
            r = self.hp / self.max_hp
            c = tuple(int(self.base_col[i] * r + DGRAY[i] * (1 - r)) for i in range(3))
        else:
            c = self.base_col
        draw_block(surf, c, self.rect, 2)

        cx, cy = self.rect.centerx, self.rect.centery
        if self.btype == "indestr":
            pygame.draw.line(surf, LGRAY, self.rect.topleft, self.rect.bottomright, 2)
            pygame.draw.line(surf, LGRAY, self.rect.topright, self.rect.bottomleft, 2)
        elif self.btype == "bomb":
            pygame.draw.circle(surf, RED, (cx, cy), 6)
            pygame.draw.circle(surf, YELLOW, (cx, cy), 3)
        elif self.btype == "move":
            pygame.draw.polygon(
                surf,
                WHITE,
                [
                    (self.rect.left + 5, cy),
                    (self.rect.left + 14, self.rect.top + 4),
                    (self.rect.left + 14, self.rect.bottom - 4),
                ],
            )


# ===== Item =================================================


class Item:
    W, H = 22, 22
    TYPE_DATA = {
        "time": (LGREEN, "+TIME"),
        "attack": (ORANGE, "ATK+"),
        "gauge": (YELLOW, "GAGE"),
        "medal": (YELLOW, "COIN"),
        "wide": (CYAN, "WIDE"),
    }

    def __init__(self, x, y, itype=None):
        if itype is None:
            itype = random.choices(
                ["time", "attack", "gauge", "medal", "wide"], weights=[3, 3, 2, 4, 2]
            )[0]
        d = self.TYPE_DATA[itype]
        self.rect = pygame.Rect(x - self.W // 2, y, self.W, self.H)
        self.itype = itype
        self.color = d[0]
        self.label = d[1]
        self.vy = 1.8
        self.active = True

    def update(self):
        self.rect.y += int(self.vy)
        if self.rect.top > PY + PH:
            self.active = False

    def draw(self, surf):
        draw_block(surf, self.color, self.rect, 2)
        font = pygame.font.SysFont("monospace", 9, bold=True)
        s = font.render(self.label, True, BLACK)
        surf.blit(s, (self.rect.x + 1, self.rect.centery - 5))


# ===== Particle =============================================


class Particle:
    def __init__(self, x, y, col, n=10):
        self.ps = []
        for _ in range(n):
            a = random.uniform(0, math.tau)
            sp = random.uniform(2, 7)
            self.ps.append(
                {
                    "x": float(x),
                    "y": float(y),
                    "vx": math.cos(a) * sp,
                    "vy": math.sin(a) * sp,
                    "life": random.randint(15, 35),
                    "col": col,
                    "sz": random.randint(2, 5),
                }
            )

    def update(self):
        for p in self.ps:
            p["x"] += p["vx"]
            p["y"] += p["vy"]
            p["vy"] += 0.25
            p["life"] -= 1
        self.ps = [p for p in self.ps if p["life"] > 0]

    def draw(self, surf):
        for p in self.ps:
            f = p["life"] / 35
            sz = max(1, int(p["sz"] * f))
            pygame.draw.rect(
                surf, p["col"], pygame.Rect(int(p["x"]), int(p["y"]), sz, sz)
            )

    @property
    def done(self):
        return not self.ps
