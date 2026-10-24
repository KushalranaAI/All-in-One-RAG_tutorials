import asyncio
from pathlib import Path

import rag_common.mcp_bridge as bridge
from tests.fake_llm import ScriptedLLM, text_response, tool_response

DAYS = Path(__file__).resolve().parents[1] / "days"


def test_stdio_multi_server(monkeypatch):
    seen = {}

    def final(messages, tools):
        seen["tools"] = [t["name"] for t in tools]
        seen["results"] = messages[-1]["content"]
        return text_response("done")

    fake = ScriptedLLM([
        tool_response(("handbook__search_docs", {"query": "refund", "k": 1}), ("calc__calculate", {"expression": "790*0.85"})),
        final,
    ])
    monkeypatch.setattr(bridge, "create", fake)
    servers = [
        bridge.MCPServerSpec.python("handbook", str(DAYS / "day-20-build-mcp-server" / "rag_mcp_server.py")),
        bridge.MCPServerSpec.python("calc", str(DAYS / "day-21-mcp-client" / "calculator_server.py")),
    ]
    assert asyncio.run(bridge.run_mcp_agent("q", servers, verbose=False)) == "done"
    assert "handbook__search_docs" in seen["tools"] and "calc__calculate" in seen["tools"]
    search, calc = seen["results"]
    assert "refund_policy#" in search["content"]
    assert calc["content"] == "671.5"


def test_shared_toolbox_and_allow_list(monkeypatch):
    seen = []

    def final(messages, tools):
        seen.append(([t["name"] for t in tools], messages[-1]["content"]))
        return text_response("ok")

    fake = ScriptedLLM([tool_response(("calc__calculate", {"expression": "1+1"})), final])
    monkeypatch.setattr(bridge, "create", fake)
    calc = bridge.MCPServerSpec.python("calc", str(DAYS / "day-21-mcp-client" / "calculator_server.py"))
    handbook = bridge.MCPServerSpec.python("handbook", str(DAYS / "day-20-build-mcp-server" / "rag_mcp_server.py"))

    async def go():
        async with bridge.MCPToolbox([calc, handbook]) as box:
            return await bridge.run_mcp_agent("q", toolbox=box, allowed_tools={"handbook__search_docs"}, verbose=False)

    assert asyncio.run(go()) == "ok"
    tools, results = seen[0]
    assert tools == ["handbook__search_docs"]          # calc tools hidden from this agent
    assert results[0]["is_error"] and "not allowed" in results[0]["content"]
