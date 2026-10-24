import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import Icon from "@/components/ui/Icon";
import { type Module, flatLessons, getCode, getToolkit } from "@/lib/content";
import { dayLabel } from "@/lib/nav";

export const metadata: Metadata = { title: "Toolkit & MCP servers" };

function ModuleCard({ m, lessons }: { m: Module; lessons: ReturnType<typeof flatLessons> }) {
  const code = getCode(m.file);
  return (
    <details id={m.name} className="code-file collapsible card module">
      <summary>
        <Icon name="code" size={16} />
        <span className="module-main">
          <code>{m.file}</code>
          <span className="muted small">{m.doc.split("\n")[0]}</span>
        </span>
        <span className="muted small">{m.lines} lines</span>
        <Icon name="chevron-down" size={14} className="caret" />
      </summary>
      <div className="module-body">
        {m.doc.includes("\n") && <Markdown askable={false}>{m.doc.split("\n").slice(1).join("\n").trim()}</Markdown>}
        {m.usedBy.length > 0 && (
          <div className="meta-row">
            <span className="muted small">Explained on</span>
            {m.usedBy.map((d) => {
              const l = lessons.find((x) => x.order === d);
              return l ? <Link key={d} href={`/learn/${l.section}/${l.slug}`} className="pill accent">{dayLabel(d)}</Link> : null;
            })}
          </div>
        )}
      </div>
      {code && <Markdown>{"```python\n" + code.code + "\n```"}</Markdown>}
    </details>
  );
}

export default function ToolkitPage() {
  const { library, servers } = getToolkit();
  const lessons = flatLessons();
  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Icon name="box" size={14} /> Reference</div>
        <h1>Toolkit &amp; MCP servers</h1>
        <p className="lead">
          Week 1 builds each piece of <code>rag_common</code> from scratch; every later day and all 15 projects import it, so their code stays short. The MCP servers are production-style and work in Claude Desktop and Claude Code.
        </p>
      </header>

      <h2 className="section-title">Shared library: <code>rag_common/</code></h2>
      <p className="muted">Install it once from the repository root with <code>pip install -e .</code></p>
      {library.map((m) => <ModuleCard key={m.file} m={m} lessons={lessons} />)}

      <h2 className="section-title">MCP servers: <code>mcp_servers/</code></h2>
      <div className="notice info">
        <Icon name="plug" size={16} />
        <div>
          Add one to Claude Code from the repository root:
          <pre className="small" style={{ margin: "8px 0 0" }}>{"claude mcp add nimbus-docs -- python $PWD/mcp_servers/docs_server.py"}</pre>
        </div>
      </div>
      {servers.map((m) => <ModuleCard key={m.file} m={m} lessons={lessons} />)}
    </article>
  );
}
