"""Day 18: build a small knowledge graph with Claude, then answer questions from graph neighbourhoods."""

import json
import sys
from collections import defaultdict

from pydantic import BaseModel

from rag_common import FAST_MODEL, INDEX_DIR, ask, handbook_chunks, parse

CACHE = INDEX_DIR / "graph.json"


class Triple(BaseModel):
    subject: str
    relation: str  # UPPER_SNAKE_CASE, e.g. INCLUDES, COSTS, REQUIRES
    object: str


class Triples(BaseModel):
    triples: list[Triple]


class Entities(BaseModel):
    entities: list[str]


def extract_triples() -> list[dict]:
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    rows = []
    for chunk in handbook_chunks():
        out = parse(
            "Extract factual (subject, relation, object) triples from this text. Use short canonical entity "
            "names (e.g. 'Pro plan', 'Enterprise plan', 'SAML SSO', 'SEV1').\n\n" + chunk.text,
            Triples,
            model=FAST_MODEL,
        )
        rows += [{**t.model_dump(), "source": chunk.metadata["chunk_id"]} for t in out.triples]
    CACHE.parent.mkdir(exist_ok=True)
    CACHE.write_text(json.dumps(rows, indent=1))
    return rows


class KnowledgeGraph:
    def __init__(self, triples: list[dict]):
        self.triples = triples
        self.edges = defaultdict(list)  # entity (lower-case) -> triples touching it
        for t in triples:
            self.edges[t["subject"].lower()].append(t)
            self.edges[t["object"].lower()].append(t)

    def neighbourhood(self, entities: list[str], limit: int = 40) -> list[dict]:
        seen, out = set(), []
        for e in entities:
            for node, triples in self.edges.items():
                if e.lower() in node or node in e.lower():
                    for t in triples:
                        key = (t["subject"], t["relation"], t["object"])
                        if key not in seen:
                            seen.add(key)
                            out.append(t)
        return out[:limit]


def answer(graph: KnowledgeGraph, question: str) -> str:
    entities = parse(f"List the entities (plans, features, processes...) mentioned in: {question}", Entities, model=FAST_MODEL).entities
    facts = graph.neighbourhood(entities)
    print(f"entities={entities} -> {len(facts)} facts")
    lines = "\n".join(f"({t['subject']}) -[{t['relation']}]-> ({t['object']})  [{t['source']}]" for t in facts)
    return ask(
        f"<knowledge_graph_facts>\n{lines}\n</knowledge_graph_facts>\n\nQuestion: {question}\n"
        "Answer using only these facts and cite the [source] ids."
    )


if __name__ == "__main__":
    graph = KnowledgeGraph(extract_triples())
    print(f"Graph: {len(graph.triples)} triples, {len(graph.edges)} entities\n")
    q = " ".join(sys.argv[1:]) or "Which features and guarantees do Enterprise customers get that Pro customers don't?"
    print(answer(graph, q))
