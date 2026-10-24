# Project 08 - Meeting Intelligence (multi-agent pipeline)

**Level:** intermediate · **Uses:** Days 12, 22, 24 · **Stack:** parallel extraction agents, structured outputs, RAG over transcripts

Drop meeting transcripts in a folder; get structured minutes for each meeting, a weekly digest, and a
Q&A bot that answers *"what did we decide about the EU launch, and who owns it?"* across all meetings.

```
transcripts/*.txt
   │  (parallel, one extractor agent per meeting — Claude Haiku, structured output)
   ▼
Minutes {summary, decisions[], action_items[{owner, task, due}], open_questions[], topics[]}
   │
   ├─► minutes/<meeting>.md
   ├─► digest writer agent (Opus) ──► minutes/weekly_digest.md
   └─► index: transcript windows + decisions + action items (with meeting/speaker metadata)
              └─► Q&A agent with search tool ─► cited answers [meeting-name]
```

## Run
```bash
python projects/08-meeting-intelligence/meetings.py process          # extract minutes + digest
python projects/08-meeting-intelligence/meetings.py ask "What did we decide about pricing for students?"
python projects/08-meeting-intelligence/meetings.py ask "List every open action item for Ravi"
```

## Patterns used
- **Parallelisation**: independent meetings are processed concurrently.
- **Chaining**: extract → write digest.
- **Indexing structured outputs**: decisions and action items are indexed as their own chunks, so a
  question about decisions retrieves decisions, not small talk.

## Extend it
- Transcribe audio first with a speech-to-text model (Whisper, etc.).
- Push action items to Linear/Jira through their MCP servers.
- Detect contradictions between meetings ("we decided X on Monday, Y on Thursday").
