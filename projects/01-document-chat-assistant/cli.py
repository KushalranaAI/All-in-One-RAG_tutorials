"""Command-line version: python cli.py <folder> "question" """

import sys
from pathlib import Path

from doc_chat import DocChat

if __name__ == "__main__":
    folder, question = Path(sys.argv[1]), " ".join(sys.argv[2:])
    files = [(p.name, p.read_bytes()) for p in folder.rglob("*") if p.suffix.lower() in {".pdf", ".md", ".txt"}]
    sources, stream = DocChat(files).ask(question)
    for delta in stream:
        print(delta, end="", flush=True)
    print("\n\nSources:", ", ".join(c.metadata["chunk_id"] for c in sources))
