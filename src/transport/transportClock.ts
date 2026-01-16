export type TransportPhase =
  | 'idle'
  | 'count-in'
  | 'playing'
  | 'paused'
  | 'ended';

export type TransportConfig = {
  tempoBpm: number;
  countInBeats: number;
  totalBeats: number;
};

export type TransportSnapshot = {
  phase: TransportPhase;
  currentBeat: number;
  elapsedMs: number;
  beatsElapsed: number;
};

/**
 * Transport clock for timing playback with count-in and tempo control.
 */
export class TransportClock {
  private tempoBpm: number;

  private countInBeats: number;

  private totalBeats: number;

  private phase: TransportPhase = 'idle';

  private startTimeMs: number | null = null;

  private accumulatedMs = 0;

  constructor(config: TransportConfig) {
    this.tempoBpm = config.tempoBpm;
    this.countInBeats = config.countInBeats;
    this.totalBeats = config.totalBeats;
  }

  /**
   * Start or resume the transport.
   * @param nowMs - High-resolution timestamp.
   */
  start(nowMs: number) {
    if (this.phase === 'playing' || this.phase === 'count-in') return;
    if (this.phase !== 'paused') {
      this.accumulatedMs = 0;
    }
    this.startTimeMs = nowMs;
    this.phase = this.countInBeats > 0 ? 'count-in' : 'playing';
  }

  /**
   * Pause the transport, preserving elapsed time.
   * @param nowMs - High-resolution timestamp.
   */
  pause(nowMs: number) {
    if (this.startTimeMs === null) return;
    this.accumulatedMs += nowMs - this.startTimeMs;
    this.startTimeMs = null;
    this.phase = 'paused';
  }

  /**
   * Reset the transport to the idle state.
   */
  reset() {
    this.accumulatedMs = 0;
    this.startTimeMs = null;
    this.phase = 'idle';
  }

  /**
   * Update the clock and derive the current beat position.
   * @param nowMs - High-resolution timestamp.
   * @returns Snapshot of the transport state.
   */
  update(nowMs: number): TransportSnapshot {
    if (this.phase === 'idle') {
      return {
        phase: 'idle',
        currentBeat: 0,
        elapsedMs: 0,
        beatsElapsed: 0,
      };
    }

    const secondsPerBeat = this.tempoBpm > 0 ? 60 / this.tempoBpm : 1;
    const elapsedMs =
      this.startTimeMs === null
        ? this.accumulatedMs
        : this.accumulatedMs + (nowMs - this.startTimeMs);
    const beatsElapsed = elapsedMs / (secondsPerBeat * 1000);
    let currentBeat = beatsElapsed - this.countInBeats;
    let nextPhase = this.phase;

    if (this.phase === 'paused') {
      return {
        phase: 'paused',
        currentBeat,
        elapsedMs,
        beatsElapsed,
      };
    }

    if (beatsElapsed < this.countInBeats) {
      nextPhase = 'count-in';
    } else if (currentBeat >= this.totalBeats) {
      const totalMs =
        (this.countInBeats + this.totalBeats) * secondsPerBeat * 1000;
      this.accumulatedMs = totalMs;
      this.startTimeMs = null;
      currentBeat = this.totalBeats;
      nextPhase = 'ended';
    } else {
      nextPhase = 'playing';
    }

    this.phase = nextPhase;
    return {
      phase: nextPhase,
      currentBeat,
      elapsedMs,
      beatsElapsed,
    };
  }

  /**
   * Get the current phase without advancing the clock.
   * @returns Current transport phase.
   */
  getPhase() {
    return this.phase;
  }
}
