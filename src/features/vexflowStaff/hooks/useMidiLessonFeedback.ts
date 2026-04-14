import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { subscribeInput } from '@/features/input/lib/inputBus';
import type { NoteEvent } from '@/features/musicxml/lessonModel';
import type { TransportSnapshot } from '@/features/transport/transportClock';
import {
  ScoringEngine,
  type ScoringState,
  type TimingGrader,
} from '@/features/scoring/scoringEngine';
import type { NoteFeedbackMap } from '@/features/vexflowStaff/lib/scrollingRenderer';

export type FeedbackIndicator = 'ready' | 'hit' | 'warn' | 'miss';

export type FeedbackDetail = {
  timing: string;
  velocity: string;
};

type PlayableNote = NoteEvent & { midiNote: number };

type UseMidiLessonFeedbackOptions = {
  gradeTiming: (deltaBeats: number) => string;
  missGraceBeats: number;
  playableNotes: PlayableNote[];
  tempoBpm: number;
  timingWindowBeats: number;
  totalBeats: number;
  velocityTolerance: number;
};

type UseMidiLessonFeedbackResult = {
  currentNoteIndex: number;
  feedbackDetail: FeedbackDetail;
  feedbackIndicator: FeedbackIndicator;
  feedbackRevision: number;
  flashKey: number;
  handleTransportSnapshot: (snapshot: TransportSnapshot) => void;
  noteStatuses: NoteFeedbackMap;
  resetFeedbackState: () => void;
};

const INITIAL_SCORING_STATE: ScoringState = {
  noteStatuses: new Map(),
  nextPendingIndex: 0,
  revision: 0,
  flashRevision: 0,
  expectedNoteFlashBeat: null,
  lastGrade: null,
};

function derivePresentationState(
  state: ScoringState,
): Omit<
  UseMidiLessonFeedbackResult,
  'handleTransportSnapshot' | 'resetFeedbackState'
> {
  const grade = state.lastGrade;
  let feedbackIndicator: FeedbackIndicator = 'ready';
  let feedbackDetail: FeedbackDetail = {
    timing: 'Waiting',
    velocity: 'Waiting',
  };

  if (grade) {
    feedbackIndicator = grade.status;
    if (grade.gradedAt === 'timeout') {
      feedbackDetail = { timing: 'Missed', velocity: 'No input' };
    } else {
      feedbackDetail = {
        timing: grade.timingLabel,
        velocity: grade.velocityLabel,
      };
    }
  }

  return {
    currentNoteIndex: state.nextPendingIndex,
    feedbackDetail,
    feedbackIndicator,
    feedbackRevision: state.revision,
    flashKey: state.flashRevision,
    noteStatuses: state.noteStatuses as NoteFeedbackMap,
  };
}

function useMidiLessonFeedback({
  gradeTiming,
  missGraceBeats,
  playableNotes,
  tempoBpm,
  timingWindowBeats,
  totalBeats,
  velocityTolerance,
}: UseMidiLessonFeedbackOptions): UseMidiLessonFeedbackResult {
  const engineRef = useRef<ScoringEngine | null>(null);
  const [scoringState, setScoringState] = useState<ScoringState>(
    () => INITIAL_SCORING_STATE,
  );

  // Wrap caller's gradeTiming to match TimingGrader signature (ignores tempoBpm
  // since caller's closure already captures timingWindowBeats).
  const gradeTimingAdapted = useCallback<TimingGrader>(
    (beatDelta) => gradeTiming(beatDelta),
    [gradeTiming],
  );

  // Recreate engine when lesson config changes.
  useLayoutEffect(() => {
    const engine = new ScoringEngine({
      notes: playableNotes,
      tempoBpm,
      totalBeats,
      timingWindowBeats,
      missGraceBeats,
      velocityTolerance,
      gradeTiming: gradeTimingAdapted,
    });
    engineRef.current = engine;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScoringState(engine.getState());
  }, [
    gradeTimingAdapted,
    missGraceBeats,
    playableNotes,
    tempoBpm,
    timingWindowBeats,
    totalBeats,
    velocityTolerance,
  ]);

  // Subscribe to MIDI input bus once.
  useEffect(() => {
    return subscribeInput((event) => {
      const next = engineRef.current?.onInputEvent(event);
      if (next) setScoringState(next);
    });
  }, []);

  const handleTransportSnapshot = useCallback((snapshot: TransportSnapshot) => {
    const next = engineRef.current?.onTransportSnapshot(snapshot);
    if (next) setScoringState(next);
  }, []);

  const resetFeedbackState = useCallback(() => {
    const next = engineRef.current?.reset();
    if (next) setScoringState(next);
  }, []);

  return {
    ...derivePresentationState(scoringState),
    handleTransportSnapshot,
    resetFeedbackState,
  };
}

export default useMidiLessonFeedback;
