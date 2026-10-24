"""MCP server over a folder of Markdown notes: search, read, relate, create, weekly review."""

import argparse
import re
import sys
import time
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from rag_common import Chunk, HybridIndex
from rag_common.chunking import chunk_by_headings

TAG = re.compile(r"(?<![\w#])#([A-Za-z][\w-]*)")
LINK = re.compile(r"\[\[([^\]]+)\]\]")


class NotesIndex:
    def __init__(self, folder: Path):
        self.folder = folder.resolve()
        self.reload()

    def reload(self) -> None:
        self.notes = {p.stem: p for p in sorted(self.folder.rglob("*.md"))}
        chunks = []
        for name, path in self.notes.items():
            text = path.read_text(errors="ignore")
            tags = sorted(set(TAG.findall(text)))
            for i, c in enumerate(chunk_by_headings(text, 800) or [Chunk(text)]):
                c.metadata.update(note=name, chunk_id=f"{name}#{i}", tags=tags)
                chunks.append(c)
        self.index = HybridIndex(chunks or [Chunk("(no notes yet)", {"note": "", "chunk_id": "empty", "tags": []})])
        print(f"indexed {len(self.notes)} notes", file=sys.stderr)

    def text(self, name: str) -> str:
        if name not in self.notes:
            raise ToolError(f"No note {name!r}. Try list_notes or search_notes.")
        return self.notes[name].read_text(errors="ignore")


def build_server(folder: Path) -> MCPServer:
    idx = NotesIndex(folder)
    mcp = MCPServer("notes", instructions="The user's personal notes. Refer to notes by name, e.g. (from: vector-databases).")

    @mcp.tool()
    def search_notes(query: str, tag: str | None = None, k: int = 5) -> str:
        """Search notes by meaning and keywords. Optionally only notes with a #tag (without the #)."""
        hits = [c for c in idx.index.search(query, k=k * 3) if not tag or tag in c.metadata["tags"]][:k]
        return "\n\n".join(f"(from: {c.metadata['note']})\n{c.text}" for c in hits) or "No matching notes."

    @mcp.tool()
    def read_note(name: str) -> str:
        """Return the full Markdown of a note by name (file name without .md)."""
        return idx.text(name)

    @mcp.tool()
    def list_notes(tag: str | None = None) -> str:
        """List notes with tags and last-modified date, optionally filtered by tag."""
        rows = []
        for name, path in idx.notes.items():
            tags = sorted(set(TAG.findall(path.read_text(errors="ignore"))))
            if not tag or tag in tags:
                rows.append(f"- {name}  [{', '.join(tags)}]  modified {time.strftime('%Y-%m-%d', time.localtime(path.stat().st_mtime))}")
        return "\n".join(rows) or "No notes."

    @mcp.tool()
    def related_notes(name: str, k: int = 3) -> str:
        """Notes most similar to the given note, plus the notes it links to with [[wikilinks]]."""
        text = idx.text(name)
        similar = []
        for c in idx.index.dense.search(text[:2000], k=k * 4):
            if c.metadata["note"] not in (name, *similar):
                similar.append(c.metadata["note"])
        return f"similar: {similar[:k]}\nlinks to: {LINK.findall(text)}"

    @mcp.tool()
    def create_note(title: str, content: str, tags: list[str] | None = None) -> str:
        """Create a NEW note (never overwrites). Tags are added as #hashtags under the title."""
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
        if not slug:
            raise ToolError("title must contain letters or numbers")
        path = idx.folder / f"{slug}.md"
        if path.exists():
            raise ToolError(f"A note named {slug!r} already exists")
        tag_line = " ".join(f"#{t.lstrip('#')}" for t in tags or [])
        path.write_text(f"# {title}\n{tag_line}\n\n{content}\n")
        idx.reload()
        return f"created note {slug!r}"

    @mcp.resource("notes://{name}")
    def note_resource(name: str) -> str:
        """A note as an attachable resource."""
        return idx.text(name)

    @mcp.prompt()
    def weekly_review() -> str:
        """Review the notes changed in the last 7 days."""
        week_ago = time.time() - 7 * 86400
        recent = [n for n, p in idx.notes.items() if p.stat().st_mtime > week_ago]
        return (
            f"These notes changed this week: {', '.join(recent) or 'none'}. Read each one with read_note, then give me: "
            "1) a 5-bullet summary of what I worked on, 2) connections between notes I may have missed "
            "(use related_notes), 3) three questions worth exploring next."
        )

    return mcp


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--notes", type=Path, default=Path(__file__).parent / "sample_notes")
    build_server(parser.parse_args().notes).run()
