// Owner: fathima. Dashboard skeleton: filter bar, two rows of KPI tiles and the chart, so nothing jumps when data arrives.
const TILES = ["a", "b", "c", "d"] as const;

function TileRow({ label }: { label: string }) {
  return (
    <div aria-hidden role="presentation" data-row={label} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {TILES.map((t) => (
        <div key={t} className="h-20 rounded-lg border border-line bg-surface-2 sm:h-24" />
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" role="status" className="animate-pulse">
      <div className="border-b border-line bg-surface px-4 py-4 md:px-6">
        <div className="h-6 w-40 rounded bg-surface-2" />
      </div>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="h-24 rounded-lg bg-surface-2 sm:h-20" />
        <TileRow label="recurring" />
        <TileRow label="billing" />
        <div className="h-72 rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
