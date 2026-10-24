"use client";
// Dev server only: re-renders the current page when a lesson, project or source file changes on disk.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "@/lib/toast";

export default function LiveReload() {
  const router = useRouter();
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const es = new EventSource("/api/watch");
    es.onmessage = (e) => {
      router.refresh(); // server components re-read the files; client state (notes, chat, scroll) is kept
      try {
        const file = (JSON.parse(e.data) as { file: string }).file.replaceAll("\\", "/");
        if (/\.(md)$/i.test(file)) toast(`Reloaded ${file.split("/").slice(-2).join("/")}`, { tone: "info", ms: 1800 });
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) es.close(); // route unavailable (static export): stop retrying
    };
    return () => es.close();
  }, [router]);
  return null;
}
