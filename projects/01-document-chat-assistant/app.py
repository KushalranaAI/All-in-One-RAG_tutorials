"""Streamlit UI: upload documents and chat with them."""

import streamlit as st
from doc_chat import DocChat

st.set_page_config(page_title="Document Chat", page_icon="📄")
st.title("📄 Chat with your documents")

files = st.sidebar.file_uploader("Upload PDF, Markdown or text files", type=["pdf", "md", "txt"], accept_multiple_files=True)
if files:
    key = tuple(sorted((f.name, f.size) for f in files))
    if st.session_state.get("key") != key:
        with st.spinner("Indexing..."):
            st.session_state.chat = DocChat([(f.name, f.getvalue()) for f in files])
            st.session_state.key, st.session_state.messages = key, []
        st.sidebar.success(f"Indexed {len(st.session_state.chat.index.chunks)} chunks")

if "chat" not in st.session_state:
    st.info("Upload one or more documents in the sidebar to start.")
    st.stop()

for m in st.session_state.messages:
    st.chat_message(m["role"]).write(m["content"])

if question := st.chat_input("Ask a question about your documents"):
    st.chat_message("user").write(question)
    sources, stream = st.session_state.chat.ask(question)
    with st.chat_message("assistant"):
        answer = st.write_stream(stream)
        with st.expander("Sources"):
            for i, c in enumerate(sources, 1):
                page = f", page {c.metadata['page']}" if "page" in c.metadata else ""
                st.markdown(f"**[{i}] {c.metadata['title']}{page}**\n\n{c.text}")
    st.session_state.messages += [{"role": "user", "content": question}, {"role": "assistant", "content": answer}]
