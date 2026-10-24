"""Day 15: the tool-use loop written out by hand."""

import json

from rag_common import build_handbook_index, create

store = build_handbook_index()

TOOLS = [
    {
        "name": "search_docs",
        "description": "Search the Nimbus Cloud handbook. Returns the most relevant passages with their ids.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "What to search for"}},
            "required": ["query"],
        },
    },
    {
        "name": "calculator",
        "description": "Evaluate an arithmetic expression such as '79 * 12 * 0.5'.",
        "input_schema": {
            "type": "object",
            "properties": {"expression": {"type": "string"}},
            "required": ["expression"],
        },
    },
]


def search_docs(query: str) -> str:
    return "\n\n".join(f"[{h.metadata['chunk_id']}]\n{h.text}" for h in store.search(query, k=3))


def calculator(expression: str) -> str:
    if not set(expression) <= set("0123456789+-*/(). "):
        raise ValueError("only numbers and + - * / ( ) are allowed")
    return str(eval(expression))  # safe: characters are whitelisted above


HANDLERS = {"search_docs": search_docs, "calculator": calculator}

if __name__ == "__main__":
    messages = [{"role": "user", "content": "I'm a student. What would one year of the Pro plan cost me if I pay monthly?"}]

    while True:
        response = create(messages, tools=TOOLS, system="Use the tools to look things up and compute exact numbers.")
        messages.append({"role": "assistant", "content": response.content})
        print(f"[stop_reason={response.stop_reason}]")

        if response.stop_reason != "tool_use":
            break

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"  Claude calls {block.name}({json.dumps(block.input)})")
                try:
                    output, is_error = HANDLERS[block.name](**block.input), False
                except Exception as exc:
                    output, is_error = f"Error: {exc}", True
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": block.id, "content": output, "is_error": is_error}
                )
        messages.append({"role": "user", "content": tool_results})  # all results in ONE message

    print("\nFinal answer:\n" + "".join(b.text for b in response.content if b.type == "text"))
