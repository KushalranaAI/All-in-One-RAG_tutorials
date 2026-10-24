"""Ask questions about a codebase: python code_agent.py <repo> "question" """

import sys

from code_index import CodeIndex

from rag_common import run_tool_loop, tool

SYSTEM = """You are a senior engineer answering questions about a codebase.
Search first, then open files to confirm details. Answer with concrete references like `path/to/file.py:42`.
Quote short code snippets when helpful. If you are unsure, say what you checked."""

if __name__ == "__main__":
    repo, question = sys.argv[1], " ".join(sys.argv[2:]) or "Give me a tour of this repository's architecture."
    code = CodeIndex(repo)
    print(f"Indexed {len(code.files)} files / {len(code.index.chunks)} chunks\n")
    tools = [
        tool("search_code", "Hybrid search over code chunks (functions, classes, files). Returns code with path:line headers.",
             {"query": {"type": "string"}}),
        tool("read_file", "Read lines start..end of a file (1-based, max 400 lines).",
             {"path": {"type": "string"}, "start": {"type": "integer"}, "end": {"type": "integer"}}, ["path"]),
        tool("list_files", "List repository files matching a glob such as '*.py' or 'days/*'.", {"pattern": {"type": "string"}}),
    ]
    handlers = {"search_code": code.search_code, "read_file": code.read_file, "list_files": code.list_files}
    answer, _ = run_tool_loop([{"role": "user", "content": question}], tools, handlers, system=SYSTEM)
    print("\n" + answer)
