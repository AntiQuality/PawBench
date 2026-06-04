import { useMemo, useState } from 'react';
import type { LeaderboardData, LeaderboardMatrix } from '@/lib/types';
import { cn, harnessLabel, harnessVersion } from '@/lib/utils';

export type MatrixScope = 'overall' | 'text' | 'multimodal';

interface Props {
  data: LeaderboardData;
  scope?: MatrixScope;
  labels: {
    title: string;
    empty: string;
    delta: string;
    avg: string;
    none: string;
    textOnlyBadge: string;
    textOnlyNote: string;
  };
}

function mean(vs: number[]): number | null {
  if (!vs.length) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

// Text-only models whose overall is dragged down by low multimodal scores.
const TEXT_ONLY_MODELS = new Set(['qwen3.7-max', 'qwen3.6-max-preview', 'glm-5.1']);

function colorFor(v: number | null): string {
  if (v == null) return 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600';
  if (v >= 0.70) return 'bg-brand-700 text-white';
  if (v >= 0.60) return 'bg-brand-500 text-white';
  if (v >= 0.50) return 'bg-brand-300 text-brand-950';
  if (v >= 0.40) return 'bg-brand-200 text-brand-900';
  if (v >= 0.30) return 'bg-amber-200 text-amber-900';
  return 'bg-rose-200 text-rose-900';
}

export default function HarnessMatrix({ data, scope = 'overall', labels }: Props) {
  const { is_mock, harnesses: harnessesMeta } = data;
  const matrix: LeaderboardMatrix =
    scope === 'text'
      ? (data.matrix_text ?? data.matrix)
      : scope === 'multimodal'
        ? (data.matrix_multimodal ?? data.matrix)
        : data.matrix;
  const { harnesses, rows } = matrix;
  const [hoverModel, setHoverModel] = useState<string | null>(null);

  // On the multimodal scope, drop text-only models — they don't actually
  // process image/audio/video; their numbers come from harness-supplied text
  // fallbacks and would mislead the comparison.
  const visibleRows = useMemo(
    () => (scope === 'multimodal'
      ? rows.filter((r) => !TEXT_ONLY_MODELS.has(String(r.model)))
      : rows),
    [rows, scope],
  );

  const enriched = useMemo(() => {
    const mapped = visibleRows.map((r) => {
      const vals = harnesses
        .map((h) => r[h])
        .filter((v): v is number => typeof v === 'number');
      const best = vals.length ? Math.max(...vals) : null;
      const worst = vals.length ? Math.min(...vals) : null;
      const delta = best != null && worst != null ? best - worst : null;
      const avg = mean(vals);
      return { ...r, _best: best, _delta: delta, _avg: avg };
    });
    return mapped.sort((a, b) => (b._avg ?? -Infinity) - (a._avg ?? -Infinity));
  }, [visibleRows, harnesses]);

  const harnessAvgs = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const h of harnesses) {
      const vs = visibleRows
        .map((r) => r[h])
        .filter((v): v is number => typeof v === 'number');
      out[h] = mean(vs);
    }
    return out;
  }, [visibleRows, harnesses]);

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
                    {TEXT_ONLY_MODELS.has(model) && (
                      <span
                        title={labels.textOnlyNote}
                        className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 align-middle text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 ring-1 ring-amber-200 dark:ring-amber-900 cursor-help"
                      >
                        {labels.textOnlyBadge}
                      </span>
                    )}
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
