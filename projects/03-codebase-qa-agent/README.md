# Project 03 - Codebase Q&A Agent (+ MCP server)

**Level:** intermediate · **Uses:** Days 04, 08, 16, 20 · **Stack:** Python `ast`, hybrid search, tool-using agent, MCP

Ask questions about any code repository: *"Where is the vector search implemented?"*, *"How does the MCP
bridge route tool calls?"*. The agent searches code, opens files, and answers with `path:line` references.

```
repo ─► code-aware chunker ──► HybridIndex
         • Python: one chunk per function/class (via ast), with signature + docstring + line range
         • other files: 60-line windows
agent tools: search_code(query) · read_file(path, start, end) · list_files(pattern)
```
The same tools are also served as an **MCP server**, so Claude Code / Claude Desktop can use your index.

## Why code needs its own chunking
Splitting code every N characters cuts functions in half. Chunking by **syntax** (functions, classes)
gives each chunk one meaning, and the `path:start-end` metadata makes answers verifiable. BM25 matters a
lot here - identifiers like `reciprocal_rank_fusion` are exact-match terms.

## Run
```bash
python projects/03-codebase-qa-agent/code_agent.py . "How does the MCP bridge decide which server to call?"
python projects/03-codebase-qa-agent/code_agent.py /path/to/other/repo "Where is authentication handled?"

# as an MCP server for Claude Code:
claude mcp add code-search -- python $PWD/projects/03-codebase-qa-agent/code_mcp_server.py --repo $PWD
```

## Extend it
- Use tree-sitter to chunk JavaScript/TypeScript/Go by syntax too.
- Add a `find_references(symbol)` tool using BM25 on the identifier.
- Index the git log (`git log -p`) so it can answer "why was this changed?".
