import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Game } from "../game/game";
import { SCREEN_W, SCREEN_H } from "../game/constants";

/**
 * Hosts the single <canvas> the game renders to. React only mounts/unmounts the
 * canvas; the entire game loop (state machine, physics, drawing) lives in the
 * Game class and runs on requestAnimationFrame, outside React's render cycle.
 *
 * The on-screen buttons below the canvas mirror the keyboard so the game is
 * fully playable on touch devices that have no physical keyboard. Paddle
 * movement on touch is handled inside Game (drag on the canvas).
 */
export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    gameRef.current = game;
    game.start();
    return () => {
      game.stop();
      gameRef.current = null;
    };
  }, []);

  // Wire an on-screen button to a virtual key press. pointerdown responds
  // immediately (no 300ms click delay) and fires once for both mouse and touch,
  // avoiding the double-trigger you get from binding touchstart + click.
  const press =
    (token: Parameters<Game["press"]>[0]) => (e: ReactPointerEvent) => {
      e.preventDefault();
      gameRef.current?.press(token);
    };

  return (
    <div className="game-wrap">
      <canvas
        ref={canvasRef}
        width={SCREEN_W}
        height={SCREEN_H}
        className="game-canvas"
        tabIndex={0}
      />

      {/* Touch controls (also clickable with a mouse). */}
      <div className="touch-controls">
        <button
          className="tc-btn tc-primary"
          onPointerDown={press("space")}
          aria-label="決定・スマッシュ (Space)"
        >
          決定 / スマッシュ
          <span className="tc-sub">SPACE</span>
        </button>

        <div className="tc-row">
          <span className="tc-label">スキル</span>
          <button className="tc-btn" onPointerDown={press("1")}>
            1
          </button>
          <button className="tc-btn" onPointerDown={press("2")}>
            2
          </button>
          <button className="tc-btn" onPointerDown={press("3")}>
            3
          </button>
          <button className="tc-btn" onPointerDown={press("4")}>
            4
          </button>
        </div>

        <div className="tc-row">
          <button className="tc-btn" onPointerDown={press("n")}>
            NORMAL
          </button>
          <button className="tc-btn" onPointerDown={press("h")}>
            HARD
          </button>
          <button className="tc-btn" onPointerDown={press("esc")}>
            メニュー
          </button>
        </div>
      </div>
    </div>
  );
}
