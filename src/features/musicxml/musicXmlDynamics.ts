import { elements } from '@stringsync/musicxml';

export type MusicXmlDynamicEvent = {
  type: string;
  startBeat: number | null;
};

const DYNAMIC_LABELS = [
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'cresc',
  'dim',
] as const;

/**
 * Normalize a raw dynamic label into a supported short label.
 * @param raw - Raw dynamic label string.
 * @returns Normalized label or null when unsupported.
 */
export function normalizeDynamicLabel(raw: string) {
  const normalized = raw.toLowerCase().replace(/\s+/g, '');
  return DYNAMIC_LABELS.find((label) => normalized.includes(label)) ?? null;
}

/**
 * Convert a dynamics child element into a normalized label.
 * @param dynamic - Dynamics child from the library.
 * @returns Normalized label or null when unsupported.
 */
export function dynamicElementToLabel(
  dynamic:
    | elements.P
    | elements.Pp
    | elements.Ppp
    | elements.Pppp
    | elements.Ppppp
    | elements.Pppppp
    | elements.F
    | elements.Ff
    | elements.Fff
    | elements.Ffff
    | elements.Fffff
    | elements.Ffffff
    | elements.Mp
    | elements.Mf
    | elements.Sf
    | elements.Sfp
    | elements.Sfpp
    | elements.Fp
    | elements.Rf
    | elements.Rfz
    | elements.Sfz
    | elements.Sffz
    | elements.Fz
    | elements.N
    | elements.Pf
    | elements.Sfzp
    | elements.OtherDynamics,
) {
  if (dynamic instanceof elements.P) return 'p';
  if (dynamic instanceof elements.Pp) return 'pp';
  if (dynamic instanceof elements.Ppp) return 'ppp';
  if (dynamic instanceof elements.Mp) return 'mp';
  if (dynamic instanceof elements.Mf) return 'mf';
  if (dynamic instanceof elements.F) return 'f';
  if (dynamic instanceof elements.Ff) return 'ff';
  if (dynamic instanceof elements.Fff) return 'fff';
  if (dynamic instanceof elements.OtherDynamics) {
    return normalizeDynamicLabel(dynamic.getText());
  }

  return null;
}

/**
 * Add a dynamic marking once per beat/label combination.
 * @param dynamics - Measure-local dynamics output.
 * @param seen - De-duplication key set.
 * @param type - Dynamic label.
 * @param startBeat - Beat position.
 */
export function pushDynamic(
  dynamics: MusicXmlDynamicEvent[],
  seen: Set<string>,
  type: string | null,
  startBeat: number,
) {
  if (!type) return;
  const key = `${type}:${startBeat.toFixed(6)}`;
  if (seen.has(key)) return;
  seen.add(key);
  dynamics.push({ type, startBeat });
}

/**
 * Parse dynamic markings directly from MusicXML directions.
 * This acts as a fallback for exports whose direction child order is not schema-valid.
 * @param xml - Raw MusicXML document.
 * @param defaultBeatUnit - Beat unit to use until a time signature appears.
 * @returns Per-measure dynamics collected from directions and wedges.
 */
export function parseXmlDynamics(xml: string, defaultBeatUnit: number) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');
  const measures = Array.from(document.querySelectorAll('part > measure'));
  let currentDivisions = 1;
  let currentBeatUnit = defaultBeatUnit;

  return measures.map((measure) => {
    const measureDynamics: MusicXmlDynamicEvent[] = [];
    const seen = new Set<string>();

    const divisionsNode = measure.querySelector('attributes > divisions');
    const divisionsValue = divisionsNode
      ? Number(divisionsNode.textContent)
      : null;
    if (divisionsValue && !Number.isNaN(divisionsValue)) {
      currentDivisions = divisionsValue;
    }

    const beatTypeNode = measure.querySelector('attributes > time > beat-type');
    const beatTypeValue = beatTypeNode
      ? Number(beatTypeNode.textContent)
      : null;
    if (beatTypeValue && !Number.isNaN(beatTypeValue)) {
      currentBeatUnit = beatTypeValue;
    }

    const directions = Array.from(measure.querySelectorAll('direction'));
    for (const direction of directions) {
      const offsetNode = direction.querySelector('offset');
      const offsetValue = offsetNode ? Number(offsetNode.textContent) : 0;
      const startBeat =
        offsetValue && !Number.isNaN(offsetValue)
          ? offsetValue / currentDivisions / (4 / currentBeatUnit)
          : 0;

      const dynamicsNode = direction.querySelector('direction-type > dynamics');
      if (dynamicsNode) {
        for (const child of Array.from(dynamicsNode.children)) {
          const tag = child.tagName?.toLowerCase();
          if (!tag) continue;
          pushDynamic(
            measureDynamics,
            seen,
            normalizeDynamicLabel(tag),
            startBeat,
          );
        }
      }

      const wedgeNode = direction.querySelector('direction-type > wedge');
      if (wedgeNode) {
        const wedgeType = wedgeNode.getAttribute('type')?.toLowerCase();
        if (wedgeType === 'crescendo') {
          pushDynamic(measureDynamics, seen, 'cresc', startBeat);
        } else if (wedgeType === 'diminuendo') {
          pushDynamic(measureDynamics, seen, 'dim', startBeat);
        }
      }

      const wordsNode = direction.querySelector('direction-type > words');
      if (wordsNode?.textContent) {
        pushDynamic(
          measureDynamics,
          seen,
          normalizeDynamicLabel(wordsNode.textContent),
          startBeat,
        );
      }
    }

    return measureDynamics;
  });
}
