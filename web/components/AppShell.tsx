"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Nav } from "@/lib/nav";
import { AIProvider, EXPANDED_WIDTH, useAI } from "./ai/AIProvider";
import AIPanel from "./ai/AIPanel";
import SelectionAsk from "./ai/SelectionAsk";
import Credit from "./Brand";
import LiveReload from "./LiveReload";
import CommandPalette from "./CommandPalette";
import Outline from "./Outline";
import Toaster from "./Toaster";
import TopNav from "./Nav";

function Frame({ nav, children }: { nav: Nav; children: React.ReactNode }) {
  const pathname = usePathname();
  const ai = useAI();
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  // the 30-day plan and the project list sit beside lessons and projects, as the module outline does in the other apps
  const hasOutline = pathname.startsWith("/learn") || pathname.startsWith("/projects");

  return (
    <div className="app" data-ai={ai.open ? "open" : "closed"} data-ai-wide={ai.expanded ? "" : undefined} style={{ "--ai-w": `${ai.expanded ? EXPANDED_WIDTH : ai.width}px` } as React.CSSProperties}>
      <a href="#main" className="skip-link">Skip to content</a>
      {process.env.NEXT_PUBLIC_STATIC_EXPORT === "1" && (
        <div className="hosted-banner" role="note">
          Hosted preview. Run buttons and Azure OpenAI need the local app:{" "}
          <a href={process.env.NEXT_PUBLIC_REPO_URL} target="_blank" rel="noreferrer">clone the repo</a> and run <code>python start.py</code>.
        </div>
      )}
      <TopNav nav={nav} onMenu={() => setMenu((m) => !m)} hasOutline={hasOutline} />
      <div className={`app-body${hasOutline ? " has-outline" : ""}`}>
        {hasOutline && <Outline nav={nav} open={menu} onNavigate={() => setMenu(false)} />}
        {hasOutline && menu && <div className="scrim" onClick={() => setMenu(false)} aria-hidden="true" />}
        <div className="content">
          <main id="main" className="main" key={pathname}>
            {children}
          </main>
        </div>
        {ai.open && <div className="scrim ai-scrim" onClick={ai.closePanel} aria-hidden="true" />}
        <AIPanel />
      </div>
      <Credit />
      <CommandPalette nav={nav} />
      <SelectionAsk />
      <Toaster />
      <LiveReload />
    </div>
  );
}

export default function AppShell({ nav, children }: { nav: Nav; children: React.ReactNode }) {
  return (
    <AIProvider>
      <Frame nav={nav}>{children}</Frame>
    </AIProvider>
  );
}
