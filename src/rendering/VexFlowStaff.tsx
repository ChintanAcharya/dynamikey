import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MockKeyboardInput from '../input/MockKeyboardInput';
import type { MidiNoteEvent } from '../input/midiEvents';
import { formatMidiNote } from '../input/noteUtils';
import type { Lesson, NoteEvent } from '../musicxml/normalizeLesson';
import {
  TransportClock,
  type TransportPhase,
  type TransportSnapshot,
} from '../transport/transportClock';
import { getLessonLastBeat } from './vexflowStaff/lessonMetrics';
import {
  createScrollingLessonRenderer,
  type NoteFeedbackMap,
  type NoteFeedbackStatus,
  type ScrollingRenderer,
} from './vexflowStaff/scrollingRenderer';

type VexFlowStaffProps = {
  lesson: Lesson;
};

const TIMING_WINDOW_RATIO = 0.5;

/**
 * Render a VexFlow staff for the provided lesson.
 * @param props - Component props.
 * @returns React element.
 */
function VexFlowStaff({ lesson }: VexFlowStaffProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const renderRootRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<ScrollingRenderer | null>(null);
  const transportRef = useRef<TransportClock | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<TransportPhase>('idle');
  const countInRef = useRef<number | null>(null);
  const lastBeatIndexRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const noteStatusesRef = useRef<NoteFeedbackMap>(new Map());
  const feedbackRevisionRef = useRef(0);
  const noteIndexRef = useRef(0);
  const [tempoBpm, setTempoBpm] = useState(() =>
    Math.round(lesson.defaultTempo),
  );
  const [phase, setPhase] = useState<TransportPhase>('idle');
  const [countInRemaining, setCountInRemaining] = useState<number | null>(null);
  const [staffHeight, setStaffHeight] = useState<number | null>(null);
  const [beatNumber, setBeatNumber] = useState<number | null>(null);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [feedbackIndicator, setFeedbackIndicator] = useState<
    'ready' | 'hit' | 'warn' | 'miss'
  >('ready');
  const [feedbackDetail, setFeedbackDetail] = useState<string | null>(null);

  const beatsPerMeasure = lesson.timeSignature[0];
  const playableNotes = useMemo(
    () =>
      lesson.timeline.filter(
        (note): note is NoteEvent & { midiNote: number } =>
          typeof note.midiNote === 'number',
      ),
    [lesson],
  );
  const currentNote = playableNotes[currentNoteIndex] ?? null;
  const msPerBeat = useMemo(
    () => (tempoBpm > 0 ? 60000 / tempoBpm : 1000),
    [tempoBpm],
  );
  const timingWindowMs = useMemo(
    () => msPerBeat * TIMING_WINDOW_RATIO,
    [msPerBeat],
  );
  const timingWindowBeats = useMemo(
    () => timingWindowMs / msPerBeat,
    [timingWindowMs, msPerBeat],
  );
  const velocityTolerance = lesson.scoring.velocityTolerance;
  const totalBeats = useMemo(
    () => getLessonLastBeat(lesson, beatsPerMeasure),
    [lesson, beatsPerMeasure],
  );
  const transport = useMemo(
    () =>
      new TransportClock({
        tempoBpm,
        countInBeats: beatsPerMeasure,
        totalBeats,
      }),
    [beatsPerMeasure, tempoBpm, totalBeats],
  );

  const isRunning = phase === 'playing' || phase === 'count-in';
  const feedbackLabel =
    feedbackIndicator === 'miss'
      ? 'MISS'
      : feedbackIndicator === 'ready'
        ? 'READY'
        : 'HIT';
  const feedbackTone =
    feedbackIndicator === 'miss'
      ? 'border-red-500/30 bg-red-500/10 text-red-700'
      : feedbackIndicator === 'warn'
        ? 'border-amber-500/40 bg-amber-500/15 text-amber-700'
        : feedbackIndicator === 'hit'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
          : 'border-black/10 bg-black/5 text-black/60';
  const feedbackSummary =
    feedbackIndicator === 'miss'
      ? 'Too late'
      : feedbackIndicator === 'warn'
        ? 'Velocity off'
        : feedbackIndicator === 'hit'
          ? 'On time'
          : 'Waiting for input';
  const feedbackMessage = feedbackDetail ?? feedbackSummary;

  /**
   * Lazily initialize and resume the AudioContext for metronome clicks.
   */
  const ensureAudioContext = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    if (audioRef.current.state === 'suspended') {
      await audioRef.current.resume();
    }
  }, []);

  /**
   * Play a short metronome click.
   * @param isDownbeat - Whether this click is the downbeat.
   */
  const playClick = useCallback((isDownbeat: boolean) => {
    const context = audioRef.current;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const frequency = isDownbeat ? 1000 : 720;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.0001, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.25,
      context.currentTime + 0.01,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.08,
    );
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.09);
  }, []);

  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  /**
   * Ensure the transport loop is stopped.
   */
  const stopLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  /**
   * Update the beat indicator and trigger metronome clicks.
   * @param snapshot - Current transport snapshot.
   */
  const updateBeatState = useCallback(
    (snapshot: TransportSnapshot) => {
      if (snapshot.phase === 'idle' || snapshot.phase === 'ended') {
        if (lastBeatIndexRef.current !== null) {
          lastBeatIndexRef.current = null;
          setBeatNumber(null);
        }
        return;
      }
      if (snapshot.phase === 'paused') {
        return;
      }

      const beatIndex =
        snapshot.phase === 'count-in'
          ? Math.floor(snapshot.beatsElapsed + Number.EPSILON)
          : Math.floor(snapshot.currentBeat + Number.EPSILON);

      if (lastBeatIndexRef.current !== beatIndex) {
        lastBeatIndexRef.current = beatIndex;
        const normalized =
          ((beatIndex % beatsPerMeasure) + beatsPerMeasure) % beatsPerMeasure;
        const nextBeat = normalized + 1;
        setBeatNumber(nextBeat);
        playClick(nextBeat === 1);
      }
    },
    [beatsPerMeasure, playClick],
  );

  const syncRenderer = useCallback((currentBeat: number) => {
    rendererRef.current?.update(
      currentBeat,
      noteStatusesRef.current,
      feedbackRevisionRef.current,
    );
  }, []);

  const bumpFeedbackRevision = useCallback(() => {
    feedbackRevisionRef.current += 1;
  }, []);

  const resetFeedbackState = useCallback(
    (currentBeat: number) => {
      noteStatusesRef.current.clear();
      bumpFeedbackRevision();
      noteIndexRef.current = 0;
      setCurrentNoteIndex(0);
      setFeedbackIndicator('ready');
      setFeedbackDetail(null);
      syncRenderer(currentBeat);
    },
    [bumpFeedbackRevision, syncRenderer],
  );

  const markMissedNotes = useCallback(
    (snapshot: TransportSnapshot) => {
      if (snapshot.phase !== 'playing' && snapshot.phase !== 'ended') {
        return;
      }
      let nextIndex = noteIndexRef.current;
      let didUpdate = false;
      while (nextIndex < playableNotes.length) {
        const note = playableNotes[nextIndex];
        const missDeadline = note.absoluteBeat + timingWindowBeats;
        if (
          snapshot.phase === 'playing' &&
          snapshot.currentBeat <= missDeadline
        ) {
          break;
        }
        if (!noteStatusesRef.current.has(note.id)) {
          noteStatusesRef.current.set(note.id, 'miss');
          didUpdate = true;
        }
        nextIndex += 1;
      }
      if (nextIndex !== noteIndexRef.current) {
        noteIndexRef.current = nextIndex;
        setCurrentNoteIndex(nextIndex);
      }
      if (didUpdate) {
        bumpFeedbackRevision();
        setFeedbackIndicator('miss');
        setFeedbackDetail('Too late');
      }
    },
    [bumpFeedbackRevision, playableNotes, timingWindowBeats],
  );

  const handleInputEvent = useCallback(
    (event: MidiNoteEvent) => {
      if (event.type !== 'noteon') return;
      const transport = transportRef.current;
      if (!transport) return;
      const snapshot = transport.update(event.timestamp);
      if (snapshot.phase !== 'playing') return;
      markMissedNotes(snapshot);

      const note = playableNotes[noteIndexRef.current];
      if (!note || typeof note.midiNote !== 'number') return;
      if (event.midiNote !== note.midiNote) return;

      const beatDelta = snapshot.currentBeat - note.absoluteBeat;
      if (Math.abs(beatDelta) > timingWindowBeats) return;

      const velocityDelta = Math.abs(event.velocity - note.velocityTarget);
      const status: NoteFeedbackStatus =
        velocityDelta <= velocityTolerance ? 'hit' : 'warn';
      noteStatusesRef.current.set(note.id, status);
      bumpFeedbackRevision();

      setFeedbackIndicator(status === 'warn' ? 'warn' : 'hit');
      setFeedbackDetail(
        status === 'warn'
          ? `Velocity off by ${Math.round(velocityDelta)}`
          : null,
      );

      const nextIndex = noteIndexRef.current + 1;
      noteIndexRef.current = nextIndex;
      setCurrentNoteIndex(nextIndex);
      syncRenderer(snapshot.currentBeat);
    },
    [
      bumpFeedbackRevision,
      markMissedNotes,
      playableNotes,
      syncRenderer,
      timingWindowBeats,
      velocityTolerance,
    ],
  );

  /**
   * Sync UI state to the latest transport snapshot.
   * @param nextPhase - Updated phase.
   * @param nextCountIn - Updated count-in ticks.
   */
  const syncStatus = useCallback(
    (nextPhase: TransportPhase, nextCountIn: number | null) => {
      if (phaseRef.current !== nextPhase) {
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
      }
      if (countInRef.current !== nextCountIn) {
        countInRef.current = nextCountIn;
        setCountInRemaining(nextCountIn);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      transportRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const renderRoot = renderRootRef.current;
    if (!viewport || !renderRoot) return;

    let activeRenderer: ScrollingRenderer | null = null;

    const rebuild = () => {
      const width = viewport.clientWidth;
      if (width <= 0 || lesson.measures.length === 0) return;
      activeRenderer?.destroy();
      activeRenderer = createScrollingLessonRenderer(lesson, renderRoot, width);
      rendererRef.current = activeRenderer;
      setStaffHeight(activeRenderer.getHeight());
      const playhead = playheadRef.current;
      if (playhead) {
        playhead.style.left = `${activeRenderer.getPlayheadX()}px`;
      }
      const transport = transportRef.current;
      const snapshot = transport ? transport.update(performance.now()) : null;
      activeRenderer.update(
        snapshot?.currentBeat ?? 0,
        noteStatusesRef.current,
        feedbackRevisionRef.current,
      );
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      activeRenderer?.destroy();
      if (rendererRef.current === activeRenderer) {
        rendererRef.current = null;
      }
    };
  }, [lesson]);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.close();
        audioRef.current = null;
      }
    };
  }, []);

  /**
   * Start the animation loop when the transport is running.
   */
  const startLoop = () => {
    if (animationFrameRef.current !== null) return;

    const step = (now: number) => {
      const transport = transportRef.current;
      const renderer = rendererRef.current;
      if (!transport || !renderer) {
        stopLoop();
        return;
      }

      const snapshot = transport.update(now);
      const nextCountIn =
        snapshot.phase === 'count-in'
          ? Math.max(0, Math.ceil(beatsPerMeasure - snapshot.beatsElapsed))
          : null;
      syncStatus(snapshot.phase, nextCountIn);
      updateBeatState(snapshot);
      markMissedNotes(snapshot);
      renderer.update(
        snapshot.currentBeat,
        noteStatusesRef.current,
        feedbackRevisionRef.current,
      );

      if (snapshot.phase === 'playing' || snapshot.phase === 'count-in') {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  /**
   * Toggle play/pause state for the transport.
   */
  const handlePlayPause = async () => {
    const transport = transportRef.current;
    if (!transport) return;

    if (isRunning) {
      transport.pause(performance.now());
      stopLoop();
      const snapshot = transport.update(performance.now());
      const nextCountIn =
        snapshot.phase === 'count-in'
          ? Math.max(0, Math.ceil(beatsPerMeasure - snapshot.beatsElapsed))
          : null;
      syncStatus(snapshot.phase, nextCountIn);
      updateBeatState(snapshot);
      rendererRef.current?.update(
        snapshot.currentBeat,
        noteStatusesRef.current,
        feedbackRevisionRef.current,
      );
      return;
    }

    await ensureAudioContext();
    transport.start(performance.now());
    const snapshot = transport.update(performance.now());
    const nextCountIn =
      snapshot.phase === 'count-in'
        ? Math.max(0, Math.ceil(beatsPerMeasure - snapshot.beatsElapsed))
        : null;
    syncStatus(snapshot.phase, nextCountIn);
    updateBeatState(snapshot);
    rendererRef.current?.update(
      snapshot.currentBeat,
      noteStatusesRef.current,
      feedbackRevisionRef.current,
    );
    startLoop();
  };

  /**
   * Reset transport to the start position.
   */
  const handleReset = () => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.reset();
    stopLoop();
    syncStatus('idle', null);
    lastBeatIndexRef.current = null;
    setBeatNumber(null);
    resetFeedbackState(0);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-black/70">
        <button
          type="button"
          onClick={handlePlayPause}
          className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:border-black/40"
        >
          {isRunning ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:border-black/40"
        >
          Reset
        </button>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            Tempo
          </span>
          <input
            type="range"
            min={40}
            max={160}
            step={1}
            value={tempoBpm}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isNaN(value)) {
                stopLoop();
                syncStatus('idle', null);
                lastBeatIndexRef.current = null;
                setBeatNumber(null);
                resetFeedbackState(0);
                setTempoBpm(value);
              }
            }}
            className="h-1 w-full max-w-[200px] accent-black"
          />
          <span className="text-xs font-semibold text-black tabular-nums">
            {tempoBpm} BPM
          </span>
        </div>
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
          {phase.replace('-', ' ')}
        </span>
        {phase === 'count-in' && typeof countInRemaining === 'number' && (
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            Count-in: {countInRemaining}
          </span>
        )}
        {typeof beatNumber === 'number' && (
          <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            Beat: {beatNumber}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="rounded-2xl border border-black/10 bg-white p-4">
          <div className={`rounded-2xl border p-4 ${feedbackTone}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em]">
              Feedback
            </div>
            <div className="mt-2 text-4xl font-semibold">{feedbackLabel}</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.2em]">
              {feedbackMessage}
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                Current note
              </div>
              <div className="mt-2 text-2xl font-semibold text-black">
                {currentNote ? formatMidiNote(currentNote.midiNote) : '—'}
              </div>
              <div className="text-xs text-black/50">
                Target velocity {currentNote ? currentNote.velocityTarget : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">
                Windows
              </div>
              <div className="mt-2 text-sm text-black/70">
                Timing ±{Math.round(timingWindowMs)} ms
              </div>
              <div className="text-sm text-black/70">
                Velocity ±{velocityTolerance}
              </div>
            </div>
          </div>
        </div>

        <MockKeyboardInput onEvent={handleInputEvent} />
      </div>

      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-white"
        style={staffHeight ? { height: staffHeight } : undefined}
      >
        <div ref={renderRootRef} className="absolute left-0 top-0" />
        <div
          ref={playheadRef}
          className="pointer-events-none absolute top-0 h-full w-px bg-red-500/80"
        />
      </div>
    </div>
  );
}

export default VexFlowStaff;
