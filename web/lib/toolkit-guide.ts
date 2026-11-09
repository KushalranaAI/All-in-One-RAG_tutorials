// The guided toolkit: for every rag_common module and MCP server, what it is for, when you would reach for it, its real
// API, a working example, and (for the library) a "build it yourself" step with starter code and a check.
// Pure data, so it can be tested; line counts, source code and lesson links are added from the repo at render time.
// Keep the Python here runnable: scripts/check-toolkit-snippets.mjs executes every example and check.

export type StageId = "ingest" | "retrieve" | "generate" | "agents" | "connect";

export const STAGES: { id: StageId; name: string; blurb: string }[] = [
  { id: "ingest", name: "Ingest", blurb: "Get text in, and cut it up" },
  { id: "retrieve", name: "Retrieve", blurb: "Find the right passages" },
  { id: "generate", name: "Generate", blurb: "Ask the model, grounded" },
  { id: "agents", name: "Agents", blurb: "Let it use tools" },
  { id: "connect", name: "Connect", blurb: "Plug in MCP servers" },
];

export type Tool = {
  id: string; // module name: rag_common/<id>.py
  stage: StageId;
  title: string;
  job: string; // one sentence: what it does for you
  reach: string[]; // "reach for this when…" (the symptom, in the learner's words)
  api: { sig: string; does: string }[];
  example: string; // runnable Python
  expect?: string; // what you should see
  needsKey?: boolean; // the example calls Claude
  build: { goal: string; starter: string; check: string; needsKey?: boolean };
  gotchas: string[];
  days: number[]; // the lessons that build it
  next?: string[]; // tools you usually use next
};

export const TOOLS: Tool[] = [
  {
    id: "loaders",
    stage: "ingest",
    title: "Load documents",
    job: "Turns files and web pages into Document objects: the text, plus where it came from.",
    reach: ["You have a folder of PDFs, Markdown or text files", "You want to index a web page", "Citations are missing a source or title"],
    api: [
      { sig: "load_file(path) -> Document", does: "Read one .md, .txt or .pdf file. PDFs are read page by page." },
      { sig: "load_directory(path, exts=(\".md\", \".txt\", \".pdf\")) -> list[Document]", does: "Every matching file under a folder, in sorted order." },
      { sig: "load_url(url) -> Document", does: "Fetch a web page, drop scripts, nav and footer, keep the page title." },
      { sig: "Document(text, metadata)", does: "metadata always has 'source' (path or URL) and 'title'." },
    ],
    example: `from rag_common import load_directory

docs = load_directory("data/company_handbook")
print(len(docs), "documents")
print(docs[0].metadata)        # {'source': '...', 'title': '...'}
print(docs[0].text[:80])`,
    expect: "A document count, then one document's source and title, then its first characters.",
    build: {
      goal: "Read every Markdown and text file in a folder into Document objects that remember where they came from.",
      starter: `from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Document:
    text: str
    metadata: dict = field(default_factory=dict)


def load_directory(path, exts=(".md", ".txt")):
    docs = []
    for p in sorted(Path(path).rglob("*")):
        if p.suffix.lower() in exts:
            ...  # TODO: read the file as utf-8 text and keep its path as 'source' and p.stem as 'title'
    return docs`,
      check: `docs = load_directory("data/company_handbook")
assert len(docs) >= 5
assert all(d.text.strip() and d.metadata["title"] for d in docs)
print("loaders OK:", len(docs), "documents")`,
    },
    gotchas: [
      "A scanned PDF has no text layer: extraction returns empty strings. Run OCR first.",
      "Keep 'source' and 'title' now. Citations and filters need them later and you cannot add them back.",
      "Web pages often carry cookie banners and menus. Read the extracted text before you index it.",
    ],
    days: [3],
    next: ["chunking"],
  },
  {
    id: "chunking",
    stage: "ingest",
    title: "Split into chunks",
    job: "Cuts each document into passages small enough to match a question and big enough to answer it.",
    reach: ["Answers cut off mid-sentence or lose their heading", "Search finds the right document but the wrong part of it", "You are choosing a chunk size"],
    api: [
      { sig: "chunk_fixed(text, size=800, overlap=100) -> list[str]", does: "Fixed-size windows with overlap. Simplest, ignores structure." },
      { sig: "chunk_recursive(text, size=800, separators=...) -> list[str]", does: "Splits on paragraphs, then lines, then sentences, then words, so pieces end at natural breaks." },
      { sig: "chunk_by_headings(markdown, max_size=1200) -> list[Chunk]", does: "Splits Markdown at headings. Each Chunk remembers its section path in metadata['section']." },
    ],
    example: `from rag_common import chunk_by_headings, load_directory

doc = load_directory("data/company_handbook")[0]
chunks = chunk_by_headings(doc.text, max_size=800)
print(len(chunks), "chunks")
print(chunks[0].metadata)      # {'section': 'Heading > Subheading'}
print(chunks[0].text[:100])`,
    expect: "A chunk count, the section path of the first chunk, and its first characters.",
    build: {
      goal: "Slice text into overlapping windows, so a sentence cut at one border still appears whole in the next piece.",
      starter: `def chunk_fixed(text: str, size: int = 800, overlap: int = 100) -> list[str]:
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")
    step = ...      # TODO: how far does each window move forward?
    return [...]    # TODO: slice text[i : i + size] for every start position i`,
      check: `text = "".join(chr(65 + i % 26) for i in range(2000))
pieces = chunk_fixed(text, size=800, overlap=100)
assert all(len(p) <= 800 for p in pieces)
assert pieces[0][-100:] == pieces[1][:100]      # neighbours share the overlap
print("chunking OK:", len(pieces), "pieces")`,
    },
    gotchas: [
      "There is no best size. Try 400, 800 and 1200 and measure with the Day 14 eval set.",
      "Overlap above about 20% mostly adds duplicates.",
      "Change the chunking and you must re-embed everything.",
    ],
    days: [4],
    next: ["embeddings"],
  },
  {
    id: "embeddings",
    stage: "retrieve",
    title: "Embed text",
    job: "Turns text into vectors, so 'money back' lands near 'refund' even with no shared words.",
    reach: ["Search misses paraphrases", "You want to compare two texts by meaning", "Setup stalls downloading a model"],
    api: [
      { sig: "get_embedder() -> Embedder", does: "The best available embedder, cached. Real sentence embeddings if sentence-transformers is installed, otherwise the offline one." },
      { sig: "embedder.embed(texts) -> ndarray", does: "One row per text, each scaled to length 1, so a dot product is the cosine similarity." },
      { sig: "HashingEmbedder(dim=1024)", does: "No download: hashed words and character n-grams. Runs anywhere, weaker on paraphrases." },
    ],
    example: `from rag_common import get_embedder

emb = get_embedder()                  # RAG_EMBEDDER=hashing forces the offline one
a, b, c = emb.embed(["How do I get a refund?", "Can I get my money back?", "SEV1 pages the on-call"])
print(round(float(a @ b), 2), round(float(a @ c), 2))   # the related pair scores higher`,
    expect: "Two numbers. The first (refund vs money back) should be larger than the second.",
    build: {
      goal: "Build a tiny embedder: hash each word to a column, count, then scale every row to length 1.",
      starter: `import hashlib

import numpy as np


class MyEmbedder:
    dim = 256

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            for word in text.lower().split():
                column = int(hashlib.md5(word.encode()).hexdigest(), 16) % self.dim
                ...  # TODO: add 1 to out[row, column]
        ...          # TODO: divide each row by its length so every row has norm 1
        return out`,
      check: `e = MyEmbedder()
v = e.embed(["refund policy", "refund rules", "on-call rota"])
assert v.shape == (3, 256)
assert abs(float(np.linalg.norm(v[0])) - 1) < 1e-4
assert v[0] @ v[1] > v[0] @ v[2]          # the shared word 'refund' scores higher
print("embeddings OK")`,
    },
    gotchas: [
      "Never mix vectors from two embedders in one index. Nothing errors: the results are just wrong.",
      "The first run with sentence-transformers downloads a model. Set RAG_EMBEDDER=hashing to skip it.",
      "Embed the question with the same model you used for the documents.",
    ],
    days: [2, 5],
    next: ["vectorstore"],
  },
  {
    id: "vectorstore",
    stage: "retrieve",
    title: "Store and search vectors",
    job: "Keeps chunk vectors in memory and returns the closest ones to a question.",
    reach: ["You need the top-k passages for a question", "You want to filter by metadata (document, product)", "You want to save an index and reload it later"],
    api: [
      { sig: "SimpleVectorStore(embedder=None)", does: "An empty store. Uses get_embedder() unless you pass one." },
      { sig: ".add(texts, metadatas=None)", does: "Embed and store texts, each with a metadata dict." },
      { sig: ".search(query, k=4, where=None) -> list[Hit]", does: "Cosine similarity. where={'title': 'pricing'} keeps only exact metadata matches." },
      { sig: ".save(dir) / SimpleVectorStore.load(dir)", does: "Write or read the vectors and records, so you skip re-embedding." },
      { sig: "Hit(text, metadata, score)", does: "One search result." },
    ],
    example: `from rag_common import SimpleVectorStore

store = SimpleVectorStore()
store.add(
    ["Refunds are prorated.", "SEV1 incidents page the on-call."],
    [{"title": "billing"}, {"title": "ops"}],
)
for hit in store.search("money back", k=1):
    print(round(hit.score, 2), hit.metadata, hit.text)`,
    expect: "One line: a score, the metadata and the text of the best match.",
    build: {
      goal: "Build a store that adds texts and returns the best matches for a question.",
      starter: `import numpy as np

from rag_common import get_embedder


class MyStore:
    def __init__(self):
        self.embedder = get_embedder()
        self.texts, self.metas = [], []
        self.vectors = np.zeros((0, self.embedder.dim), dtype=np.float32)

    def add(self, texts, metas=None):
        ...  # TODO: embed the texts, then append vectors, texts and metadata

    def search(self, query, k=4):
        ...  # TODO: scores = self.vectors @ the query vector; return the top k as (score, text, meta)`,
      check: `s = MyStore()
s.add(["Refunds are prorated.", "SEV1 incidents page the on-call."])
best = s.search("money back refund", k=1)[0]
assert "Refunds" in best[1]
print("vector store OK")`,
    },
    gotchas: [
      "Filters are exact matches only: no ranges and no 'contains'.",
      "It is in memory. Save and load it so you do not re-embed on every start.",
      "Fine for thousands of chunks. Move to Chroma or pgvector beyond that.",
    ],
    days: [5],
    next: ["retrieval", "prompts"],
  },
  {
    id: "index",
    stage: "retrieve",
    title: "Handbook index (shortcut)",
    job: "One call that loads, chunks and embeds the sample Nimbus handbook, so you can skip ahead and try the later steps.",
    reach: ["You want to try retrieval or prompts without writing the ingest steps first", "You are past Day 6 and want a ready index", "You need chunks with a chunk_id"],
    api: [
      { sig: "build_handbook_index(max_size=800) -> SimpleVectorStore", does: "Load, chunk by headings, embed and store the handbook." },
      { sig: "handbook_chunks(max_size=800) -> list[Chunk]", does: "The chunks only, each with a chunk_id like 'pricing#3'." },
      { sig: "INDEX_DIR, HANDBOOK_DIR, ROOT_DIR", does: "Paths. RAG_INDEX_DIR moves where caches and saved indexes go." },
    ],
    example: `from rag_common import build_handbook_index

store = build_handbook_index()
print(len(store), "chunks")
for hit in store.search("What is the API rate limit on the Pro plan?", k=2):
    print(round(hit.score, 2), hit.metadata["title"], "|", hit.text[:70])`,
    expect: "A chunk count, then the two best matches with their document titles.",
    build: {
      goal: "Wire the first three tools together: load a folder, chunk each document, store every chunk with its title.",
      starter: `from rag_common import SimpleVectorStore, chunk_by_headings, load_directory


def build_index(folder: str) -> SimpleVectorStore:
    store = SimpleVectorStore()
    for doc in load_directory(folder):
        chunks = ...   # TODO: split doc.text with chunk_by_headings
        ...            # TODO: store.add(the chunk texts, a metadata dict with the doc title on each)
    return store`,
      check: `store = build_index("data/company_handbook")
assert len(store) > 10
hit = store.search("API rate limit", k=1)[0]
print("index OK:", len(store), "chunks; top hit from", hit.metadata.get("title"))`,
    },
    gotchas: [
      "The first run embeds every chunk, so it can take a few seconds. Save the store to skip that next time.",
      "Change the chunk size and you must rebuild the index.",
    ],
    days: [6],
    next: ["retrieval", "prompts"],
  },
  {
    id: "retrieval",
    stage: "retrieve",
    title: "Hybrid search",
    job: "Combines keyword search (BM25) with vector search, so exact terms and paraphrases both get found.",
    reach: ["Search misses error codes, product names or acronyms", "You want better recall without adding a reranker", "You need keyword-only search"],
    api: [
      { sig: "BM25(texts, k1=1.5, b=0.75).search(query, k=4) -> [(index, score)]", does: "Classic keyword scoring. Rare words count for more." },
      { sig: "reciprocal_rank_fusion(rankings, k=60) -> [(id, score)]", does: "Merge ranked lists of ids: each id scores 1 / (k + rank) per list it appears in." },
      { sig: "HybridIndex(chunks).search(query, k=4, where=None, candidates=20) -> list[Chunk]", does: "BM25 and vectors fused with RRF. 'candidates' is how many each side contributes." },
      { sig: "HybridIndex(...).search_text(query, k, where) -> str", does: "The same results as text, each passage prefixed by its chunk id. Handy as an agent tool." },
    ],
    example: `from rag_common import HybridIndex, handbook_chunks

index = HybridIndex(handbook_chunks())
for chunk in index.search("Pro plan rate limit", k=3):
    print(chunk.metadata["chunk_id"], "|", chunk.text[:60])`,
    expect: "Three chunk ids with the start of their text.",
    build: {
      goal: "Write the fusion step: merge several ranked lists so items that appear high in more than one list win.",
      starter: `def reciprocal_rank_fusion(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            ...  # TODO: add 1 / (k + rank + 1) to this document's score
    return sorted(scores.items(), key=lambda item: -item[1])`,
      check: `fused = reciprocal_rank_fusion([["a", "b", "c"], ["b", "c", "d"]])
assert fused[0][0] == "b"                     # b is high in both lists
assert {doc for doc, _ in fused} == {"a", "b", "c", "d"}
print("fusion OK:", [doc for doc, _ in fused])`,
    },
    gotchas: [
      "Both lists must use the same ids, or nothing gets fused.",
      "Fetch more candidates than you return (candidates=20, k=4). Dropped candidates cannot come back.",
      "BM25 knows nothing about synonyms. That is exactly why it is paired with vectors.",
    ],
    days: [8],
    next: ["prompts"],
  },
  {
    id: "prompts",
    stage: "generate",
    title: "Grounded prompts",
    job: "Numbers the retrieved chunks and tells the model to cite them, or say it does not know.",
    reach: ["The model invents facts", "You want [1] [2] citations", "Answers ignore the sources you retrieved"],
    api: [
      { sig: "RAG_SYSTEM", does: "A system prompt: use only the sources, cite like [1], say 'I don't know' when they are silent." },
      { sig: "format_context(hits) -> str", does: "Wraps each hit in <source id=n title=...>, numbered from 1." },
      { sig: "rag_user_prompt(question, hits) -> str  (rag_common.prompts)", does: "The sources and the question in one user message." },
    ],
    example: `from rag_common import RAG_SYSTEM, ask, build_handbook_index
from rag_common.prompts import rag_user_prompt

store = build_handbook_index()
question = "What is the API rate limit on the Pro plan?"
hits = store.search(question, k=4)
print(ask(rag_user_prompt(question, hits), system=RAG_SYSTEM))`,
    expect: "A short answer with [n] citations pointing at the numbered sources.",
    needsKey: true,
    build: {
      goal: "Turn search hits into a numbered, labelled context block the model can cite.",
      starter: `def format_context(hits) -> str:
    blocks = []
    for i, hit in enumerate(hits, 1):
        title = hit.metadata.get("title", "unknown")
        ...  # TODO: append '<source id="i" title="title">' + hit.text + '</source>' to blocks
    return "\\n\\n".join(blocks)`,
      check: `from rag_common import Hit

ctx = format_context([Hit("Refunds are prorated.", {"title": "billing"}, 0.9)])
assert 'id="1"' in ctx and "billing" in ctx and "Refunds are prorated." in ctx
print("prompts OK")`,
    },
    gotchas: [
      "Put the refusal rule in the system prompt, not only in the question.",
      "Keep the numbering stable so a citation [2] always maps back to the same chunk.",
      "If the answer ignores a source, shorten the context before blaming the model.",
    ],
    days: [7],
    next: ["llm"],
  },
  {
    id: "llm",
    stage: "generate",
    title: "Call Claude",
    job: "A thin wrapper over the Anthropic SDK: one-line answers, structured output, streaming and a tool loop.",
    reach: ["You want an answer from the model in one line", "You want JSON that matches a schema", "You want the model to call your Python functions"],
    api: [
      { sig: "ask(prompt, *, system=None, **kwargs) -> str", does: "Prompt in, text out. The one-liner." },
      { sig: "create(messages, *, system, tools, model, max_tokens, effort)", does: "One Messages API call. Returns the raw response." },
      { sig: "parse(prompt, schema, *, system=None) -> schema", does: "Structured output: a validated instance of your Pydantic model." },
      { sig: "stream_text(messages, *, system=None)", does: "Yields text as it arrives. For chat UIs and server-sent events." },
      { sig: "run_tool_loop(messages, tools, handlers, *, system=None, max_turns=12) -> (text, history)", does: "Let Claude call your Python functions until it has an answer." },
      { sig: "MODEL, FAST_MODEL, text_of(response)", does: "The default and cheap model ids, and a helper that joins the text blocks." },
    ],
    example: `from rag_common import ask

print(ask("In one sentence: what is RAG?"))`,
    expect: "One sentence from the model.",
    needsKey: true,
    build: {
      goal: "Write the tool loop: call the model, run any tools it asks for, send the results back, repeat until it answers.",
      needsKey: true,
      starter: `from rag_common import create, text_of, tool


def run_tool_loop(messages, tools, handlers, max_turns=12):
    for _ in range(max_turns):
        response = create(messages, tools=tools)
        messages.append({"role": "assistant", "content": response.content})
        calls = [b for b in response.content if b.type == "tool_use"]
        if not calls:
            return text_of(response)            # no tool requested: this is the answer
        results = []
        for call in calls:
            ...  # TODO: run handlers[call.name](**call.input); append a tool_result block with call.id
        messages.append({"role": "user", "content": results})
    raise RuntimeError("too many turns")`,
      check: `add = tool("add", "Add two numbers", {"a": {"type": "number"}, "b": {"type": "number"}}, ["a", "b"])
answer = run_tool_loop([{"role": "user", "content": "What is 17 + 25? Use the tool."}], [add], {"add": lambda a, b: a + b})
assert "42" in answer
print("tool loop OK:", answer)`,
    },
    gotchas: [
      "Needs ANTHROPIC_API_KEY in your .env.",
      "Always set max_turns. A tool loop without a limit can run, and bill, forever.",
      "Each tool result goes back as a tool_result block in a user message, matching the tool_use id.",
    ],
    days: [1, 6, 15],
    next: ["agents"],
  },
  {
    id: "agents",
    stage: "agents",
    title: "Agents",
    job: "An LLM with a role and a few tools, plus helpers to run several in parallel or let one call another.",
    reach: ["One agent has too many tools", "You want a router and specialists", "You want agents to run at the same time"],
    api: [
      { sig: "tool(name, description, properties, required=None) -> dict", does: "A JSON-schema tool definition Claude can call." },
      { sig: "Agent(name, system, tools=[], handlers={}, model, effort, max_turns)", does: "A role (system prompt) with optional tools." },
      { sig: "agent.run(task) -> str", does: "Do one task. Uses the tool loop when the agent has tools." },
      { sig: "agent.as_tool(description) -> (definition, handler)", does: "Let another agent call this one as a tool named ask_<name>." },
      { sig: "run_parallel([(agent, task), ...], max_workers=4) -> list[str]", does: "Run agents at once. Results keep the input order." },
    ],
    example: `from rag_common import Agent, run_parallel

analyst = Agent("analyst", "You are a careful analyst. Answer in two sentences.")
writer = Agent("writer", "You write friendly, plain-English summaries.")
print(run_parallel([(analyst, "Explain BM25."), (writer, "Explain RRF.")]))`,
    expect: "A list of two short answers, in the order you asked.",
    needsKey: true,
    build: {
      goal: "Build the smallest useful agent: a name, a role, and a run() that sends a task to the model with that role.",
      needsKey: true,
      starter: `from dataclasses import dataclass

from rag_common import ask


@dataclass
class MyAgent:
    name: str
    system: str

    def run(self, task: str) -> str:
        ...  # TODO: one call to ask() that uses this agent's system prompt`,
      check: `poet = MyAgent("poet", "Reply with exactly one short line of verse about the topic.")
answer = poet.run("databases")
assert answer.strip()
print("agent OK:", answer)`,
    },
    gotchas: [
      "Give each agent only the tools it needs. Fewer choices, fewer mistakes.",
      "Parallel agents share nothing. Pass each one the context it needs in its task.",
      "A delegating agent only knows a specialist by its description. Write it as 'call this when…'.",
    ],
    days: [22, 23],
    next: ["mcp_bridge"],
  },
  {
    id: "mcp_bridge",
    stage: "connect",
    title: "MCP bridge",
    job: "Connects Claude to MCP servers: lists their tools, forwards each tool call, returns the results.",
    reach: ["You want your agent to use tools from an MCP server", "You need to limit which tools an agent may call", "You want several servers in one agent"],
    api: [
      { sig: "MCPServerSpec.python(name, script, *args)", does: "A Python MCP server, launched over stdio with the current interpreter." },
      { sig: "MCPServerSpec(name, url=...)", does: "A remote server over streamable HTTP." },
      { sig: "run_mcp_agent(question, servers, *, allowed_tools=None, system=None, local_tools=None, max_turns=15)", does: "An agent loop whose tools come from the servers. Async." },
      { sig: "MCPToolbox(servers)", does: "Keep connections open across many calls: async with MCPToolbox(servers) as toolbox." },
    ],
    example: `import asyncio

from rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent

servers = [MCPServerSpec.python("docs", "mcp_servers/docs_server.py")]
print(asyncio.run(run_mcp_agent("What is the refund policy?", servers)))`,
    expect: "An answer found by calling the docs server's tools. Tool calls are printed as they happen.",
    needsKey: true,
    build: {
      goal: "Give an agent a docs server but only one of its tools: least privilege.",
      needsKey: true,
      starter: `import asyncio

from rag_common.mcp_bridge import MCPServerSpec, run_mcp_agent

servers = [MCPServerSpec.python("docs", "mcp_servers/docs_server.py")]
answer = asyncio.run(
    run_mcp_agent(
        "What is the refund policy?",
        servers,
        allowed_tools=...,   # TODO: a set with just "docs__search_docs"
    )
)
print(answer)`,
      check: `assert "refund" in answer.lower()
print("mcp bridge OK")`,
    },
    gotchas: [
      "Tools are exposed as <server>__<tool>, for example docs__search_docs. Use that name in allowed_tools.",
      "A research agent should not get tickets__create_ticket. Allow only what each agent needs.",
      "stdio servers start as child processes. Run them with the same Python environment (pip install -e .).",
    ],
    days: [21],
  },
];

/** "I'm stuck with…" phrases that jump to the right tool or server. */
export const STUCK: { symptom: string; tool: string }[] = [
  { symptom: "Search misses exact terms: error codes, names, SKUs", tool: "retrieval" },
  { symptom: "Search misses paraphrases ('money back' vs 'refund')", tool: "embeddings" },
  { symptom: "Answers are cut off or lose their heading", tool: "chunking" },
  { symptom: "Garbage text from a PDF or web page", tool: "loaders" },
  { symptom: "The model makes things up", tool: "prompts" },
  { symptom: "I need results from one document or product only", tool: "vectorstore" },
  { symptom: "I want the model to call my Python functions", tool: "llm" },
  { symptom: "One agent is not enough", tool: "agents" },
  { symptom: "Use Claude Desktop or Claude Code with my documents", tool: "docs_server" },
  { symptom: "Let an agent query a database safely", tool: "sql_server" },
];

/* ----------------------------------------------------------------------------------------------- MCP servers */

export type McpServer = {
  id: string; // file name without .py
  name: string; // the name you register it under
  title: string;
  job: string;
  tools: { name: string; args: string; does: string }[];
  resources?: { uri: string; does: string }[];
  needs?: string; // one-time setup
  extraArgs?: string; // flags shown in the run command
  port: number;
  tips?: string[];
  tryAsking: string[];
  safety: string[];
  projects: string[]; // project slugs
};

export const SERVERS: McpServer[] = [
  {
    id: "docs_server",
    name: "nimbus-docs",
    title: "Docs server",
    job: "Hybrid keyword + semantic search over a folder of documents. Gives any MCP-aware app a searchable knowledge base.",
    tools: [
      { name: "search_docs", args: "query, k=4, title=None", does: "Hybrid search. Pass title to look inside one document only." },
      { name: "list_documents", args: "", does: "Every document title with its first heading. Use it to see what exists." },
      { name: "get_document", args: "title", does: "The full text of one document." },
    ],
    resources: [{ uri: "docs://{title}", does: "A document you can attach to a chat as context." }],
    port: 8001,
    tips: ["Use your own documents: add `--docs path/to/your/folder` (Markdown, text or PDF).", "Register it under another name with `--name`, so you can run several."],
    tryAsking: ["What documents do you have about billing?", "What is the refund policy? Quote the source.", "Summarise the incident runbook."],
    safety: ["Read-only: it never writes.", "It serves the folder you point it at, so point it at non-sensitive documents."],
    projects: ["07-data-analyst-agent", "13-support-agent-team-mcp", "15-enterprise-rag-platform"],
  },
  {
    id: "sql_server",
    name: "nimbus-sql",
    title: "SQL server",
    job: "Read-only access to a SQLite database, so an agent can answer questions about numbers and records.",
    tools: [
      { name: "get_schema", args: "", does: "Every table's CREATE statement plus two sample rows. Call this first." },
      { name: "run_sql", args: "query", does: "Runs ONE read-only SELECT (or WITH … SELECT). Results are capped at 200 rows." },
    ],
    needs: "python data/make_sample_db.py   # once: creates data/nimbus.db",
    extraArgs: "--db data/nimbus.db",
    port: 8002,
    tips: ["Point it at your own SQLite file with `--db path/to/file.db`."],
    tryAsking: ["Which Pro customers have overdue invoices?", "How many customers are in each region?", "What does the schema look like?"],
    safety: ["Read-only by design: a single SELECT, a row cap, no writes.", "Still point it at a copy, not a production database."],
    projects: ["07-data-analyst-agent", "12-invoice-intelligence", "15-enterprise-rag-platform"],
  },
  {
    id: "tickets_server",
    name: "nimbus-tickets",
    title: "Tickets server",
    job: "A small support-desk: look up customers, read their tickets, open new ones and hand off to a human.",
    tools: [
      { name: "find_customer", args: "name", does: "Customers whose name contains the text: id, name, plan, region." },
      { name: "list_tickets", args: "customer_id", does: "Past tickets and open support tickets for a customer." },
      { name: "create_ticket", args: "customer_id, subject, severity, summary", does: "Opens a ticket. severity is SEV1, SEV2 or SEV3." },
      { name: "escalate_to_human", args: "ticket_id, reason", does: "Hands a ticket to a person, with the reason." },
    ],
    needs: "python data/make_sample_db.py   # once: creates data/nimbus.db",
    port: 8003,
    tryAsking: ["Find the customer Acme and list their tickets.", "Open a SEV2 ticket for customer 3 about failed logins.", "Escalate ticket 1: the customer is asking for a refund over the limit."],
    safety: ["It WRITES: create_ticket and escalate_to_human add rows to data/support.db (not your main database).", "Give agents that should only read an allowed_tools list without those two."],
    projects: ["13-support-agent-team-mcp", "15-enterprise-rag-platform"],
  },
];

export const MCP_TROUBLE: { problem: string; fix: string }[] = [
  { problem: "The server does not show up in Claude Code", fix: "Run `claude mcp list`. Use an absolute path to the script (`$PWD/mcp_servers/docs_server.py`), then restart Claude Code." },
  { problem: "ModuleNotFoundError: rag_common", fix: "From the repository root run `pip install -e .` with the same Python the server uses. Claude launches the server itself, so its Python must have rag_common installed." },
  { problem: "unable to open database file / no such table", fix: "Create the sample database once: `python data/make_sample_db.py`." },
  { problem: "It works in the terminal but not in Claude Desktop (Windows)", fix: "Use the full path to python.exe and forward slashes in the JSON (C:/Users/you/...), then fully quit and reopen Claude Desktop." },
  { problem: "A tool returns an error and you cannot see why", fix: "Run the server by hand and poke it with the inspector: `npx @modelcontextprotocol/inspector python mcp_servers/docs_server.py`." },
];

export const SETUP: { title: string; cmd: string; note: string }[] = [
  { title: "Install", cmd: "pip install -r requirements.txt\npip install -e .", note: "The second line installs rag_common so every script can import it." },
  { title: "Add your key", cmd: "cp .env.example .env", note: "Then put your ANTHROPIC_API_KEY in .env. Needed for anything that calls Claude." },
  { title: "Make the sample database", cmd: "python data/make_sample_db.py", note: "Once. Needed for the SQL and tickets servers and from Day 26." },
  { title: "Check it works", cmd: "python -c \"from rag_common import build_handbook_index; print(len(build_handbook_index()), 'chunks indexed')\"", note: "Slow first run? Set RAG_EMBEDDER=hashing to skip the model download." },
];
