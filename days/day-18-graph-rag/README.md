# Day 18 - Graph RAG: knowledge graphs for connected questions

**Goal:** answer questions that need *relationships* across documents, not just similar passages.

## In everyday life

Picture a railway timetable book. Each page lists one train and its stops. You ask, "Can I get from Station A to Station B with one change, and where?" No single page says so. You have to join facts from several pages, and that is easier on a route map, with stations as dots and trains as lines.

**Graph RAG** builds that map from your documents. A model reads every chunk and writes down facts as **triples** (small facts shaped as thing, relation, thing, such as "Enterprise plan includes SAML SSO"). Together the triples form a **knowledge graph** (a network where dots are things and lines are relationships). At question time the system finds the things your question names, follows their lines one or two steps, and hands Claude those facts plus the original passages.

Similarity search finds passages that sound alike. The graph finds facts that are connected. Unlike a printed rail map, this graph is drawn by a model, so it can miss or misread a link.

**Where you meet it.** A help bot is asked which features exist only on the top plan. The answer is spread across the pricing, security and FAQ pages, so similar-text search returns scattered pieces. The graph shows which features connect to which plans, so the bot can list the right ones.

```scene
title: Building a route map from timetables
step: 📄 Each timetable page lists some stops, and no page answers the trip | Facts scattered across chunks
step: ✂️ Someone reads every page and notes each link as a from-to pair | Extract triples with an LLM
step: 🗺️ The pairs are drawn as dots and lines on one map | Build the knowledge graph
step: 📍 You mark the stations your question mentions | Entity linking
step: 👣 You follow the lines one or two stops out from each mark | Walk the graph neighbourhood
step: 🧳 You give the traveller the links plus the pages they came from | Triples and source chunks to Claude
takeaway: When the answer lives in the links between facts, build a graph of them.
```

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
