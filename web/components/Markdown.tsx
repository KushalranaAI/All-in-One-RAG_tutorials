"use client";
import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import Mermaid from "./Mermaid";
import AskButton from "./ai/AskButton";
import Icon from "./ui/Icon";

type HastNode = { type?: string; value?: string; children?: HastNode[]; properties?: { className?: string[] } };
const hastText = (n: HastNode): string => (n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(hastText).join(""));

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="chip-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable (insecure context) */
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={14} />
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

function CodeBlock({ node, children, askable }: { node?: HastNode; children: React.ReactNode; askable: boolean }) {
  const code = node?.children?.find((c) => (c as { tagName?: string }).tagName === "code");
  const text = code ? hastText(code).replace(/\n$/, "") : "";
  const lang = code?.properties?.className?.find((c) => c.startsWith("language-"))?.slice(9) ?? "";
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span className="codeblock-lang">{lang || "text"}</span>
        <span className="codeblock-actions">
          <CopyButton text={text} />
          {askable && <AskButton quote={text} prompt={`Explain this ${lang || "code"} step by step: what each part does and why it is written this way.`} label="Explain" />}
        </span>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

/** Course markdown: GitHub tables, $math$ / $$math$$ (KaTeX), ```mermaid diagrams and highlighted code. */
export default function Markdown({ children, askable = true }: { children: string; askable?: boolean }) {
  return (
    <div className="prose" data-askable={askable ? "" : undefined}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          code(props) {
            const { className, children, node, ...rest } = props;
            void node;
            if (className?.includes("language-mermaid")) return <Mermaid chart={String(children).trim()} ask={askable} />;
            return <code className={className} {...rest}>{children}</code>;
          },
          pre(props) {
            const child = props.children as { props?: { className?: string } } | undefined;
            if (child?.props?.className?.includes("language-mermaid")) return <>{props.children}</>;
            return <CodeBlock node={props.node as HastNode | undefined} askable={askable}>{props.children}</CodeBlock>;
          },
          table(props) {
            const { node, ...rest } = props;
            void node;
            return <div className="table-wrap"><table {...rest} /></div>;
          },
          a(props) {
            const { node, ...rest } = props;
            void node;
            const external = props.href?.startsWith("http");
            if (props.href?.startsWith("/")) return <Link href={props.href}>{rest.children}</Link>; // keeps the base path on GitHub Pages
            return <a {...rest} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
