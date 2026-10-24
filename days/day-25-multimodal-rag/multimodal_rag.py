"""Day 25: caption-then-embed for images, and native PDF question answering."""

import argparse
import base64
import json
import mimetypes
from pathlib import Path

from rag_common import (
    FAST_MODEL,
    INDEX_DIR,
    ROOT_DIR,
    SimpleVectorStore,
    create,
    text_of,
)

IMAGE_DIR = ROOT_DIR / "data" / "multimodal"
CAPTIONS = INDEX_DIR / "captions.json"


def b64(path: Path) -> str:
    return base64.standard_b64encode(path.read_bytes()).decode()


def image_block(path: Path) -> dict:
    media_type = mimetypes.guess_type(path.name)[0] or "image/png"
    return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64(path)}}


def index_images() -> None:
    captions = {}
    for path in sorted(IMAGE_DIR.glob("*")):
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
            continue
        response = create(
            [{"role": "user", "content": [
                image_block(path),
                {"type": "text", "text": "Describe this image for a search index: what it is, all visible text, "
                 "numbers, labels, and what it shows. Be specific and complete."},
            ]}],
            model=FAST_MODEL,
            effort="low",
        )
        captions[path.name] = text_of(response)
        print(f"captioned {path.name}: {captions[path.name][:80]}...")
    CAPTIONS.parent.mkdir(exist_ok=True)
    CAPTIONS.write_text(json.dumps(captions, indent=1))


def ask_images(question: str, k: int = 2) -> str:
    captions = json.loads(CAPTIONS.read_text())
    store = SimpleVectorStore()
    store.add(list(captions.values()), [{"file": f} for f in captions])
    hits = store.search(question, k=k)
    print("retrieved:", [h.metadata["file"] for h in hits])
    # Retrieval used the captions; the answer uses the ORIGINAL images.
    content = [image_block(IMAGE_DIR / h.metadata["file"]) for h in hits]
    content.append({"type": "text", "text": f"Answer using these images: {question}"})
    return text_of(create([{"role": "user", "content": content}]))


def ask_pdf(pdf: Path, question: str) -> str:
    response = create([{"role": "user", "content": [
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64(pdf)},
         "title": pdf.name, "citations": {"enabled": True}},
        {"type": "text", "text": question},
    ]}])
    out = []
    for block in response.content:
        if block.type == "text":
            pages = {c.start_page_number for c in (block.citations or []) if hasattr(c, "start_page_number")}
            out.append(block.text + (f" (p. {', '.join(map(str, sorted(pages)))})" if pages else ""))
    return "".join(out)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("index")
    a = sub.add_parser("ask")
    a.add_argument("question")
    p = sub.add_parser("pdf")
    p.add_argument("path", type=Path)
    p.add_argument("question")
    args = parser.parse_args()

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    if args.cmd == "index":
        index_images()
    elif args.cmd == "ask":
        print(ask_images(args.question))
    else:
        print(ask_pdf(args.path, args.question))
