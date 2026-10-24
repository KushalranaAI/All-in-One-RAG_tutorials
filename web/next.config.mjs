import { fileURLToPath } from "node:url";
import { contentSecurityPolicy } from "./scripts/csp.mjs";

// `npm run build:pages` sets STATIC_EXPORT=1 to produce a fully static copy for GitHub Pages (no server, no Run buttons).
// Everything else - `python start.py`, `npm run dev`, `npm run build` - is the normal dynamic app.
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = staticExport ? (process.env.PAGES_BASE_PATH ?? "/All-in-One-RAG_tutorials") : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app reads lessons, projects and source code from the parent folder at request time.
  // fileURLToPath (not URL.pathname) so Windows gets "E:\..." rather than "/E:/...".
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  env: {
    NEXT_PUBLIC_STATIC_EXPORT: staticExport ? "1" : "",
    NEXT_PUBLIC_REPO_URL: "https://github.com/KushalranaAI/All-in-One-RAG_tutorials",
  },
  // The local app sends the policy as a header. (The static copy can't send headers; build-pages.mjs adds it as a <meta> tag.)
  // Next's own bootstrap scripts are inline and change per request, so script-src has to allow 'unsafe-inline' here;
  // the static copy is stricter because its inline scripts are fixed and can be hashed.
  ...(!staticExport && {
    async headers() {
      const dev = process.env.NODE_ENV !== "production";
      return [
        {
          source: "/:path*",
          headers: [
            { key: "Content-Security-Policy", value: [contentSecurityPolicy({ dev }), "frame-ancestors 'none'"].join("; ") },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "same-origin" },
          ],
        },
      ];
    },
  }),
  ...(staticExport && {
    output: "export",
    basePath,
    trailingSlash: true, // folder/index.html, which GitHub Pages serves without rewrites
    images: { unoptimized: true },
  }),
};

export default nextConfig;
