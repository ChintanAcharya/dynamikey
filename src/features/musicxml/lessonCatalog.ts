export type LessonSource = {
  id: string;
  title: string;
  path: string;
  xml: string;
};

const lessonModules = import.meta.glob('/lessons/*.musicxml', {
  eager: true,
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
  ([path, xml]) => {
    const fileName = path.split('/').pop() ?? path;
    const id = fileName.replace(/\.musicxml$/i, '');
    return {
      id,
      title: toTitle(id),
      path,
      xml: String(xml),
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
 * Build the lesson route path for a lesson id.
 * @param id - Lesson id.
 * @returns Router path.
 */
export function getLessonPath(id: string) {
  return `/lesson/${encodeURIComponent(id)}`;
}
