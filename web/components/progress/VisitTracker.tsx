"use client";
import { useEffect } from "react";
import { markVisited } from "@/lib/progress";

/** Renders nothing; records that this page was opened so the dashboard can say "continue where you left off". */
export default function VisitTracker({ id, href, title }: { id: string; href: string; title: string }) {
  useEffect(() => {
    markVisited(id, href, title);
  }, [id, href, title]);
  return null;
}
