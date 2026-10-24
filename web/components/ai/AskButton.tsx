"use client";
import Icon, { type IconName } from "../ui/Icon";
import { useAI } from "./AIProvider";

/** A small "ask the tutor about this" action. Drop it next to any piece of content. */
export default function AskButton({
  prompt,
  quote,
  label = "Ask AI",
  send = true,
  icon = "sparkles",
  variant = "chip",
}: {
  prompt: string;
  quote?: string;
  label?: string;
  send?: boolean;
  icon?: IconName;
  variant?: "chip" | "ghost" | "primary";
}) {
  const { ask } = useAI();
  return (
    <button
      type="button"
      className={variant === "chip" ? "chip-btn ask" : `btn ${variant}`}
      onClick={() => ask({ prompt, quote: quote && quote.length > 6000 ? quote.slice(0, 6000) + "\n…" : quote, send })}
    >
      <Icon name={icon} size={variant === "chip" ? 14 : 16} />
      <span>{label}</span>
    </button>
  );
}
