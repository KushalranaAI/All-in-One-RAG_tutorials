import Dashboard from "@/components/Dashboard";
import { getNav } from "@/lib/navdata";

export default function Home() {
  return <Dashboard nav={getNav()} />;
}
