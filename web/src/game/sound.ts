// Procedural sound effects via the Web Audio API (port of utils.make_snd +
// Game._init_sounds). Buffers are generated once; each play() spawns a source.

type Shape = "sq" | "noise" | "tri" | "sine";
type SndDef = [freq: number, dur: number, vol: number, shape: Shape];

const DEFS: Record<string, SndDef> = {
  reflect: [440, 0.08, 0.4, "sq"],
  smash: [660, 0.12, 0.5, "sq"],
  block: [300, 0.1, 0.3, "sq"],
  destroy: [180, 0.18, 0.5, "noise"],
  attack: [880, 0.25, 0.6, "sq"],
  item: [550, 0.15, 0.4, "sine"],
  clear: [523, 0.6, 0.5, "sine"],
  gameover: [110, 0.8, 0.5, "tri"],
  bomb: [150, 0.3, 0.6, "noise"],
};

export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Record<string, AudioBuffer> = {};

  /** Lazily create the AudioContext + buffers (must follow a user gesture). */
  init(): void {
    if (this.ctx) return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    for (const [name, def] of Object.entries(DEFS)) {
      try {
        this.buffers[name] = this.generate(...def);
      } catch (e) {
        console.warn(`Sound '${name}' failed:`, e);
      }
    }
  }

  /** Browsers suspend audio until a gesture; call this on first key/click. */
  resume(): void {
    this.ctx?.resume();
  }

  play(name: string): void {
    const ctx = this.ctx;
    const buf = this.buffers[name];
    if (!ctx || !buf) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    } catch {
      // ignore playback errors (e.g. context not yet running)
    }
  }

  private generate(
    freq: number,
    dur: number,
    vol: number,
    shape: Shape,
    envDecay = true,
  ): AudioBuffer {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const fade = envDecay ? 1 - i / n : 1;
      let v: number;
      if (shape === "sq") {
        v = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
      } else if (shape === "noise") {
        v = Math.random() * 2 - 1;
      } else if (shape === "tri") {
        v = 2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1;
      } else {
        v = Math.sin(2 * Math.PI * freq * t);
      }
      data[i] = v * vol * fade;
    }
    return buf;
  }
}
