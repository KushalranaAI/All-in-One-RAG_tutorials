"""Day 01: the same question with no context, wrong context, and the right context."""

from pathlib import Path

import anthropic

DATA = Path(__file__).resolve().parents[2] / "data" / "company_handbook"
MODEL = "claude-opus-5-5"

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

SYSTEM = (
    "Answer the user's question. If context is provided, answer only from it and name the document "
    "you used. If you cannot answer from the context, say you don't know."
)
QUESTION = "How many days do I have to get a refund on a monthly Nimbus Cloud plan?"


def ask(question: str, context: str | None = None) -> str:
    content = question if context is None else f"<context>\n{context}\n</context>\n\n{question}"
    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM,
        output_config={"effort": "low"},  # simple Q&A doesn't need deep thinking
        messages=[{"role": "user", "content": content}],
    )
    print(f"   (tokens in={response.usage.input_tokens}, out={response.usage.output_tokens})")
    return "".join(block.text for block in response.content if block.type == "text")


if __name__ == "__main__":
    print("1) No context:")
    print(ask(QUESTION), "\n")

    print("2) Wrong context (security.md):")
    print(ask(QUESTION, (DATA / "security.md").read_text()), "\n")

    print("3) Right context (refund_policy.md):")
    print(ask(QUESTION, "Document: refund_policy.md\n" + (DATA / "refund_policy.md").read_text()))
