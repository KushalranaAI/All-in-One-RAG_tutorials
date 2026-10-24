"""Graph RAG: extraction, entity resolution, communities, local and global search."""

from __future__ import annotations

import argparse
import json
import random
import re
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from pydantic import BaseModel

from rag_common import FAST_MODEL, INDEX_DIR, ask, handbook_chunks, parse
from rag_common.index import HANDBOOK_DIR

CACHE = INDEX_DIR / "graph_explorer.json"


class Entity(BaseModel):
    name: str
    type: str  # e.g. Plan, Feature, Process, Policy, Region, Team, Metric


class Relation(BaseModel):
    source: str
    relation: str
    target: str


class Extraction(BaseModel):
    entities: list[Entity]
    relations: list[Relation]




def norm(name: str) -> str:
    name = re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()
    name = re.sub(r"^(the|a|an) ", "", name)
    return re.sub(r" (tier|plan)$", " plan", name)


def extract(chunk) -> dict:
    out = parse(
        "Extract the important entities (with a short type) and the factual relations between them from this text. "
        f"Use canonical names.\n\n{chunk.text}",
        Extraction,
        model=FAST_MODEL,
    )
    return {"chunk_id": chunk.metadata["chunk_id"], "text": chunk.text, **out.model_dump()}


def label_propagation(adj: dict[str, set[str]], rounds: int = 10, seed: int = 0) -> dict[str, int]:
    rng = random.Random(seed)
    labels = {n: i for i, n in enumerate(adj)}
    nodes = list(adj)
    for _ in range(rounds):
        rng.shuffle(nodes)
        for n in nodes:
            if adj[n]:
                labels[n] = Counter(labels[m] for m in adj[n]).most_common(1)[0][0]
    return labels


def build(docs: Path) -> dict:
    chunks = handbook_chunks(directory=docs)
    with ThreadPoolExecutor(max_workers=6) as pool:
        extractions = list(pool.map(extract, chunks))

    entities, edges = {}, []
    for ex in extractions:
        for e in ex["entities"]:
            entities.setdefault(norm(e["name"]), {"name": e["name"], "type": e["type"], "chunks": set()})["chunks"].add(ex["chunk_id"])
        for r in ex["relations"]:
            s, t = norm(r["source"]), norm(r["target"])
            for key, raw in ((s, r["source"]), (t, r["target"])):
                entities.setdefault(key, {"name": raw, "type": "Unknown", "chunks": set()})["chunks"].add(ex["chunk_id"])
            edges.append({"source": s, "relation": r["relation"], "target": t, "chunk_id": ex["chunk_id"]})

    adj = defaultdict(set)
    for e in edges:
        adj[e["source"]].add(e["target"])
        adj[e["target"]].add(e["source"])
    for key in entities:
        adj.setdefault(key, set())
    labels = label_propagation(adj)
    groups = defaultdict(list)
    for node, label in labels.items():
        groups[label].append(node)
    communities = [members for members in groups.values() if len(members) >= 3]

    def summarise(members: list[str]) -> dict:
        facts = [f"{e['source']} -[{e['relation']}]-> {e['target']}" for e in edges if e["source"] in members][:60]
        summary = ask("Summarise this cluster of a company knowledge graph in 3-4 sentences, naming its theme:\n" + "\n".join(facts),
                      model=FAST_MODEL, effort="low")
        return {"members": members, "summary": summary}

    with ThreadPoolExecutor(max_workers=6) as pool:
        community_rows = list(pool.map(summarise, communities))

    graph = {
        "entities": {k: {**v, "chunks": sorted(v["chunks"])} for k, v in entities.items()},
        "edges": edges,
        "communities": community_rows,
        "chunks": {ex["chunk_id"]: ex["text"] for ex in extractions},
    }
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(graph, indent=1))
    return graph


def load() -> dict:
    if not CACHE.exists():
        raise SystemExit("Run `graph_rag.py build` first.")
    return json.loads(CACHE.read_text())


class Mentions(BaseModel):
    entities: list[str]


def local_search(graph: dict, question: str, hops: int = 2) -> str:
    mentioned = parse(f"List the entities mentioned in: {question}", Mentions, model=FAST_MODEL).entities
    seeds = {k for m in mentioned for k in graph["entities"] if norm(m) in k or k in norm(m)}
    frontier, seen = set(seeds), set(seeds)
    facts = []
    for _ in range(hops):
        nxt = set()
        for e in graph["edges"]:
            if e["source"] in frontier or e["target"] in frontier:
                facts.append(e)
                nxt |= {e["source"], e["target"]}
        frontier, seen = nxt - seen, seen | nxt
    chunk_ids = list(dict.fromkeys(e["chunk_id"] for e in facts))[:6]
    lines = "\n".join(f"({e['source']}) -[{e['relation']}]-> ({e['target']}) [{e['chunk_id']}]" for e in facts[:80])
    sources = "\n\n".join(f"[{c}]\n{graph['chunks'][c]}" for c in chunk_ids)
    return ask(f"<graph_facts>\n{lines}\n</graph_facts>\n<sources>\n{sources}\n</sources>\n\nQuestion: {question}\n"
               "Answer from the facts and sources, citing [chunk ids].")


def global_search(graph: dict, question: str) -> str:
    def partial(c: dict) -> str:  # map
        return ask(f"Community summary:\n{c['summary']}\n\nWhat does this tell us about: {question}? "
                   "Reply 'NOT RELEVANT' if nothing.", model=FAST_MODEL, effort="low")

    with ThreadPoolExecutor(max_workers=6) as pool:
        partials = [p for p in pool.map(partial, graph["communities"]) if "NOT RELEVANT" not in p]
    return ask("Combine these partial answers into one comprehensive answer:\n\n" + "\n\n---\n\n".join(partials)  # reduce
               + f"\n\nQuestion: {question}")


def entity_info(graph: dict, name: str) -> str:
    key = norm(name)
    matches = [k for k in graph["entities"] if key in k]
    if not matches:
        return f"No entity like {name!r}"
    k = matches[0]
    rel = [f"{e['source']} -[{e['relation']}]-> {e['target']}" for e in graph["edges"] if k in (e["source"], e["target"])]
    return json.dumps({"entity": graph["entities"][k], "relations": rel[:40]}, indent=1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["build", "local", "global", "entity"])
    parser.add_argument("query", nargs="*")
    parser.add_argument("--docs", type=Path, default=HANDBOOK_DIR)
    args = parser.parse_args()
    if args.mode == "build":
        g = build(args.docs)
        print(f"{len(g['entities'])} entities, {len(g['edges'])} relations, {len(g['communities'])} communities")
    else:
        fn = {"local": local_search, "global": global_search, "entity": entity_info}[args.mode]
        print(fn(load(), " ".join(args.query)))
