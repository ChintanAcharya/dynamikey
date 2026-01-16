import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lesson } from '../musicxml/normalizeLesson';
import {
  TransportClock,
  type TransportPhase,
  type TransportSnapshot,
} from '../transport/transportClock';
import { getLessonLastBeat } from './vexflowStaff/lessonMetrics';
import {
  createScrollingLessonRenderer,
  type ScrollingRenderer,
} from './vexflowStaff/scrollingRenderer';

type VexFlowStaffProps = {
  lesson: Lesson;
};

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
  const [tempoBpm, setTempoBpm] = useState(() =>
    Math.round(lesson.defaultTempo),
  );
  const [phase, setPhase] = useState<TransportPhase>('idle');
  const [countInRemaining, setCountInRemaining] = useState<number | null>(null);
  const [staffHeight, setStaffHeight] = useState<number | null>(null);
  const [beatNumber, setBeatNumber] = useState<number | null>(null);

  const beatsPerMeasure = lesson.timeSignature[0];
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
    gainNode.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.01);
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
      activeRenderer.update(snapshot?.currentBeat ?? 0);
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
          ? Math.max(
              0,
              Math.ceil(beatsPerMeasure - snapshot.beatsElapsed),
            )
          : null;
      syncStatus(snapshot.phase, nextCountIn);
      updateBeatState(snapshot);
      renderer.update(snapshot.currentBeat);

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
      rendererRef.current?.update(snapshot.currentBeat);
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
    rendererRef.current?.update(snapshot.currentBeat);
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
    rendererRef.current?.update(0);
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
                rendererRef.current?.update(0);
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
