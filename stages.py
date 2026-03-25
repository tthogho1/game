import random
from entities import Invader, Block
from utils import PX, PY, PW


def make_stage(n):
    """Return data for stage n (invaders, blocks, target, time_sec)."""
    inv, blk = [], []

    if n == 1:
        # --- Stage 1: Tutorial. Eliminate all invaders ---
        for row in range(2):
            for col in range(7):
                x = PX + 60 + col * 88
                y = PY + 30 + row * 55
                inv.append(Invader(x, y, "A"))
        for gx in range(15):
            blk.append(Block(gx, 9, "normal"))
        target, tlim = "invader", 60

    elif n == 2:
        # --- Stage 2: Destroy all blocks ---
        pat = [
            "NNNNNNNNNNNNNN",
            "NHHHHHHHHHHHHN",
            "NHNIIIIIINHN",
            "NHHHHHHHHHHHHN",
            "NNNNNNNNNNNNNN",
        ]
        tm = {"N": "normal", "H": "hard", "I": "indestr"}
        for gy, row in enumerate(pat):
            for gx, ch in enumerate(row):
                if ch in tm:
                    blk.append(Block(gx, gy, tm[ch]))
        for col in range(6):
            x = PX + 60 + col * 108
            y = PY + 120
            inv.append(Invader(x, y, "B"))
        target, tlim = "block", 90

    elif n == 3:
        # --- Stage 3: Bomb blocks and moving blocks ---
        pat = [
            "NNNBBBNNNN",
            "NMMNMMMNMM",
            "NNNNNNNNNN",
            "BBNNNNNNBB",
        ]
        tm = {"N": "normal", "B": "bomb", "M": "move"}
        for gy, row in enumerate(pat):
            for gx, ch in enumerate(row):
                if ch in tm:
                    blk.append(Block(gx, gy, tm[ch]))
        for row in range(2):
            for col in range(7):
                tp = "B" if row == 1 else "A"
                x = PX + 50 + col * 94
                y = PY + 20 + row * 55
                inv.append(Invader(x, y, tp))
        target, tlim = "both", 90

    elif n == 4:
        # --- Stage 4: Maze blocks. Tough enemies ---
        pat = [
            "INNNNNNNNI",
            "INHHHHHNI",
            "INHINIIHNNI",
            "INIHNHHNI",
            "INNNNNNNI",
        ]
        tm = {"N": "normal", "H": "hard", "I": "indestr"}
        for gy, row in enumerate(pat):
            for gx, ch in enumerate(row):
                if ch in tm:
                    blk.append(Block(gx, gy, tm[ch]))
        for col in range(5):
            x = PX + 80 + col * 120
            y = PY + 20
            inv.append(Invader(x, y, "C"))
        target, tlim = "invader", 80

    elif n == 5:
        # --- Stage 5: Boss battle ---
        boss = Invader(PX + PW // 2 - 32, PY + 15, "BOSS")
        inv.append(boss)
        for col in range(4):
            x = PX + 100 + col * 160
            y = PY + 85
            inv.append(Invader(x, y, "B"))
        pat = [
            "IIBBBII",
            "IBNNNNBI",
            "IBHHHBI",
            "IBNNNNBI",
            "IIBBBII",
        ]
        tm = {"N": "normal", "H": "hard", "I": "indestr", "B": "bomb"}
        for gy, row in enumerate(pat):
            for gx, ch in enumerate(row):
                if ch in tm:
                    blk.append(Block(gx, gy, tm[ch]))
        target, tlim = "invader", 120

    else:
        # --- Extra stage: Random generation ---
        for row in range(3):
            for col in range(8):
                if random.random() < 0.75:
                    tp = random.choices(["A", "B", "C"], weights=[4, 3, 2])[0]
                    inv.append(Invader(PX + 45 + col * 80, PY + 18 + row * 55, tp))
        for gy in range(5):
            for gx in range(15):
                if random.random() < 0.55:
                    tp = random.choices(
                        ["normal", "hard", "indestr", "bomb", "move"],
                        weights=[5, 3, 2, 2, 1],
                    )[0]
                    blk.append(Block(gx, gy + 4, tp))
        target, tlim = "both", 95

    return inv, blk, target, tlim
