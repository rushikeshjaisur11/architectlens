import { lessons } from "#velite";

export const lessonKeys = new Set(lessons.map((l) => `${l.track.slug}/${l.category.slug}/${l.slug}`));
