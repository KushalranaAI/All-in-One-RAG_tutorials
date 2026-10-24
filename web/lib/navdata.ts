// Server-only: builds the navigation/progress metadata the client components work from.
import { getLesson, getProjects, getSections } from "./content";
import type { Nav } from "./nav";

export function getNav(): Nav {
  return {
    sections: getSections().map((s) => ({
      slug: s.slug,
      title: s.title,
      order: s.order,
      description: s.description,
      lessons: s.lessons.map((l) => ({
        slug: l.slug,
        title: l.title,
        summary: l.summary,
        minutes: l.minutes,
        level: l.level,
        order: l.order,
        topic: l.topic,
        exercises: getLesson(s.slug, l.slug)?.exercises.length ?? 0,
      })),
    })),
    projects: getProjects().map((p) => ({
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      level: p.level,
      stars: p.stars,
      steps: p.extend.length,
      ideas: p.ideas,
      mcp: p.mcp,
      multiAgent: p.multiAgent,
      days: p.days,
    })),
  };
}
