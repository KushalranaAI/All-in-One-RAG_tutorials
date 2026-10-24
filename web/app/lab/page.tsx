import type { Metadata } from "next";
import Lab from "@/components/Lab";
import Icon from "@/components/ui/Icon";
import { getLabData } from "@/lib/content";
import { getNav } from "@/lib/navdata";

export const metadata: Metadata = { title: "Retrieval lab" };

export default function LabPage() {
  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Icon name="flask" size={14} /> Play</div>
        <h1>Retrieval lab</h1>
        <p className="lead">
          Chunk, embed, search, fuse and evaluate the course&apos;s sample handbook without leaving the browser. These are the <code>rag_common</code> algorithms ported to TypeScript: no Python, no API key.
        </p>
      </header>
      <Lab data={getLabData()} nav={getNav()} />
    </article>
  );
}
