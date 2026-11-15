"use client";
// The Studio reads its saved design and ?preset= from the browser, so it renders on the client only.
import dynamic from "next/dynamic";

const StudioPage = dynamic(() => import("./StudioPage"), {
  ssr: false,
  loading: () => <p className="muted small" style={{ padding: 24 }}>Loading the Studio…</p>,
});

export default function StudioLoader() {
  return <StudioPage />;
}
