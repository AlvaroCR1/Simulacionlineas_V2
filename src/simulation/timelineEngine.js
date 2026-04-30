/**
 * timelineEngine.js  v3.0
 * Motor de reproducción para TrayEvents emparejados M1/M2/M4.
 *
 * Callbacks:
 *   onSpawn(tray)    — hora tMs_M1: tarrina nace en Bizerba 1
 *   onReachM2(tray)  — hora tMs_M2: misma tarrina llega a Bizerba 2
 *   onReachM4(tray)  — hora tMs_M4: misma tarrina llega a GLMI
 *   onTick(state)    — cada frame (~60fps)
 *   onStop(stop)     — al entrar en una parada
 *
 * API:
 *   play() · pause() · seekTo(offsetMs) · setSpeed(n) · reset() · destroy()
 */

export const SPEEDS = [1, 5, 10, 30, 60];

export class TimelineEngine {
  constructor(trays, meta) {
    if (!trays?.length) throw new Error("TimelineEngine: trays array vacío");
    this._trays = trays;
    this._meta = meta;
    this._startMs = meta.startMs;
    this._endMs = meta.endMs;
    this._durationMs = meta.durationMs;

    this._cursorMs = 0;
    this._speed = 10;
    this._playing = false;
    this._lastRealTs = null;
    this._rafId = null;

    // Arrays ordenados por cada checkpoint (pre-calculados para O(log n) seek)
    this._byM1 = [...trays].sort((a, b) => a.tMs_M1 - b.tMs_M1);
    this._byM2 = [...trays]
      .filter((t) => t.tMs_M2)
      .sort((a, b) => a.tMs_M2 - b.tMs_M2);
    this._byM4 = [...trays]
      .filter((t) => t.tMs_M4)
      .sort((a, b) => a.tMs_M4 - b.tMs_M4);

    this._idxSpawn = 0;
    this._idxM2 = 0;
    this._idxM4 = 0;
    this._emittedStops = new Set();

    // Callbacks (asignar desde fuera)
    this.onSpawn = null;
    this.onReachM2 = null;
    this.onReachM4 = null;
    this.onTick = null;
    this.onStop = null;
  }

  // ── Estado público ─────────────────────────────────────────────────────────
  get state() {
    return {
      cursorMs: this._cursorMs,
      cursorDate: new Date(this._startMs + this._cursorMs),
      progress: this._durationMs > 0 ? this._cursorMs / this._durationMs : 0,
      playing: this._playing,
      speed: this._speed,
      meta: this._meta,
      reachedEnd: this._cursorMs >= this._durationMs,
    };
  }

  // ── Control ────────────────────────────────────────────────────────────────
  play() {
    if (this._playing) return;
    if (this._cursorMs >= this._durationMs) this._resetCursor();
    this._playing = true;
    this._lastRealTs = performance.now();
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  pause() {
    this._playing = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._tick();
  }

  seekTo(offsetMs) {
    const wasPlaying = this._playing;
    if (wasPlaying) this.pause();
    this._cursorMs = Math.max(0, Math.min(offsetMs, this._durationMs));
    const abs = this._startMs + this._cursorMs;
    this._idxSpawn = this._bisect(this._byM1, "tMs_M1", abs);
    this._idxM2 = this._bisect(this._byM2, "tMs_M2", abs);
    this._idxM4 = this._bisect(this._byM4, "tMs_M4", abs);
    this._emittedStops.clear();
    for (const s of this._meta.stops || [])
      if (s.startMs - this._startMs < this._cursorMs)
        this._emittedStops.add(s.startMs);
    this._tick();
    if (wasPlaying) this.play();
  }

  setSpeed(speed) {
    if (!SPEEDS.includes(speed)) return;
    this._speed = speed;
    this._lastRealTs = performance.now();
    this._tick();
  }

  reset() {
    this.pause();
    this._resetCursor();
    this._tick();
  }

  destroy() {
    this.pause();
    this.onSpawn =
      this.onReachM2 =
      this.onReachM4 =
      this.onTick =
      this.onStop =
        null;
  }

  // ── Loop interno ───────────────────────────────────────────────────────────
  _loop(realNow) {
    if (!this._playing) return;
    const dt = realNow - this._lastRealTs;
    this._lastRealTs = realNow;
    this._cursorMs += dt * this._speed;
    if (this._cursorMs >= this._durationMs) {
      this._cursorMs = this._durationMs;
      this._emitPending();
      this._playing = false;
      this._tick();
      return;
    }
    this._emitPending();
    this._checkStops();
    this._tick();
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  _emitPending() {
    const abs = this._startMs + this._cursorMs;
    while (
      this._idxSpawn < this._byM1.length &&
      this._byM1[this._idxSpawn].tMs_M1 <= abs
    ) {
      console.log("EMIT SPAWN", this._idxSpawn, !!this.onSpawn);
      console.log("onSpawn en engine:", !!this.onSpawn, this._idxSpawn);
      if (this.onSpawn) this.onSpawn(this._byM1[this._idxSpawn]);
      this._idxSpawn++;
    }
    while (
      this._idxM2 < this._byM2.length &&
      this._byM2[this._idxM2].tMs_M2 <= abs
    ) {
      if (this.onReachM2) this.onReachM2(this._byM2[this._idxM2]);
      this._idxM2++;
    }
    while (
      this._idxM4 < this._byM4.length &&
      this._byM4[this._idxM4].tMs_M4 <= abs
    ) {
      if (this.onReachM4) this.onReachM4(this._byM4[this._idxM4]);
      this._idxM4++;
    }
    let spawnCount = 0;
while (
  this._idxSpawn < this._byM1.length &&
  this._byM1[this._idxSpawn].tMs_M1 <= abs &&
  spawnCount < 5
) {
  if (this.onSpawn) this.onSpawn(this._byM1[this._idxSpawn]);
  this._idxSpawn++;
  spawnCount++;
}
  }

  _checkStops() {
    if (!this._meta.stops) return;
    const abs = this._startMs + this._cursorMs;
    for (const stop of this._meta.stops) {
      if (!this._emittedStops.has(stop.startMs) && abs >= stop.startMs) {
        this._emittedStops.add(stop.startMs);
        if (this.onStop) this.onStop(stop);
      }
    }
  }

  _tick() {
    if (this.onTick) this.onTick(this.state);
  }

  _resetCursor() {
    this._cursorMs = 0;
    this._idxSpawn = this._idxM2 = this._idxM4 = 0;
    this._emittedStops.clear();
    this._lastRealTs = null;
  }

  // Búsqueda binaria: primer índice donde arr[i][key] >= target
  _bisect(arr, key, target) {
    let lo = 0,
      hi = arr.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      arr[m][key] < target ? (lo = m + 1) : (hi = m);
    }
    return lo;
  }
}
