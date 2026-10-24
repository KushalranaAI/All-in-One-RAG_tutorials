// Small global toast queue: toast("Saved") from anywhere, rendered by <Toaster />.
import { useSyncExternalStore } from "react";

export type Toast = { id: number; text: string; tone: "good" | "info" | "bad"; action?: { label: string; href: string } };

const NONE: Toast[] = [];
let items: Toast[] = NONE;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(text: string, opts: { tone?: Toast["tone"]; action?: Toast["action"]; ms?: number } = {}) {
  const t: Toast = { id: nextId++, text, tone: opts.tone ?? "good", action: opts.action };
  items = [...items, t].slice(-3);
  emit();
  setTimeout(() => dismiss(t.id), opts.ms ?? 5000);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => items,
    () => NONE,
  );
}
