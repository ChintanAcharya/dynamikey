export type LessonSource = {
  id: string;
  title: string;
  path: string;
};

const lessonModules = import.meta.glob('/lessons/*.musicxml', {
  query: '?raw',
  import: 'default',
});

/**
 * Convert a slug into a human-friendly title.
 * @param slug - File slug without extension.
 * @returns Title-cased string.
 */
function toTitle(slug: string) {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const lessons: LessonSource[] = Object.entries(lessonModules).map(
  ([path]) => {
    const fileName = path.split('/').pop() ?? path;
    const id = fileName.replace(/\.musicxml$/i, '');
    return {
      id,
      title: toTitle(id),
      path,
    };
  },
);

export const defaultLesson = lessons[0] ?? null;

/**
 * Resolve a lesson by route id.
 * @param id - Lesson id from the router.
 * @returns Matching lesson or null.
 */
export function findLessonById(id: string | undefined) {
  if (!id) {
    return null;
  }

  return lessons.find((lesson) => lesson.id === id) ?? null;
}

/**
 * Load the raw MusicXML source for a lesson on demand.
 * @param lesson - Lesson metadata from the catalog.
 * @returns Raw MusicXML file contents.
 */
export async function loadLessonXml(lesson: LessonSource) {
  const loader = lessonModules[lesson.path];

  if (!loader) {
    throw new Error(`No MusicXML loader found for lesson: ${lesson.path}`);
  }

  const xml = await loader();
  return String(xml);
}

/**
 * Build the lesson route path for a lesson id.
 * @param id - Lesson id.
 * @returns Router path.
 */
export function getLessonPath(id: string) {
  return `/lesson/${encodeURIComponent(id)}`;
}
