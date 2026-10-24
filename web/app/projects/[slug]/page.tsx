import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AskButton from "@/components/ai/AskButton";
import Markdown from "@/components/Markdown";
import ProjectSteps from "@/components/ProjectSteps";
import RunPanel from "@/components/RunPanel";
import MarkComplete from "@/components/progress/MarkComplete";
import Icon from "@/components/ui/Icon";
import { flatLessons, getCode, getProject, getProjects } from "@/lib/content";
import { dayLabel } from "@/lib/nav";

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: getProject(slug)?.title ?? "Project" };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProject(slug);
  if (!p) notFound();
  const lessons = flatLessons().filter((l) => p.days.includes(l.order));
  const code = p.files.map(getCode).filter((c) => c !== null);
  const all = getProjects();
  const i = all.findIndex((x) => x.slug === slug);
  const next = all[i + 1];
  const tutorText = `Project: ${p.title}\nLevel: ${p.level}\nStack: ${p.stack.join(", ")}\n\n${p.summary}\n\nArchitecture:\n${p.diagram}\n\nFeatures:\n${p.features.map((f) => `- ${f}`).join("\n")}\n\nHow to run:\n${p.run}\n\n${p.body}\n\nIdeas to extend it:\n${p.extend.map((e) => `- ${e}`).join("\n")}\n\n# Code\n${code.map((c) => `# ${c.file}\n${c.code}`).join("\n\n")}`;

  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Link href="/projects"><Icon name="rocket" size={14} /> Projects</Link> · Project {p.order}</div>
        <h1>{p.title}</h1>
        <p className="lead">{p.summary}</p>
        <div className="meta-row">
          <span className={`pill ${p.level}`}>{p.level}</span>
          <span className="stars" aria-label={`Difficulty ${p.stars} of 4`}>{"★".repeat(p.stars)}</span>
          {p.mcp && <span className="pill accent"><Icon name="plug" size={12} /> MCP</span>}
          {p.multiAgent && <span className="pill accent"><Icon name="users" size={12} /> multi-agent</span>}
          <span className="spacer" />
          <MarkComplete id={`project/${slug}`} noun="project" next={next ? { href: `/projects/${next.slug}`, title: next.title } : null} />
        </div>
      </header>

      <div className="info-grid">
        {p.diagram && (
          <section className="card overview-card wide">
            <h4><Icon name="workflow" size={16} /> Architecture</h4>
            <pre className="ascii-diagram">{p.diagram}</pre>
            <div className="diagram-tools"><AskButton label="Explain this architecture" quote={p.diagram} prompt="Walk me through this architecture step by step: what each box does, what flows along each arrow, and why it's designed this way." /></div>
          </section>
        )}
        {p.features.length > 0 && (
          <section className="card overview-card">
            <h4><Icon name="checklist" size={16} /> What it does</h4>
            <ul>{p.features.map((f) => <li key={f}><Markdown askable={false}>{f}</Markdown></li>)}</ul>
          </section>
        )}
        <section className="card overview-card">
          <h4><Icon name="book" size={16} /> Builds on</h4>
          {lessons.length === 30 ? (
            <p style={{ margin: 0 }}>Everything: all 30 days come together here.</p>
          ) : (
            <ul>{lessons.map((l) => <li key={l.slug}><Link href={`/learn/${l.section}/${l.slug}`}>{dayLabel(l.order)} · {l.title}</Link></li>)}</ul>
          )}
        </section>
        {p.stack.length > 0 && (
          <section className="card overview-card">
            <h4><Icon name="layers" size={16} /> Stack</h4>
            <div className="chips">{p.stack.map((s) => <span key={s} className="pill">{s}</span>)}</div>
          </section>
        )}
      </div>

      {p.commands.length > 0 && (
        <>
          <h2 className="section-title">Run it</h2>
          <p className="muted">Each command runs from the repository root with your local Python. Edit the arguments to try your own files and questions.</p>
          {p.commands.map((c) => <RunPanel key={c.script + c.args.join(" ")} script={c.script} args={c.args} note={c.note} />)}
        </>
      )}
      {p.run && (
        <details className="pipeline">
          <summary>All commands from the README (servers, MCP setup, UIs) <Icon name="chevron-down" size={14} /></summary>
          <Markdown>{p.run}</Markdown>
        </details>
      )}

      <ProjectSteps slug={slug} title={p.title} steps={p.extend} context={tutorText} />

      {p.body.trim() && (
        <>
          <h2 className="section-title">Details</h2>
          <Markdown>{p.body}</Markdown>
        </>
      )}

      {code.length > 0 && (
        <>
          <h2 className="section-title">Code</h2>
          {code.map((c) => (
            <details key={c.file} className="code-file collapsible card">
              <summary><Icon name="code" size={16} /><code>{c.file}</code><span className="muted small">{c.code.split("\n").length} lines</span><Icon name="chevron-down" size={14} className="caret" /></summary>
              <Markdown>{"```" + c.language + "\n" + c.code + "\n```"}</Markdown>
            </details>
          ))}
        </>
      )}
    </article>
  );
}
