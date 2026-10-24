export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 18, width: 140, marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 40, width: "60%", marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 20, width: "80%", marginBottom: 28 }} />
      <div className="skeleton" style={{ height: 260 }} />
    </div>
  );
}
