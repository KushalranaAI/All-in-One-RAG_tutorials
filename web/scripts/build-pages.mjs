// Builds the static copy of the course for GitHub Pages into web/out.
//
// The static copy has no server, so the server-only routes (app/api: running scripts, live reload, the .env relay) must
// not be part of it. Instead of moving files around inside web/ (which fights a running dev server, especially on
// Windows), the build happens in a throwaway copy of web/ next to it, without app/api, node_modules or .next. web/ itself
// is never modified, so `python start.py` can stay running while you build.
//
//   npm run build:pages                       # served at /All-in-One-RAG_tutorials (a GitHub project page)
//   PAGES_BASE_PATH= npm run build:pages      # served from the root of a domain
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { contentSecurityPolicy } from "./csp.mjs";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// A sibling of web/ so the app's "repository root is one folder up" assumption still holds inside the copy.
const work = path.join(path.dirname(web), ".pages-build");
const SKIP = new Set(["node_modules", "out", "tsconfig.tsbuildinfo", "next-env.d.ts"]);
const skipped = (top) => SKIP.has(top) || top.startsWith(".next"); // .next, .next-test ... never copy build output

const rmWork = () => fs.rmSync(work, { recursive: true, force: true });
rmWork();
fs.cpSync(web, work, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(web, src).split(path.sep).join("/");
    return !skipped(rel.split("/")[0]) && rel !== "app/api" && !rel.startsWith("app/api/");
  },
});
fs.symlinkSync(path.join(web, "node_modules"), path.join(work, "node_modules"), "junction");

let status = 1;
try {
  const next = path.join(web, "node_modules", "next", "dist", "bin", "next");
  const res = spawnSync(process.execPath, [next, "build"], { cwd: work, stdio: "inherit", env: { ...process.env, STATIC_EXPORT: "1" } });
  status = res.status ?? 1;
  if (status === 0) {
    fs.rmSync(path.join(web, "out"), { recursive: true, force: true });
    fs.cpSync(path.join(work, "out"), path.join(web, "out"), { recursive: true });
  }
} finally {
  // remove the junction first so deleting the copy can never reach into the real node_modules
  try {
    fs.unlinkSync(path.join(work, "node_modules"));
  } catch {
    /* already gone */
  }
  rmWork();
}

/** Next writes route-segment payloads as nested files (__next.learn/$d$section/__PAGE__.txt) but its client asks for the
 *  flat dotted name (__next.learn.$d$section.__PAGE__.txt). Without the flat copies every prefetch is a 404 on a static host. */
function addFlatSegmentFiles(dir) {
  let copied = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) {
      const walk = (d, prefix) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (e.isDirectory()) walk(path.join(d, e.name), `${prefix}.${e.name}`);
          else {
            fs.copyFileSync(path.join(d, e.name), path.join(dir, `${prefix}.${e.name}`));
            copied++;
          }
        }
      };
      walk(full, entry.name);
    } else if (entry.name !== "_next") copied += addFlatSegmentFiles(full);
  }
  return copied;
}

/** Adds a Content-Security-Policy <meta> tag to every page, allowing only this page's own inline scripts (by hash). */
function addCsp(dir) {
  let pages = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_next") pages += addCsp(full);
    } else if (entry.name.endsWith(".html")) {
      let html = fs.readFileSync(full, "utf8");
      const hashes = new Set();
      for (const m of html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (/type="application\/(ld\+)?json"/.test(m[1])) continue; // data, not executed
        hashes.add(`'sha256-${createHash("sha256").update(m[2]).digest("base64")}'`);
      }
      const policy = contentSecurityPolicy({ scriptSrc: ["'self'", ...hashes] });
      html = html.replace(/<head>/, `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
      fs.writeFileSync(full, html);
      pages++;
    }
  }
  return pages;
}

if (status === 0) {
  console.log(`Added a Content-Security-Policy to ${addCsp(path.join(web, "out"))} pages`);
  console.log(`Added ${addFlatSegmentFiles(path.join(web, "out"))} flat segment files`);
  fs.writeFileSync(path.join(web, "out", ".nojekyll"), ""); // GitHub Pages: serve the _next folder as-is
  console.log("\nStatic site written to web/out");
}
process.exit(status);
