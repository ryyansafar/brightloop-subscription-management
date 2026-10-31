// Owner: fathima. From/To date filter as a GET form, like the dashboard. Keeps the other filters in the URL.
import { Button, Input, hrefWith, type Params } from "@/components";

interface DateRangeFilterProps {
  basePath: string;
  searchParams: Params;
  from?: string;
  to?: string;
  /** Error to show, e.g. when the end date is before the start date. */
  error?: string;
}

export function DateRangeFilter({ basePath, searchParams, from, to, error }: DateRangeFilterProps) {
  const keep = Object.entries(searchParams).filter(
    ([key, value]) => key !== "from" && key !== "to" && key !== "page" && typeof value === "string",
  ) as [string, string][];
  const active = Boolean(from || to);

  return (
    <form
      action={basePath}
      aria-label="Filter by payment date"
      className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {keep.map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <label className="flex flex-col gap-1 text-sm">
        From
        <Input type="date" name="from" defaultValue={from ?? ""} max={to || undefined} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        To
        <Input type="date" name="to" defaultValue={to ?? ""} min={from || undefined} />
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Apply
        </Button>
        {active && (
          <Button href={hrefWith(basePath, searchParams, { from: undefined, to: undefined, page: undefined })}>
            Clear dates
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
