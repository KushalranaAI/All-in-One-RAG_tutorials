// Learning progress: completed lessons, visits, daily activity (for streaks), notes and quiz scores.
// Lives in localStorage only. Ids: "07-regression/01-linear-regression", "project/01-house-prices", "project/01-house-prices/2".
import { jsonStore, useStore } from "./localstore";

export type Progress = {
  done: Record<string, number>; // id -> completed at (ms)
  visited: Record<string, number>; // id -> last visited (ms)
  days: Record<string, number>; // YYYY-MM-DD -> activity score
  last: { id: string; href: string; title: string; at: number } | null;
  notes: Record<string, string>;
  quiz: Record<string, { score: number; total: number; at: number }>;
};

const EMPTY: Progress = { done: {}, visited: {}, days: {}, last: null, notes: {}, quiz: {} };

/** Older versions stored {id: true} under "rag30-progress". Keep that progress. */
function legacy(): Partial<Progress> | null {
  try {
    const old = JSON.parse(localStorage.getItem("rag30-progress") ?? "null") as Record<string, boolean> | null;
    if (!old) return null;
    const done: Record<string, number> = {};
    for (const [id, v] of Object.entries(old)) if (v) done[id] = Date.now();
    return { done };
  } catch {
    return null;
  }
}

export const progressStore = jsonStore<Progress>("rag30-state-v2", EMPTY, legacy);
export const useProgress = () => useStore(progressStore);

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const bump = (days: Record<string, number>, by: number) => ({ ...days, [dayKey()]: (days[dayKey()] ?? 0) + by });

export function markVisited(id: string, href: string, title: string) {
  const p = progressStore.get();
  const sameDay = p.visited[id] && dayKey(new Date(p.visited[id])) === dayKey();
  if (sameDay && p.last?.id === id && Date.now() - p.last.at < 60_000) return;
  progressStore.set({
    ...p,
    visited: { ...p.visited, [id]: Date.now() },
    last: { id, href, title, at: Date.now() },
    days: sameDay ? p.days : bump(p.days, 1),
  });
}

export function setDone(id: string, done: boolean) {
  progressStore.set((p) => {
    const next = { ...p.done };
    if (done) next[id] = Date.now();
    else delete next[id];
    return { ...p, done: next, days: done ? bump(p.days, 3) : p.days };
  });
}

export function setNote(id: string, text: string) {
  progressStore.set((p) => {
    const notes = { ...p.notes };
    if (text.trim()) notes[id] = text;
    else delete notes[id];
    return { ...p, notes };
  });
}

export function saveQuiz(id: string, score: number, total: number) {
  progressStore.set((p) => {
    const prev = p.quiz[id];
    const better = !prev || score / total >= prev.score / prev.total;
    return { ...p, quiz: better ? { ...p.quiz, [id]: { score, total, at: Date.now() } } : p.quiz, days: bump(p.days, 2) };
  });
}

export function resetProgress() {
  progressStore.set(EMPTY);
}

export function importProgress(json: string): boolean {
  try {
    const data = JSON.parse(json) as Partial<Progress>;
    if (typeof data !== "object" || data === null || typeof data.done !== "object") return false;
    progressStore.set({ ...EMPTY, ...data });
    return true;
  } catch {
    return false;
  }
}

/** Consecutive active days ending today (or yesterday, so the streak survives until you've had today's session). */
export function streak(p: Progress): { current: number; longest: number; activeToday: boolean } {
  const active = new Set(Object.keys(p.days).filter((k) => p.days[k] > 0));
  const activeToday = active.has(dayKey());
  const cursor = new Date();
  if (!activeToday) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (active.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(`${k}T00:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current), activeToday };
}
