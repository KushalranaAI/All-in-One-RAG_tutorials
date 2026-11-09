"use client";
import { useEffect, useState } from "react";
import { type ThemePref, applyTheme, getThemePref } from "@/lib/theme";
import Icon from "./ui/Icon";

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("dark");
  useEffect(() => setPref(getThemePref()), []);

  const next: ThemePref = pref === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => {
        applyTheme(next);
        setPref(next);
      }}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <Icon name={pref === "dark" ? "sun" : "moon"} />
    </button>
  );
}
