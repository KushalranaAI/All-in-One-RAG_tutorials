// The slice of course metadata the client needs for navigation, search and progress. Built on the server (see layout.tsx).
// A "section" is a week of the course; a "lesson" is one day.
export type NavLesson = { slug: string; title: string; summary: string; minutes: number; level: string; order: number; topic: string; exercises: number };
export type NavSection = { slug: string; title: string; order: number; description: string; lessons: NavLesson[] };
export type NavProject = { slug: string; title: string; summary: string; level: string; stars: number; steps: number; ideas: string; mcp: boolean; multiAgent: boolean; days: number[] };
export type Nav = { sections: NavSection[]; projects: NavProject[] };

export const lessonId = (section: string, lesson: string) => `${section}/${lesson}`;
export const projectId = (slug: string) => `project/${slug}`;
export const stepId = (slug: string, i: number) => `project/${slug}/${i}`;
export const exerciseId = (lesson: string, i: number) => `${lesson}/ex/${i}`;

/** "Day 08" - the course's own way of naming a lesson. */
export const dayLabel = (n: number) => `Day ${String(n).padStart(2, "0")}`;

export function allLessons(nav: Nav) {
  return nav.sections.flatMap((s) => s.lessons.map((l) => ({ ...l, section: s.slug, sectionTitle: s.title, id: lessonId(s.slug, l.slug), href: `/learn/${s.slug}/${l.slug}` })));
}
