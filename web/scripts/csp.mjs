// The Content-Security-Policy shared by the local app (sent as a header) and the static GitHub Pages copy (a <meta> tag,
// with a hash for every inline script). It limits what the page can load and, above all, where it can send data:
// only to this app, the AI providers it supports, and servers on this computer. A script injected into the page
// can't send your saved key to an unknown site.

const PROVIDERS = [
  "https://api.openai.com",
  "https://api.anthropic.com",
  "https://*.openai.azure.com",
  "https://*.cognitiveservices.azure.com",
  "https://*.services.ai.azure.com",
  "https://generativelanguage.googleapis.com",
];
const LOOPBACK = ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"]; // Ollama, LM Studio and similar on this machine

/** @param {{ scriptSrc?: string[], dev?: boolean }} opts */
export function contentSecurityPolicy({ scriptSrc = ["'self'", "'unsafe-inline'"], dev = false } = {}) {
  return [
    "default-src 'self'",
    `script-src ${[...scriptSrc, ...(dev ? ["'unsafe-eval'"] : [])].join(" ")}`,
    "style-src 'self' 'unsafe-inline'", // React and KaTeX set inline style attributes
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${["'self'", ...PROVIDERS, ...LOOPBACK, ...(dev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : [])].join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join("; ");
}
