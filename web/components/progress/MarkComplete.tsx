"use client";
import { useProgress, setDone, streak, progressStore } from "@/lib/progress";
import { toast } from "@/lib/toast";
import Icon from "../ui/Icon";

/** Toggle a lesson / project as complete, with a small celebration and a pointer to what's next. */
export default function MarkComplete({
  id,
  noun = "lesson",
  next,
  size = "md",
}: {
  id: string;
  noun?: string;
  next?: { href: string; title: string } | null;
  size?: "md" | "lg";
}) {
  const p = useProgress();
  const done = !!p.done[id];
  return (
    <button
      type="button"
      className={`btn ${done ? "done" : "primary"} ${size === "lg" ? "lg" : ""}`}
      aria-pressed={done}
      onClick={() => {
        setDone(id, !done);
        if (!done) {
          const s = streak(progressStore.get());
          toast(`${noun[0].toUpperCase() + noun.slice(1)} complete${s.current > 1 ? ` · ${s.current}-day streak` : ""}. Nice work!`, {
            action: next ? { label: `Next: ${next.title}`, href: next.href } : undefined,
          });
        }
      }}
    >
      <Icon name={done ? "circle-check" : "check"} size={16} />
      {done ? "Completed" : `Mark ${noun} complete`}
    </button>
  );
}
