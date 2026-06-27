import { useEffect, useRef } from "react";
import { Game } from "../game/game";
import { SCREEN_W, SCREEN_H } from "../game/constants";

/**
 * Hosts the single <canvas> the game renders to. React only mounts/unmounts the
 * canvas; the entire game loop (state machine, physics, drawing) lives in the
 * Game class and runs on requestAnimationFrame, outside React's render cycle.
 */
export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    game.start();
    return () => game.stop();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_W}
      height={SCREEN_H}
      className="game-canvas"
      tabIndex={0}
    />
  );
}
