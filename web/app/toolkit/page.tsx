import type { Metadata } from "next";
import ToolkitGuide, { type ModMeta } from "@/components/ToolkitGuide";
import Icon from "@/components/ui/Icon";
import { getCode, getToolkit } from "@/lib/content";
import { getNav } from "@/lib/navdata";

export const metadata: Metadata = { title: "Toolkit & MCP servers" };

export default function ToolkitPage() {
  const { library, servers } = getToolkit();
  // line counts, full source and the lessons that mention each file: read from the repo, so they never go stale
  const mods: Record<string, ModMeta> = {};
  for (const m of [...library, ...servers]) {
    mods[m.name] = { lines: m.lines, usedBy: m.usedBy, source: getCode(m.file)?.code ?? "" };
  }
  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Icon name="box" size={14} /> Toolkit</div>
        <h1>Your toolkit</h1>
        <p className="lead">
          The small, readable pieces behind every lesson and project. Use them when you are stuck, rebuild them to really understand them, or plug the MCP servers into Claude.
        </p>
      </header>
      <ToolkitGuide nav={getNav()} mods={mods} />
    </article>
  );
}
