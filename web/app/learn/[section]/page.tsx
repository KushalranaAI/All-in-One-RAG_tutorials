import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskButton from "@/components/ai/AskButton";
import SectionLessons from "@/components/SectionLessons";
import SectionProgress from "@/components/progress/SectionProgress";
import Icon, { sectionIcon } from "@/components/ui/Icon";
import { getProjects, getSections } from "@/lib/content";
import { getNav } from "@/lib/navdata";

// Lets the GitHub Pages export pre-render every week; the local app still renders on request.
export function generateStaticParams() {
  return getSections().map((s) => ({ section: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const s = getSections().find((x) => x.slug === section);
  return { title: s ? `Week ${s.order} · ${s.title}` : "Week" };
}

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const nav = getNav().sections.find((x) => x.slug === section);
  if (!nav) notFound();
  const days = nav.lessons.map((l) => l.order);
  const projects = getProjects().filter((p) => p.days.length < 30 && p.days.some((d) => days.includes(d)) && Math.max(...p.days) <= Math.max(...days));
  const steps = nav.description.split(/\s*→\s*/).filter(Boolean);
  return (
    <article>
      <header className="page-head with-ring">
        <div>
          <div className="eyebrow"><Icon name={sectionIcon(nav.slug)} size={14} /> Week {nav.order} of 4</div>
          <h1>{nav.title}</h1>
          {steps.length > 1 && (
            <ol className="week-flow" aria-label="This week's path">
              {steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          )}
          <div className="meta-row">
            <span className="pill">{nav.lessons.length} days</span>
            <span className="pill"><Icon name="clock" size={13} /> ~{Math.round(nav.lessons.reduce((n, l) => n + l.minutes, 0) / 60)} h</span>
            <AskButton variant="ghost" label="What will I learn this week?" prompt={`I'm about to start week ${nav.order} of this RAG course, "${nav.title}" (${nav.description}). In a few sentences, what will I be able to build after it, and how should I approach it?`} />
          </div>
        </div>
        <SectionProgress section={nav} />
      </header>

      <h2 className="section-title">Days</h2>
      <SectionLessons section={nav} />

      {projects.length > 0 && (
        <>
          <h2 className="section-title">Projects you can build after this week</h2>
          <div className="grid">
            {projects.map((p) => (
              <Link key={p.slug} href={`/projects/${p.slug}`} className="card link-card lift">
                <span className="card-foot" style={{ marginTop: 0, paddingTop: 0 }}><span className={`pill ${p.level}`}>{p.level}</span></span>
                <b className="card-title">{p.title}</b>
                <span className="muted small clamp">{p.summary}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
