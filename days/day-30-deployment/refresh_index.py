"""Day 30: incremental indexing - only re-embed documents whose content changed."""

import argparse
import hashlib
import json
from pathlib import Path

from rag_common import INDEX_DIR, SimpleVectorStore
from rag_common.chunking import chunk_by_headings
from rag_common.index import HANDBOOK_DIR
from rag_common.loaders import load_directory


def refresh(docs_dir: Path, index_dir: Path) -> None:
    manifest_path = index_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    store = SimpleVectorStore.load(index_dir) if (index_dir / "records.json").exists() else SimpleVectorStore()

    docs = {d.metadata["source"]: d for d in load_directory(docs_dir)}
    current = {src: hashlib.sha256(d.text.encode()).hexdigest() for src, d in docs.items()}
    changed = {s for s, h in current.items() if manifest.get(s) != h}
    removed = set(manifest) - set(current)

    if not changed and not removed:
        print("index is up to date")
        return

    # Drop chunks of changed or removed documents, then add fresh chunks for changed ones.
    keep = [i for i, m in enumerate(store.metadatas) if m["source"] not in changed | removed]
    fresh = SimpleVectorStore(store.embedder)
    fresh.texts = [store.texts[i] for i in keep]
    fresh.metadatas = [store.metadatas[i] for i in keep]
    fresh.vectors = store.vectors[keep] if keep else fresh.vectors
    for src in sorted(changed):
        chunks = chunk_by_headings(docs[src].text)
        fresh.add([c.text for c in chunks], [{**docs[src].metadata, **c.metadata} for c in chunks])

    fresh.save(index_dir)
    manifest_path.write_text(json.dumps(current, indent=1))
    print(f"re-indexed {len(changed)} changed, removed {len(removed)}; index now has {len(fresh)} chunks")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs", type=Path, default=HANDBOOK_DIR)
    parser.add_argument("--index", type=Path, default=INDEX_DIR / "handbook")
    args = parser.parse_args()
    refresh(args.docs, args.index)
