import GameCanvas from "./components/GameCanvas";

export default function App() {
  return (
    <div className="app">
      <h1>ARKANOID vs INVADERS</h1>
      <GameCanvas />
      <div className="hint">
        PC: マウスで移動 / SPACE でスマッシュ・決定 / ESC でメニュー / 1-4 でスキル
        <br />
        スマホ: 画面をドラッグで移動、下のボタンで操作
      </div>
    </div>
  );
}
