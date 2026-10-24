"""Day 03: load a folder of documents (plus optional URL / PDF) and clean the text."""

import argparse
import hashlib
import re
from pathlib import Path

from rag_common.loaders import Document, load_directory, load_file, load_url

DATA = Path(__file__).resolve().parents[2] / "data" / "company_handbook"


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = re.sub(r"[ \t]+", " ", text)        # collapse runs of spaces
    text = re.sub(r"\n{3,}", "\n\n", text)     # at most one blank line
    return text.strip()


def describe(doc: Document) -> None:
    doc.text = clean(doc.text)
    doc.metadata["sha256"] = hashlib.sha256(doc.text.encode()).hexdigest()[:12]
    doc.metadata["chars"] = len(doc.text)
    print(f"- {doc.metadata['title']:<20} {doc.metadata['chars']:>6} chars  sha={doc.metadata['sha256']}")
    print("   " + doc.text[:90].replace("\n", " ") + "...")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="also load a web page")
    parser.add_argument("--pdf", help="also load a PDF file")
    args = parser.parse_args()

    docs = load_directory(DATA)
    if args.url:
        docs.append(load_url(args.url))
    if args.pdf:
        docs.append(load_file(args.pdf))

    print(f"Loaded {len(docs)} documents:\n")
    for doc in docs:
        describe(doc)
