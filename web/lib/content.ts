// Reads the course (README.md, days/, projects/, rag_common/, mcp_servers/) straight from the repository on disk.
// The Markdown files are the single source of truth: GitHub renders them, and so does this app. Nothing here needs
// frontmatter - weeks, topics and project levels come from the tables in the root README, everything else from each
// lesson's own README (title, "**Goal:**", "## Run it", "## Exercises").
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(process.cwd(), "..");
const DAYS = path.join(/*turbopackIgnore: true*/ ROOT, "days");
const PROJECTS = path.join(/*turbopackIgnore: true*/ ROOT, "projects");

const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "");

export function safeInside(base: string, target: string): boolean {
  const rel = path.relative(base, path.resolve(target));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

// ------------------------------------------------------------------------------------ markdown helpers

/** Split a README into its "# Title", the text before the first "##", and its "## " sections. */
function sections(md: string): { title: string; intro: string; parts: { heading: string; body: string }[] } {
  const lines = md.split("\n");
  const titleAt = lines.findIndex((l) => /^# /.test(l));
  const title = titleAt >= 0 ? lines[titleAt].replace(/^# /, "").trim() : "";
  const parts: { heading: string; body: string[] }[] = [];
  const intro: string[] = [];
  let fence = false;
  for (const line of lines.slice(titleAt + 1)) {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = !fence && /^## (.*)/.exec(line);
    if (m) parts.push({ heading: m[1].trim(), body: [] });
    else (parts.length ? parts[parts.length - 1].body : intro).push(line);
  }
  return { title, intro: intro.join("\n").trim(), parts: parts.map((p) => ({ heading: p.heading, body: p.body.join("\n").trim() })) };
}

const joinParts = (parts: { heading: string; body: string }[]) => parts.map((p) => `## ${p.heading}\n${p.body}`).join("\n\n");

/** Top-level items of the first ordered or bulleted list in a block of Markdown. */
function listItems(md: string): string[] {
  const items: string[] = [];
  for (const line of md.split("\n")) {
    const m = /^(?:\d+\.|[-*])\s+(?:\[[ x]\]\s+)?(.*)/.exec(line);
    if (m) items.push(m[1].trim());
    else if (items.length && /^\s{2,}\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

const stripMd = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, "$1$2").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

// ------------------------------------------------------------------------------------ runnable commands

export type Command = { script: string; args: string[]; note: string };

/** Split a shell argument list, honouring "double" and 'single' quotes. */
function shellSplit(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Folders whose scripts the Run button may execute (also enforced by app/api/run). */
export const RUNNABLE_DIRS = ["days", "projects", "data"];

/**
 * The `python …` lines from a README's code blocks that make sense to run from the app: one-shot scripts inside
 * the course. Long-running servers (MCP over stdio, --http, uvicorn, streamlit), placeholder paths and
 * interactive sessions are left for the terminal.
 */
export function commandsIn(md: string): Command[] {
  const out: Command[] = [];
  for (const block of md.matchAll(/```([\w-]*)\n([\s\S]*?)```/g)) {
    if (!["", "bash", "sh", "shell", "console"].includes(block[1])) continue;
    for (const raw of block[2].split("\n")) {
      const m = /^\s*python\s+(\S+\.py)(.*)$/.exec(raw);
      if (!m) continue;
      const [rest, ...comment] = m[2].split(/\s+#\s+/);
      const note = comment.join(" # ").trim();
      const script = m[1];
      const args = shellSplit(rest.trim());
      const top = script.split("/")[0];
      const server = /_server\.py$/.test(script) && !/(^|\/)test_/.test(script);
      if (!RUNNABLE_DIRS.includes(top) || server || args.includes("--http") || /path\/to|^~|\/path/.test(rest) || /interactive/i.test(note)) continue;
      if (!fs.existsSync(path.join(/*turbopackIgnore: true*/ ROOT, script))) continue;
      if (out.some((c) => c.script === script && c.args.join(" ") === args.join(" "))) continue;
      out.push({ script, args, note });
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------ the root README

type WeekRow = { day: string; topic: string; build: string };
type Week = { n: number; title: string; blurb: string; rows: WeekRow[] };
type ProjectRow = { slug: string; title: string; stars: number; ideas: string; mcp: boolean; multiAgent: boolean };

function courseIndex(): { tagline: string; weeks: Week[]; projects: ProjectRow[] } {
  const md = read(path.join(/*turbopackIgnore: true*/ ROOT, "README.md"));
  const tagline = stripMd(/^\*\*(.+)\*\*$/m.exec(md)?.[1] ?? "");
  // "Week 1  Foundations         embeddings → loading → …" lines in the overview block
  const blurbs = new Map<number, { title: string; blurb: string }>();
  for (const m of md.matchAll(/^Week (\d+)\s{2,}(.+?)\s{2,}(.+)$/gm)) blurbs.set(Number(m[1]), { title: m[2].trim(), blurb: m[3].trim() });

  const weeks: Week[] = [];
  let current: Week | null = null;
  const projects: ProjectRow[] = [];
  for (const line of md.split("\n")) {
    const wk = /^### Week (\d+)\s*[-–]\s*(.+)$/.exec(line);
    if (wk) {
      const n = Number(wk[1]);
      current = { n, title: wk[2].trim(), blurb: blurbs.get(n)?.blurb ?? "", rows: [] };
      weeks.push(current);
      continue;
    }
    if (/^#{1,3} /.test(line)) current = null;
    const cells = line.startsWith("|") ? line.split("|").slice(1, -1).map((c) => c.trim()) : null;
    if (!cells) continue;
    const dayLink = /\]\(days\/([^)]+?)\/?\)/.exec(cells[0] ?? "");
    if (current && dayLink) current.rows.push({ day: dayLink[1], topic: stripMd(cells[1] ?? ""), build: stripMd(cells[2] ?? "") });
    const projLink = /\[([^\]]+)\]\(projects\/([^)]+?)\/?\)/.exec(cells[1] ?? "");
    if (projLink)
      projects.push({
        slug: projLink[2],
        title: projLink[1],
        stars: (cells[2]?.match(/★/g) ?? []).length,
        ideas: stripMd(cells[3] ?? ""),
        mcp: (cells[4] ?? "").includes("✅"),
        multiAgent: (cells[5] ?? "").includes("✅"),
      });
  }
  return { tagline, weeks, projects };
}

export const getTagline = () => courseIndex().tagline;

// ------------------------------------------------------------------------------------ lessons (days)

export type LessonMeta = {
  section: string; // "week-1"
  slug: string; // "day-08-hybrid-search"
  title: string;
  order: number; // the day number
  summary: string; // the lesson's **Goal:**
  topic: string; // from the README table
  build: string; // "You build" from the README table
  level: string;
  minutes: number;
};

export type Lesson = LessonMeta & {
  body: string; // the explanation, without "Run it" and "Exercises"
  run: string; // the "Run it" section
  exercises: string[];
  exercisesTitle: string; // "Exercises", or "Production checklist" on Day 30
  commands: Command[];
  files: string[]; // .py files in the lesson folder, relative to the repo root
  library: string[]; // rag_common / mcp_servers files the lesson mentions
  dir: string;
};

export type Section = { slug: string; title: string; order: number; description: string; lessons: LessonMeta[] };

const LEVELS = ["beginner", "intermediate", "advanced", "advanced"];
const isRun = (h: string) => /^run( it)?$/i.test(h);
const isExercises = (h: string) => /^(exercises?|(production )?checklist)$/i.test(h);

function parseLesson(section: string, week: number, row: WeekRow | undefined, slug: string): Lesson | null {
  const dir = path.join(/*turbopackIgnore: true*/ DAYS, slug);
  const md = read(path.join(/*turbopackIgnore: true*/ dir, "README.md"));
  if (!md) return null;
  const { title, intro, parts } = sections(md);
  const goal = /\*\*Goal:\*\*\s*(.+)/.exec(intro)?.[1].trim() ?? "";
  const learn = parts.filter((p) => !isRun(p.heading) && !isExercises(p.heading));
  const introRest = intro.replace(/\*\*Goal:\*\*.*\n?/, "").trim();
  const body = [introRest, joinParts(learn)].filter(Boolean).join("\n\n");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".py")).sort().map((f) => `days/${slug}/${f}`) : [];
  const library = [...new Set([...md.matchAll(/\b((?:rag_common|mcp_servers)\/\w+\.py)\b/g)].map((m) => m[1]))].filter((f) => fs.existsSync(path.join(/*turbopackIgnore: true*/ ROOT, f)));
  const order = parseInt(slug.replace(/^day-/, ""), 10);
  return {
    section,
    slug,
    title: title.replace(/^Day \d+\s*[-–:]\s*/, ""),
    order,
    summary: stripMd(goal).replace(/^\w/, (c) => c.toUpperCase()),
    topic: row?.topic ?? "",
    build: row?.build ?? "",
    level: LEVELS[week - 1] ?? "advanced",
    // reading at ~180 words a minute, plus running the code and one exercise
    minutes: Math.round((words(md) / 180 + 30 + 10 * files.length) / 5) * 5,
    body,
    run: parts.find((p) => isRun(p.heading))?.body ?? "",
    exercises: listItems(parts.find((p) => isExercises(p.heading))?.body ?? ""),
    exercisesTitle: parts.find((p) => isExercises(p.heading))?.heading ?? "Exercises",
    commands: commandsIn(md),
    files,
    library,
    dir: path.relative(ROOT, dir).split(path.sep).join("/"),
  };
}

const metaOf = (l: Lesson): LessonMeta => ({ section: l.section, slug: l.slug, title: l.title, order: l.order, summary: l.summary, topic: l.topic, build: l.build, level: l.level, minutes: l.minutes });

export function getSections(): Section[] {
  const { weeks } = courseIndex();
  return weeks.map((w) => {
    const slug = `week-${w.n}`;
    const lessons = w.rows
      .map((r) => parseLesson(slug, w.n, r, r.day))
      .filter((l): l is Lesson => l !== null)
      .map(metaOf)
      .sort((a, b) => a.order - b.order);
    return { slug, title: w.title, order: w.n, description: w.blurb, lessons };
  });
}

export function getLesson(section: string, slug: string): Lesson | null {
  const s = courseIndex().weeks.find((w) => `week-${w.n}` === section);
  const row = s?.rows.find((r) => r.day === slug);
  if (!s || !row || !safeInside(DAYS, path.join(/*turbopackIgnore: true*/ DAYS, slug))) return null;
  return parseLesson(section, s.n, row, slug);
}

export function flatLessons(): LessonMeta[] {
  return getSections().flatMap((s) => s.lessons);
}

// ------------------------------------------------------------------------------------ projects

export type Project = {
  slug: string;
  title: string;
  order: number;
  level: string; // beginner / intermediate / advanced / capstone
  stars: number;
  summary: string;
  ideas: string;
  stack: string[];
  uses: string; // "Days 03-08, 27"
  days: number[];
  mcp: boolean;
  multiAgent: boolean;
  diagram: string; // the README's architecture sketch
  features: string[];
  extend: string[]; // "Extend it" ideas: the project's checklist
  commands: Command[];
  run: string;
  body: string; // everything below the summary
  files: string[];
  dir: string;
};

const LEVEL_BY_STARS = ["beginner", "beginner", "intermediate", "advanced", "capstone"];

/** "Days 03-08, 27" → [3,4,5,6,7,8,27]; "everything" → every day. */
function parseDays(uses: string): number[] {
  if (/everything|all/i.test(uses)) return Array.from({ length: 30 }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const m of uses.matchAll(/(\d+)\s*[-–]\s*(\d+)|(\d+)/g)) {
    if (m[3]) out.add(Number(m[3]));
    else for (let d = Number(m[1]); d <= Number(m[2]); d++) out.add(d);
  }
  return [...out].sort((a, b) => a - b);
}

export function getProject(slug: string): Project | null {
  const dir = path.join(/*turbopackIgnore: true*/ PROJECTS, slug);
  if (!safeInside(PROJECTS, dir)) return null;
  const md = read(path.join(/*turbopackIgnore: true*/ dir, "README.md"));
  if (!md) return null;
  const row = courseIndex().projects.find((p) => p.slug === slug);
  const { title, intro, parts } = sections(md);
  const meta = /^\*\*Level:\*\*.*$/m.exec(intro)?.[0] ?? "";
  const field = (name: string) => new RegExp(`\\*\\*${name}:\\*\\*\\s*([^·]+)`).exec(meta)?.[1].trim() ?? "";
  const afterMeta = intro.replace(meta, "").trim();
  const diagram = /```[a-z]*\n([\s\S]*?)```/.exec(afterMeta)?.[1].replace(/\s+$/, "") ?? "";
  const summary = stripMd(afterMeta.replace(/```[\s\S]*?```/g, "").trim().split(/\n\n/)[0]?.replace(/\n/g, " ") ?? "");
  const runPart = parts.find((p) => isRun(p.heading));
  const extendPart = parts.find((p) => /extend|further|ideas/i.test(p.heading));
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "__pycache__") walk(path.join(/*turbopackIgnore: true*/ d, e.name));
      else if (e.name.endsWith(".py")) files.push(path.relative(ROOT, path.join(/*turbopackIgnore: true*/ d, e.name)).split(path.sep).join("/"));
    }
  };
  walk(dir);
  const level = field("Level").toLowerCase() || LEVEL_BY_STARS[row?.stars ?? 1];
  return {
    slug,
    title: row?.title ?? title.replace(/^Project \d+\s*[-–:]\s*/, ""),
    order: parseInt(slug, 10),
    level,
    stars: row?.stars ?? 1,
    summary,
    ideas: row?.ideas ?? "",
    stack: field("Stack").split(",").map((s) => s.trim()).filter(Boolean),
    uses: field("Uses"),
    days: parseDays(field("Uses")),
    mcp: row?.mcp ?? false,
    multiAgent: row?.multiAgent ?? false,
    diagram,
    features: listItems(parts.find((p) => /^features/i.test(p.heading))?.body ?? ""),
    extend: listItems(extendPart?.body ?? ""),
    commands: commandsIn(md),
    run: runPart?.body ?? "",
    body: joinParts(parts.filter((p) => p !== runPart && p !== extendPart)),
    files,
    dir: path.relative(ROOT, dir).split(path.sep).join("/"),
  };
}

export function getProjects(): Project[] {
  const order = courseIndex().projects.map((p) => p.slug);
  return order.map(getProject).filter((p): p is Project => p !== null);
}

// ------------------------------------------------------------------------------------ the toolkit

export type Module = { file: string; name: string; doc: string; lines: number; usedBy: number[] };

/** The shared library (rag_common/) and the reusable MCP servers, with the lessons that mention each file. */
export function getToolkit(): { library: Module[]; servers: Module[]; serversReadme: string } {
  const mentions = new Map<string, Set<number>>();
  for (const l of fs.existsSync(DAYS) ? fs.readdirSync(DAYS) : []) {
    const md = read(path.join(/*turbopackIgnore: true*/ DAYS, l, "README.md"));
    for (const m of md.matchAll(/\b((?:rag_common|mcp_servers)\/\w+\.py)\b/g)) {
      if (!mentions.has(m[1])) mentions.set(m[1], new Set());
      mentions.get(m[1])!.add(parseInt(l.replace(/^day-/, ""), 10));
    }
  }
  const mod = (folder: string) =>
    fs
      .readdirSync(path.join(/*turbopackIgnore: true*/ ROOT, folder))
      .filter((f) => f.endsWith(".py") && f !== "__init__.py")
      .sort()
      .map((f) => {
        const file = `${folder}/${f}`;
        const src = read(path.join(/*turbopackIgnore: true*/ ROOT, file));
        const doc = /^\s*(?:#[^\n]*\n)*\s*"""([\s\S]*?)"""/.exec(src)?.[1].trim() ?? "";
        return { file, name: f.replace(/\.py$/, ""), doc, lines: src.split("\n").length, usedBy: [...(mentions.get(file) ?? [])].sort((a, b) => a - b) };
      });
  return { library: mod("rag_common"), servers: mod("mcp_servers"), serversReadme: sections(read(path.join(/*turbopackIgnore: true*/ ROOT, "mcp_servers", "README.md"))).parts.length ? read(path.join(/*turbopackIgnore: true*/ ROOT, "mcp_servers", "README.md")) : "" };
}

// ------------------------------------------------------------------------------------ source code

export type CodeSnippet = { spec: string; file: string; symbol: string | null; language: string; code: string };

const LANG: Record<string, string> = { ".py": "python", ".md": "markdown", ".json": "json", ".yml": "yaml", ".yaml": "yaml", ".toml": "toml" };

/** "rag_common/retrieval.py" → the whole file. */
export function getCode(spec: string): CodeSnippet | null {
  const full = path.join(/*turbopackIgnore: true*/ ROOT, spec);
  if (!safeInside(ROOT, full) || !fs.existsSync(full)) return null;
  return { spec, file: spec, symbol: null, language: LANG[path.extname(spec)] ?? "text", code: read(full).replace(/\s+$/, "") };
}

/** The sample "Nimbus Cloud" handbook the lessons search over (used by the in-browser lab). */
export function getHandbook(): { name: string; text: string }[] {
  const dir = path.join(/*turbopackIgnore: true*/ ROOT, "data", "company_handbook");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => ({ name: f, text: read(path.join(/*turbopackIgnore: true*/ dir, f)) }));
}

/** data/eval_set.json: {question, answer, source} per row (Day 14). */
export function getEvalSet(): { question: string; answer: string; source: string }[] {
  try {
    return JSON.parse(read(path.join(/*turbopackIgnore: true*/ ROOT, "data", "eval_set.json")));
  } catch {
    return [];
  }
}

export const getLabData = () => ({ docs: getHandbook(), evalSet: getEvalSet() });
