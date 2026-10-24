"use client";
// Shared AI state: is the tutor panel open, what is the learner looking at, and what are they asking about.
// Any component can call useAI().ask({...}) - the panel picks it up.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GENERAL, type PageContext } from "@/lib/ai/prompts";

export type AskRequest = {
  prompt?: string; // text to put in (or send from) the composer
  quote?: string; // excerpt the question is about
  send?: boolean; // send immediately instead of waiting for the learner
};

type Ctx = {
  open: boolean;
  /** panel width in px (drag the edge to change), and whether it is expanded to a wide reading size */
  width: number;
  expanded: boolean;
  setWidth(w: number): void;
  toggleExpanded(): void;
  view: "chat" | "settings";
  page: PageContext;
  request: (AskRequest & { id: number }) | null;
  setPage(p: PageContext | null): void;
  openPanel(view?: "chat" | "settings"): void;
  closePanel(): void;
  togglePanel(): void;
  setView(v: "chat" | "settings"): void;
  ask(req: AskRequest): void;
};

export const DEFAULT_WIDTH = 420;
export const MIN_WIDTH = 340;
export const MAX_WIDTH = 1000;
export const EXPANDED_WIDTH = 820;

const AICtx = createContext<Ctx | null>(null);

export function useAI(): Ctx {
  const c = useContext(AICtx);
  if (!c) throw new Error("useAI must be used inside <AIProvider>");
  return c;
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [width, setWidthState] = useState(DEFAULT_WIDTH);
  const [expanded, setExpanded] = useState(false);
  const [page, setPageState] = useState<PageContext>(GENERAL);
  const [request, setRequest] = useState<Ctx["request"]>(null);
  const counter = useRef(0);

  // remember panel visibility and size across visits
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem("rag30-ai-width"));
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setWidthState(w);
      setExpanded(localStorage.getItem("rag30-ai-expanded") === "1");
    } catch {}
    try {
      if (localStorage.getItem("rag30-ai-open") === "1" && window.matchMedia("(min-width: 1360px)").matches) setOpen(true);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("rag30-ai-open", open ? "1" : "0");
    } catch {}
  }, [open]);

  const setWidth = useCallback((w: number) => {
    const next = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)));
    setWidthState(next);
    setExpanded(false);
    try {
      localStorage.setItem("rag30-ai-width", String(next));
      localStorage.setItem("rag30-ai-expanded", "0");
    } catch {}
  }, []);
  const toggleExpanded = useCallback(() => {
    setExpanded((e) => {
      try {
        localStorage.setItem("rag30-ai-expanded", e ? "0" : "1");
      } catch {}
      return !e;
    });
  }, []);

  const openPanel = useCallback((v?: "chat" | "settings") => {
    if (v) setView(v);
    setOpen(true);
  }, []);
  const ask = useCallback((req: AskRequest) => {
    setView("chat");
    setOpen(true);
    setRequest({ ...req, id: ++counter.current });
  }, []);

  // Ctrl/Cmd + / toggles the tutor from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      open,
      width,
      expanded,
      setWidth,
      toggleExpanded,
      view,
      page,
      request,
      setPage: (p) => setPageState(p ?? GENERAL),
      openPanel,
      closePanel: () => setOpen(false),
      togglePanel: () => setOpen((o) => !o),
      setView,
      ask,
    }),
    [open, width, expanded, setWidth, toggleExpanded, view, page, request, openPanel, ask],
  );
  return <AICtx.Provider value={value}>{children}</AICtx.Provider>;
}

/** Pages call this to tell the tutor what the learner is looking at. */
export function usePageContext(ctx: PageContext | null) {
  const { setPage } = useAI();
  const key = ctx ? `${ctx.key}|${ctx.focus ?? ""}|${ctx.text.length}|${ctx.title}` : "";
  const ref = useRef(ctx);
  ref.current = ctx;
  useEffect(() => {
    setPage(ref.current);
    return () => setPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
