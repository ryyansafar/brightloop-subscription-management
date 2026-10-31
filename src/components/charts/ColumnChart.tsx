"use client";
// Owner: fathima. Grouped column chart (one y-axis, up to 3 series) with hover/focus tooltip,
// a legend and a table view. Series colours come from the --series-N tokens in globals.css.
import { useEffect, useRef, useState } from "react";

export interface ColumnSeries {
  name: string;
}

export interface ColumnPoint {
  label: string; // short axis label, e.g. "Jan 26"
  title: string; // full label for tooltip and table, e.g. "January 2026"
  values: number[]; // one per series, same order
}

interface ColumnChartProps {
  title: string;
  series: ColumnSeries[];
  data: ColumnPoint[];
  formatValue: (v: number) => string; // tooltip and table
  formatTick: (v: number) => string; // compact axis labels
  height?: number;
}

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3, var(--muted))"];
const M = { top: 12, right: 8, bottom: 28, left: 56 };

/** Clean tick step (1/2/2.5/5 × 10^n) for about `ticks` gridlines; the axis ends at the first tick above the data. */
function niceMax(max: number, ticks = 5) {
  if (max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return { top: step * Math.ceil(max / step), step };
}

/** Column with a 4px rounded cap, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function ColumnChart({ title, series, data, formatValue, formatTick, height = 260 }: ColumnChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { top, step } = niceMax(Math.max(0, ...data.flatMap((d) => d.values)));
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const band = data.length ? innerW / data.length : 0;
  const groupW = band * 0.7;
  const colW = Math.max(1, (groupW - 2 * (series.length - 1)) / series.length); // 2px gap between columns
  const y = (v: number) => M.top + innerH - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  // On narrow screens label every other month.
  const labelEvery = band < 34 ? 2 : 1;

  return (
    <figure className="rounded-lg border border-line bg-surface p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLORS[i] }} />
              {s.name}
            </span>
          ))}
        </span>
      </figcaption>

      <div ref={box} className="relative mt-3" style={{ height }} onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${title}, column chart. Table view below.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                  {formatTick(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x0 = M.left + i * band;
              const gx = x0 + (band - groupW) / 2;
              const label = `${d.title}: ${series.map((s, k) => `${s.name} ${formatValue(d.values[k])}`).join(", ")}`;
              return (
                <g
                  key={d.label}
                  tabIndex={0}
                  role="img"
                  aria-label={label}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                >
                  {/* Hit target is the whole month band, bigger than the columns. */}
                  <rect x={x0} y={M.top} width={band} height={innerH} fill={active === i ? "var(--surface-2)" : "transparent"} />
                  {d.values.map((v, k) => {
                    const h = Math.max(0, M.top + innerH - y(v));
                    return h > 0 ? (
                      <path key={k} d={columnPath(gx + k * (colW + 2), y(v), colW, h)} fill={COLORS[k]} />
                    ) : null;
                  })}
                  {i % labelEvery === 0 && (
                    <text x={x0 + band / 2} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={M.left} x2={width - M.right} y1={M.top + innerH} y2={M.top + innerH} stroke="var(--muted)" strokeWidth={1} />
          </svg>
        )}

        {active !== null && data[active] && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-md"
            style={
              M.left + (active + 0.5) * band > width / 2
                ? { right: width - (M.left + active * band) + 8 }
                : { left: M.left + (active + 1) * band + 8 }
            }
          >
            <p className="mb-1 font-semibold">{data[active].title}</p>
            {series.map((s, k) => (
              <p key={s.name} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span aria-hidden className="size-2 rounded-sm" style={{ background: COLORS[k] }} />
                  {s.name}
                </span>
                <span className="font-medium tabular-nums">{formatValue(data[active].values[k])}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-muted hover:text-foreground">Show as table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="py-1 text-left font-medium">Month</th>
                {series.map((s) => (
                  <th key={s.name} className="py-1 text-right font-medium">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-t border-line">
                  <td className="py-1">{d.title}</td>
                  {d.values.map((v, k) => (
                    <td key={k} className="py-1 text-right">
                      {formatValue(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
