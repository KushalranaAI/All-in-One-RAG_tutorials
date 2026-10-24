"use client";
// A self-check quiz written by the learner's own AI from the lesson text. Scores are kept in this browser.
import { useEffect, useRef, useState } from "react";
import { complete } from "@/lib/ai/client";
import { contextBudget, useConnection } from "@/lib/ai/settings";
import { saveQuiz, useProgress } from "@/lib/progress";
import { useAI } from "../ai/AIProvider";
import AskButton from "../ai/AskButton";
import Markdown from "../Markdown";
import Icon from "../ui/Icon";

type Question = { q: string; options: string[]; answer: number; explanation: string };

const SYSTEM = `You write short multiple-choice quizzes that test understanding, not memorisation. Reply with ONLY a JSON array - no prose, no markdown fences.
Each element: {"q": string, "options": [4 strings], "answer": index 0-3 of the correct option, "explanation": one or two sentences saying why}.
Use $...$ for math. Vary the position of the correct answer. Make wrong options plausible misconceptions.`;

function parse(raw: string): Question[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  const list = JSON.parse(raw.slice(start, end + 1)) as Question[];
  const ok = list.filter((x) => x && typeof x.q === "string" && Array.isArray(x.options) && x.options.length >= 2 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length);
  if (!ok.length) throw new Error("no valid questions");
  return ok.slice(0, 8).map((x) => ({ ...x, explanation: String(x.explanation ?? "") }));
}

export default function Quiz({ id, title, text }: { id: string; title: string; text: string }) {
  const { settings, connection, ready } = useConnection();
  const ai = useAI();
  const progress = useProgress();
  const best = progress.quiz[id];
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [picked, setPicked] = useState<(number | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const saved = useRef(false);

  useEffect(() => () => abort.current?.abort(), []);

  async function generate() {
    setBusy(true);
    setError("");
    setQuestions(null);
    saved.current = false;
    const ctrl = new AbortController();
    abort.current = ctrl;
    const excerpt = text.slice(0, Math.min(contextBudget(settings), 14000));
    try {
      const raw = await complete(
        connection,
        SYSTEM,
        `Write 5 multiple-choice questions for a learner studying "${title}". Base them on this lesson text:\n\n${excerpt}`,
        ctrl.signal,
      );
      const qs = parse(raw);
      setQuestions(qs);
      setPicked(qs.map(() => null));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const hint = (e as { hint?: string }).hint;
      setError(e instanceof SyntaxError || (e as Error).message === "no valid questions" ? "The model didn't return a usable quiz. Try again - smaller local models sometimes need a second go." : `${(e as Error).message}${hint ? ` ${hint}` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  const answered = picked.filter((p) => p !== null).length;
  const score = questions ? picked.filter((p, i) => p === questions[i].answer).length : 0;
  const finished = !!questions && answered === questions.length;

  useEffect(() => {
    if (finished && questions && !saved.current) {
      saved.current = true;
      saveQuiz(id, score, questions.length);
    }
  }, [finished, questions, score, id]);

  return (
    <div className="quiz">
      <div className="quiz-head card">
        <div>
          <h3 style={{ margin: 0 }}>Check your understanding</h3>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Your AI tutor writes five questions from this lesson. Wrong answers are the best teachers.
            {best && <> Best score so far: <b>{best.score}/{best.total}</b>.</>}
          </p>
        </div>
        {ready ? (
          <button type="button" className="btn primary" onClick={generate} disabled={busy}>
            <Icon name={questions ? "refresh" : "sparkles"} size={16} /> {busy ? "Writing questions…" : questions ? "New quiz" : "Generate quiz"}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => ai.openPanel("settings")}>
            <Icon name="key" size={16} /> Connect an AI to unlock
          </button>
        )}
      </div>

      {busy && <div className="skeleton" style={{ height: 160, marginTop: 14 }} aria-busy="true" />}
      {error && <div className="notice bad" role="alert"><Icon name="alert" size={16} /><div>{error}</div></div>}

      {questions?.map((q, qi) => {
        const choice = picked[qi];
        return (
          <fieldset key={qi} className="question card" disabled={choice !== null}>
            <legend><span className="muted">Question {qi + 1} of {questions.length}</span></legend>
            <div className="q-text"><Markdown askable={false}>{q.q}</Markdown></div>
            <div className="options">
              {q.options.map((o, oi) => {
                const state = choice === null ? "" : oi === q.answer ? "correct" : oi === choice ? "wrong" : "dim";
                return (
                  <button key={oi} type="button" className={`option ${state}`} onClick={() => setPicked((p) => p.map((v, i) => (i === qi ? oi : v)))}>
                    <span className="letter">{"ABCD"[oi]}</span>
                    <span className="opt-text"><Markdown askable={false}>{o}</Markdown></span>
                    {state === "correct" && <Icon name="check" size={16} label="Correct" />}
                    {state === "wrong" && <Icon name="x" size={16} label="Your answer, incorrect" />}
                  </button>
                );
              })}
            </div>
            {choice !== null && (
              <div className={`explain ${choice === q.answer ? "good" : "bad"}`}>
                <b>{choice === q.answer ? "Correct." : "Not quite."}</b> <Markdown askable={false}>{q.explanation}</Markdown>
                <AskButton
                  label="Explain more"
                  prompt={`I'm doing a quiz on "${title}". Question: ${q.q}\nOptions: ${q.options.map((o, i) => `${"ABCD"[i]}) ${o}`).join("  ")}\nCorrect answer: ${"ABCD"[q.answer]}. I chose ${"ABCD"[choice]}. Explain the concept behind this so I really get it.`}
                />
              </div>
            )}
          </fieldset>
        );
      })}

      {finished && questions && (
        <div className="card score" role="status">
          <b>You scored {score} / {questions.length}</b>
          <span className="muted">{score === questions.length ? "Perfect - you've got this one." : score >= questions.length / 2 ? "Solid. Review the explanations you missed." : "Worth another pass through the Learn step - then try a fresh quiz."}</span>
        </div>
      )}
    </div>
  );
}
