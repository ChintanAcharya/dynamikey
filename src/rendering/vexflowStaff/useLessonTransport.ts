import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TransportClock,
  type TransportPhase,
  type TransportSnapshot,
} from '../../transport/transportClock';

type UseLessonTransportOptions = {
  beatsPerMeasure: number;
  ensureAudioContext: () => Promise<void>;
  onSnapshot?: ((snapshot: TransportSnapshot) => void) | null;
  playClick: (isDownbeat: boolean) => void;
  tempoBpm: number;
  totalBeats: number;
};

type UseLessonTransportResult = {
  beatNumber: number | null;
  countInRemaining: number | null;
  handlePlayPause: () => Promise<void>;
  isRunning: boolean;
  phase: TransportPhase;
  reconfigureTransport: (nextTempoBpm: number) => void;
  resetTransport: () => void;
  transportSnapshot: TransportSnapshot;
};

function createIdleSnapshot(timestampMs: number): TransportSnapshot {
  return {
    phase: 'idle',
    currentBeat: 0,
    elapsedMs: 0,
    beatsElapsed: 0,
    timestampMs,
  };
}

function useLessonTransport({
  beatsPerMeasure,
  ensureAudioContext,
  onSnapshot,
  playClick,
  tempoBpm,
  totalBeats,
}: UseLessonTransportOptions): UseLessonTransportResult {
  const transportRef = useRef(
    new TransportClock({
      tempoBpm,
      countInBeats: beatsPerMeasure,
      totalBeats,
    }),
  );
  const animationFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<TransportPhase>('idle');
  const countInRef = useRef<number | null>(null);
  const lastBeatIndexRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<TransportPhase>('idle');
  const [countInRemaining, setCountInRemaining] = useState<number | null>(null);
  const [beatNumber, setBeatNumber] = useState<number | null>(null);
  const [transportSnapshot, setTransportSnapshot] = useState<TransportSnapshot>(
    () =>
      createIdleSnapshot(
        typeof performance === 'undefined' ? 0 : performance.now(),
      ),
  );

  const stopLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

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

  const publishSnapshot = useCallback(
    (snapshot: TransportSnapshot) => {
      const nextCountIn =
        snapshot.phase === 'count-in'
          ? Math.max(0, Math.ceil(beatsPerMeasure - snapshot.beatsElapsed))
          : null;

      syncStatus(snapshot.phase, nextCountIn);
      updateBeatState(snapshot);
      setTransportSnapshot(snapshot);
      onSnapshot?.(snapshot);
    },
    [beatsPerMeasure, onSnapshot, syncStatus, updateBeatState],
  );

  const startLoop = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    const step = (now: number) => {
      const snapshot = transportRef.current.update(now);
      publishSnapshot(snapshot);

      if (snapshot.phase === 'playing' || snapshot.phase === 'count-in') {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [publishSnapshot]);

  const handlePlayPause = useCallback(async () => {
    const transport = transportRef.current;

    if (phaseRef.current === 'playing' || phaseRef.current === 'count-in') {
      transport.pause(performance.now());
      stopLoop();

      const snapshot = transport.update(performance.now());
      publishSnapshot(snapshot);
      return;
    }

    await ensureAudioContext();
    transport.start(performance.now());

    const snapshot = transport.update(performance.now());
    publishSnapshot(snapshot);
    startLoop();
  }, [ensureAudioContext, publishSnapshot, startLoop, stopLoop]);

  const resetTransport = useCallback(() => {
    transportRef.current.reset();
    stopLoop();
    publishSnapshot(createIdleSnapshot(performance.now()));
  }, [publishSnapshot, stopLoop]);

  const reconfigureTransport = useCallback(
    (nextTempoBpm: number) => {
      transportRef.current = new TransportClock({
        tempoBpm: nextTempoBpm,
        countInBeats: beatsPerMeasure,
        totalBeats,
      });
      stopLoop();
      publishSnapshot(createIdleSnapshot(performance.now()));
    },
    [beatsPerMeasure, publishSnapshot, stopLoop, totalBeats],
  );

  useEffect(() => {
    return () => {
      stopLoop();
    };
  }, [stopLoop]);

  return {
    beatNumber,
    countInRemaining,
    handlePlayPause,
    isRunning: phase === 'playing' || phase === 'count-in',
    phase,
    reconfigureTransport,
    resetTransport,
    transportSnapshot,
  };
}

export default useLessonTransport;
