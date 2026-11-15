import type { Metadata } from "next";
import StudioLoader from "@/components/studio/StudioLoader";

export const metadata: Metadata = { title: "Studio" };

export default function StudioRoute() {
  return (
    <div className="studio-page">
      <StudioLoader />
    </div>
  );
}
