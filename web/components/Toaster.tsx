"use client";
import Link from "next/link";
import { dismiss, useToasts } from "@/lib/toast";
import Icon from "./ui/Icon";

export default function Toaster() {
  const toasts = useToasts();
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <Icon name={t.tone === "good" ? "circle-check" : t.tone === "bad" ? "alert" : "info"} size={18} />
          <span>{t.text}</span>
          {t.action && (
            <Link href={t.action.href} className="toast-action" onClick={() => dismiss(t.id)}>
              {t.action.label} <Icon name="arrow-right" size={14} />
            </Link>
          )}
          <button type="button" className="icon-btn sm" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
