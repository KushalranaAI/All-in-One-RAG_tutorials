import type { Metadata } from "next";
import Mermaid from "@/components/Mermaid";
import TechniqueMap from "@/components/TechniqueMap";
import Icon from "@/components/ui/Icon";
import { getNav } from "@/lib/navdata";
import { DIAGNOSE } from "@/lib/techniques";

export const metadata: Metadata = { title: "Technique map" };

export default function MapPage() {
  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Icon name="compass" size={14} /> Diagnose</div>
        <h1>Technique map</h1>
        <p className="lead">
          RAG has dozens of named techniques, and most fix one specific failure. Start from what's going wrong, find the technique that targets it, and jump to the day that teaches it.
        </p>
      </header>
      <h2 className="section-title">Where does it go wrong?</h2>
      <Mermaid chart={DIAGNOSE} />
      <p className="muted">
        Look at the retrieved chunks before you change the prompt. Most bad answers are retrieval problems, and you can't tell which fix worked without the Day 14 eval set.
      </p>
      <h2 className="section-title">Symptom → technique</h2>
      <TechniqueMap nav={getNav()} />
    </article>
  );
}
