"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Nav as NavData } from "@/lib/nav";
import { streak, useProgress } from "@/lib/progress";
import { useAI } from "./ai/AIProvider";
import { PALETTE_EVENT } from "./CommandPalette";
import ThemeToggle from "./ThemeToggle";
import Icon, { type IconName } from "./ui/Icon";

/** The family logo tile: emerald, rounded, one glyph (here: search with a spark, i.e. retrieval). */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <circle cx="13.5" cy="13.5" r="5.5" fill="none" stroke="var(--on-accent)" strokeWidth="2.6" />
      <path d="m17.6 17.6 4.4 4.4" stroke="var(--on-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M21 8.5h4.5M23.25 6.25v4.5" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type Item = { href: string; label: string; icon: IconName; match: (p: string) => boolean };

export default function Nav({ nav, onMenu, hasOutline }: { nav: NavData; onMenu: () => void; hasOutline: boolean }) {
  const pathname = usePathname();
  const ai = useAI();
  const progress = useProgress();
  const s = streak(progress);
  const bar = useRef<HTMLDivElement>(null);

  const items: Item[] = [
    { href: nav.sections[0] ? `/learn/${nav.sections[0].slug}` : "/", label: "Learn", icon: "book", match: (p) => p.startsWith("/learn") },
    { href: "/lab", label: "Lab", icon: "flask", match: (p) => p.startsWith("/lab") },
    { href: "/map", label: "Technique map", icon: "compass", match: (p) => p.startsWith("/map") },
    { href: "/toolkit", label: "Toolkit", icon: "box", match: (p) => p.startsWith("/toolkit") },
    { href: "/projects", label: "Projects", icon: "rocket", match: (p) => p.startsWith("/projects") },
  ];

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

  return (
    <header className="nav">
      {hasOutline && (
        <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Toggle course outline">
          <Icon name="menu" />
        </button>
      )}
      <Link href="/" className="brand" aria-label="RAG in 30 Days, home">
        <Logo /> <span>RAG in 30 Days</span>
      </Link>
      <nav aria-label="Main">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className={it.match(pathname) ? "active" : ""} aria-current={it.match(pathname) ? "page" : undefined} title={it.label}>
            <Icon name={it.icon} size={16} /> <span className="nav-label">{it.label}</span>
          </Link>
        ))}
      </nav>
      <span className="grow" />
      <button type="button" className="search-btn" onClick={() => window.dispatchEvent(new Event(PALETTE_EVENT))} aria-label="Search">
        <Icon name="search" size={15} />
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <Link href="/progress" className={`nav-progress${pathname.startsWith("/progress") ? " active" : ""}`} title={s.activeToday ? "You've learned today - streak safe" : "Your progress"}>
        <Icon name={s.current > 0 ? "flame" : "trophy"} size={15} /> <span className="nav-label">{s.current > 0 ? `${s.current}-day streak` : "Progress"}</span>
      </Link>
      <ThemeToggle />
      <button type="button" className={`ai-chip${ai.open ? " on" : ""}`} onClick={ai.togglePanel} aria-pressed={ai.open} title="Ask the AI tutor (Ctrl+/)">
        <Icon name="sparkles" size={14} /> <span className="nav-label">Ask AI</span>
      </button>
      <div className="read-progress" aria-hidden="true"><div ref={bar} /></div>
    </header>
  );
}
