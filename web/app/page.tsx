import Dashboard from "@/components/Dashboard";
import PathGuide from "@/components/PathGuide";
import { getNav } from "@/lib/navdata";

export default function Home() {
  return (
    <>
      <Dashboard nav={getNav()} />
      <PathGuide current="rag" />
    </>
  );
}
