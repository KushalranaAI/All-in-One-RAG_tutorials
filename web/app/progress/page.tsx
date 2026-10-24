import type { Metadata } from "next";
import ProgressPage from "@/components/ProgressPage";
import { getNav } from "@/lib/navdata";

export const metadata: Metadata = { title: "My progress" };

export default function Page() {
  return <ProgressPage nav={getNav()} />;
}
