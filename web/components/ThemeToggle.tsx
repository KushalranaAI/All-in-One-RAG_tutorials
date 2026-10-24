"use client";
import { useEffect, useState } from "react";
import { type ThemePref, applyTheme, getThemePref } from "@/lib/theme";
import Icon from "./ui/Icon";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const ICON = { system: "monitor", light: "sun", dark: "moon" } as const;
const LABEL = { system: "Match system", light: "Light", dark: "Dark" } as const;

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");
  useEffect(() => setPref(getThemePref()), []);

  // follow the OS while on "system"
  useEffect(() => {
    if (pref !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);

  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => {
        applyTheme(next);
        setPref(next);
      }}
      aria-label={`Theme: ${LABEL[pref]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[pref]}`}
    >
      <Icon name={ICON[pref]} />
    </button>
  );
}
