import type { Metadata } from "next";
import InteractiveMap from "@/components/InteractiveMap";
import TechniqueMap from "@/components/TechniqueMap";
import Icon from "@/components/ui/Icon";
import { getNav } from "@/lib/navdata";

export const metadata: Metadata = { title: "Technique map" };

export default function MapPage() {
  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Icon name="compass" size={14} /> Diagnose</div>
        <h1>Technique map</h1>
        <p className="lead">
          RAG has dozens of named techniques, and most fix one specific failure. Pick an architecture, click any part of it to see how it works and how to change it, or start from the symptom you are seeing.
        </p>
      </header>
      <h2 className="section-title">Explore how RAG systems are built</h2>
      <InteractiveMap nav={getNav()} />
      <p className="muted" style={{ marginTop: 16 }}>
        Look at the retrieved chunks before you change the prompt. Most bad answers are retrieval problems, and you can't tell which fix worked without the Day 14 eval set.
      </p>
      <h2 className="section-title">Symptom → technique</h2>
      <TechniqueMap nav={getNav()} />
    </article>
  );
}
