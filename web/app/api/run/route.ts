// Runs a lesson or project script with the local Python and streams its output as NDJSON:
//   {"type":"out","text":"..."}  {"type":"err","text":"..."}  {"type":"info","text":"..."}  {"type":"exit","code":0}
// Only .py files inside days/, projects/ or data/ can run, and only for requests from this machine. Scripts run from
// the repository root, exactly like the `python days/...` commands in the READMEs.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, RUNNABLE_DIRS, safeInside } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DIRS = RUNNABLE_DIRS.map((d) => path.join(ROOT, d));
const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function pythonCommand(): string {
  return process.env.RAG_PYTHON || (process.platform === "win32" ? "python" : "python3");
}

/** True if ANTHROPIC_API_KEY is set in the environment or in the repository's .env (which rag_common loads). */
function hasApiKey(): boolean {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return true;
  try {
    const m = /^\s*(?:export\s+)?ANTHROPIC_API_KEY\s*=\s*["']?([^"'\s#]+)/m.exec(fs.readFileSync(path.join(/*turbopackIgnore: true*/ ROOT, ".env"), "utf8"));
    return !!m && !m[1].endsWith("...");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!LOCAL_HOSTS.test(req.headers.get("host") ?? "")) {
    return new Response("Scripts can only be run from localhost.", { status: 403 });
  }
  // Block other websites open in the same browser: they can't send a cross-origin JSON POST without a CORS preflight,
  // and their Origin header gives them away.
  const origin = req.headers.get("origin");
  const originHost = origin ? (URL.canParse(origin) ? new URL(origin).host : "invalid") : null;
  if ((originHost !== null && !LOCAL_HOSTS.test(originHost)) || !req.headers.get("content-type")?.includes("application/json")) {
    return new Response("Cross-origin requests are not allowed.", { status: 403 });
  }
  const { script, args = [] } = (await req.json()) as { script: string; args?: string[] };
  const full = path.resolve(/*turbopackIgnore: true*/ ROOT, script ?? "");
  const allowed = ALLOWED_DIRS.some((d) => safeInside(d, full)) && full.endsWith(".py") && fs.existsSync(full);
  if (!allowed || !Array.isArray(args) || args.length > 20 || args.some((a) => typeof a !== "string" || a.length > 500)) {
    return new Response("Not a runnable course script.", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let open = true;
      const send = (obj: object) => {
        if (open) controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      if (!hasApiKey()) {
        send({ type: "info", text: "Note: no ANTHROPIC_API_KEY found. Copy .env.example to .env in the repository root and add your key; steps that call Claude will fail without it.\n\n" });
      }
      const options = {
        cwd: ROOT,
        // ROOT on PYTHONPATH: `import rag_common` works even before `pip install -e .`
        env: { ...process.env, PYTHONPATH: [ROOT, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter), PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      };
      const child = spawn(pythonCommand(), ["-u", full, ...args], /*turbopackIgnore: true*/ options);
      // Interactive scripts read questions from stdin; an empty line ends them cleanly instead of waiting forever.
      child.stdin.end("\n");
      const timer = setTimeout(() => child.kill(), 15 * 60 * 1000);
      req.signal.addEventListener("abort", () => child.kill());
      let missing = "";
      child.stdout.on("data", (d) => send({ type: "out", text: d.toString() }));
      child.stderr.on("data", (d) => {
        const text = d.toString();
        missing ||= /No module named '([\w.]+)'/.exec(text)?.[1] ?? "";
        send({ type: "err", text });
      });
      child.on("error", (e) => {
        send({ type: "err", text: `Could not start Python (${pythonCommand()}): ${e.message}\nStart the app with \`python start.py\` from your virtual environment, or set RAG_PYTHON to your interpreter.` });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (missing) {
          send({ type: "info", text: `\nThe Python package "${missing.split(".")[0]}" isn't installed for ${pythonCommand()}. From the repository root run:\n  pip install -r requirements.txt\nor start the app with \`python start.py\`, which installs everything into the Python you run it with.\n` });
        }
        send({ type: "exit", code });
        open = false;
        try {
          controller.close();
        } catch {
          /* client already gone */
        }
      });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
