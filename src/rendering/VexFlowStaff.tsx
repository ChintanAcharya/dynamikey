import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeInput } from '../input/inputBus';
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
import VexFlowScrollingStaff from './vexflowStaff/VexFlowScrollingStaff';
import VexFlowStaffFeedback from './vexflowStaff/VexFlowStaffFeedback';
import VexFlowStaffInfo from './vexflowStaff/VexFlowStaffInfo';
import VexFlowStaffPlayer from './vexflowStaff/VexFlowStaffPlayer';

type VexFlowStaffProps = {
  lesson: Lesson;
};

type TimingGrade =
  | 'Too Early'
  | 'Early'
  | 'Good'
  | 'Perfect'
  | 'Late'
  | 'Too Late';

type FeedbackDetail = {
  timing: string;
  velocity: string;
};

const TIMING_GRADE_THRESHOLDS = {
  perfect: 0.15,
  good: 0.4,
  earlyLate: 0.65,
  too: 0.9,
};
const FLASH_BEAT_EPSILON = 1e-3;
const MIN_TIMING_WINDOW_MS = 1;
const MISS_GRACE_MS = 30;

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
  const expectedFlashIndexRef = useRef(0);
  const [tempoBpm, setTempoBpm] = useState(() =>
    Math.round(lesson.defaultTempo),
  );
  const [phase, setPhase] = useState<TransportPhase>('idle');
  const [countInRemaining, setCountInRemaining] = useState<number | null>(null);
  const [staffHeight, setStaffHeight] = useState<number | null>(null);
  const [beatNumber, setBeatNumber] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [feedbackIndicator, setFeedbackIndicator] = useState<
    'ready' | 'hit' | 'warn' | 'miss'
  >('ready');
  const [feedbackDetail, setFeedbackDetail] = useState<FeedbackDetail>(() => ({
    timing: 'Waiting',
    velocity: 'Waiting',
  }));

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
    () => Math.max(lesson.scoring.timingToleranceMs, MIN_TIMING_WINDOW_MS),
    [lesson.scoring.timingToleranceMs],
  );
  const timingWindowBeats = useMemo(
    () => timingWindowMs / msPerBeat,
    [timingWindowMs, msPerBeat],
  );
  const missGraceBeats = useMemo(() => MISS_GRACE_MS / msPerBeat, [msPerBeat]);
  const velocityTolerance = lesson.scoring.velocityTolerance;

  const gradeTiming = useCallback(
    (deltaBeats: number): TimingGrade => {
      const ratio = timingWindowBeats > 0 ? deltaBeats / timingWindowBeats : 0;
      if (ratio <= -TIMING_GRADE_THRESHOLDS.too) return 'Too Early';
      if (ratio <= -TIMING_GRADE_THRESHOLDS.earlyLate) return 'Early';
      if (ratio <= -TIMING_GRADE_THRESHOLDS.good) return 'Good';
      if (Math.abs(ratio) <= TIMING_GRADE_THRESHOLDS.perfect) return 'Perfect';
      if (ratio < TIMING_GRADE_THRESHOLDS.earlyLate) return 'Good';
      if (ratio < TIMING_GRADE_THRESHOLDS.too) return 'Late';
      return 'Too Late';
    },
    [timingWindowBeats],
  );
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

  const triggerFlash = useCallback(() => {
    setFlashKey((prev) => prev + 1);
  }, []);

  const resetFeedbackState = useCallback(
    (currentBeat: number) => {
      noteStatusesRef.current.clear();
      bumpFeedbackRevision();
      noteIndexRef.current = 0;
      expectedFlashIndexRef.current = 0;
      setCurrentNoteIndex(0);
      setFeedbackIndicator('ready');
      setFeedbackDetail({ timing: 'Waiting', velocity: 'Waiting' });
      setFlashKey(0);
      syncRenderer(currentBeat);
    },
    [bumpFeedbackRevision, syncRenderer],
  );

  const updateExpectedNoteFlash = useCallback(
    (snapshot: TransportSnapshot) => {
      if (snapshot.phase !== 'playing') return;
      let index = expectedFlashIndexRef.current;
      while (
        index < playableNotes.length &&
        snapshot.currentBeat + FLASH_BEAT_EPSILON >=
          playableNotes[index].absoluteBeat
      ) {
        index += 1;
      }
      if (index !== expectedFlashIndexRef.current) {
        expectedFlashIndexRef.current = index;
        triggerFlash();
      }
    },
    [playableNotes, triggerFlash],
  );

  const syncNextPendingNote = useCallback(() => {
    let nextIndex = noteIndexRef.current;
    while (nextIndex < playableNotes.length) {
      const status = noteStatusesRef.current.get(playableNotes[nextIndex].id);
      if (!status) {
        break;
      }
      nextIndex += 1;
    }
    if (nextIndex !== noteIndexRef.current) {
      noteIndexRef.current = nextIndex;
      setCurrentNoteIndex(nextIndex);
    }
  }, [playableNotes]);

  const markMissedNotes = useCallback(
    (snapshot: TransportSnapshot) => {
      if (snapshot.phase !== 'playing' && snapshot.phase !== 'ended') {
        return;
      }
      let nextIndex = noteIndexRef.current;
      let didUpdate = false;
      while (nextIndex < playableNotes.length) {
        const note = playableNotes[nextIndex];
        const missDeadline =
          note.absoluteBeat + timingWindowBeats + missGraceBeats;
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
        setFeedbackDetail({ timing: 'Missed', velocity: 'No input' });
      }
      syncNextPendingNote();
    },
    [
      bumpFeedbackRevision,
      missGraceBeats,
      playableNotes,
      syncNextPendingNote,
      timingWindowBeats,
    ],
  );

  const findMatchingNoteIndex = useCallback(
    (midiNote: number, currentBeat: number) => {
      let matchIndex = -1;
      let smallestDelta = Number.POSITIVE_INFINITY;

      for (let index = 0; index < playableNotes.length; index += 1) {
        const note = playableNotes[index];
        if (note.midiNote !== midiNote) {
          continue;
        }

        const status = noteStatusesRef.current.get(note.id);
        if (status && status !== 'miss') {
          continue;
        }

        const beatDelta = currentBeat - note.absoluteBeat;
        const beatDistance = Math.abs(beatDelta);
        if (beatDistance > timingWindowBeats) {
          if (note.absoluteBeat - currentBeat > timingWindowBeats) {
            break;
          }
          continue;
        }

        if (beatDistance < smallestDelta) {
          smallestDelta = beatDistance;
          matchIndex = index;
        }
      }

      return matchIndex;
    },
    [playableNotes, timingWindowBeats],
  );

  const handleInputEvent = useCallback(
    (event: MidiNoteEvent) => {
      if (event.type !== 'noteon') return;
      const transport = transportRef.current;
      if (!transport) return;
      const snapshot = transport.update(event.timestamp);
      if (snapshot.phase !== 'playing') return;
      markMissedNotes(snapshot);

      const matchingNoteIndex = findMatchingNoteIndex(
        event.midiNote,
        snapshot.currentBeat,
      );
      if (matchingNoteIndex < 0) return;

      const note = playableNotes[matchingNoteIndex];
      if (!note) return;

      const beatDelta = snapshot.currentBeat - note.absoluteBeat;
      const velocityDelta = event.velocity - note.velocityTarget;
      const velocityDeltaAbs = Math.abs(velocityDelta);
      const status: NoteFeedbackStatus =
        velocityDeltaAbs <= velocityTolerance ? 'hit' : 'warn';
      const timingGrade = gradeTiming(beatDelta);
      const velocityMessage =
        velocityDeltaAbs <= velocityTolerance
          ? 'On target'
          : `${velocityDelta > 0 ? 'Higher' : 'Lower'} by ${Math.round(
              velocityDeltaAbs,
            )}`;
      noteStatusesRef.current.set(note.id, status);
      bumpFeedbackRevision();

      setFeedbackIndicator(status === 'warn' ? 'warn' : 'hit');
      setFeedbackDetail({
        timing: timingGrade.toLowerCase(),
        velocity: velocityMessage,
      });

      syncNextPendingNote();
      syncRenderer(snapshot.currentBeat);
    },
    [
      bumpFeedbackRevision,
      findMatchingNoteIndex,
      gradeTiming,
      markMissedNotes,
      playableNotes,
      syncNextPendingNote,
      syncRenderer,
      velocityTolerance,
    ],
  );

  useEffect(() => {
    return subscribeInput((event) => {
      handleInputEvent(event);
    });
  }, [handleInputEvent]);

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
      updateExpectedNoteFlash(snapshot);
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
    if (transport.getPhase() === 'ended') {
      resetFeedbackState(0);
    }
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

  const handleTempoChange = (value: number) => {
    stopLoop();
    syncStatus('idle', null);
    lastBeatIndexRef.current = null;
    setBeatNumber(null);
    resetFeedbackState(0);
    setTempoBpm(value);
  };

  return (
    <div className="flex flex-col gap-4">
      <VexFlowStaffPlayer
        beatNumber={beatNumber}
        countInRemaining={countInRemaining}
        isRunning={isRunning}
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        onTempoChange={handleTempoChange}
        phase={phase}
        tempoBpm={tempoBpm}
      />

      <div className="rounded-2xl border border-black/10 bg-white p-4">
        <VexFlowStaffFeedback
          flashKey={flashKey}
          indicator={feedbackIndicator}
          timing={feedbackDetail.timing}
          velocity={feedbackDetail.velocity}
        />
        <VexFlowStaffInfo
          currentNoteLabel={
            currentNote ? formatMidiNote(currentNote.midiNote) : '—'
          }
          targetVelocity={currentNote?.velocityTarget ?? null}
          timingWindowMs={timingWindowMs}
          velocityTolerance={velocityTolerance}
        />
      </div>

      <VexFlowScrollingStaff
        playheadRef={playheadRef}
        renderRootRef={renderRootRef}
        staffHeight={staffHeight}
        viewportRef={viewportRef}
      />
    </div>
  );
}

export default VexFlowStaff;
