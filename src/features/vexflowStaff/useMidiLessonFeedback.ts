import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeInput } from '@/features/input/inputBus';
import type { MidiNoteEvent } from '@/features/input/midiEvents';
import type { NoteEvent } from '@/features/musicxml/normalizeLesson';
import type { TransportSnapshot } from '@/features/transport/transportClock';

import type { NoteFeedbackMap, NoteFeedbackStatus } from './scrollingRenderer';

const FLASH_BEAT_EPSILON = 1e-3;

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

function useMidiLessonFeedback({
  gradeTiming,
  missGraceBeats,
  playableNotes,
  tempoBpm,
  timingWindowBeats,
  totalBeats,
  velocityTolerance,
}: UseMidiLessonFeedbackOptions): UseMidiLessonFeedbackResult {
  const noteStatusesRef = useRef<NoteFeedbackMap>(new Map());
  const transportSnapshotRef = useRef<TransportSnapshot>({
    phase: 'idle',
    currentBeat: 0,
    elapsedMs: 0,
    beatsElapsed: 0,
    timestampMs: 0,
  });
  const noteIndexRef = useRef(0);
  const expectedFlashIndexRef = useRef(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [feedbackIndicator, setFeedbackIndicator] =
    useState<FeedbackIndicator>('ready');
  const [feedbackRevision, setFeedbackRevision] = useState(0);
  const [feedbackDetail, setFeedbackDetail] = useState<FeedbackDetail>({
    timing: 'Waiting',
    velocity: 'Waiting',
  });
  const [flashKey, setFlashKey] = useState(0);
  const [noteStatuses, setNoteStatuses] = useState<NoteFeedbackMap>(
    () => new Map(),
  );

  const bumpFeedbackRevision = useCallback(() => {
    setFeedbackRevision((previous) => previous + 1);
  }, []);

  const syncNoteStatuses = useCallback(() => {
    setNoteStatuses(new Map(noteStatusesRef.current));
  }, []);

  const triggerFlash = useCallback(() => {
    setFlashKey((previous) => previous + 1);
  }, []);

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

  const markMissedNotes = useCallback(
    (snapshot: TransportSnapshot) => {
      if (snapshot.phase !== 'playing' && snapshot.phase !== 'ended') {
        return false;
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
        syncNoteStatuses();
        bumpFeedbackRevision();
        setFeedbackIndicator('miss');
        setFeedbackDetail({ timing: 'Missed', velocity: 'No input' });
      }

      syncNextPendingNote();
      return didUpdate;
    },
    [
      bumpFeedbackRevision,
      missGraceBeats,
      playableNotes,
      syncNoteStatuses,
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

  const resetFeedbackState = useCallback(() => {
    noteStatusesRef.current.clear();
    syncNoteStatuses();
    bumpFeedbackRevision();
    noteIndexRef.current = 0;
    expectedFlashIndexRef.current = 0;
    setCurrentNoteIndex(0);
    setFeedbackIndicator('ready');
    setFeedbackDetail({ timing: 'Waiting', velocity: 'Waiting' });
    setFlashKey(0);
  }, [bumpFeedbackRevision, syncNoteStatuses]);

  const resolveSnapshotAtTimestamp = useCallback(
    (timestamp: number): TransportSnapshot => {
      const snapshot = transportSnapshotRef.current;
      if (
        timestamp <= snapshot.timestampMs ||
        (snapshot.phase !== 'playing' && snapshot.phase !== 'count-in')
      ) {
        return snapshot;
      }

      const msPerBeat = tempoBpm > 0 ? 60000 / tempoBpm : 1000;
      const deltaMs = timestamp - snapshot.timestampMs;
      const deltaBeats = deltaMs / msPerBeat;
      const elapsedMs = snapshot.elapsedMs + deltaMs;
      const beatsElapsed = snapshot.beatsElapsed + deltaBeats;
      const nextCurrentBeat = snapshot.currentBeat + deltaBeats;

      if (nextCurrentBeat >= totalBeats) {
        return {
          ...snapshot,
          phase: 'ended',
          currentBeat: totalBeats,
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
    },
    [tempoBpm, totalBeats],
  );

  const handleInputEvent = useCallback(
    (event: MidiNoteEvent) => {
      if (event.type !== 'noteon') return;

      const snapshot = resolveSnapshotAtTimestamp(event.timestamp);
      if (snapshot.phase !== 'playing') return;

      markMissedNotes(snapshot);

      const matchingNoteIndex = findMatchingNoteIndex(
        event.midiNote,
        snapshot.currentBeat,
      );
      if (matchingNoteIndex < 0) {
        return;
      }

      const note = playableNotes[matchingNoteIndex];
      if (!note) return;

      const beatDelta = snapshot.currentBeat - note.absoluteBeat;
      const velocityDelta = event.velocity - note.velocityTarget;
      const velocityDeltaAbs = Math.abs(velocityDelta);
      const status: NoteFeedbackStatus =
        velocityDeltaAbs <= velocityTolerance ? 'hit' : 'warn';
      const velocityMessage =
        velocityDeltaAbs <= velocityTolerance
          ? 'On target'
          : `${velocityDelta > 0 ? 'Higher' : 'Lower'} by ${Math.round(
              velocityDeltaAbs,
            )}`;

      noteStatusesRef.current.set(note.id, status);
      syncNoteStatuses();
      bumpFeedbackRevision();
      setFeedbackIndicator(status === 'warn' ? 'warn' : 'hit');
      setFeedbackDetail({
        timing: gradeTiming(beatDelta).toLowerCase(),
        velocity: velocityMessage,
      });

      syncNextPendingNote();
    },
    [
      bumpFeedbackRevision,
      findMatchingNoteIndex,
      gradeTiming,
      markMissedNotes,
      playableNotes,
      resolveSnapshotAtTimestamp,
      syncNoteStatuses,
      syncNextPendingNote,
      velocityTolerance,
    ],
  );

  const handleTransportSnapshot = useCallback(
    (snapshot: TransportSnapshot) => {
      transportSnapshotRef.current = snapshot;
      updateExpectedNoteFlash(snapshot);
      markMissedNotes(snapshot);
    },
    [markMissedNotes, updateExpectedNoteFlash],
  );

  useEffect(() => {
    return subscribeInput((event) => {
      handleInputEvent(event);
    });
  }, [handleInputEvent]);

  return {
    currentNoteIndex,
    feedbackDetail,
    feedbackIndicator,
    feedbackRevision,
    flashKey,
    handleTransportSnapshot,
    noteStatuses,
    resetFeedbackState,
  };
}

export default useMidiLessonFeedback;
