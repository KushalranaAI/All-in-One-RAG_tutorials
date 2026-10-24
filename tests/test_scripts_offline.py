"""Run the lesson and project scripts end to end with a schema-aware fake LLM (no API key).

This catches wiring bugs (wrong attribute names, bad tool loops, broken imports). It does not
judge answer quality - for that, run Day 14 / Project 14 with a real API key.
"""

import os
import runpy
import shutil
import sys
import types
import typing
from pathlib import Path

import pytest
from pydantic import BaseModel

import rag_common
import rag_common.agents
import rag_common.llm as llm
import rag_common.mcp_bridge as bridge
from tests.fake_llm import text_response, tool_response

ROOT = Path(__file__).resolve().parents[1]


def dummy(tp):
    """Build a plausible value for any type annotation."""
    origin, args = typing.get_origin(tp), typing.get_args(tp)
    if origin is typing.Literal:
        return args[0]
    if origin in (typing.Union, types.UnionType):
        return dummy(next(a for a in args if a is not type(None)))
    if origin is list:
        return [dummy(args[0]) for _ in range(2)]
    if isinstance(tp, type) and issubclass(tp, BaseModel):
        return tp(**{name: dummy(f.annotation) for name, f in tp.model_fields.items()})
    return {str: "test", int: 1, float: 0.9, bool: True}.get(tp, "test")


def args_for(schema: dict) -> dict:
    out = {}
    for name in schema.get("required", []):
        prop = schema["properties"][name]
        out[name] = prop["enum"][0] if "enum" in prop else {"integer": 1, "number": 1, "boolean": True, "array": []}.get(prop.get("type"), "pricing")
    return out


def fake_create(messages, tools=None, **_):
    last = messages[-1]["content"]
    client_tools = [t for t in tools or [] if "input_schema" in t]
    if client_tools and not (isinstance(last, list) and last and isinstance(last[0], dict) and last[0].get("type") == "tool_result"):
        return tool_response(*[(t["name"], args_for(t["input_schema"])) for t in client_tools[:2]])
    return text_response("Fake answer citing [1].")


def fake_stream(messages, **_):
    yield from ["Fake ", "streamed ", "answer."]


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    monkeypatch.setenv("RAG_EMBEDDER", "hashing")
    monkeypatch.setattr(llm, "create", fake_create)
    monkeypatch.setattr(rag_common, "create", fake_create)
    monkeypatch.setattr(bridge, "create", fake_create)
    parse = lambda prompt, schema, **_: dummy(schema)  # noqa: E731
    for mod in (llm, rag_common):
        monkeypatch.setattr(mod, "parse", parse)
        monkeypatch.setattr(mod, "stream_text", fake_stream)
    ask = lambda prompt, **kw: "Fake answer [1]."  # noqa: E731
    for mod in (llm, rag_common, rag_common.agents):
        monkeypatch.setattr(mod, "ask", ask)
    monkeypatch.setattr(rag_common, "INDEX_DIR", tmp_path / "index")
    sys.path.insert(0, str(ROOT / "data"))
    import make_sample_db

    make_sample_db.build()


SCRIPTS = [
    ("days/day-06-first-rag-pipeline/rag.py", ["Which plan has SSO?"]),
    ("days/day-07-prompting-and-citations/compare_prompts.py", []),
    ("days/day-07-prompting-and-citations/native_citations.py", []),
    ("days/day-09-reranking/rerank.py", []),
    ("days/day-10-query-transformation/query_transform.py", []),
    ("days/day-11-metadata-filtering/self_query.py", []),
    ("days/day-12-parent-document-retrieval/small_to_big.py", []),
    ("days/day-14-evaluation/evaluate.py", ["--judge"]),
    ("days/day-15-tool-use/manual_loop.py", []),
    ("days/day-16-agentic-rag/agent.py", []),
    ("days/day-17-corrective-rag/crag.py", []),
    ("days/day-18-graph-rag/graph_rag.py", []),
    ("days/day-21-mcp-client/mcp_agent.py", ["--multi"]),
    ("days/day-22-multi-agent-patterns/router_and_specialists.py", []),
    ("days/day-23-multi-agent-research/research_team.py", []),
    ("days/day-24-memory-conversational-rag/chat.py", ["--demo"]),
    ("days/day-26-structured-data-sql/sql_agent.py", []),
    ("days/day-28-cost-latency/optimizations.py", []),
    ("days/day-29-guardrails-security/guardrails.py", []),
    ("projects/01-document-chat-assistant/cli.py", ["data/company_handbook", "What does Pro include?"]),
    ("projects/03-codebase-qa-agent/code_agent.py", [".", "Where is BM25?"]),
    ("projects/04-support-reply-copilot/copilot.py", ["samples/refund.txt"]),
    ("projects/07-data-analyst-agent/analyst.py", []),
    ("projects/08-meeting-intelligence/meetings.py", ["process"]),
    ("projects/08-meeting-intelligence/meetings.py", ["ask", "What did we decide?"]),
    ("projects/09-multi-agent-research-team/team.py", ["--no-web", "Summarise our security posture"]),
    ("projects/10-contract-review-agents/review.py", ["samples/vendor_msa.txt"]),
    ("projects/12-invoice-intelligence/invoices.py", ["extract"]),
    ("projects/12-invoice-intelligence/invoices.py", ["ask", "Total spend per vendor?"]),
    ("projects/13-support-agent-team-mcp/support_team.py", ["Acme here, 409 errors on deploy"]),
    ("projects/14-rag-evaluation-lab/lab.py", ["retrieval", "--no-rerank"]),
]

GENERATED = ["projects/07-data-analyst-agent/reports", "projects/08-meeting-intelligence/minutes",
             "projects/09-multi-agent-research-team/report.md", "projects/10-contract-review-agents/review_report.md",
             "projects/14-rag-evaluation-lab/results.csv", "projects/14-rag-evaluation-lab/leaderboard.md",
             "data/invoices.db", "data/support.db"]


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    existed = {p for p in GENERATED if (ROOT / p).exists()}
    yield
    for p in set(GENERATED) - existed:
        target = ROOT / p
        shutil.rmtree(target) if target.is_dir() else target.unlink(missing_ok=True)


@pytest.mark.parametrize("script,argv", SCRIPTS, ids=[f"{s}:{' '.join(a)[:20]}" for s, a in SCRIPTS])
def test_script_runs(script, argv, monkeypatch, capsys):
    path = ROOT / script
    monkeypatch.chdir(ROOT)
    monkeypatch.setattr(sys, "argv", [str(path), *argv])
    monkeypatch.syspath_prepend(str(path.parent))
    for name in ("hybrid", "doc_chat", "code_index", "arxiv_tools", "graph_rag"):  # same-named helper modules
        sys.modules.pop(name, None)
    runpy.run_path(str(path), run_name="__main__")
    assert capsys.readouterr().out.strip()


def test_mcp_servers_start_over_stdio():
    """Every standalone MCP server must start and answer list_tools over a real stdio pipe."""
    import asyncio

    from mcp import Client
    from mcp.client.stdio import StdioServerParameters

    servers = ["mcp_servers/docs_server.py", "mcp_servers/sql_server.py", "mcp_servers/tickets_server.py",
               "days/day-19-mcp-fundamentals/hello_server.py", "days/day-20-build-mcp-server/rag_mcp_server.py",
               "projects/03-codebase-qa-agent/code_mcp_server.py", "projects/05-research-paper-assistant/arxiv_mcp_server.py",
               "projects/06-personal-knowledge-mcp/notes_server.py", "projects/15-enterprise-rag-platform/mcp_server.py"]

    async def tools(script):
        params = StdioServerParameters(command=sys.executable, args=[str(ROOT / script)], cwd=str(ROOT / Path(script).parent),
                                       env={**os.environ, "RAG_EMBEDDER": "hashing"})
        async with Client(params) as c:
            return [t.name for t in (await c.list_tools()).tools]

    for script in servers:
        assert asyncio.run(tools(script)), script
