import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMidiNote } from '../input/noteUtils';
import type { Lesson, NoteEvent } from '../musicxml/normalizeLesson';
import { getLessonLastBeat } from './vexflowStaff/lessonMetrics';
import VexFlowScrollingStaff from './vexflowStaff/VexFlowScrollingStaff';
import type { NoteFeedbackMap } from './vexflowStaff/scrollingRenderer';
import VexFlowStaffFeedback from './vexflowStaff/VexFlowStaffFeedback';
import VexFlowStaffInfo from './vexflowStaff/VexFlowStaffInfo';
import VexFlowStaffPlayer from './vexflowStaff/VexFlowStaffPlayer';
import useLessonTransport from './vexflowStaff/useLessonTransport';
import useMetronomeAudio from './vexflowStaff/useMetronomeAudio';
import useMidiLessonFeedback from './vexflowStaff/useMidiLessonFeedback';
import type { TransportSnapshot } from '../transport/transportClock';

type VexFlowStaffProps = {
  lesson: Lesson;
};

type StaffRenderState = {
  currentBeat: number;
  feedbackRevision: number;
  noteStatuses: NoteFeedbackMap;
};

type TimingGrade =
  | 'Too Early'
  | 'Early'
  | 'Good'
  | 'Perfect'
  | 'Late'
  | 'Too Late';

const TIMING_GRADE_THRESHOLDS = {
  perfect: 0.15,
  good: 0.4,
  earlyLate: 0.65,
  too: 0.9,
};
const MIN_TIMING_WINDOW_MS = 1;
const MISS_GRACE_MS = 30;

function VexFlowStaff({ lesson }: VexFlowStaffProps) {
  const [tempoBpm, setTempoBpm] = useState(() =>
    Math.round(lesson.defaultTempo),
  );
  const [staffRenderState, setStaffRenderState] = useState<StaffRenderState>(
    () => ({
      currentBeat: 0,
      feedbackRevision: 0,
      noteStatuses: new Map(),
    }),
  );

  const beatsPerMeasure = lesson.timeSignature[0];
  const playableNotes = useMemo(
    () =>
      lesson.timeline.filter(
        (note): note is NoteEvent & { midiNote: number } =>
          typeof note.midiNote === 'number',
      ),
    [lesson],
  );
  const totalBeats = useMemo(
    () => getLessonLastBeat(lesson, beatsPerMeasure),
    [lesson, beatsPerMeasure],
  );

  const msPerBeat = tempoBpm > 0 ? 60000 / tempoBpm : 1000;
  const timingWindowMs = Math.max(
    lesson.scoring.timingToleranceMs,
    MIN_TIMING_WINDOW_MS,
  );
  const timingWindowBeats = timingWindowMs / msPerBeat;
  const missGraceBeats = MISS_GRACE_MS / msPerBeat;
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

  const renderScrollingStaff = useCallback(
    (
      currentBeat: number,
      noteStatuses: NoteFeedbackMap,
      feedbackRevision: number,
    ) => {
      setStaffRenderState((previous) => {
        if (
          previous.currentBeat === currentBeat &&
          previous.noteStatuses === noteStatuses &&
          previous.feedbackRevision === feedbackRevision
        ) {
          return previous;
        }

        return {
          currentBeat,
          feedbackRevision,
          noteStatuses,
        };
      });
    },
    [],
  );

  const metronomeAudio = useMetronomeAudio();

  const {
    beatNumber,
    countInRemaining,
    getTransportSnapshot,
    handlePlayPause: togglePlayback,
    isRunning,
    phase,
    reconfigureTransport,
    resetTransport,
    setOnSnapshot,
  } = useLessonTransport({
    beatsPerMeasure,
    ensureAudioContext: metronomeAudio.ensureAudioContext,
    playClick: metronomeAudio.playClick,
    tempoBpm,
    totalBeats,
  });

  const {
    applyTransportSnapshot,
    currentNoteIndex,
    feedbackDetail,
    feedbackIndicator,
    flashKey,
    resetFeedbackState,
  } = useMidiLessonFeedback({
    getTransportSnapshot,
    gradeTiming,
    missGraceBeats,
    onRenderUpdate: renderScrollingStaff,
    playableNotes,
    timingWindowBeats,
    velocityTolerance,
  });

  useEffect(() => {
    const handleTransportSnapshot = (snapshot: TransportSnapshot) => {
      setStaffRenderState((previous) => {
        if (previous.currentBeat === snapshot.currentBeat) {
          return previous;
        }

        return {
          ...previous,
          currentBeat: snapshot.currentBeat,
        };
      });
      applyTransportSnapshot(snapshot);
    };

    setOnSnapshot(handleTransportSnapshot);

    return () => {
      setOnSnapshot(null);
    };
  }, [applyTransportSnapshot, setOnSnapshot]);

  const currentNote = playableNotes[currentNoteIndex] ?? null;

  const handlePlayPause = async () => {
    if (phase === 'ended') {
      resetFeedbackState(0);
    }
    await togglePlayback();
  };

  const handleReset = () => {
    resetTransport();
    resetFeedbackState(0);
  };

  const handleTempoChange = (value: number) => {
    resetFeedbackState(0);
    reconfigureTransport(value);
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
        currentBeat={staffRenderState.currentBeat}
        feedbackRevision={staffRenderState.feedbackRevision}
        lesson={lesson}
        noteStatuses={staffRenderState.noteStatuses}
      />
    </div>
  );
}

export default VexFlowStaff;
