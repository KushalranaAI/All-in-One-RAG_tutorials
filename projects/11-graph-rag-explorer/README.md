# Project 11 - Graph RAG Explorer (local + global search, MCP)

**Level:** advanced · **Uses:** Days 18, 20 · **Stack:** LLM triple extraction, entity resolution, communities, map-reduce, MCP

A fuller Graph RAG implementation in the spirit of Microsoft GraphRAG, built with plain Python:

1. **Extract** entities (with types) and relations from every chunk - Claude Haiku, structured output.
2. **Resolve** duplicate entities ("Pro", "Pro plan", "the Pro tier" → `pro plan`).
3. **Detect communities** with label propagation and **summarise** each community.
4. Two query modes:
   - **local** - entity neighbourhood (1-2 hops) + source chunks → precise, connected questions
   - **global** - map-reduce over community summaries → "what are the main themes?" questions
5. Serve it as an **MCP server**: `graph_local_search`, `graph_global_search`, `entity_lookup`.

## Run
```bash
python projects/11-graph-rag-explorer/graph_rag.py build                  # extract + communities (cached)
python projects/11-graph-rag-explorer/graph_rag.py local "What does Enterprise include that Pro doesn't?"
python projects/11-graph-rag-explorer/graph_rag.py global "What are the main themes of this knowledge base?"
python projects/11-graph-rag-explorer/graph_rag.py build --docs path/to/your/docs
claude mcp add graph -- python $PWD/projects/11-graph-rag-explorer/graph_mcp_server.py
```
The graph is cached in `.rag_index/graph_explorer.json`.

## Extend it
- Export to Neo4j (`MERGE (a)-[:REL]->(b)`) and query with Cypher.
- Weight edges by how many chunks mention a relation.
- Combine with vector search in one prompt (hybrid Graph RAG).
