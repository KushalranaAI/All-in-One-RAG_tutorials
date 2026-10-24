// Interactive visuals for the lab and the lessons' "Try it" step. Each runs the course's own algorithms (lib/rag.ts,
// ported from rag_common/) in the browser on the sample handbook, so no API key or Python is needed.
import Chunking from "./Chunking";
import Evaluation from "./Evaluation";
import HybridSearch from "./HybridSearch";
import PromptBuilder from "./PromptBuilder";
import Similarity from "./Similarity";

export type Doc = { name: string; text: string };
export type EvalItem = { question: string; answer: string; source: string };
export type LabData = { docs: Doc[]; evalSet: EvalItem[] };
export type WidgetProps = { data: LabData };

type Widget = { title: string; blurb: string; days: number[]; icon: "sliders" | "scissors" | "search" | "target" | "message"; Component: (p: WidgetProps) => React.ReactNode };

export const WIDGETS: Record<string, Widget> = {
  similarity: { title: "Similarity matrix", blurb: "Embed sentences and compare them with cosine similarity. See what a lexical embedder can and can't match.", days: [2], icon: "sliders", Component: Similarity },
  chunking: { title: "Chunking playground", blurb: "Split a handbook page with the fixed, recursive and heading-aware chunkers. Watch sizes, overlap and cut-off sentences.", days: [4, 12], icon: "scissors", Component: Chunking },
  hybrid: { title: "Hybrid search with RRF", blurb: "BM25 and vector search side by side, fused with Reciprocal Rank Fusion. Find queries where one fails and hybrid wins.", days: [5, 8, 9], icon: "search", Component: HybridSearch },
  prompt: { title: "Prompt assembler", blurb: "Retrieve top-k chunks and see the exact grounded prompt, with numbered sources, that Claude receives.", days: [6, 7], icon: "message", Component: PromptBuilder },
  evaluation: { title: "Retrieval evaluation", blurb: "Run the Day 14 eval set against each retriever: hit@k and MRR, question by question.", days: [8, 14], icon: "target", Component: Evaluation },
};

/** The widgets that belong to a lesson, by day number. */
export const widgetsForDay = (day: number) => Object.keys(WIDGETS).filter((k) => WIDGETS[k].days.includes(day));
