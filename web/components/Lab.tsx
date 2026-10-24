"use client";
// Every interactive visual in one place, one at a time, with links back to the days that use it.
import Link from "next/link";
import { useEffect, useState } from "react";
import { type Nav, allLessons, dayLabel } from "@/lib/nav";
import { useResolvedTheme } from "@/lib/theme";
import { usePageContext } from "./ai/AIProvider";
import AskButton from "./ai/AskButton";
import Icon from "./ui/Icon";
import { type LabData, WIDGETS } from "./widgets";

const KEYS = Object.keys(WIDGETS);

export default function Lab({ data, nav }: { data: LabData; nav: Nav }) {
  const [active, setActive] = useState(KEYS[0]);
  const theme = useResolvedTheme();
  const lessons = allLessons(nav);

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (KEYS.includes(h)) setActive(h);
  }, []);
  const choose = (k: string) => {
    setActive(k);
    history.replaceState(null, "", `#${k}`);
  };

  const w = WIDGETS[active];
  usePageContext({ key: `lab:${active}`, kind: "lab", title: w.title, focus: `the interactive visual “${w.title}”`, text: `${w.title}: ${w.blurb}\nIt runs the course's rag_common algorithms in the browser on the sample Nimbus Cloud handbook (${data.docs.map((d) => d.name).join(", ")}).` });

  return (
    <div className="lab">
      <nav className="lab-nav card" aria-label="Visuals">
        <div className="lab-list">
          <div>
            {KEYS.map((k) => (
              <button key={k} type="button" className={`lab-item ${active === k ? "active" : ""}`} aria-current={active === k ? "true" : undefined} onClick={() => choose(k)}>
                {WIDGETS[k].title}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <section className="widget-frame" style={{ minWidth: 0 }}>
        <div className="widget-head">
          <h2>{w.title}</h2>
          <AskButton label="What should I try?" prompt={`Explain what the interactive visual “${w.title}” demonstrates, and give me three experiments to try with its controls and what I should notice each time.`} />
        </div>
        <p className="muted" style={{ marginTop: 0 }}>{w.blurb}</p>
        <div className="meta-row" style={{ marginBottom: 14 }}>
          <span className="muted small"><Icon name="book" size={13} /> Used on</span>
          {w.days.map((d) => {
            const l = lessons.find((x) => x.order === d);
            return l ? <Link key={d} href={`${l.href}#try`} className="pill accent">{dayLabel(d)} · {l.title}</Link> : null;
          })}
        </div>
        <w.Component key={`${active}-${theme}`} data={data} />
      </section>
    </div>
  );
}
