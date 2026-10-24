"use client";
// A lesson as a guided journey: Overview → Learn → Try it → Code → Run → Exercises → Quiz → Notes.
// One step on screen at a time (progressive disclosure), with a clear "next" at the end of each.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { type PageContext } from "@/lib/ai/prompts";
import { markVisited, progressStore, useProgress } from "@/lib/progress";
import { useResolvedTheme } from "@/lib/theme";
import { usePageContext } from "./ai/AIProvider";
import AskButton from "./ai/AskButton";
import Exercises from "./lesson/Exercises";
import Notes from "./lesson/Notes";
import Quiz from "./lesson/Quiz";
import Toc from "./lesson/Toc";
import Markdown from "./Markdown";
import MarkComplete from "./progress/MarkComplete";
import RunPanel from "./RunPanel";
import Icon, { type IconName } from "./ui/Icon";
import { WIDGETS, type LabData } from "./widgets";

type Snippet = { spec: string; file: string; symbol: string | null; language: string; code: string };
type Command = { script: string; args: string[]; note: string };

type Props = {
  id: string;
  href: string;
  title: string;
  sectionTitle: string;
  summary: string;
  overview: React.ReactNode;
  body: string;
  widgets: string[];
  lab: LabData;
  code: Snippet[];
  library: Snippet[];
  run: string;
  commands: Command[];
  exercises: string[];
  exercisesTitle: string;
  next: { href: string; title: string } | null;
};

export default function LessonView(props: Props) {
  const { id, href, title, sectionTitle, summary, overview, body, widgets, lab, code, library, run, commands, exercises, exercisesTitle, next } = props;
  const steps = useMemo(
    () =>
      [
        { key: "overview", label: "Overview", icon: "lightbulb" as IconName },
        { key: "learn", label: "Learn", icon: "book" as IconName },
        ...(widgets.length ? [{ key: "try", label: "Try it", icon: "sliders" as IconName }] : []),
        ...(code.length ? [{ key: "code", label: "Code", icon: "code" as IconName }] : []),
        ...(commands.length || run ? [{ key: "run", label: "Run", icon: "play" as IconName }] : []),
        ...(exercises.length ? [{ key: "exercises", label: exercisesTitle === "Exercises" ? "Exercises" : "Checklist", icon: "checklist" as IconName }] : []),
        { key: "quiz", label: "Quiz", icon: "target" as IconName },
        { key: "notes", label: "Notes", icon: "pen" as IconName },
      ],
    [widgets.length, code.length, commands.length, run, exercises.length, exercisesTitle],
  );
  const progress = useProgress();
  const theme = useResolvedTheme();
  const [step, setStep] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const initial = useRef<{ id: string; step: string } | null>(null);

  // Start where it makes sense: the URL hash, else Learn for returning learners, else the Overview.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    // Decide once per lesson (effects can run twice in development), before recording this visit.
    if (initial.current?.id !== id) {
      const returning = !!progressStore.get().visited[id];
      initial.current = { id, step: steps.some((s) => s.key === fromHash) ? fromHash : returning ? "learn" : "overview" };
      markVisited(id, href, title);
    }
    setStep(initial.current.step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!step) return;
    document.getElementById(`tab-${step}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    setSeen((s) => new Set(s).add(step));
    if (window.location.hash.slice(1) !== step) history.replaceState(null, "", `#${step}`);
  }, [step]);

  const go = (key: string) => {
    setStep(key);
    document.getElementById("lesson-top")?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  // what the AI tutor can see
  const codeText = useMemo(() => code.map((c) => `# ${c.file}\n${c.code}`).join("\n\n"), [code]);
  const current = steps.find((s) => s.key === step);
  const context = useMemo<PageContext>(() => {
    const head = `Lesson: ${title}\nWeek: ${sectionTitle}\nGoal: ${summary}`;
    const onCode = step === "code" || step === "run";
    const tail = `${run ? `\n\n# How to run it\n${run}` : ""}${exercises.length ? `\n\n# Exercises\n${exercises.map((e, i) => `${i + 1}. ${e}`).join("\n")}` : ""}`;
    return {
      key: `lesson:${id}`,
      kind: "lesson",
      title,
      noteId: id,
      focus: current ? `the “${current.label}” step${onCode ? " (the lesson's Python code)" : step === "try" ? ` (interactive visuals: ${widgets.join(", ")})` : ""}` : undefined,
      text: onCode ? `${head}\n\n# Lesson code on screen\n${codeText}\n\n# Lesson text\n${body}${tail}` : `${head}\n\n# Lesson text\n${body}${tail}${codeText ? `\n\n# Code in this lesson\n${codeText}` : ""}`,
    };
  }, [id, title, sectionTitle, summary, body, run, exercises, widgets, codeText, step, current]);
  usePageContext(step ? context : null);

  const idx = steps.findIndex((s) => s.key === step);
  const prev = idx > 0 ? steps[idx - 1] : null;
  const following = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
  const done = !!progress.done[id];

  if (!step) {
    return (
      <div aria-busy="true">
        <div className="skeleton" style={{ height: 44, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  return (
    <div id="lesson-top" className="lesson">
      <div
        className="stepper"
        role="tablist"
        aria-label="Lesson steps"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const n = steps[(idx + (e.key === "ArrowRight" ? 1 : -1) + steps.length) % steps.length];
          setStep(n.key);
          requestAnimationFrame(() => document.getElementById(`tab-${n.key}`)?.focus());
        }}
      >
        {steps.map((s, i) => (
          <button
            key={s.key}
            id={`tab-${s.key}`}
            role="tab"
            type="button"
            aria-selected={step === s.key}
            aria-controls="lesson-panel"
            tabIndex={step === s.key ? 0 : -1}
            className={`step ${step === s.key ? "active" : ""} ${seen.has(s.key) && step !== s.key ? "seen" : ""}`}
            onClick={() => go(s.key)}
          >
            <span className="step-num">{seen.has(s.key) && step !== s.key ? <Icon name="check" size={13} /> : i + 1}</span>
            <Icon name={s.icon} size={16} className="step-icon" />
            <span className="step-label">{s.label}</span>
          </button>
        ))}
      </div>

      <div id="lesson-panel" role="tabpanel" aria-labelledby={`tab-${step}`} className="step-panel" tabIndex={-1}>
        {step === "overview" && <div className="info-grid">{overview}</div>}

        {step === "learn" && (
          <div className="with-toc">
            <div id="lesson-learn" className="learn-col"><Markdown>{body}</Markdown></div>
            <Toc rootId="lesson-learn" />
          </div>
        )}

        {step === "try" && (
          <div>
            <p className="muted">These run the course&apos;s own algorithms in your browser, on the Nimbus Cloud handbook the lessons use. Change the inputs and watch what happens.</p>
            {widgets.map((w) => {
              const Widget = WIDGETS[w];
              return Widget ? (
                <section key={w} className="widget-frame">
                  <header>
                    <h3>{Widget.title}</h3>
                    <AskButton label="What should I try?" prompt={`Explain what the interactive visual “${Widget.title}” on this page demonstrates, and give me three things to try with its controls and what I should notice each time.`} />
                  </header>
                  <Widget.Component key={theme} data={lab} />
                </section>
              ) : null;
            })}
          </div>
        )}

        {step === "code" && (
          <div>
            <p className="muted">The lesson&apos;s scripts, straight from <code>{href.split("/").pop()}</code>. Open them in your editor and change something.</p>
            {code.map((c) => (
              <section key={c.spec} className="code-file">
                <div className="code-file-head"><Icon name="code" size={16} /><code>{c.file}</code><span className="muted small">{c.code.split("\n").length} lines</span></div>
                <Markdown>{"```" + c.language + "\n" + c.code + "\n```"}</Markdown>
              </section>
            ))}
            {library.length > 0 && (
              <>
                <h3 className="section-title">From the shared library</h3>
                <p className="muted">The lesson builds on these files in <code>rag_common/</code> and <code>mcp_servers/</code>. Every later day and project imports them.</p>
                {library.map((c) => (
                  <details key={c.spec} className="code-file collapsible card">
                    <summary><Icon name="box" size={16} /><code>{c.file}</code><span className="muted small">{c.code.split("\n").length} lines</span><Icon name="chevron-down" size={14} className="caret" /></summary>
                    <Markdown>{"```" + c.language + "\n" + c.code + "\n```"}</Markdown>
                  </details>
                ))}
              </>
            )}
          </div>
        )}

        {step === "run" && (
          <div>
            <p className="muted">
              Runs with the Python you started this app with, from the repository root, the same as typing it in a terminal. Change the arguments to ask your own question.
            </p>
            {commands.map((c) => <RunPanel key={c.script + c.args.join(" ")} script={c.script} args={c.args} note={c.note} />)}
            {run && (
              <details className="pipeline">
                <summary>What the README says about running it <Icon name="chevron-down" size={14} /></summary>
                <Markdown>{run}</Markdown>
              </details>
            )}
          </div>
        )}

        {step === "exercises" && <Exercises id={id} title={title} items={exercises} heading={exercisesTitle} />}
        {step === "quiz" && <Quiz id={id} title={title} text={body} />}
        {step === "notes" && <Notes id={id} />}
      </div>

      <div className="step-nav">
        {prev ? (
          <button type="button" className="btn" onClick={() => go(prev.key)}>
            <Icon name="arrow-left" size={16} /> {prev.label}
          </button>
        ) : <span />}
        {following ? (
          <button type="button" className="btn primary" onClick={() => go(following.key)}>
            Next: {following.label} <Icon name="arrow-right" size={16} />
          </button>
        ) : (
          <div className="finish">
            <MarkComplete id={id} next={next} size="lg" />
          </div>
        )}
      </div>
      {!following && done && next && (
        <div className="up-next card">
          <span className="muted small">Up next</span>
          <Link href={next.href}><b>{next.title}</b> <Icon name="arrow-right" size={16} /></Link>
        </div>
      )}
    </div>
  );
}
