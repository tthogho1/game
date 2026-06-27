import GameCanvas from "./components/GameCanvas";

export default function App() {
  return (
    <div className="app">
      <h1>ARKANOID vs INVADERS</h1>
      <GameCanvas />
      <div className="hint">
        マウス: 移動 / SPACE: スマッシュ・決定 / ESC: メニュー / 1-4:
        スキル選択
        <br />
        Move: mouse &nbsp;·&nbsp; Smash / Confirm: Space &nbsp;·&nbsp; Menu: Esc
      </div>
    </div>
  );
}
