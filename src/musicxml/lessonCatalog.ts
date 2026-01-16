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
