"use client";
import { useProgress } from "@/lib/progress";
import Icon from "../ui/Icon";

/** "Completed" / "In progress" chip that reflects this browser's progress. */
export default function LessonStatus({ id }: { id: string }) {
  const p = useProgress();
  if (p.done[id]) return <span className="pill good"><Icon name="circle-check" size={13} /> Completed</span>;
  if (p.visited[id]) return <span className="pill warn"><Icon name="circle-half" size={13} /> In progress</span>;
  return null;
}
