"use client";
// "On this page" outline with scroll-spy. Reads the headings from the rendered lesson, so it always matches the content.
import { useEffect, useState } from "react";

type Heading = { id: string; text: string; level: number };

export default function Toc({ rootId }: { rootId: string }) {
  const [items, setItems] = useState<Heading[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const scan = () => {
      const seen = new Set<string>();
      const found: Heading[] = [];
      root.querySelectorAll<HTMLElement>("h2, h3").forEach((h, i) => {
        const clone = h.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".katex-mathml").forEach((n) => n.remove());
        const text = clone.textContent?.trim() ?? "";
        if (!text) return;
        let id = h.id || text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || `section-${i}`;
        while (seen.has(id)) id += "-x";
        seen.add(id);
        h.id = id;
        h.style.scrollMarginTop = "88px";
        found.push({ id, text, level: h.tagName === "H2" ? 2 : 3 });
      });
      setItems(found);
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [rootId]);

  useEffect(() => {
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    items.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [items]);

  if (items.length < 3) return null;
  return (
    <nav className="toc" aria-label="On this page">
      <div className="toc-title">On this page</div>
      <ul>
        {items.map((h) => (
          <li key={h.id} className={h.level === 3 ? "sub" : ""}>
            <a href={`#${h.id}`} className={active === h.id ? "active" : ""} aria-current={active === h.id ? "location" : undefined}
               onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); setActive(h.id); }}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
