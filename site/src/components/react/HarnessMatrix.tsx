import { useMemo, useState } from 'react';
import type { LeaderboardData } from '@/lib/types';
import { cn, harnessLabel, harnessVersion } from '@/lib/utils';

interface Props {
  data: LeaderboardData;
  labels: {
    title: string;
    empty: string;
    delta: string;
    avg: string;
    none: string;
  };
}

function mean(vs: number[]): number | null {
  if (!vs.length) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

function colorFor(v: number | null): string {
  if (v == null) return 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600';
  if (v >= 0.70) return 'bg-brand-700 text-white';
  if (v >= 0.60) return 'bg-brand-500 text-white';
  if (v >= 0.50) return 'bg-brand-300 text-brand-950';
  if (v >= 0.40) return 'bg-brand-200 text-brand-900';
  if (v >= 0.30) return 'bg-amber-200 text-amber-900';
  return 'bg-rose-200 text-rose-900';
}

export default function HarnessMatrix({ data, labels }: Props) {
  const { matrix, is_mock, harnesses: harnessesMeta } = data;
  const { harnesses, rows } = matrix;
  const [hoverModel, setHoverModel] = useState<string | null>(null);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const vals = harnesses
        .map((h) => r[h])
        .filter((v): v is number => typeof v === 'number');
      const best = vals.length ? Math.max(...vals) : null;
      const worst = vals.length ? Math.min(...vals) : null;
      const delta = best != null && worst != null ? best - worst : null;
      const avg = mean(vals);
      return { ...r, _best: best, _delta: delta, _avg: avg };
    });
  }, [rows, harnesses]);

  const harnessAvgs = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const h of harnesses) {
      const vs = rows
        .map((r) => r[h])
        .filter((v): v is number => typeof v === 'number');
      out[h] = mean(vs);
    }
    return out;
  }, [rows, harnesses]);

  const grandAvg = useMemo(() => {
    const vs = enriched
      .map((r) => r._avg)
      .filter((v): v is number => typeof v === 'number');
    return mean(vs);
  }, [enriched]);

  if (!enriched.length) {
    return <div className="text-sm text-slate-500">{labels.empty}</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {is_mock && (
        <div className="px-4 py-2 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900">
          {labels.empty}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="text-left px-4 py-2 font-medium">Model</th>
              {harnesses.map((h) => {
                const display = harnessLabel(h, harnessesMeta);
                const version = harnessVersion(h, harnessesMeta);
                return (
                  <th
                    key={h}
                    className="px-3 py-2 font-medium text-center normal-case align-bottom"
                    title={version ? `${display} v${version}` : display}
                  >
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {display}
                    </div>
                    {version && (
                      <div className="text-[10px] font-mono font-normal text-slate-400 dark:text-slate-500 normal-case tracking-normal">
                        v{version}
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="px-3 py-2 font-medium text-center border-l border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900">
                {labels.avg}
              </th>
              <th className="px-3 py-2 font-medium text-right">{labels.delta}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {enriched.map((r) => {
              const model = String(r.model);
              return (
                <tr
                  key={model}
                  onMouseEnter={() => setHoverModel(model)}
                  onMouseLeave={() => setHoverModel(null)}
                  className={cn(
                    'transition',
                    hoverModel === model ? 'bg-slate-50 dark:bg-slate-900/40' : ''
                  )}
                >
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {model}
                  </td>
                  {harnesses.map((h) => {
                    const v = typeof r[h] === 'number' ? (r[h] as number) : null;
                    return (
                      <td key={h} className="p-1 text-center">
                        <div
                          className={cn(
                            'rounded-md px-2 py-1.5 text-xs tabular-nums font-medium',
                            colorFor(v)
                          )}
                          title={v != null ? `${(v * 100).toFixed(1)}%` : labels.none}
                        >
                          {v != null ? (v * 100).toFixed(1) : '—'}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-1 text-center border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <div
                      className={cn(
                        'rounded-md px-2 py-1.5 text-xs tabular-nums font-semibold',
                        colorFor(r._avg)
                      )}
                      title={r._avg != null ? `${(r._avg * 100).toFixed(1)}%` : labels.none}
                    >
                      {r._avg != null ? (r._avg * 100).toFixed(1) : '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {r._delta != null ? `+${(r._delta * 100).toFixed(1)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 text-xs">
              <th className="text-left px-4 py-2 font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {labels.avg}
              </th>
              {harnesses.map((h) => {
                const v = harnessAvgs[h];
                return (
                  <td key={h} className="p-1 text-center">
                    <div
                      className={cn(
                        'rounded-md px-2 py-1.5 text-xs tabular-nums font-semibold',
                        colorFor(v)
                      )}
                      title={v != null ? `${(v * 100).toFixed(1)}%` : labels.none}
                    >
                      {v != null ? (v * 100).toFixed(1) : '—'}
                    </div>
                  </td>
                );
              })}
              <td className="p-1 text-center border-l border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900">
                <div
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs tabular-nums font-bold ring-1 ring-slate-300 dark:ring-slate-700',
                    colorFor(grandAvg)
                  )}
                  title={grandAvg != null ? `${(grandAvg * 100).toFixed(1)}%` : labels.none}
                >
                  {grandAvg != null ? (grandAvg * 100).toFixed(1) : '—'}
                </div>
              </td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
