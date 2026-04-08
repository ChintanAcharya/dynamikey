import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { formatMidiNote } from '@/features/input/noteUtils';
import type { Lesson, NoteEvent } from '@/features/musicxml/normalizeLesson';

import { getLessonLastBeat } from './lessonMetrics';
import VexFlowScrollingStaff from './VexFlowScrollingStaff';
import VexFlowStaffFeedback from './VexFlowStaffFeedback';
import VexFlowStaffInfo from './VexFlowStaffInfo';
import VexFlowStaffPlayer from './VexFlowStaffPlayer';
import useLessonTransport from './useLessonTransport';
import useMetronomeAudio from './useMetronomeAudio';
import useMidiLessonFeedback from './useMidiLessonFeedback';

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

const TIMING_GRADE_THRESHOLDS = {
  perfect: 0.15,
  good: 0.4,
  earlyLate: 0.65,
  too: 0.9,
};
const MIN_TIMING_WINDOW_MS = 1;
const MISS_GRACE_MS = 30;

function VexFlowStaff({ lesson }: VexFlowStaffProps) {
  const [tempoBpm, setTempoBpm] = useState(Math.round(lesson.defaultTempo));

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

  const metronomeAudio = useMetronomeAudio();

  const {
    currentNoteIndex,
    feedbackDetail,
    feedbackIndicator,
    feedbackRevision,
    flashKey,
    handleTransportSnapshot,
    noteStatuses,
    resetFeedbackState,
  } = useMidiLessonFeedback({
    gradeTiming,
    missGraceBeats,
    playableNotes,
    tempoBpm,
    timingWindowBeats,
    totalBeats,
    velocityTolerance,
  });

  const {
    beatNumber,
    countInRemaining,
    handlePlayPause: togglePlayback,
    isRunning,
    phase,
    reconfigureTransport,
    resetTransport,
    transportSnapshot,
  } = useLessonTransport({
    beatsPerMeasure,
    ensureAudioContext: metronomeAudio.ensureAudioContext,
    onSnapshot: handleTransportSnapshot,
    playClick: metronomeAudio.playClick,
    tempoBpm,
    totalBeats,
  });

  const currentNote = playableNotes[currentNoteIndex] ?? null;
  const currentBeat = Math.min(
    totalBeats,
    Math.max(0, transportSnapshot.currentBeat),
  );

  const handlePlayPause = async () => {
    if (phase === 'ended') {
      resetFeedbackState();
    }
    await togglePlayback();
  };

  const handleReset = () => {
    resetTransport();
    resetFeedbackState();
  };

  const handleTempoChange = (value: number) => {
    resetFeedbackState();
    reconfigureTransport(value);
    setTempoBpm(value);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <VexFlowStaffPlayer
        beatNumber={beatNumber}
        countInRemaining={countInRemaining}
        currentBeat={currentBeat}
        isRunning={isRunning}
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        phase={phase}
        totalBeats={totalBeats}
      />

      <div className="min-h-0 flex-1">
        <VexFlowScrollingStaff
          currentBeat={transportSnapshot.currentBeat}
          feedbackRevision={feedbackRevision}
          lesson={lesson}
          noteStatuses={noteStatuses}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Tempo</CardTitle>
                <CardDescription>
                  Adjust playback speed for the lesson.
                </CardDescription>
              </div>
              <Badge variant="outline" className="tabular-nums">
                {tempoBpm} BPM
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Slider
              aria-label="Tempo"
              value={[tempoBpm]}
              min={40}
              max={160}
              step={1}
              onValueChange={(values) => {
                const value = values[0];
                if (typeof value === 'number') {
                  handleTempoChange(value);
                }
              }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>40 BPM</span>
              <span>160 BPM</span>
            </div>
          </CardContent>
        </Card>

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
    </div>
  );
}

export default VexFlowStaff;
