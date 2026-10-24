// The lab's TypeScript ports must behave like rag_common. Expected values mirror the Python implementations.
import { describe, expect, it } from "vitest";
import { BM25, chunkByHeadings, chunkFixed, chunkRecursive, cosine, hashingEmbed, reciprocalRankFusion, scoreRetrieval } from "./rag";

describe("chunking", () => {
  it("chunk_fixed slides a window of size-overlap", () => {
    expect(chunkFixed("abcdefghij", 4, 1)).toEqual(["abcd", "defg", "ghij"]);
    expect(() => chunkFixed("abc", 2, 2)).toThrow();
  });

  it("chunk_recursive keeps paragraphs together and stays under size", () => {
    const text = "one two three.\n\nfour five six.\n\nseven eight nine ten eleven twelve.";
    const chunks = chunkRecursive(text, 32);
    // same output as rag_common.chunking.chunk_recursive(text, 32)
    expect(chunks).toEqual(["one two three.\n\nfour five six.", "seven eight nine ten eleven", "twelve."]);
    expect(chunks.every((c) => c.length <= 32)).toBe(true);
  });

  it("chunk_by_headings records the section path", () => {
    const md = "# Pricing\nintro\n## Plans\n### Pro\n- $79\n## Add-ons\n- storage";
    expect(chunkByHeadings(md).map((c) => c.section)).toEqual(["Pricing", "Pricing > Plans > Pro", "Pricing > Add-ons"]);
  });
});

describe("search", () => {
  it("BM25 ranks exact terms and prefers rarer ones", () => {
    const bm = new BM25(["refund policy for annual plans", "SEV1 incident runbook", "annual plans pricing"]);
    const s = bm.scores("SEV1 incident");
    expect(s[1]).toBeGreaterThan(0);
    expect(s[0]).toBe(0);
    expect(bm.idf.get("sev1")!).toBeGreaterThan(bm.idf.get("annual")!);
  });

  it("RRF uses 1/(k + rank) with 1-based ranks", () => {
    const fused = reciprocalRankFusion([["a", "b"], ["b", "c"]], 60);
    expect(fused[0][0]).toBe("b");
    expect(fused[0][1]).toBeCloseTo(1 / 62 + 1 / 61);
  });

  it("the hashing embedder is unit length and sees lexical overlap only", () => {
    const a = hashingEmbed("How do I get a refund?");
    expect(cosine(a, a)).toBeCloseTo(1);
    expect(cosine(a, hashingEmbed("refund request"))).toBeGreaterThan(cosine(a, hashingEmbed("money back")));
  });

  it("scores retrieval by source document", () => {
    expect(scoreRetrieval(["pricing", "pricing", "security"], "security", 1)).toEqual({ hit: false, rr: 0.5, rank: 2 });
    expect(scoreRetrieval(["security"], "security", 1).hit).toBe(true);
  });
});
