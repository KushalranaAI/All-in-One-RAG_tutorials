"""Day 19: connect an MCP client to the hello server and explore its capabilities."""

import asyncio

from hello_server import mcp as hello_server
from mcp import Client


async def main():
    # Passing the server object connects in-process. For a real subprocess use
    # Client(StdioServerParameters(command="python", args=["hello_server.py"])).
    async with Client(hello_server) as client:
        tools = (await client.list_tools()).tools
        print("Tools:")
        for t in tools:
            print(f"  {t.name}: {t.description}\n    input schema: {t.input_schema}")

        print("Resources:", [str(r.uri) for r in (await client.list_resources()).resources])
        print("Prompts:  ", [p.name for p in (await client.list_prompts()).prompts])

        result = await client.call_tool("add", {"a": 2, "b": 40})
        print("\ncall_tool add(2, 40) ->", result.content[0].text)

        resource = await client.read_resource("info://today")
        print("read_resource info://today ->", resource.contents[0].text)

        prompt = await client.get_prompt("explain", {"topic": "vector databases"})
        print("get_prompt explain ->", prompt.messages[0].content.text)


if __name__ == "__main__":
    asyncio.run(main())
