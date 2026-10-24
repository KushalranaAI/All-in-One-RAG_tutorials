import "./globals.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark-dimmed.css";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import AppShell from "@/components/AppShell";
import { getNav } from "@/lib/navdata";
import { THEME_SCRIPT } from "@/lib/theme-script";

export const metadata: Metadata = {
  title: { default: "RAG in 30 Days", template: "%s · RAG in 30 Days" },
  description: "Learn Retrieval-Augmented Generation in 30 days, from your first embedding to multi-agent systems on MCP, then build 15 projects.",
  authors: [{ name: "Kushal Rana", url: "https://kushalranaai.github.io/" }],
  creator: "Kushal Rana",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e14" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The local app reads lessons from disk on every request, so edits show up without rebuilding.
  // The static GitHub Pages export (STATIC_EXPORT=1) is rendered once at build time instead.
  if (process.env.STATIC_EXPORT !== "1") await connection();
  const nav = getNav();
  return (
    // suppressHydrationWarning: the inline script sets data-theme before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly, ColorZilla ...) add attributes to <body> before React loads */}
      <body suppressHydrationWarning>
        <AppShell nav={nav}>{children}</AppShell>
      </body>
    </html>
  );
}
