import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { subscribeInput } from '../../input/inputBus';
import type { MidiNoteEvent } from '../../input/midiEvents';
import type { NoteEvent } from '../../musicxml/normalizeLesson';
import type { TransportSnapshot } from '../../transport/transportClock';
import type {
  NoteFeedbackMap,
  NoteFeedbackStatus,
} from './scrollingRenderer';

const FLASH_BEAT_EPSILON = 1e-3;

export type FeedbackIndicator = 'ready' | 'hit' | 'warn' | 'miss';

export type FeedbackDetail = {
  timing: string;
  velocity: string;
};

type PlayableNote = NoteEvent & { midiNote: number };

type UseMidiLessonFeedbackOptions = {
  getTransportSnapshot: (timestamp: number) => TransportSnapshot | null;
  gradeTiming: (deltaBeats: number) => string;
  missGraceBeats: number;
  onRenderUpdate: (
    currentBeat: number,
    noteStatuses: NoteFeedbackMap,
    feedbackRevision: number,
  ) => void;
  playableNotes: PlayableNote[];
  timingWindowBeats: number;
  velocityTolerance: number;
};

type UseMidiLessonFeedbackResult = {
  applyTransportSnapshot: (snapshot: TransportSnapshot) => void;
  currentNoteIndex: number;
  feedbackDetail: FeedbackDetail;
  feedbackIndicator: FeedbackIndicator;
  flashKey: number;
  resetFeedbackState: (currentBeat: number) => void;
};

function useMidiLessonFeedback({
  getTransportSnapshot,
  gradeTiming,
  missGraceBeats,
  onRenderUpdate,
  playableNotes,
  timingWindowBeats,
  velocityTolerance,
}: UseMidiLessonFeedbackOptions): UseMidiLessonFeedbackResult {
  const noteStatusesRef = useRef<NoteFeedbackMap>(new Map());
  const feedbackRevisionRef = useRef(0);
  const noteIndexRef = useRef(0);
  const expectedFlashIndexRef = useRef(0);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [feedbackIndicator, setFeedbackIndicator] =
    useState<FeedbackIndicator>('ready');
  const [feedbackDetail, setFeedbackDetail] = useState<FeedbackDetail>({
    timing: 'Waiting',
    velocity: 'Waiting',
  });
  const [flashKey, setFlashKey] = useState(0);

  const bumpFeedbackRevision = useCallback(() => {
    feedbackRevisionRef.current += 1;
  }, []);

  const triggerFlash = useCallback(() => {
    setFlashKey((previous) => previous + 1);
  }, []);

  const emitRenderUpdate = useCallback(
    (currentBeat: number) => {
      onRenderUpdate(
        currentBeat,
        noteStatusesRef.current,
        feedbackRevisionRef.current,
      );
    },
    [onRenderUpdate],
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
      emitRenderUpdate(currentBeat);
    },
    [bumpFeedbackRevision, emitRenderUpdate],
  );

  const applyTransportSnapshot = useCallback(
    (snapshot: TransportSnapshot) => {
      updateExpectedNoteFlash(snapshot);
      if (markMissedNotes(snapshot)) {
        emitRenderUpdate(snapshot.currentBeat);
      }
    },
    [emitRenderUpdate, markMissedNotes, updateExpectedNoteFlash],
  );

  const handleInputEvent = useCallback(
    (event: MidiNoteEvent) => {
      if (event.type !== 'noteon') return;

      const snapshot = getTransportSnapshot(event.timestamp);
      if (!snapshot || snapshot.phase !== 'playing') return;

      const didMarkMisses = markMissedNotes(snapshot);

      const matchingNoteIndex = findMatchingNoteIndex(
        event.midiNote,
        snapshot.currentBeat,
      );
      if (matchingNoteIndex < 0) {
        if (didMarkMisses) {
          emitRenderUpdate(snapshot.currentBeat);
        }
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
      bumpFeedbackRevision();
      setFeedbackIndicator(status === 'warn' ? 'warn' : 'hit');
      setFeedbackDetail({
        timing: gradeTiming(beatDelta).toLowerCase(),
        velocity: velocityMessage,
      });

      syncNextPendingNote();
      emitRenderUpdate(snapshot.currentBeat);
    },
    [
      emitRenderUpdate,
      bumpFeedbackRevision,
      findMatchingNoteIndex,
      getTransportSnapshot,
      gradeTiming,
      markMissedNotes,
      playableNotes,
      syncNextPendingNote,
      velocityTolerance,
    ],
  );

  useEffect(() => {
    return subscribeInput((event) => {
      handleInputEvent(event);
    });
  }, [handleInputEvent]);

  return {
    applyTransportSnapshot,
    currentNoteIndex,
    feedbackDetail,
    feedbackIndicator,
    flashKey,
    resetFeedbackState,
  };
}

export default useMidiLessonFeedback;
