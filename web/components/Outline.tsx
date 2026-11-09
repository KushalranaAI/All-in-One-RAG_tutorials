"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { type Nav, lessonId, projectId } from "@/lib/nav";
import { useProgress } from "@/lib/progress";
import Icon, { sectionIcon } from "./ui/Icon";
import Ring from "./ui/Ring";

export default function Outline({ nav, open, onNavigate }: { nav: Nav; open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const progress = useProgress();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  const total = nav.sections.reduce((n, s) => n + s.lessons.length, 0);
  const done = nav.sections.reduce((n, s) => n + s.lessons.filter((l) => progress.done[lessonId(s.slug, l.slug)]).length, 0);

  return (
    <nav className={`outline ${open ? "open" : ""}`} aria-label="Course navigation" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate()}>
      <div className="side-heading">
        <span>30-day plan</span>
        <span className="muted">{done}/{total}</span>
      </div>

      {nav.sections.map((s) => {
        const inSection = pathname.startsWith(`/learn/${s.slug}`);
        const sectionDone = s.lessons.filter((l) => progress.done[lessonId(s.slug, l.slug)]).length;
        return (
          <details key={s.slug} className="nav-section" open={inSection || undefined}>
            <summary>
              <Ring value={s.lessons.length ? sectionDone / s.lessons.length : 0} size={26} stroke={3} label={`${sectionDone} of ${s.lessons.length} lessons done`}>
                <Icon name={sectionIcon(s.slug)} size={12} />
              </Ring>
              <span className="nav-title">{s.title}</span>
              <span className="muted count">{sectionDone}/{s.lessons.length}</span>
              <Icon name="chevron-down" size={14} className="caret" />
            </summary>
            <ul>
              {s.lessons.map((l) => {
                const id = lessonId(s.slug, l.slug);
                const href = `/learn/${s.slug}/${l.slug}`;
                const active = pathname === href;
                const state = progress.done[id] ? "done" : progress.visited[id] ? "started" : "new";
                return (
                  <li key={l.slug}>
                    <Link href={href} ref={active ? activeRef : undefined} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                      <Icon
                        name={state === "done" ? "circle-check" : state === "started" ? "circle-half" : "circle"}
                        size={15}
                        className={`status ${state}`}
                        label={state === "done" ? "Completed" : state === "started" ? "In progress" : undefined}
                      />
                      <span><span className="day-no">{String(l.order).padStart(2, "0")}</span>{l.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      <details className="nav-section" open={pathname.startsWith("/projects") || undefined}>
        <summary>
          <span className="ring-icon"><Icon name="rocket" size={14} /></span>
          <span className="nav-title">Projects</span>
          <span className="muted count">{nav.projects.filter((p) => progress.done[projectId(p.slug)]).length}/{nav.projects.length}</span>
          <Icon name="chevron-down" size={14} className="caret" />
        </summary>
        <ul>
          {nav.projects.map((p) => {
            const href = `/projects/${p.slug}`;
            const active = pathname === href;
            const state = progress.done[projectId(p.slug)] ? "done" : progress.visited[projectId(p.slug)] ? "started" : "new";
            return (
              <li key={p.slug}>
                <Link href={href} ref={active ? activeRef : undefined} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                  <Icon name={state === "done" ? "circle-check" : state === "started" ? "circle-half" : "circle"} size={15} className={`status ${state}`} />
                  <span>{p.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </details>

    </nav>
  );
}
