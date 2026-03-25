# Shared constants and utility functions for Arkanoid vs Invaders
import pygame
import math
import random
import array as _arr

# ===== Constants =====================================================
SCREEN_W, SCREEN_H = 800, 600
FPS = 60

# Play area
PX, PY, PW, PH = 40, 78, 720, 490

# Voxel-style color palette
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GRAY = (140, 140, 140)
DGRAY = (50, 50, 60)
LGRAY = (200, 200, 210)
RED = (220, 50, 50)
GREEN = (60, 200, 80)
LGREEN = (120, 240, 130)
BLUE = (60, 110, 220)
CYAN = (0, 220, 230)
YELLOW = (240, 210, 0)
ORANGE = (240, 140, 0)
PURPLE = (170, 40, 220)
PINK = (240, 100, 190)
DBLUE = (10, 10, 25)


def draw_block(surf, color, rect, bw=2):
    """Draw a voxel-style 3D block."""
    pygame.draw.rect(surf, color, rect)
    hi = tuple(min(c + 70, 255) for c in color)
    sh = tuple(max(c - 70, 0) for c in color)
    pygame.draw.line(surf, hi, rect.topleft, rect.topright, bw)
    pygame.draw.line(surf, hi, rect.topleft, rect.bottomleft, bw)
    pygame.draw.line(surf, sh, rect.bottomleft, rect.bottomright, bw)
    pygame.draw.line(surf, sh, rect.topright, rect.bottomright, bw)


def txt(surf, s, x, y, col=WHITE, sz=16, bold=True):
    font = pygame.font.SysFont("monospace", sz, bold=bold)
    surf.blit(font.render(s, True, col), (x, y))


def make_snd(freq, dur, vol=0.3, shape="sq", env_decay=True):
    """Generate a sound effect without numpy."""
    sr = 22050
    n = int(sr * dur)
    buf = _arr.array("h")
    for i in range(n):
        t = i / sr
        fade = (1.0 - i / n) if env_decay else 1.0
        if shape == "sq":
            v = 1.0 if math.sin(2 * math.pi * freq * t) > 0 else -1.0
        elif shape == "noise":
            v = random.uniform(-1.0, 1.0)
        elif shape == "tri":
            v = 2 * abs(2 * (t * freq - math.floor(t * freq + 0.5))) - 1
        else:
            v = math.sin(2 * math.pi * freq * t)
        s = int(v * vol * fade * 32767)
        s = max(-32768, min(32767, s))
        buf.append(s)
        buf.append(s)  # stereo
    return pygame.mixer.Sound(buffer=buf)
