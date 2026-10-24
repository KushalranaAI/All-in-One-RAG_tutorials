// Local-only relay: AI keys kept in the repository's .env are attached here, on the server, so you never paste them in
// the browser. See web/server/ai-relay.ts for the rules. Not part of the static GitHub Pages copy (it has no server).
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "@/lib/content";
import { createAiServerHandler, type Env } from "@/server/ai-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal .env parser: KEY=value, optional quotes, # comments. Read per request, so editing .env needs no restart. */
function readDotEnv(): Env {
  const out: Env = {};
  try {
    const text = fs.readFileSync(path.join(/*turbopackIgnore: true*/ ROOT, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || m[1].startsWith("#")) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, "");
      out[m[1]] = v;
    }
  } catch {
    /* no .env: nothing configured */
  }
  return out;
}

// Real environment variables win over the file, so tests can pass fake keys without touching your .env.
const env = (): Env => ({ ...readDotEnv(), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(OPENAI|ANTHROPIC|AZURE_OPENAI)_/.test(k))) });
const handler = createAiServerHandler(env);

type Ctx = { params: Promise<{ path?: string[] }> };
const run = async (req: Request, { params }: Ctx) => handler(req, (await params).path ?? []);
export const GET = run;
export const POST = run;
export const PUT = run;
export const DELETE = run;
export const PATCH = run;
