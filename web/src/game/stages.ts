// Stage layouts (port of stages.py). makeStage(n) returns the invaders, blocks,
// win-condition target, and time limit (seconds) for stage n.
import { Invader, Block } from "./entities";
import { PX, PY, PW, choice } from "./constants";

export type Target = "invader" | "block" | "both";

export interface StageData {
  invaders: Invader[];
  blocks: Block[];
  target: Target;
  tlim: number;
}

type BType = "normal" | "hard" | "indestr" | "bomb" | "move";

export function makeStage(n: number): StageData {
  const inv: Invader[] = [];
  const blk: Block[] = [];
  let target: Target;
  let tlim: number;

  if (n === 1) {
    // --- Stage 1: Tutorial. Eliminate all invaders ---
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 7; col++) {
        inv.push(new Invader(PX + 60 + col * 88, PY + 30 + row * 55, "A"));
      }
    }
    for (let gx = 0; gx < 15; gx++) blk.push(new Block(gx, 9, "normal"));
    target = "invader";
    tlim = 60;
  } else if (n === 2) {
    // --- Stage 2: Destroy all blocks ---
    const pat = [
      "NNNNNNNNNNNNNN",
      "NHHHHHHHHHHHHN",
      "NHNIIIIIINHN",
      "NHHHHHHHHHHHHN",
      "NNNNNNNNNNNNNN",
    ];
    const tm: Record<string, BType> = { N: "normal", H: "hard", I: "indestr" };
    pat.forEach((rowStr, gy) => {
      [...rowStr].forEach((ch, gx) => {
        if (ch in tm) blk.push(new Block(gx, gy, tm[ch]));
      });
    });
    for (let col = 0; col < 6; col++) {
      inv.push(new Invader(PX + 60 + col * 108, PY + 120, "B"));
    }
    target = "block";
    tlim = 90;
  } else if (n === 3) {
    // --- Stage 3: Bomb blocks and moving blocks ---
    const pat = ["NNNBBBNNNN", "NMMNMMMNMM", "NNNNNNNNNN", "BBNNNNNNBB"];
    const tm: Record<string, BType> = { N: "normal", B: "bomb", M: "move" };
    pat.forEach((rowStr, gy) => {
      [...rowStr].forEach((ch, gx) => {
        if (ch in tm) blk.push(new Block(gx, gy, tm[ch]));
      });
    });
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 7; col++) {
        const tp = row === 1 ? "B" : "A";
        inv.push(new Invader(PX + 50 + col * 94, PY + 20 + row * 55, tp));
      }
    }
    target = "both";
    tlim = 90;
  } else if (n === 4) {
    // --- Stage 4: Maze blocks. Tough enemies ---
    const pat = [
      "INNNNNNNNI",
      "INHHHHHNI",
      "INHINIIHNNI",
      "INIHNHHNI",
      "INNNNNNNI",
    ];
    const tm: Record<string, BType> = { N: "normal", H: "hard", I: "indestr" };
    pat.forEach((rowStr, gy) => {
      [...rowStr].forEach((ch, gx) => {
        if (ch in tm) blk.push(new Block(gx, gy, tm[ch]));
      });
    });
    for (let col = 0; col < 5; col++) {
      inv.push(new Invader(PX + 80 + col * 120, PY + 20, "C"));
    }
    target = "invader";
    tlim = 80;
  } else if (n === 5) {
    // --- Stage 5: Boss battle ---
    inv.push(new Invader(PX + PW / 2 - 32, PY + 15, "BOSS"));
    for (let col = 0; col < 4; col++) {
      inv.push(new Invader(PX + 100 + col * 160, PY + 85, "B"));
    }
    const pat = ["IIBBBII", "IBNNNNBI", "IBHHHBI", "IBNNNNBI", "IIBBBII"];
    const tm: Record<string, BType> = {
      N: "normal",
      H: "hard",
      I: "indestr",
      B: "bomb",
    };
    pat.forEach((rowStr, gy) => {
      [...rowStr].forEach((ch, gx) => {
        if (ch in tm) blk.push(new Block(gx, gy, tm[ch]));
      });
    });
    target = "invader";
    tlim = 120;
  } else {
    // --- Extra stage: Random generation ---
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if (Math.random() < 0.75) {
          const tp = choice(["A", "B", "C"], [4, 3, 2]) as "A" | "B" | "C";
          inv.push(new Invader(PX + 45 + col * 80, PY + 18 + row * 55, tp));
        }
      }
    }
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 15; gx++) {
        if (Math.random() < 0.55) {
          const tp = choice<BType>(
            ["normal", "hard", "indestr", "bomb", "move"],
            [5, 3, 2, 2, 1],
          );
          blk.push(new Block(gx, gy + 4, tp));
        }
      }
    }
    target = "both";
    tlim = 95;
  }

  return { invaders: inv, blocks: blk, target, tlim };
}
