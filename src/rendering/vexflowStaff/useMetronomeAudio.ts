import { useCallback, useEffect, useRef } from 'react';

type UseMetronomeAudioResult = {
  ensureAudioContext: () => Promise<void>;
  playClick: (isDownbeat: boolean) => void;
};

function useMetronomeAudio(): UseMetronomeAudioResult {
  const audioRef = useRef<AudioContext | null>(null);

  const ensureAudioContext = useCallback(async () => {
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    if (audioRef.current.state === 'suspended') {
      await audioRef.current.resume();
    }
  }, []);

  const playClick = useCallback((isDownbeat: boolean) => {
    const context = audioRef.current;
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = isDownbeat ? 1000 : 720;
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
    return () => {
      if (audioRef.current) {
        audioRef.current.close();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    ensureAudioContext,
    playClick,
  };
}

export default useMetronomeAudio;
