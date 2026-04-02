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
  getTransportSnapshot: (timestamp: number) => TransportSnapshot | null;
  handlePlayPause: () => Promise<void>;
  isRunning: boolean;
  phase: TransportPhase;
  reconfigureTransport: (nextTempoBpm: number) => void;
  resetTransport: () => void;
  setOnSnapshot: (
    listener: ((snapshot: TransportSnapshot) => void) | null,
  ) => void;
};

function createIdleSnapshot(): TransportSnapshot {
  return {
    phase: 'idle',
    currentBeat: 0,
    elapsedMs: 0,
    beatsElapsed: 0,
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
  const onSnapshotRef = useRef<((snapshot: TransportSnapshot) => void) | null>(
    onSnapshot ?? null,
  );
  const [phase, setPhase] = useState<TransportPhase>('idle');
  const [countInRemaining, setCountInRemaining] = useState<number | null>(null);
  const [beatNumber, setBeatNumber] = useState<number | null>(null);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot ?? null;
  }, [onSnapshot]);

  const setOnSnapshot = useCallback(
    (listener: ((snapshot: TransportSnapshot) => void) | null) => {
      onSnapshotRef.current = listener;
    },
    [],
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

  const getTransportSnapshot = useCallback((timestamp: number) => {
    return transportRef.current.update(timestamp);
  }, []);

  const startLoop = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    const step = (now: number) => {
      const snapshot = transportRef.current.update(now);
      const nextCountIn =
        snapshot.phase === 'count-in'
          ? Math.max(0, Math.ceil(beatsPerMeasure - snapshot.beatsElapsed))
          : null;

      syncStatus(snapshot.phase, nextCountIn);
      updateBeatState(snapshot);
      onSnapshotRef.current?.(snapshot);

      if (snapshot.phase === 'playing' || snapshot.phase === 'count-in') {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [beatsPerMeasure, syncStatus, updateBeatState]);

  const handlePlayPause = useCallback(async () => {
    const transport = transportRef.current;

    if (phaseRef.current === 'playing' || phaseRef.current === 'count-in') {
      transport.pause(performance.now());
      stopLoop();

      const snapshot = transport.update(performance.now());
      const nextCountIn =
        snapshot.phase === 'count-in'
          ? Math.max(0, Math.ceil(beatsPerMeasure - snapshot.beatsElapsed))
          : null;

      syncStatus(snapshot.phase, nextCountIn);
      updateBeatState(snapshot);
      onSnapshotRef.current?.(snapshot);
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
    onSnapshotRef.current?.(snapshot);
    startLoop();
  }, [beatsPerMeasure, ensureAudioContext, startLoop, stopLoop, syncStatus, updateBeatState]);

  const resetTransport = useCallback(() => {
    transportRef.current.reset();
    stopLoop();
    syncStatus('idle', null);
    lastBeatIndexRef.current = null;
    setBeatNumber(null);
    onSnapshotRef.current?.(createIdleSnapshot());
  }, [stopLoop, syncStatus]);

  const reconfigureTransport = useCallback((nextTempoBpm: number) => {
    transportRef.current = new TransportClock({
      tempoBpm: nextTempoBpm,
      countInBeats: beatsPerMeasure,
      totalBeats,
    });
    stopLoop();
    syncStatus('idle', null);
    lastBeatIndexRef.current = null;
    setBeatNumber(null);
    onSnapshotRef.current?.(createIdleSnapshot());
  }, [beatsPerMeasure, stopLoop, syncStatus, totalBeats]);

  useEffect(() => {
    return () => {
      stopLoop();
    };
  }, [stopLoop]);

  return {
    beatNumber,
    countInRemaining,
    getTransportSnapshot,
    handlePlayPause,
    isRunning: phase === 'playing' || phase === 'count-in',
    phase,
    reconfigureTransport,
    resetTransport,
    setOnSnapshot,
  };
}

export default useLessonTransport;
