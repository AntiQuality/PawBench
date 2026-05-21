import { useEffect, useMemo, useState } from 'react';
import type { LeaderboardData, StatsData } from '@/lib/types';
import { cn, harnessLabel, harnessVersion } from '@/lib/utils';

type Dim =
  | 'complexity'
  | 'capability'
  | 'modality'
  | 'environment'
  | 'scenario_top'
  | 'source';

interface Props {
  data: LeaderboardData;
  stats: StatsData;
  labels: {
    dim: string;
    dims: Partial<
      Record<
        | Dim
        | 'bucket.title'
        | 'bucket.help'
        | 'pivot.summary'
        | 'pivot.taskCount'
        | 'pivot.bestCol'
        | 'noModelData',
        string
      >
    >;
  };
}

interface DimSpec {
  statsField: keyof StatsData;
  rowField:
    | 'by_complexity' | 'by_capability' | 'by_modality'
    | 'by_environment' | 'by_source' | 'by_scenario_top'
    | null;
  topN?: number;
}

// Order = display order in the picker, mirroring the fields under `task.labels`
// in the markdown frontmatter (plus the implicit `source`).
const DIM_ORDER: Dim[] = [
  'complexity', 'modality', 'environment',
  'capability',
  'scenario_top',
  'source',
];

const DIM_SPEC: Record<Dim, DimSpec> = {
  complexity:    { statsField: 'complexity',   rowField: 'by_complexity',   topN: 10 },
  modality:      { statsField: 'modality',     rowField: 'by_modality',     topN: 4  },
  environment:   { statsField: 'environment',  rowField: 'by_environment',  topN: 4  },
  capability:    { statsField: 'capabilities', rowField: 'by_capability',   topN: 8  },
  scenario_top:  { statsField: 'scenario_top', rowField: 'by_scenario_top', topN: 8  },
  source:        { statsField: 'sources',      rowField: 'by_source',       topN: 8  },
};

function colorFor(v: number | null | undefined): string {
  if (v == null) return 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600';
  if (v >= 0.70) return 'bg-brand-700 text-white';
  if (v >= 0.55) return 'bg-brand-500 text-white';
  if (v >= 0.40) return 'bg-brand-300 text-brand-950';
  if (v >= 0.25) return 'bg-amber-200 text-amber-900';
  return 'bg-rose-200 text-rose-900';
}

function l(labels: Props['labels'], key: string, fallback: string): string {
  return (labels.dims as Record<string, string>)[key] ?? fallback;
}

export default function SliceAnalyzer({ data, stats, labels }: Props) {
  const [dim, setDim] = useState<Dim>('complexity');
  const [bucket, setBucket] = useState<string | null>(null);
  const [showAllBuckets, setShowAllBuckets] = useState(false);

  const spec = DIM_SPEC[dim];
  const taskCounts = (stats[spec.statsField] || {}) as Record<string, number>;
  const totalBuckets = Object.keys(taskCounts).length;

  const allBuckets = useMemo(
    () => Object.entries(taskCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k),
    [taskCounts]
  );

  const visibleBuckets = useMemo(
    () => (showAllBuckets ? allBuckets : allBuckets.slice(0, spec.topN ?? allBuckets.length)),
    [allBuckets, showAllBuckets, spec.topN]
  );

  // Reset bucket selection when dimension changes; default to the largest one.
  useEffect(() => {
    setShowAllBuckets(false);
    setBucket(allBuckets[0] ?? null);
  }, [dim, allBuckets]);

  return (
    <div className="space-y-5">
      {/* Combined picker — dimension + specific value live in one card */}
      <Card
        step="1"
        title={labels.dim}
        hint={l(labels, 'bucket.help', 'Pick a dimension, then a value → see model × harness scores on that subset of tasks')}
      >
        {/* Dimension row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
            {labels.dim}
          </span>
          {DIM_ORDER.map((d) => {
            const total = Object.keys((stats[DIM_SPEC[d].statsField] || {}) as Record<string, number>).length;
            const active = dim === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDim(d)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs border transition inline-flex items-center gap-1.5',
                  active
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <span>{labels.dims[d] ?? d}</span>
                <span className={cn(
                  'text-[10px] px-1 rounded',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                )}>{total}</span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-800" />

        {/* Bucket row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
            {l(labels, 'bucket.title', 'Value')}
          </span>
          {visibleBuckets.map((b) => {
            const active = bucket === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBucket(b)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs border transition inline-flex items-center gap-1.5',
                  active
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
                title={b}
              >
                <span className={cn(
                  'inline-block w-2.5 h-2.5 rounded-full border',
                  active ? 'bg-white border-white' : 'border-slate-300 dark:border-slate-600'
                )} />
                <span>{truncate(b, 28)}</span>
                <span className={cn(
                  'text-[10px] px-1 rounded',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                )}>{taskCounts[b]}</span>
              </button>
            );
          })}
          {totalBuckets > visibleBuckets.length && (
            <button
              type="button"
              onClick={() => setShowAllBuckets(true)}
              className="px-2.5 py-1 rounded-full text-xs border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              +{totalBuckets - visibleBuckets.length} more
            </button>
          )}
          {showAllBuckets && totalBuckets > (spec.topN ?? totalBuckets) && (
            <button
              type="button"
              onClick={() => setShowAllBuckets(false)}
              className="px-2.5 py-1 rounded-full text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline"
            >
              show top {spec.topN}
            </button>
          )}
        </div>
      </Card>

      {/* Result — model × harness on the selected bucket */}
      {bucket
        ? (
          <PivotMatrix
            data={data}
            rowField={spec.rowField}
            bucketLabel={bucket}
            taskCount={taskCounts[bucket] ?? 0}
            labels={labels}
          />
        ) : null
      }

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>Legend:</span>
        <Legend bg="bg-rose-200" tx="text-rose-900">&lt; 25</Legend>
        <Legend bg="bg-amber-200" tx="text-amber-900">25–40</Legend>
        <Legend bg="bg-brand-300" tx="text-brand-950">40–55</Legend>
        <Legend bg="bg-brand-500" tx="text-white">55–70</Legend>
        <Legend bg="bg-brand-700" tx="text-white">≥ 70</Legend>
        <span className="ml-2">·</span>
        <span>Cells = mean score (×100) on the tasks in that bucket</span>
      </div>
    </div>
  );
}

/* ── building blocks ──────────────────────────────────────────────────────── */

function Card({
  step,
  title,
  hint,
  children,
}: {
  step: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900 rounded px-1.5 py-0.5">
          {step}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        {hint && (
          <span className="text-xs text-slate-400 dark:text-slate-500 normal-case font-normal">
            · {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function PivotMatrix({
  data, rowField, bucketLabel, taskCount, labels,
}: {
  data: LeaderboardData;
  rowField: DimSpec['rowField'];
  bucketLabel: string;
  taskCount: number;
  labels: Props['labels'];
}) {
  const { models, harnesses, cellMap, anyData } = useMemo(() => {
    const ms: string[] = [];
    const hs: string[] = [];
    const cm = new Map<string, number | null>();
    let any = false;
    for (const r of data.rows) {
      if (!ms.includes(r.model)) ms.push(r.model);
      if (!hs.includes(r.harness)) hs.push(r.harness);
      const sub = rowField ? ((r as Record<string, unknown>)[rowField] as Record<string, number> | undefined) : undefined;
      const v = sub && typeof sub[bucketLabel] === 'number' ? sub[bucketLabel] : null;
      if (v != null) any = true;
      cm.set(`${r.model}/${r.harness}`, v);
    }
    hs.sort();
    ms.sort((a, b) => {
      const bestA = Math.max(...hs.map((h) => cm.get(`${a}/${h}`) ?? -Infinity));
      const bestB = Math.max(...hs.map((h) => cm.get(`${b}/${h}`) ?? -Infinity));
      return bestB - bestA;
    });
    return { models: ms, harnesses: hs, cellMap: cm, anyData: any };
  }, [data.rows, rowField, bucketLabel]);

  return (
    <div>
      {!anyData && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 mb-3">
          {l(labels, 'noModelData', 'Submissions don\'t include this dimension yet.')}
        </div>
      )}
      <div className="rounded-xl border border-brand-200 dark:border-brand-900 overflow-hidden">
        <div className="px-4 py-2 bg-brand-50 dark:bg-brand-950/40 border-b border-brand-100 dark:border-brand-900 flex items-center justify-between text-xs">
          <span className="font-semibold text-brand-800 dark:text-brand-200">
            {l(labels, 'pivot.summary', 'Model × Harness on').replace('{bucket}', bucketLabel)}
          </span>
          <span className="text-brand-700/70 dark:text-brand-300/70">
            {taskCount} {l(labels, 'pivot.taskCount', 'tasks')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2 sticky left-0 bg-slate-50 dark:bg-slate-900/50">Model \ Harness</th>
                {harnesses.map((h) => {
                  const display = harnessLabel(h, data.harnesses);
                  const version = harnessVersion(h, data.harnesses);
                  return (
                    <th
                      key={h}
                      className="px-3 py-2 text-center font-medium normal-case align-bottom"
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
                <th className="px-3 py-2 text-right font-medium">{l(labels, 'pivot.bestCol', 'best')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {models.map((m) => {
                const vals = harnesses
                  .map((h) => cellMap.get(`${m}/${h}`))
                  .filter((v): v is number => typeof v === 'number');
                const best = vals.length ? Math.max(...vals) : null;
                return (
                  <tr key={m}>
                    <td className="px-4 py-2 sticky left-0 bg-white dark:bg-slate-950 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {m}
                    </td>
                    {harnesses.map((h) => {
                      const v = cellMap.get(`${m}/${h}`) ?? null;
                      return (
                        <td key={h} className="p-1 text-center">
                          <div
                            className={cn('rounded-md px-2 py-1.5 text-xs tabular-nums', colorFor(v))}
                            title={v != null ? `${(v * 100).toFixed(1)}%` : 'no data'}
                          >
                            {v == null ? '—' : (v * 100).toFixed(1)}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-brand-700 dark:text-brand-300">
                      {best == null ? '—' : (best * 100).toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Legend({ bg, tx, children }: { bg: string; tx: string; children: React.ReactNode }) {
  return <span className={cn('px-1.5 py-0.5 rounded font-mono text-[10px]', bg, tx)}>{children}</span>;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
