import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskButton from "@/components/ai/AskButton";
import LessonView from "@/components/LessonView";
import LessonStatus from "@/components/progress/LessonStatus";
import Icon, { type IconName, sectionIcon } from "@/components/ui/Icon";
import { widgetsForDay } from "@/components/widgets";
import { flatLessons, getCode, getLabData, getLesson, getProjects, getSections } from "@/lib/content";
import { dayLabel } from "@/lib/nav";

export function generateStaticParams() {
  return flatLessons().map((l) => ({ section: l.section, topic: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string; topic: string }> }): Promise<Metadata> {
  const { section, topic } = await params;
  const l = getLesson(section, topic);
  return { title: l ? `${dayLabel(l.order)} · ${l.title}` : "Lesson" };
}

function OverviewCard({ icon, title, wide, children }: { icon: IconName; title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card overview-card ${wide ? "wide" : ""}`}>
      <h4><Icon name={icon} size={16} /> {title}</h4>
      {children}
    </section>
  );
}

export default async function LessonPage({ params }: { params: Promise<{ section: string; topic: string }> }) {
  const { section, topic } = await params;
  const lesson = getLesson(section, topic);
  if (!lesson) notFound();
  const sectionInfo = getSections().find((s) => s.slug === section)!;
  const all = flatLessons();
  const i = all.findIndex((l) => l.section === section && l.slug === topic);
  const prev = all[i - 1];
  const next = all[i + 1];
  const before = all.slice(Math.max(0, i - 2), i);
  const projects = getProjects().filter((p) => p.days.includes(lesson.order) && p.days.length < 30);
  const code = lesson.files.map(getCode).filter((c) => c !== null);
  const library = lesson.library.map(getCode).filter((c) => c !== null);
  const widgets = widgetsForDay(lesson.order);

  const overview = (
    <>
      <OverviewCard icon="target" title="Today's goal" wide>
        <p className="overview-goal">{lesson.summary}</p>
        {lesson.build && <p style={{ margin: 0 }}><b>You build:</b> {lesson.build}.</p>}
      </OverviewCard>
      <OverviewCard icon="route" title="How today works">
        <ol className="how-today">
          <li>Read the explanation (Learn)</li>
          {widgets.length > 0 && <li>Play with it in the browser (Try it)</li>}
          {code.length > 0 && <li>Read {code.length === 1 ? "the script" : `the ${code.length} scripts`} (Code)</li>}
          {lesson.commands.length > 0 && <li>Run {lesson.commands.length === 1 ? "it" : `${lesson.commands.length} commands`} on the sample handbook (Run)</li>}
          {lesson.exercises.length > 0 && <li>Do at least one of {lesson.exercises.length} {lesson.exercisesTitle === "Exercises" ? "exercises" : "checklist items"}</li>}
        </ol>
      </OverviewCard>
      {before.length > 0 && (
        <OverviewCard icon="arrow-left" title="Builds on">
          <ul>{before.map((b) => <li key={b.slug}><Link href={`/learn/${b.section}/${b.slug}`}>{dayLabel(b.order)} · {b.title}</Link></li>)}</ul>
        </OverviewCard>
      )}
      {library.length > 0 && (
        <OverviewCard icon="box" title="Shared library">
          <ul>{library.map((c) => <li key={c.file}><Link href={`/toolkit#${c.file.split("/").pop()?.replace(/\.py$/, "")}`}><code>{c.file}</code></Link></li>)}</ul>
        </OverviewCard>
      )}
      {projects.length > 0 && (
        <OverviewCard icon="rocket" title="Used in these projects">
          <ul>{projects.map((p) => <li key={p.slug}><Link href={`/projects/${p.slug}`}>{p.title}</Link></li>)}</ul>
        </OverviewCard>
      )}
    </>
  );

  const id = `${section}/${topic}`;
  return (
    <article>
      <header className="page-head">
        <div className="eyebrow">
          <Link href={`/learn/${section}`}><Icon name={sectionIcon(section)} size={14} /> Week {sectionInfo.order} · {sectionInfo.title}</Link>
        </div>
        <h1><span className="day-badge">{dayLabel(lesson.order)}</span>{lesson.title}</h1>
        <div className="meta-row">
          <span className={`pill ${lesson.level}`}>{lesson.level}</span>
          <span className="pill"><Icon name="clock" size={13} /> ~{lesson.minutes} min</span>
          {widgets.length > 0 && <span className="pill accent"><Icon name="sliders" size={13} /> interactive</span>}
          {lesson.commands.length > 0 && <span className="pill"><Icon name="play" size={13} /> runnable</span>}
          <LessonStatus id={id} />
          <span className="spacer" />
          <AskButton variant="ghost" label="Quick summary" prompt="Give me a 5-line summary of this lesson: the problem it solves, the core idea, how the code does it, when to use it, and one pitfall." />
        </div>
      </header>

      <LessonView
        id={id}
        href={`/learn/${section}/${topic}`}
        title={lesson.title}
        sectionTitle={sectionInfo.title}
        summary={lesson.summary}
        overview={overview}
        body={lesson.body}
        widgets={widgets}
        lab={widgets.length ? getLabData() : { docs: [], evalSet: [] }}
        code={code}
        library={library}
        run={lesson.run}
        commands={lesson.commands}
        exercises={lesson.exercises}
        exercisesTitle={lesson.exercisesTitle}
        next={next ? { href: `/learn/${next.section}/${next.slug}`, title: `${dayLabel(next.order)} · ${next.title}` } : null}
      />

      <nav className="prevnext" aria-label="Previous and next lesson">
        {prev ? (
          <Link href={`/learn/${prev.section}/${prev.slug}`} className="card link-card">
            <span className="muted small"><Icon name="arrow-left" size={14} /> {dayLabel(prev.order)}</span>
            <b>{prev.title}</b>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/learn/${next.section}/${next.slug}`} className="card link-card right">
            <span className="muted small">{dayLabel(next.order)} <Icon name="arrow-right" size={14} /></span>
            <b>{next.title}</b>
          </Link>
        ) : (
          <Link href="/projects" className="card link-card right">
            <span className="muted small">You finished the 30 days <Icon name="arrow-right" size={14} /></span>
            <b>Build the projects</b>
          </Link>
        )}
      </nav>
    </article>
  );
}
