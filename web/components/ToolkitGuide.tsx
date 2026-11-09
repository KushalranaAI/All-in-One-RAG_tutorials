"use client";
// The Toolkit, designed around three jobs a learner arrives with:
//   1. "I'm stuck"        -> find the right tool for the problem, see how to call it, what goes wrong.
//   2. "Build it myself"  -> rebuild each piece from a starter, run a check, compare with ours, tick it off.
//   3. "Use it with Claude" -> what MCP is, what each server offers, how to run and connect it, how to fix it.
// Content lives in lib/toolkit-guide.ts (and is verified by scripts/check-toolkit-snippets.mjs).
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Nav, allLessons, dayLabel } from "@/lib/nav";
import { setDone, useProgress } from "@/lib/progress";
import { MCP_TROUBLE, SERVERS, SETUP, STAGES, STUCK, type McpServer, type StageId, TOOLS, type Tool } from "@/lib/toolkit-guide";
import AskButton from "./ai/AskButton";
import Markdown from "./Markdown";
import Icon from "./ui/Icon";
import Ring from "./ui/Ring";

export type ModMeta = { lines: number; source: string; usedBy: number[] };
type Tab = "find" | "build" | "mcp";

const code = (src: string, lang = "python") => "```" + lang + "\n" + src + "\n```";
const doneId = (id: string) => `toolkit/${id}`;

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="chip-btn"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1400);
        });
      }}
    >
      <Icon name={ok ? "check" : "copy"} size={13} /> {ok ? "Copied" : label}
    </button>
  );
}

export default function ToolkitGuide({ nav, mods }: { nav: Nav; mods: Record<string, ModMeta> }) {
  const [tab, setTab] = useState<Tab>("find");
  const [toolId, setToolId] = useState<string | null>(null); // find tab
  const [stepId, setStepId] = useState<string>(TOOLS[0].id); // build tab
  const [serverId, setServerId] = useState<string>(SERVERS[0].id); // mcp tab
  const [ready, setReady] = useState(false);
  const detail = useRef<HTMLDivElement>(null);
  const p = useProgress();

  // deep links: /toolkit#find/retrieval, #build/chunking, #mcp/sql_server
  useEffect(() => {
    const [t, id] = location.hash.slice(1).split("/");
    if (t === "find" || t === "build" || t === "mcp") {
      setTab(t);
      if (t === "find" && id && TOOLS.some((x) => x.id === id)) setToolId(id);
      if (t === "build" && id && TOOLS.some((x) => x.id === id)) setStepId(id);
      if (t === "mcp" && id && SERVERS.some((x) => x.id === id)) setServerId(id);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const id = tab === "find" ? toolId : tab === "build" ? stepId : serverId;
    history.replaceState(null, "", `#${tab}${id ? `/${id}` : ""}`);
  }, [tab, toolId, stepId, serverId, ready]);

  const builtCount = TOOLS.filter((t) => p.done[doneId(t.id)]).length;
  const reveal = () => {
    if (window.innerWidth < 1000) requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const goBuild = (id: string) => {
    setStepId(id);
    setTab("build");
    reveal();
  };
  const goFind = (id: string) => {
    setToolId(id);
    setTab("find");
    reveal();
  };
  const goServer = (id: string) => {
    setServerId(id);
    setTab("mcp");
    reveal();
  };

  return (
    <div className="tk">
      <Setup />

      <div className="tk-tabs segmented" role="tablist" aria-label="What do you want to do?">
        {([
          ["find", "search", "Find a tool", "I'm stuck, or looking for something"],
          ["build", "hammer", `Build it yourself (${builtCount}/${TOOLS.length})`, "Rebuild each piece, with checks"],
          ["mcp", "plug", "MCP servers", "Use it with Claude"],
        ] as const).map(([id, icon, label, sub]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            <Icon name={icon} size={16} />
            <span><b>{label}</b><small>{sub}</small></span>
          </button>
        ))}
      </div>

      {tab === "find" && <Find nav={nav} mods={mods} toolId={toolId} setToolId={(id) => { setToolId(id); reveal(); }} goBuild={goBuild} goServer={goServer} detailRef={detail} />}
      {tab === "build" && <Build nav={nav} mods={mods} stepId={stepId} setStepId={(id) => { setStepId(id); reveal(); }} goFind={goFind} detailRef={detail} />}
      {tab === "mcp" && <Mcp nav={nav} mods={mods} serverId={serverId} setServerId={(id) => { setServerId(id); reveal(); }} detailRef={detail} />}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- first-time setup */
function Setup() {
  return (
    <details className="tk-setup card">
      <summary>
        <Icon name="rocket" size={16} /> <b>First time here?</b> <span className="muted small">Four commands to get every tool working</span>
        <Icon name="chevron-down" size={14} className="caret" />
      </summary>
      <ol className="tk-setup-steps">
        {SETUP.map((s, i) => (
          <li key={s.title}>
            <span className="tk-num">{i + 1}</span>
            <div>
              <div className="row between"><b>{s.title}</b><CopyBtn text={s.cmd} /></div>
              <pre className="tk-cmd">{s.cmd}</pre>
              <p className="muted small">{s.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

function DayPills({ nav, days }: { nav: Nav; days: number[] }) {
  const lessons = useMemo(() => allLessons(nav), [nav]);
  const p = useProgress();
  const items = days.map((d) => ({ d, l: lessons.find((x) => x.order === d) })).filter((x) => x.l);
  if (!items.length) return null;
  return (
    <span className="chips">
      {items.map(({ d, l }) => (
        <Link key={d} href={l!.href} className={`pill ${p.done[l!.id] ? "good" : "accent"}`} title={l!.title}>
          {p.done[l!.id] && <Icon name="check" size={12} />}{dayLabel(d)} · {l!.title.length > 28 ? l!.title.slice(0, 26) + "…" : l!.title}
        </Link>
      ))}
    </span>
  );
}

const unionDays = (t: Tool, m?: ModMeta) => [...new Set([...t.days, ...(m?.usedBy ?? [])])].sort((a, b) => a - b);

/* ---------------------------------------------------------------------------------------------- tab 1: find a tool */
function Find({ nav, mods, toolId, setToolId, goBuild, goServer, detailRef }: {
  nav: Nav; mods: Record<string, ModMeta>; toolId: string | null; setToolId: (id: string | null) => void;
  goBuild: (id: string) => void; goServer: (id: string) => void; detailRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<StageId | null>(null);
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (t: Tool) => `${t.title} ${t.job} ${t.id} ${t.reach.join(" ")} ${t.api.map((a) => a.sig + " " + a.does).join(" ")} ${t.gotchas.join(" ")}`.toLowerCase();
  const shown = TOOLS.filter((t) => (!stage || t.stage === stage) && tokens.every((w) => hay(t).includes(w)));
  const tool = toolId ? TOOLS.find((t) => t.id === toolId) ?? null : null;

  return (
    <div className="tk-find">
      <div className="tk-toolbar card">
        <div className="lab-search wide">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What are you stuck on? “exact terms”, “PDF”, “citations”, “tools”…" aria-label="Search the toolkit" />
        </div>
        <div className="tk-stages" role="group" aria-label="Pipeline stage">
          <button type="button" className={`filter-chip ${stage === null ? "on" : ""}`} aria-pressed={stage === null} onClick={() => setStage(null)}>All</button>
          {STAGES.map((s, i) => (
            <span key={s.id} className="tk-stage-wrap">
              {i >= 0 && <Icon name="chevron-right" size={13} className="tk-arrow" />}
              <button type="button" className={`filter-chip ${stage === s.id ? "on" : ""}`} aria-pressed={stage === s.id} onClick={() => setStage(stage === s.id ? null : s.id)} title={s.blurb}>{s.name}</button>
            </span>
          ))}
        </div>
      </div>

      <div className="tk-body">
        <nav className="tk-list" aria-label="Tools">
          {STAGES.filter((s) => shown.some((t) => t.stage === s.id)).map((s) => (
            <section key={s.id}>
              <h4>{s.name} <span className="h-note muted">{s.blurb}</span></h4>
              {shown.filter((t) => t.stage === s.id).map((t) => (
                <button key={t.id} type="button" className={`tk-item${toolId === t.id ? " on" : ""}`} aria-current={toolId === t.id} onClick={() => setToolId(t.id)}>
                  <span className="tk-item-title">{t.title}</span>
                  <span className="tk-item-job clamp">{t.job}</span>
                  <code className="tk-item-file">rag_common/{t.id}.py</code>
                </button>
              ))}
            </section>
          ))}
          {shown.length === 0 && <p className="muted">Nothing matches “{q}”. Try fewer words, or ask the AI tutor.</p>}
        </nav>

        <div className="tk-panel card" ref={detailRef} aria-live="polite">
          {tool ? <ToolDetail nav={nav} tool={tool} meta={mods[tool.id]} onBuild={() => goBuild(tool.id)} onPick={setToolId} onClose={() => setToolId(null)} /> : <StuckStart onTool={setToolId} onServer={goServer} />}
        </div>
      </div>
    </div>
  );
}

function StuckStart({ onTool, onServer }: { onTool: (id: string) => void; onServer: (id: string) => void }) {
  return (
    <div className="tk-detail">
      <p className="eyebrow" style={{ margin: 0 }}>Start here</p>
      <h3>What are you stuck on?</h3>
      <p className="muted">Pick the closest problem and jump to the tool that fixes it. Or choose a tool on the left.</p>
      <ul className="tk-stuck">
        {STUCK.map((s) => {
          const server = SERVERS.find((x) => x.id === s.tool);
          return (
            <li key={s.symptom}>
              <button type="button" onClick={() => (server ? onServer(server.id) : onTool(s.tool))}>
                <span>{s.symptom}</span>
                <span className="pill accent">{server ? server.title : TOOLS.find((t) => t.id === s.tool)?.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <section>
        <h4>How the pieces fit</h4>
        <ol className="tk-flow">
          {TOOLS.filter((t) => t.id !== "index").map((t) => <li key={t.id}><button type="button" onClick={() => onTool(t.id)}>{t.title}</button></li>)}
        </ol>
        <p className="muted small">Load → split → embed → store and search → fuse → prompt → ask Claude → agents → MCP. Week 1 builds the first half, one piece a day.</p>
      </section>
    </div>
  );
}

function ToolDetail({ nav, tool, meta, onBuild, onPick, onClose }: { nav: Nav; tool: Tool; meta?: ModMeta; onBuild: () => void; onPick: (id: string) => void; onClose: () => void }) {
  const stage = STAGES.find((s) => s.id === tool.stage)!;
  return (
    <div className="tk-detail">
      <div className="row between">
        <span className="pill accent">{stage.name}</span>
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Back to start"><Icon name="x" size={16} /></button>
      </div>
      <h3>{tool.title}</h3>
      <p className="tk-job">{tool.job}</p>
      <p className="muted small"><code>rag_common/{tool.id}.py</code>{meta ? ` · ${meta.lines} lines` : ""}</p>

      <section>
        <h4><Icon name="target" size={13} /> Reach for this when</h4>
        <ul className="tk-reach">{tool.reach.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>

      <section>
        <h4><Icon name="box" size={13} /> What's inside</h4>
        <ul className="tk-api">
          {tool.api.map((a) => <li key={a.sig}><code>{a.sig}</code><span>{a.does}</span></li>)}
        </ul>
      </section>

      <section>
        <h4><Icon name="play" size={13} /> Try it</h4>
        {tool.needsKey && <p className="notice info small"><Icon name="key" size={14} /> <span>This calls Claude, so it needs <code>ANTHROPIC_API_KEY</code> in your <code>.env</code>.</span></p>}
        <Markdown askable={false}>{code(tool.example)}</Markdown>
        {tool.expect && <p className="muted small"><b>You should see:</b> {tool.expect}</p>}
        <p className="muted small">Run from the repository root so paths like <code>data/company_handbook</code> resolve.</p>
      </section>

      <section className="tk-warn">
        <h4><Icon name="alert" size={13} /> Where it goes wrong</h4>
        <ul>{tool.gotchas.map((g) => <li key={g}>{g}</li>)}</ul>
      </section>

      <section>
        <h4><Icon name="book" size={13} /> Learn it</h4>
        <DayPills nav={nav} days={unionDays(tool, meta)} />
      </section>

      {tool.next && (
        <section>
          <h4>Usually next</h4>
          <span className="chips">{tool.next.map((id) => <button key={id} type="button" className="chip-btn" onClick={() => onPick(id)}>{TOOLS.find((t) => t.id === id)?.title}<Icon name="arrow-right" size={12} /></button>)}</span>
        </section>
      )}

      <div className="tk-actions">
        <button type="button" className="btn primary" onClick={onBuild}><Icon name="hammer" size={16} /> Build it yourself</button>
        <AskButton label="Explain this tool" prompt={`Explain rag_common/${tool.id}.py: what it does, when I should use it, and the most common mistake. Keep it practical.`} />
      </div>

      {meta && (
        <details className="tk-source">
          <summary><Icon name="code" size={14} /> View the full source <span className="muted small">{meta.lines} lines</span><Icon name="chevron-down" size={14} className="caret" /></summary>
          <Markdown>{code(meta.source)}</Markdown>
        </details>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- tab 2: build it yourself */
function Build({ nav, mods, stepId, setStepId, goFind, detailRef }: {
  nav: Nav; mods: Record<string, ModMeta>; stepId: string; setStepId: (id: string) => void; goFind: (id: string) => void; detailRef: React.RefObject<HTMLDivElement | null>;
}) {
  const p = useProgress();
  const idx = Math.max(0, TOOLS.findIndex((t) => t.id === stepId));
  const tool = TOOLS[idx];
  const done = (id: string) => !!p.done[doneId(id)];
  const count = TOOLS.filter((t) => done(t.id)).length;
  const file = `step_${idx + 1}_${tool.id}.py`;
  const meta = mods[tool.id];

  return (
    <div className="tk-build">
      <div className="tk-intro card">
        <Ring value={count / TOOLS.length} size={56} stroke={5} label={`${count} of ${TOOLS.length} built`}><span className="small"><b>{count}</b></span></Ring>
        <div>
          <h3>Rebuild the toolkit, one piece at a time</h3>
          <p className="muted">Each step gives you a starter with the hard part left blank. Fill it in, run the check, then compare with the real file. Do them in order: every step uses the one before.</p>
        </div>
      </div>

      <div className="tk-body">
        <ol className="tk-steps" aria-label="Build steps">
          {TOOLS.map((t, i) => (
            <li key={t.id}>
              <button type="button" className={`tk-step${t.id === tool.id ? " on" : ""}${done(t.id) ? " done" : ""}`} aria-current={t.id === tool.id ? "step" : undefined} onClick={() => setStepId(t.id)}>
                <span className="tk-step-no">{done(t.id) ? <Icon name="check" size={14} /> : i + 1}</span>
                <span><b>{t.title}</b><small>{t.build.needsKey ? "needs an API key" : "runs offline"}</small></span>
              </button>
            </li>
          ))}
        </ol>

        <div className="tk-panel card" ref={detailRef}>
          <div className="tk-detail">
            <p className="eyebrow" style={{ margin: 0 }}>Step {idx + 1} of {TOOLS.length}</p>
            <h3>{tool.title}</h3>
            <p className="tk-job"><b>Goal:</b> {tool.build.goal}</p>
            {tool.build.needsKey && <p className="notice info small"><Icon name="key" size={14} /> <span>This step calls Claude, so it needs <code>ANTHROPIC_API_KEY</code> in your <code>.env</code>.</span></p>}

            <section className="tk-stepblock">
              <h4><span className="tk-num">1</span> Write it</h4>
              <p className="muted small">Copy the starter into <code>{file}</code> in the repository root and fill in every <code>TODO</code>.</p>
              <Markdown askable={false}>{code(tool.build.starter)}</Markdown>
            </section>

            <section className="tk-stepblock">
              <h4><span className="tk-num">2</span> Check it</h4>
              <p className="muted small">Add this to the bottom of the same file and run <code>python {file}</code>. It should print an <b>OK</b> line and not raise.</p>
              <Markdown askable={false}>{code(tool.build.check)}</Markdown>
              <div className="row gap"><CopyBtn text={`python ${file}`} label="Copy run command" /></div>
            </section>

            <section className="tk-stepblock">
              <h4><span className="tk-num">3</span> Compare with ours</h4>
              <p className="muted small">Only after your check passes (or you are really stuck): read the real thing.</p>
              {meta && (
                <details className="tk-source">
                  <summary><Icon name="code" size={14} /> rag_common/{tool.id}.py <span className="muted small">{meta.lines} lines</span><Icon name="chevron-down" size={14} className="caret" /></summary>
                  <Markdown>{code(meta.source)}</Markdown>
                </details>
              )}
              <p className="muted small">Explained in</p>
              <DayPills nav={nav} days={unionDays(tool, meta)} />
            </section>

            <section className="tk-warn">
              <h4><Icon name="alert" size={13} /> If it does not work</h4>
              <ul>{tool.gotchas.map((g) => <li key={g}>{g}</li>)}</ul>
              <AskButton label="Help me debug this step" prompt={`I am rebuilding rag_common/${tool.id}.py from the starter (goal: ${tool.build.goal}). Ask me what my check prints, then help me find the bug without giving me the full solution.`} />
            </section>

            <div className="tk-actions">
              <button type="button" className={`btn ${done(tool.id) ? "done" : "primary"}`} onClick={() => setDone(doneId(tool.id), !done(tool.id))} aria-pressed={done(tool.id)}>
                <Icon name="check" size={16} /> {done(tool.id) ? "Built. Undo" : "Mark as built"}
              </button>
              {idx < TOOLS.length - 1 && <button type="button" className="btn" onClick={() => setStepId(TOOLS[idx + 1].id)}>Next: {TOOLS[idx + 1].title} <Icon name="arrow-right" size={14} /></button>}
              <button type="button" className="btn ghost" onClick={() => goFind(tool.id)}>How do I use it?</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- tab 3: MCP servers */
type Via = "code" | "desktop" | "python" | "http";

function connectSnippets(s: McpServer) {
  const script = `mcp_servers/${s.id}.py`;
  const extraCode = s.id === "sql_server" ? " --db $PWD/data/nimbus.db" : "";
  const extraArg = s.id === "sql_server" ? `, "--db", "/absolute/path/to/data/nimbus.db"` : "";
  const alias = s.id.replace("_server", "");
  const pyArg = s.id === "sql_server" ? `, "--db", "data/nimbus.db"` : "";
  return {
    code: { lang: "bash", text: `claude mcp add ${s.name} -- python $PWD/${script}${extraCode}\nclaude mcp list    # ${s.name} should appear` },
    desktop: {
      lang: "json",
      text: `{\n  "mcpServers": {\n    "${s.name}": {\n      "command": "python",\n      "args": ["/absolute/path/to/${script}"${extraArg}]\n    }\n  }\n}`,
    },
    python: {
      lang: "python",
      text: `import asyncio\n\nfrom rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent\n\nservers = [MCPServerSpec.python("${alias}", "${script}"${pyArg})]\nprint(asyncio.run(run_mcp_agent("${s.tryAsking[0]}", servers)))`,
    },
    http: {
      lang: "bash",
      text: `python ${script}${s.id === "sql_server" ? " --db data/nimbus.db" : ""} --http --port ${s.port}\nclaude mcp add --transport http ${s.name} http://localhost:${s.port}/mcp`,
    },
  } as const;
}

function Mcp({ nav, mods, serverId, setServerId, detailRef }: { nav: Nav; mods: Record<string, ModMeta>; serverId: string; setServerId: (id: string) => void; detailRef: React.RefObject<HTMLDivElement | null> }) {
  const [via, setVia] = useState<Via>("code");
  const s = SERVERS.find((x) => x.id === serverId) ?? SERVERS[0];
  const snip = connectSnippets(s)[via];
  const meta = mods[s.id];
  const lessons = useMemo(() => allLessons(nav), [nav]);
  const projects = s.projects.map((slug) => nav.projects.find((x) => x.slug === slug)).filter((x): x is NonNullable<typeof x> => !!x);
  const mcpDays = [19, 20, 21].filter((d) => lessons.some((l) => l.order === d));

  return (
    <div className="tk-mcp">
      <div className="tk-intro card tk-explain">
        <div>
          <h3>MCP in 30 seconds</h3>
          <p className="muted">The Model Context Protocol is a standard plug between an AI app and your tools. You write a <b>server</b> that offers tools (actions) and resources (documents). Any <b>host</b> (Claude Desktop, Claude Code, or your own agent) can then discover and call them. The model never sees your code, only each tool's name, arguments and result.</p>
          <p className="small">Learn it: <DayPills nav={nav} days={mcpDays} /></p>
        </div>
        <ol className="tk-diagram" aria-label="How MCP fits together">
          <li><b>Host</b><small>Claude Desktop, Claude Code, or your agent</small></li>
          <li className="tk-link"><Icon name="arrow-right" size={14} /><small>asks to call a tool</small></li>
          <li><b>MCP client</b><small>speaks the protocol</small></li>
          <li className="tk-link"><Icon name="arrow-right" size={14} /><small>stdio or HTTP</small></li>
          <li className="on"><b>Your server</b><small>tools + resources</small></li>
        </ol>
      </div>

      <div className="tk-servers" role="tablist" aria-label="Choose a server">
        {SERVERS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === s.id} className={`tk-server card${x.id === s.id ? " on" : ""}`} onClick={() => setServerId(x.id)}>
            <b>{x.title}</b>
            <span className="muted small clamp">{x.job}</span>
            <span className="chips">{x.tools.map((t) => <code key={t.name}>{t.name}</code>)}</span>
          </button>
        ))}
      </div>

      <div className="tk-panel card tk-wide" ref={detailRef}>
        <div className="tk-detail">
          <div className="row between">
            <h3 style={{ margin: 0 }}>{s.title} <code className="tk-reg">{s.name}</code></h3>
            {meta && <span className="muted small"><code>mcp_servers/{s.id}.py</code> · {meta.lines} lines</span>}
          </div>
          <p className="tk-job">{s.job}</p>

          <div className="tk-cols">
            <section>
              <h4><Icon name="box" size={13} /> What it offers</h4>
              <ul className="tk-api">
                {s.tools.map((t) => <li key={t.name}><code>{t.name}({t.args})</code><span>{t.does}</span></li>)}
                {s.resources?.map((r) => <li key={r.uri}><code>resource {r.uri}</code><span>{r.does}</span></li>)}
              </ul>
            </section>
            <section>
              <h4><Icon name="message" size={13} /> Try asking Claude</h4>
              <ul className="tk-asks">
                {s.tryAsking.map((a) => <li key={a}><span>“{a}”</span><CopyBtn text={a} /></li>)}
              </ul>
            </section>
          </div>

          <section className="tk-stepblock">
            <h4><span className="tk-num">1</span> Run it once to check it starts</h4>
            {s.needs && <><p className="muted small">First, one-time setup:</p><Markdown askable={false}>{code(s.needs, "bash")}</Markdown></>}
            <Markdown askable={false}>{code(`python mcp_servers/${s.id}.py${s.extraArgs ? " " + s.extraArgs : ""}`, "bash")}</Markdown>
            <p className="muted small">It waits silently for a host to connect: that is correct. Stop it with <kbd>Ctrl</kbd> + <kbd>C</kbd>.</p>
          </section>

          <section className="tk-stepblock">
            <h4><span className="tk-num">2</span> Connect it</h4>
            <div className="segmented small" role="group" aria-label="Connect from">
              {([["code", "Claude Code"], ["desktop", "Claude Desktop"], ["python", "Your Python agent"], ["http", "Remote (HTTP)"]] as const).map(([id, label]) => (
                <button key={id} type="button" className={via === id ? "on" : ""} onClick={() => setVia(id)}>{label}</button>
              ))}
            </div>
            {via === "desktop" && <p className="muted small">Open Claude Desktop → Settings → Developer → Edit Config, merge this into <code>claude_desktop_config.json</code>, replace the path with yours, and restart the app.</p>}
            {via === "code" && <p className="muted small">Run from the repository root. <code>$PWD</code> makes the path absolute.</p>}
            {via === "python" && <p className="muted small">The bridge starts the server for you and exposes its tools to Claude as <code>{s.id.replace("_server", "")}__{s.tools[0].name}</code>.</p>}
            {via === "http" && <p className="muted small">Use HTTP when the server runs on another machine or you want one server shared by several apps.</p>}
            <Markdown askable={false}>{code(snip.text, snip.lang)}</Markdown>
          </section>

          {s.tips && <section><h4><Icon name="lightbulb" size={13} /> Good to know</h4><ul className="tk-reach">{s.tips.map((t) => <li key={t}><Markdown askable={false}>{t}</Markdown></li>)}</ul></section>}

          <section className="tk-warn">
            <h4><Icon name="alert" size={13} /> Safety</h4>
            <ul>{s.safety.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>

          {projects.length > 0 && (
            <section>
              <h4><Icon name="rocket" size={13} /> Used in these projects</h4>
              <span className="chips">{projects.map((pr) => <Link key={pr.slug} href={`/projects/${pr.slug}`} className="pill accent">{pr.title}</Link>)}</span>
            </section>
          )}

          <div className="tk-actions">
            <AskButton label="Explain this server" prompt={`Explain mcp_servers/${s.id}.py: what each tool does, how a host like Claude Code decides to call it, and how I could add a new tool.`} />
          </div>

          {meta && (
            <details className="tk-source">
              <summary><Icon name="code" size={14} /> View the full source <span className="muted small">{meta.lines} lines</span><Icon name="chevron-down" size={14} className="caret" /></summary>
              <Markdown>{code(meta.source)}</Markdown>
            </details>
          )}
        </div>
      </div>

      <section className="tk-trouble card">
        <h3><Icon name="alert" size={16} /> It is not working</h3>
        <div>
          {MCP_TROUBLE.map((t) => (
            <details key={t.problem} className="tk-faq">
              <summary>{t.problem}<Icon name="chevron-down" size={14} className="caret" /></summary>
              <Markdown askable={false}>{t.fix}</Markdown>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
