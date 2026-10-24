"""Day 15: the same agent using the SDK's tool runner - you only write the functions."""

import anthropic
from anthropic import beta_tool

from rag_common import MODEL, build_handbook_index

store = build_handbook_index()


@beta_tool
def search_docs(query: str) -> str:
    """Search the Nimbus Cloud handbook and return the most relevant passages.

    Args:
        query: What to search for.
    """
    return "\n\n".join(f"[{h.metadata['chunk_id']}]\n{h.text}" for h in store.search(query, k=3))


if __name__ == "__main__":
    runner = anthropic.Anthropic().beta.messages.tool_runner(
        model=MODEL,
        max_tokens=16000,
        output_config={"effort": "medium"},
        tools=[search_docs],
        messages=[{"role": "user", "content": "Which regions does Nimbus run in, and is there one in India?"}],
    )
    for message in runner:  # one iteration per model turn; tools run automatically in between
        for block in message.content:
            if block.type == "tool_use":
                print(f"  -> {block.name}({block.input})")
            elif block.type == "text":
                print(block.text)
