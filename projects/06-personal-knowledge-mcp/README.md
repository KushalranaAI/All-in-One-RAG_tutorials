# Project 06 - Personal Knowledge Base MCP Server ("second brain")

**Level:** intermediate · **Uses:** Days 08, 12, 19, 20 · **Stack:** MCP tools + resources + prompts, live re-indexing

Turn a folder of Markdown notes (Obsidian, Logseq, plain files) into an MCP server. In Claude Desktop or
Claude Code you can then say *"what did I write about vector databases?"*, *"save this as a note"*, or run
the *weekly review* prompt.

| Primitive | Name | Description |
|-----------|------|-------------|
| tool | `search_notes(query, tag?)` | hybrid search; returns note names + matching passages |
| tool | `read_note(name)` | full note |
| tool | `list_notes(tag?)` | names, tags and modification dates |
| tool | `related_notes(name)` | notes most similar to a given note (embedding neighbours) + `[[wikilinks]]` |
| tool | `create_note(title, content, tags)` | writes a new `.md` file and re-indexes |
| resource | `notes://{name}` | each note as an attachable resource |
| prompt | `weekly_review` | summarise notes changed in the last 7 days and suggest connections |

Tags come from `#hashtags` in the text; links from `[[Wiki Links]]`.

## Run
```bash
python projects/06-personal-knowledge-mcp/test_notes_server.py      # offline smoke test
claude mcp add notes -- python $PWD/projects/06-personal-knowledge-mcp/notes_server.py --notes ~/Documents/notes
```
Claude Desktop config:
```json
{"mcpServers": {"notes": {"command": "python",
  "args": ["/abs/path/projects/06-personal-knowledge-mcp/notes_server.py", "--notes", "/abs/path/to/notes"]}}}
```
Without `--notes` it uses `sample_notes/`.

## Safety
`create_note` only writes inside the notes folder, refuses to overwrite existing notes, and sanitises the
file name. MCP hosts ask the user before running tools - keep write tools clearly named.

## Extend it
- Watch the folder (`watchdog`) and re-index on change.
- Add `append_to_daily_note(text)`.
- Add contextual chunk headers (Day 13) for long notes.
