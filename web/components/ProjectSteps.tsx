"use client";
// A project's "Extend it" ideas as a checklist, and a tutor that knows the whole project.
import { useMemo } from "react";
import type { PageContext } from "@/lib/ai/prompts";
import { projectId, stepId } from "@/lib/nav";
import { setDone, useProgress } from "@/lib/progress";
import { toast } from "@/lib/toast";
import { usePageContext } from "./ai/AIProvider";
import AskButton from "./ai/AskButton";
import Markdown from "./Markdown";
import VisitTracker from "./progress/VisitTracker";
import Icon from "./ui/Icon";

export default function ProjectSteps({ slug, title, steps, context: text }: { slug: string; title: string; steps: string[]; context: string }) {
  const p = useProgress();
  const doneCount = steps.filter((_, i) => p.done[stepId(slug, i)]).length;

  const context = useMemo<PageContext>(() => ({ key: `project:${slug}`, kind: "project", title, noteId: projectId(slug), text }), [slug, title, text]);
  usePageContext(context);

  return (
    <>
      <VisitTracker id={projectId(slug)} href={`/projects/${slug}`} title={title} />
      {steps.length > 0 && (
        <>
          <div className="section-head">
            <h2>Make it yours</h2>
            <span className="muted small">{doneCount} of {steps.length} done</span>
          </div>
          <p className="muted">The README&apos;s ideas for taking it further. Each one is a real feature you can talk about in an interview.</p>
          <div className="bar" style={{ marginBottom: 16 }} aria-hidden="true"><div style={{ width: `${(100 * doneCount) / steps.length}%` }} /></div>
          <ol className="steps">
            {steps.map((step, i) => {
              const done = !!p.done[stepId(slug, i)];
              return (
                <li key={step} className={done ? "done" : ""}>
                  <div className="step-head exercise">
                    <button
                      type="button"
                      className={`check ${done ? "on" : ""}`}
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`Mark extension ${i + 1} done`}
                      onClick={() => {
                        setDone(stepId(slug, i), !done);
                        if (!done && doneCount + 1 === steps.length) toast("Every extension done. Mark the project complete when you're ready.", { tone: "info" });
                      }}
                    >
                      {done ? <Icon name="check" size={16} /> : <span>{i + 1}</span>}
                    </button>
                    <div className="exercise-text"><Markdown askable={false}>{step}</Markdown></div>
                    <AskButton label="Plan it" prompt={`I want to add this to the project "${title}":\n\n${step}\n\nGive me a short implementation plan: which files to change, what to add, and how to test it. Don't write the whole thing.`} />
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}
