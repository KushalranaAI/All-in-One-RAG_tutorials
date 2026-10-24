// Dev-only live reload for course content. Next's own hot reload only watches web/, but the lessons, projects and
// source code live next to it. This streams a "change" event when any of them is saved, and <LiveReload /> refreshes the page.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WATCHED = ["days", "projects", "rag_common", "mcp_servers", "data", "README.md"];
const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
// matched against a forward-slash path such as "projects/07-data-analyst-agent/reports/x.md" (files the scripts write)
const IGNORE = /(__pycache__|\.pyc$|\.db(-journal)?$|\.rag_index|chroma_db|(^|\/)(reports|minutes)\/|\.(csv|jsonl)$)/;

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development" || !LOCAL_HOSTS.test(req.headers.get("host") ?? "")) {
    return new Response("Live reload is only available in the local dev server.", { status: 404 });
  }
  const encoder = new TextEncoder();
  const watchers: fs.FSWatcher[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (line: string) => {
        try {
          controller.enqueue(encoder.encode(line));
        } catch {
          /* client went away */
        }
      };
      send("retry: 2000\n\n");
      for (const dir of WATCHED) {
        const full = path.join(/*turbopackIgnore: true*/ ROOT, dir);
        if (!fs.existsSync(full)) continue;
        try {
          watchers.push(
            fs.watch(full, { recursive: !dir.endsWith(".md") }, (_event, file) => {
              const rel = dir.endsWith(".md") ? dir : `${dir}/${String(file ?? "").split(path.sep).join("/")}`;
              if (!file || IGNORE.test(rel)) return;
              clearTimeout(timer); // editors write several times per save
              timer = setTimeout(() => send(`data: ${JSON.stringify({ file: rel })}\n\n`), 250);
            }),
          );
        } catch {
          /* directory can't be watched on this platform: that folder just won't live-reload */
        }
      }
      heartbeat = setInterval(() => send(": keep-alive\n\n"), 20000);
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });
  function cleanup() {
    clearTimeout(timer);
    clearInterval(heartbeat);
    watchers.splice(0).forEach((w) => w.close());
  }
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" } });
}
