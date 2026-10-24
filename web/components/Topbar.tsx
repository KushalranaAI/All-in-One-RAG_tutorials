"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { type Nav, dayLabel } from "@/lib/nav";
import { streak, useProgress } from "@/lib/progress";
import { useAI } from "./ai/AIProvider";
import { PALETTE_EVENT } from "./CommandPalette";
import ThemeToggle from "./ThemeToggle";
import Icon from "./ui/Icon";

function crumbs(pathname: string, nav: Nav): { label: string; href?: string }[] {
  const [, area, a, b] = pathname.split("/");
  if (!area) return [{ label: "Dashboard" }];
  if (area === "learn") {
    const s = nav.sections.find((x) => x.slug === a);
    const l = s?.lessons.find((x) => x.slug === b);
    return [{ label: "Learn" }, ...(s ? [{ label: `Week ${s.order} · ${s.title}`, href: b ? `/learn/${s.slug}` : undefined }] : []), ...(l ? [{ label: `${dayLabel(l.order)} · ${l.title}` }] : [])];
  }
  if (area === "projects") {
    const p = nav.projects.find((x) => x.slug === a);
    return [{ label: "Projects", href: a ? "/projects" : undefined }, ...(p ? [{ label: p.title }] : [])];
  }
  const label = ({ progress: "My progress", lab: "Retrieval lab", map: "Technique map", toolkit: "Toolkit & MCP servers" } as Record<string, string>)[area];
  // Unknown routes get no breadcrumb: the static 404.html is rendered for "/_not-found" but shown at any URL,
  // so anything derived from the path would differ between the server HTML and the client and fail hydration.
  return label ? [{ label }] : [];
}

export default function Topbar({ nav, onMenu }: { nav: Nav; onMenu: () => void }) {
  const pathname = usePathname();
  const ai = useAI();
  const progress = useProgress();
  const s = streak(progress);
  const bar = useRef<HTMLDivElement>(null);

  // reading progress for long pages
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  const trail = crumbs(pathname, nav);
  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Toggle navigation">
        <Icon name="menu" />
      </button>
      <nav className="crumbs" aria-label="Breadcrumb">
        {trail.map((c, i) => (
          <span key={i} className="crumb">
            {i > 0 && <Icon name="chevron-right" size={14} className="sep" />}
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current={i === trail.length - 1 ? "page" : undefined}>{c.label}</span>}
          </span>
        ))}
      </nav>
      <div className="top-actions">
        <button type="button" className="search-btn" onClick={() => window.dispatchEvent(new Event(PALETTE_EVENT))}>
          <Icon name="search" size={16} />
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        {s.current > 0 && (
          <Link href="/progress" className={`streak ${s.activeToday ? "on" : ""}`} title={s.activeToday ? "You've learned today - streak safe" : "Learn something today to keep your streak"}>
            <Icon name="flame" size={16} /> {s.current}
            <span className="sr-only"> day streak</span>
          </Link>
        )}
        <ThemeToggle />
        <button type="button" className={`btn ai-toggle ${ai.open ? "on" : ""}`} onClick={ai.togglePanel} aria-pressed={ai.open} title="Ask the AI tutor (Ctrl+/)">
          <Icon name="sparkles" size={16} /> <span>Ask AI</span>
        </button>
      </div>
      <div className="read-progress" aria-hidden="true"><div ref={bar} /></div>
    </header>
  );
}
