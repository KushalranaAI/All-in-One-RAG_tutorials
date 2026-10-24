// The app derives everything from the course's Markdown. These checks fail loudly if a README change breaks that.
import { describe, expect, it } from "vitest";
import { commandsIn, flatLessons, getLesson, getProjects, getSections, getToolkit } from "./content";

describe("course content", () => {
  it("finds four weeks and thirty days, in order", () => {
    const weeks = getSections();
    expect(weeks.map((w) => w.slug)).toEqual(["week-1", "week-2", "week-3", "week-4"]);
    expect(weeks.every((w) => w.title && w.description)).toBe(true);
    expect(flatLessons().map((l) => l.order)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("gives every day a title, goal, topic and exercises", () => {
    for (const l of flatLessons()) {
      const full = getLesson(l.section, l.slug)!;
      expect(full.title, l.slug).not.toMatch(/^Day/);
      expect(full.summary, l.slug).not.toBe("");
      expect(full.topic, l.slug).not.toBe("");
      expect(full.exercises.length, l.slug).toBeGreaterThan(0);
      expect(full.body, l.slug).not.toMatch(/^## Exercises/m);
    }
  });

  it("splits the Run it section into runnable commands", () => {
    const day6 = getLesson("week-1", "day-06-first-rag-pipeline")!;
    expect(day6.commands).toEqual([
      { script: "days/day-06-first-rag-pipeline/rag.py", args: ["Which plan includes SSO?"], note: "" },
      { script: "days/day-06-first-rag-pipeline/rag.py", args: ["--show-sources", "What is the SEV1 response process?"], note: "" },
    ]);
  });

  it("leaves servers, placeholders and interactive sessions to the terminal", () => {
    const md = "```bash\npython days/day-20-build-mcp-server/rag_mcp_server.py --http --port 8000\npython days/day-03-document-loading/load_docs.py --pdf path/to/file.pdf\npython days/day-24-memory-conversational-rag/chat.py   # interactive\nclaude mcp add x -- python days/day-01-what-is-rag/hello_claude.py\n```";
    expect(commandsIn(md)).toEqual([]);
  });

  it("finds fifteen projects with levels and the days they build on", () => {
    const projects = getProjects();
    expect(projects).toHaveLength(15);
    for (const p of projects) {
      expect(p.summary, p.slug).not.toBe("");
      expect(p.days.length, p.slug).toBeGreaterThan(0);
    }
    expect(projects[0].days).toEqual([3, 4, 5, 6, 7, 8, 27]);
    expect(projects[14].level).toBe("capstone");
  });

  it("lists the shared library and MCP servers", () => {
    const t = getToolkit();
    expect(t.library.map((m) => m.name)).toContain("retrieval");
    expect(t.servers.map((m) => m.name)).toContain("docs_server");
  });
});
