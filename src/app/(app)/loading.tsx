// Owner: fathima. Shown instantly while a back-office page loads its data (keeps the sidebar visible).
export default function Loading() {
  return (
    <div aria-busy className="animate-pulse">
      <div className="border-b border-line bg-surface px-4 py-4 md:px-6">
        <div className="h-6 w-48 rounded bg-surface-2" />
      </div>
      <div className="flex flex-col gap-3 p-4 md:p-6">
        <div className="h-10 rounded-lg bg-surface-2" />
        <div className="h-64 rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
