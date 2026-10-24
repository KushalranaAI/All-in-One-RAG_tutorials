"use client";
// The lesson's "## Exercises" as a checklist. Ticks are saved in this browser; each exercise can ask the tutor for a hint
// (not the answer: doing it yourself is the point).
import { exerciseId } from "@/lib/nav";
import { setDone, useProgress } from "@/lib/progress";
import { toast } from "@/lib/toast";
import AskButton from "../ai/AskButton";
import Markdown from "../Markdown";
import Icon from "../ui/Icon";

export default function Exercises({ id, title, items, heading }: { id: string; title: string; items: string[]; heading: string }) {
  const p = useProgress();
  const done = items.filter((_, i) => p.done[exerciseId(id, i)]).length;
  return (
    <div>
      <div className="section-head" style={{ marginTop: 0 }}>
        <p className="muted" style={{ margin: 0 }}>
          {heading === "Exercises" ? "Reading gets you the idea; changing the code makes it yours. Pick at least one." : "Go through it for your own system before you ship."}
        </p>
        <span className="muted small">{done} of {items.length} done</span>
      </div>
      <div className="bar" style={{ margin: "0 0 16px" }} aria-hidden="true"><div style={{ width: `${items.length ? (100 * done) / items.length : 0}%` }} /></div>
      <ol className="steps">
        {items.map((text, i) => {
          const on = !!p.done[exerciseId(id, i)];
          return (
            <li key={i} className={on ? "done" : ""}>
              <div className="step-head exercise">
                <button
                  type="button"
                  className={`check ${on ? "on" : ""}`}
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`Mark exercise ${i + 1} done`}
                  onClick={() => {
                    setDone(exerciseId(id, i), !on);
                    if (!on && done + 1 === items.length) toast("Every exercise done. Mark the lesson complete when you're ready.", { tone: "info" });
                  }}
                >
                  {on ? <Icon name="check" size={16} /> : <span>{i + 1}</span>}
                </button>
                <div className="exercise-text"><Markdown askable={false}>{text}</Markdown></div>
                <AskButton
                  label="Hint"
                  prompt={`I'm doing this exercise from the lesson "${title}":\n\n${text}\n\nGive me a hint and a plan of attack (which file and function to change, what to measure) but don't write the full solution.`}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
