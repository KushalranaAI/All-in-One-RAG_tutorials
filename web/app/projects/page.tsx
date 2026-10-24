import type { Metadata } from "next";
import ProjectsList from "@/components/ProjectsList";
import Icon from "@/components/ui/Icon";
import { getNav } from "@/lib/navdata";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <article>
      <header className="page-head">
        <div className="eyebrow"><Icon name="rocket" size={14} /> Build</div>
        <h1>Projects</h1>
        <p className="lead">Fifteen complete applications, from a document chatbot to an enterprise multi-agent platform. After Day 30, pick three to five, point them at your own data, and you have a portfolio.</p>
      </header>
      <ProjectsList projects={getNav().projects} />
    </article>
  );
}
