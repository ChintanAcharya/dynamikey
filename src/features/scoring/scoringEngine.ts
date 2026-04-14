// src/features/scoring/scoringEngine.ts

import type { MidiNoteEvent } from '@/features/input/types';
import type { TransportSnapshot } from '@/features/transport/transportClock';

const FLASH_BEAT_EPSILON = 1e-3;

// ── Core domain types ─────────────────────────────────────────────────────────

export type NoteId = string;

export type NoteFeedbackStatus = 'hit' | 'miss' | 'warn';

/** Minimal note shape the engine needs. The hook maps PlayableNote to this. */
export type ScoringNote = {
  id: NoteId;
  absoluteBeat: number;
  midiNote: number;
  velocityTarget: number;
};

export type NoteGrade = {
  noteId: NoteId;
  status: NoteFeedbackStatus;
  beatDelta: number; // signed: negative = early, positive = late
  velocityDelta: number; // signed: negative = softer, positive = louder
  timingLabel: string; // pre-formatted by engine for display
  velocityLabel: string; // pre-formatted by engine for display
  gradedAt: 'input' | 'timeout';
};

export type ScoringState = {
  noteStatuses: ReadonlyMap<NoteId, NoteFeedbackStatus>;
  nextPendingIndex: number; // index of first ungraded note
  revision: number; // monotonically increasing — diff to detect changes
  flashRevision: number; // increments only when flash index advances
  expectedNoteFlashBeat: number | null;
  lastGrade: NoteGrade | null;
};

// ── Extension points ──────────────────────────────────────────────────────────

/**
 * EXTENSION POINT 1 — timing grader
 * Default: maps beat delta to a human-readable label.
 * Swap for adaptive difficulty, custom thresholds, etc.
 */
export type TimingGrader = (beatDelta: number, tempoBpm: number) => string;

/**
 * EXTENSION POINT 2 — note matcher
 * Default: nearest ungraded note within the timing window (monophonic).
 * Swap for chord matching, polyphonic scoring, or pitch-lenient mode.
 */
export type NoteMatcher = (
  midiNote: number,
  currentBeat: number,
  notes: readonly ScoringNote[],
  noteStatuses: ReadonlyMap<NoteId, NoteFeedbackStatus>,
  timingWindowBeats: number,
) => number; // index into notes, or -1

/**
 * EXTENSION POINT 3 — hit classifier
 * Default: checks velocity delta against tolerance → 'hit' | 'warn'.
 * Swap for weighted rubric, partial credit, etc.
 */
export type HitClassifier = (params: {
  note: ScoringNote;
  event: MidiNoteEvent;
  beatDelta: number;
  timingGrade: string;
  velocityTolerance: number;
}) => NoteFeedbackStatus;

/**
 * EXTENSION POINT 4 — miss deadline
 * Default: absoluteBeat + timingWindow + missGrace.
 * Swap for phrase-aware or note-duration-aware deadlines.
 */
export type MissDeadlineFn = (
  note: ScoringNote,
  timingWindowBeats: number,
  missGraceBeats: number,
) => number;

// ── Config ────────────────────────────────────────────────────────────────────

export type ScoringEngineConfig = {
  notes: readonly ScoringNote[];
  tempoBpm: number;
  totalBeats: number;
  timingWindowBeats: number;
  missGraceBeats: number;
  velocityTolerance: number;

  // All optional — defaults are exported and can be wrapped or replaced.
  gradeTiming?: TimingGrader;
  matchNote?: NoteMatcher;
  classifyHit?: HitClassifier;
  getMissDeadline?: MissDeadlineFn;
};

// ── Default implementations ───────────────────────────────────────────────────

export function defaultTimingGrader(
  beatDelta: number,
  tempoBpm: number,
): string {
  const msPerBeat = tempoBpm > 0 ? 60000 / tempoBpm : 1000;
  const deltaMs = beatDelta * msPerBeat;
  if (deltaMs <= -300) return 'Too Early';
  if (deltaMs <= -150) return 'Early';
  if (Math.abs(deltaMs) <= 50) return 'Perfect';
  if (deltaMs <= 150) return 'Good';
  if (deltaMs <= 300) return 'Late';
  return 'Too Late';
}

export function defaultNoteMatcher(
  midiNote: number,
  currentBeat: number,
  notes: readonly ScoringNote[],
  noteStatuses: ReadonlyMap<NoteId, NoteFeedbackStatus>,
  timingWindowBeats: number,
): number {
  let matchIndex = -1;
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (note.midiNote !== midiNote) continue;

    const status = noteStatuses.get(note.id);
    if (status && status !== 'miss') continue;

    const beatDelta = currentBeat - note.absoluteBeat;
    const beatDistance = Math.abs(beatDelta);
    if (beatDistance > timingWindowBeats) {
      if (note.absoluteBeat - currentBeat > timingWindowBeats) break;
      continue;
    }

    if (beatDistance < smallestDelta) {
      smallestDelta = beatDistance;
      matchIndex = i;
    }
  }

  return matchIndex;
}

export function defaultHitClassifier(params: {
  note: ScoringNote;
  event: MidiNoteEvent;
  beatDelta: number;
  timingGrade: string;
  velocityTolerance: number;
}): NoteFeedbackStatus {
  const velocityDeltaAbs = Math.abs(
    params.event.velocity - params.note.velocityTarget,
  );
  return velocityDeltaAbs <= params.velocityTolerance ? 'hit' : 'warn';
}

export function defaultMissDeadline(
  note: ScoringNote,
  timingWindowBeats: number,
  missGraceBeats: number,
): number {
  return note.absoluteBeat + timingWindowBeats + missGraceBeats;
}

// ── Engine ────────────────────────────────────────────────────────────────────

const IDLE_SNAPSHOT: TransportSnapshot = {
  phase: 'idle',
  currentBeat: 0,
  elapsedMs: 0,
  beatsElapsed: 0,
  timestampMs: 0,
};

export class ScoringEngine {
  private readonly notes: readonly ScoringNote[];
  private tempoBpm: number;
  private readonly totalBeats: number;
  private readonly timingWindowBeats: number;
  private readonly missGraceBeats: number;
  private readonly velocityTolerance: number;
  private readonly gradeTiming: TimingGrader;
  private readonly matchNote: NoteMatcher;
  private readonly classifyHit: HitClassifier;
  private readonly getMissDeadline: MissDeadlineFn;

  private readonly noteStatuses = new Map<NoteId, NoteFeedbackStatus>();
  private nextPendingIndex = 0;
  private revision = 0;
  private flashRevision = 0;
  private expectedFlashIndex = 0;
  private expectedNoteFlashBeat: number | null = null;
  private lastGrade: NoteGrade | null = null;
  private lastSnapshot: TransportSnapshot = IDLE_SNAPSHOT;
  private readonly gradeListeners = new Set<(grade: NoteGrade) => void>();

  constructor(config: ScoringEngineConfig) {
    this.notes = config.notes;
    this.tempoBpm = config.tempoBpm;
    this.totalBeats = config.totalBeats;
    this.timingWindowBeats = config.timingWindowBeats;
    this.missGraceBeats = config.missGraceBeats;
    this.velocityTolerance = config.velocityTolerance;
    this.gradeTiming = config.gradeTiming ?? defaultTimingGrader;
    this.matchNote = config.matchNote ?? defaultNoteMatcher;
    this.classifyHit = config.classifyHit ?? defaultHitClassifier;
    this.getMissDeadline = config.getMissDeadline ?? defaultMissDeadline;
  }

  /** Call every rAF frame from the transport loop. Returns null when nothing changed. */
  onTransportSnapshot(snapshot: TransportSnapshot): ScoringState | null {
    this.lastSnapshot = snapshot;
    let changed = false;

    // Advance flash index past notes the playhead has reached
    if (snapshot.phase === 'playing') {
      let index = this.expectedFlashIndex;
      while (
        index < this.notes.length &&
        snapshot.currentBeat + FLASH_BEAT_EPSILON >=
          this.notes[index].absoluteBeat
      ) {
        index++;
      }
      if (index !== this.expectedFlashIndex) {
        this.expectedFlashIndex = index;
        this.expectedNoteFlashBeat =
          index > 0 ? this.notes[index - 1].absoluteBeat : null;
        this.flashRevision++;
        this.revision++;
        changed = true;
      }
    }

    // Mark notes whose deadline has passed
    if (this.applyMissDeadlines(snapshot)) {
      changed = true;
    }

    return changed ? this.buildState() : null;
  }

  /** Call for each MIDI note-on event. Timestamp drives interpolated beat resolution. */
  onInputEvent(event: MidiNoteEvent): ScoringState | null {
    if (event.type !== 'noteon') return null;

    const snapshot = this.resolveSnapshotAtTimestamp(event.timestamp);
    if (snapshot.phase !== 'playing') return null;

    this.applyMissDeadlines(snapshot);

    const matchIndex = this.matchNote(
      event.midiNote,
      snapshot.currentBeat,
      this.notes,
      this.noteStatuses,
      this.timingWindowBeats,
    );
    if (matchIndex < 0) return null;

    const note = this.notes[matchIndex];
    const beatDelta = snapshot.currentBeat - note.absoluteBeat;
    const velocityDelta = event.velocity - note.velocityTarget;
    const velocityDeltaAbs = Math.abs(velocityDelta);
    const timingGrade = this.gradeTiming(beatDelta, this.tempoBpm);
    const status = this.classifyHit({
      note,
      event,
      beatDelta,
      timingGrade,
      velocityTolerance: this.velocityTolerance,
    });

    const velocityLabel =
      velocityDeltaAbs <= this.velocityTolerance
        ? 'On target'
        : `${velocityDelta > 0 ? 'Higher' : 'Lower'} by ${Math.round(velocityDeltaAbs)}`;

    const grade: NoteGrade = {
      noteId: note.id,
      status,
      beatDelta,
      velocityDelta,
      timingLabel: timingGrade.toLowerCase(),
      velocityLabel,
      gradedAt: 'input',
    };

    this.noteStatuses.set(note.id, status);
    this.lastGrade = grade;
    this.revision++;
    this.advancePendingIndex();

    for (const listener of this.gradeListeners) {
      listener(grade);
    }

    return this.buildState();
  }

  /** Returns current state without mutating. Safe to call any time. */
  getState(): ScoringState {
    return this.buildState();
  }

  /** Resets all grading state. Config (notes, tempo, etc.) is preserved. */
  reset(): ScoringState {
    this.noteStatuses.clear();
    this.nextPendingIndex = 0;
    this.expectedFlashIndex = 0;
    this.expectedNoteFlashBeat = null;
    this.flashRevision = 0;
    this.lastGrade = null;
    this.revision++;
    this.lastSnapshot = IDLE_SNAPSHOT;
    return this.buildState();
  }

  /**
   * Hot-swaps tempo without resetting accumulated grades.
   * Use when the user adjusts BPM mid-session.
   */
  setTempoBpm(bpm: number): void {
    this.tempoBpm = bpm;
  }

  /**
   * EXTENSION POINT 5 — grade event stream.
   * Subscribe for aggregate statistics, replay recording, or analytics.
   * Returns unsubscribe function.
   */
  onGrade(listener: (grade: NoteGrade) => void): () => void {
    this.gradeListeners.add(listener);
    return () => {
      this.gradeListeners.delete(listener);
    };
  }

  private buildState(): ScoringState {
    return {
      noteStatuses: new Map(this.noteStatuses),
      nextPendingIndex: this.nextPendingIndex,
      revision: this.revision,
      flashRevision: this.flashRevision,
      expectedNoteFlashBeat: this.expectedNoteFlashBeat,
      lastGrade: this.lastGrade,
    };
  }

  private resolveSnapshotAtTimestamp(timestamp: number): TransportSnapshot {
    const snapshot = this.lastSnapshot;
    if (
      timestamp <= snapshot.timestampMs ||
      (snapshot.phase !== 'playing' && snapshot.phase !== 'count-in')
    ) {
      return snapshot;
    }

    const msPerBeat = this.tempoBpm > 0 ? 60000 / this.tempoBpm : 1000;
    const deltaMs = timestamp - snapshot.timestampMs;
    const deltaBeats = deltaMs / msPerBeat;
    const elapsedMs = snapshot.elapsedMs + deltaMs;
    const beatsElapsed = snapshot.beatsElapsed + deltaBeats;
    const nextCurrentBeat = snapshot.currentBeat + deltaBeats;

    if (nextCurrentBeat >= this.totalBeats) {
      return {
        ...snapshot,
        phase: 'ended',
        currentBeat: this.totalBeats,
        elapsedMs,
        beatsElapsed,
        timestampMs: timestamp,
      };
    }

    const phase: TransportSnapshot['phase'] =
      nextCurrentBeat < 0 ? 'count-in' : 'playing';

    return {
      ...snapshot,
      phase,
      currentBeat: nextCurrentBeat,
      elapsedMs,
      beatsElapsed,
      timestampMs: timestamp,
    };
  }

  private applyMissDeadlines(snapshot: TransportSnapshot): boolean {
    if (snapshot.phase !== 'playing' && snapshot.phase !== 'ended') {
      return false;
    }

    let index = this.nextPendingIndex;
    let didUpdate = false;

    while (index < this.notes.length) {
      const note = this.notes[index];
      const missDeadline = this.getMissDeadline(
        note,
        this.timingWindowBeats,
        this.missGraceBeats,
      );

      if (
        snapshot.phase === 'playing' &&
        snapshot.currentBeat <= missDeadline
      ) {
        break;
      }

      if (!this.noteStatuses.has(note.id)) {
        this.noteStatuses.set(note.id, 'miss');
        const grade: NoteGrade = {
          noteId: note.id,
          status: 'miss',
          beatDelta: snapshot.currentBeat - note.absoluteBeat,
          velocityDelta: 0,
          timingLabel: 'missed',
          velocityLabel: 'no input',
          gradedAt: 'timeout',
        };
        this.lastGrade = grade;
        for (const listener of this.gradeListeners) {
          listener(grade);
        }
        didUpdate = true;
      }

      index++;
    }

    if (index !== this.nextPendingIndex) {
      this.nextPendingIndex = index;
    }

    if (didUpdate) {
      this.revision++;
    }

    return didUpdate;
  }

  private advancePendingIndex(): void {
    let index = this.nextPendingIndex;
    while (
      index < this.notes.length &&
      this.noteStatuses.has(this.notes[index].id)
    ) {
      index++;
    }
    this.nextPendingIndex = index;
  }
}
