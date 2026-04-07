import type { Voice } from 'vexflow';
import type { VexFlowContext } from './types';

/**
 * Attach a rendering context to all tickables in the provided voices.
 * @param context - VexFlow rendering context.
 * @param voices - VexFlow voices to update.
 */
export function applyContextToVoices(context: VexFlowContext, voices: Voice[]) {
  voices.forEach((voice) => {
    voice.getTickables().forEach((tickable) => {
      if (
        typeof (tickable as { setContext?: (ctx: VexFlowContext) => void })
          .setContext === 'function'
      ) {
        (tickable as { setContext: (ctx: VexFlowContext) => void }).setContext(
          context,
        );
      }
    });
  });
}
