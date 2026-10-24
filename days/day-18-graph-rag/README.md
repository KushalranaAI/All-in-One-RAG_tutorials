# Day 18 - Graph RAG: knowledge graphs for connected questions

**Goal:** answer questions that need *relationships* across documents, not just similar passages.

## Where vector search struggles
- "Which features are **only** available on Enterprise?" - the answer is scattered across pricing,
  security and FAQ docs; no single chunk says it.
- "What connects SEV1 incidents to the Enterprise SLA?" - multi-hop.
- "Summarise the main themes of the whole corpus" - global questions.

## Graph RAG in three steps
1. **Extract** entities and relations from every chunk with an LLM (structured output):
   `(Enterprise plan) -[INCLUDES]-> (SAML SSO)`, `(Pro plan) -[HAS_BACKUP_RETENTION]-> (30 days)`.
2. **Build** a graph: nodes = entities, edges = relations, each edge remembers its source chunk.
3. **Query**: find the entities mentioned in the question, walk their neighbourhood (1-2 hops), and
   give Claude the **facts (triples) + source chunks**.

```
question ─► entity linking ─► graph neighbourhood ─► triples + chunks ─► Claude ─► answer
```

## Variants
- **Local search** (this lesson): entity neighbourhoods - specific, connected questions.
- **Global search** (Microsoft GraphRAG): cluster the graph into communities, pre-summarise each
  community, answer global questions by map-reducing over community summaries.
- **Hybrid**: vector search for passages + graph for facts in the same prompt.
- Production stacks store graphs in Neo4j / Memgraph / Kùzu and query with Cypher.

## Run it
```bash
python days/day-18-graph-rag/graph_rag.py
```
The first run extracts triples with Claude Haiku and caches them to `.rag_index/graph.json`.

## Exercises
1. Normalise entity names (lower-case, merge "Pro" and "Pro plan") before building the graph.
2. Add 2-hop expansion and compare answers.
3. Load the triples into `networkx` and visualise the graph.
