import Link from "next/link";
import Icon from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <div className="empty-page">
      <Icon name="map" size={36} />
      <h1>That page isn&apos;t on the map</h1>
      <p className="lead">The lesson may have been renamed. Search for it with Ctrl&nbsp;K, or head back to the dashboard.</p>
      <Link href="/" className="btn primary">Back to the dashboard</Link>
    </div>
  );
}
