"use client";
import Link from "next/link";
import { type NavSection, lessonId } from "@/lib/nav";
import { useProgress } from "@/lib/progress";
import Icon from "../ui/Icon";
import Ring from "../ui/Ring";

/** Big ring + "start / continue" button for a week. */
export default function SectionProgress({ section }: { section: NavSection }) {
  const p = useProgress();
  const done = section.lessons.filter((l) => p.done[lessonId(section.slug, l.slug)]).length;
  const nextLesson = section.lessons.find((l) => !p.done[lessonId(section.slug, l.slug)]);
  const started = done > 0 || section.lessons.some((l) => p.visited[lessonId(section.slug, l.slug)]);
  return (
    <div className="section-progress card">
      <Ring value={section.lessons.length ? done / section.lessons.length : 0} size={84} stroke={8}>
        <span className="ring-big">{done}<small>/{section.lessons.length}</small></span>
      </Ring>
      {nextLesson ? (
        <Link href={`/learn/${section.slug}/${nextLesson.slug}`} className="btn primary">
          {started ? "Continue" : "Start"} <Icon name="arrow-right" size={16} />
        </Link>
      ) : (
        <span className="pill good"><Icon name="trophy" size={13} /> Week complete</span>
      )}
    </div>
  );
}
