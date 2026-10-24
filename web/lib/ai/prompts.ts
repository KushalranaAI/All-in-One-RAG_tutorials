// What the tutor is told about the learner's current page, and quick prompts offered per page type.

export type PageContext = {
  key: string; // chat thread id, e.g. "lesson:week-2/day-08-hybrid-search"
  kind: "lesson" | "project" | "map" | "lab" | "section" | "general";
  title: string;
  /** Progress id where "save to notes" can write, if any. */
  noteId?: string;
  /** What the learner is looking at right now (the lesson step, a widget …). */
  focus?: string;
  /** The page's own text: lesson body, code, project steps. Trimmed before sending. */
  text: string;
};

export const GENERAL: PageContext = { key: "general", kind: "general", title: "RAG", text: "" };

const BASE = `You are a patient, precise tutor built into "RAG in 30 Days" (All-in-One RAG Tutorials), a hands-on course on Retrieval-Augmented Generation: embeddings, chunking, vector and hybrid search, reranking, evaluation, tool use, agentic and corrective RAG, Graph RAG, the Model Context Protocol (MCP), multi-agent systems and production concerns. The code is Python using the Claude API (Anthropic SDK), the official MCP Python SDK and a shared package "rag_common"; the sample data is a fictional company handbook ("Nimbus Cloud").

How to answer:
- Teach, don't just tell. Start with the intuition in one or two sentences, then the code or the numbers if it helps.
- Ground advice in measurement: when the learner wants to improve retrieval or answers, point them to an eval set (Day 14) and changing one thing at a time.
- Use Markdown. Put code in fenced blocks with a language tag. Math, when it helps, goes in $...$ (rendered with KaTeX).
- Be concise: short paragraphs, small numeric examples, no filler. Offer a follow-up only when it is genuinely useful.
- When the learner's page text is provided below, treat it as the source of truth for this course's notation and code; refer to its sections and file names. If the answer is not covered there, say so and answer from general knowledge.
- If something the learner says is wrong, correct it kindly and explain why.
- If you are unsure, say so rather than guessing.`;

export function buildSystem(ctx: PageContext, share: boolean, budget: number): string {
  if (!share || ctx.kind === "general") return BASE;
  const head = `\n\nThe learner is on: ${ctx.title} (${ctx.kind})${ctx.focus ? `\nThey are currently looking at: ${ctx.focus}` : ""}`;
  const text = ctx.text.length > budget ? ctx.text.slice(0, budget) + "\n…[page text trimmed]" : ctx.text;
  return `${BASE}${head}\n\n<page>\n${text}\n</page>`;
}

export function buildUserTurn(text: string, quote?: string): string {
  if (!quote) return text;
  return `Here is the excerpt I'm asking about:\n\n"""\n${quote}\n"""\n\n${text}`;
}

export type QuickPrompt = { label: string; prompt: string };

export function quickPrompts(ctx: PageContext): QuickPrompt[] {
  if (ctx.kind === "lesson") {
    const code = ctx.focus?.toLowerCase().includes("code");
    return [
      ...(code
        ? [
            { label: "Explain this code step by step", prompt: "Walk me through the code on this page step by step: what each function does and how data flows from the question to the answer." },
            { label: "What would break this?", prompt: "What inputs or documents would make this code give bad results, and how would I notice?" },
          ]
        : [
            { label: "Explain it like I'm new", prompt: "Explain this lesson's main idea like I'm new to it. Use one concrete everyday analogy." },
            { label: "Show me with the handbook", prompt: "Show this lesson's main idea working on a concrete example from the Nimbus Cloud handbook: a real question, what gets retrieved, and why." },
          ]),
      { label: "Common mistakes", prompt: "What are the most common mistakes or misconceptions about this topic, and how do I avoid them?" },
      { label: "When to use it", prompt: "When is this technique worth it in a real RAG system, and when is it overkill? Mention the cost and latency trade-off." },
      { label: "Quiz me", prompt: "Quiz me with 3 questions on this lesson, one at a time. Wait for my answer before revealing the solution." },
    ];
  }
  if (ctx.kind === "project") {
    return [
      { label: "Where do I start?", prompt: "I'm about to start this project. What should I think about first, and what are the likely pitfalls?" },
      { label: "Explain the approach", prompt: "Explain the overall approach of this project and why each step is there." },
      { label: "Adapt it to my data", prompt: "I want to point this project at my own documents. What do I need to change, and what should I test first?" },
    ];
  }
  if (ctx.kind === "map") {
    return [
      { label: "Help me diagnose", prompt: "My RAG system gives bad answers. Ask me questions one at a time to find out whether it's an ingestion, retrieval or generation problem, then point me to the right technique on this map." },
      { label: "Order of fixes", prompt: "If I'm starting from a basic RAG pipeline, in what order should I add these techniques, and why?" },
    ];
  }
  if (ctx.kind === "lab") {
    return [
      { label: "What should I try?", prompt: "What are three experiments I can do with this visual to build intuition, and what should I notice each time?" },
      { label: "What am I seeing?", prompt: "Explain what this visual is demonstrating and how to read it." },
    ];
  }
  return [
    { label: "Where should I start?", prompt: "I'm new to RAG. Suggest how to work through this 30-day course based on my goal. Ask me what I want to build first." },
    { label: "RAG vs fine-tuning", prompt: "When should I use RAG instead of fine-tuning a model, and when would I use both?" },
    { label: "What is MCP?", prompt: "Explain the Model Context Protocol in plain language: what problem it solves and how it relates to RAG and tool use." },
  ];
}
