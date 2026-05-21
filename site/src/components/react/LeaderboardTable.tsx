import { useMemo, useState } from 'react';
import type { LeaderboardData, LeaderboardRow } from '@/lib/types';
import { cn, harnessLabel, harnessVersion } from '@/lib/utils';

type SortKey = 'overall' | 'automated' | 'judge';

interface Props {
  data: LeaderboardData;
  labels: {
    rank: string;
    model: string;
    harness: string;
    overall: string;
    automated: string;
    judge: string;
    tasks: string;
    updated: string;
  };
}

export default function LeaderboardTable({ data, labels }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('overall');
  const [filterHarness, setFilterHarness] = useState<string | 'all'>('all');
  const harnessesMeta = data.harnesses;

  const harnesses = useMemo(
    () => Array.from(new Set(data.rows.map((r) => r.harness))).sort(),
    [data.rows]
  );

  const sorted = useMemo<LeaderboardRow[]>(() => {
    const filtered = filterHarness === 'all'
      ? data.rows
      : data.rows.filter((r) => r.harness === filterHarness);
    return [...filtered].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [data.rows, sortKey, filterHarness]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterHarness('all')}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs border transition',
            filterHarness === 'all'
              ? 'bg-brand-700 border-brand-700 text-white'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          All harnesses
        </button>
        {harnesses.map((h) => {
          const display = harnessLabel(h, harnessesMeta);
          const version = harnessVersion(h, harnessesMeta);
          return (
            <button
              key={h}
              type="button"
              onClick={() => setFilterHarness(h)}
              title={version ? `${display} v${version}` : display}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs border transition inline-flex items-baseline gap-1',
                filterHarness === h
                  ? 'bg-brand-700 border-brand-700 text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              <span>{display}</span>
              {version && (
                <span
                  className={cn(
                    'text-[10px] font-mono',
                    filterHarness === h ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'
                  )}
                >
                  v{version}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="text-left px-4 py-2 w-12">{labels.rank}</th>
                <th className="text-left px-3 py-2">{labels.model}</th>
                <th className="text-left px-3 py-2">{labels.harness}</th>
                <SortHeader k="overall"   active={sortKey} onClick={setSortKey}>{labels.overall}</SortHeader>
                <SortHeader k="automated" active={sortKey} onClick={setSortKey}>{labels.automated}</SortHeader>
                <SortHeader k="judge"     active={sortKey} onClick={setSortKey}>{labels.judge}</SortHeader>
                <th className="text-right px-3 py-2">{labels.tasks}</th>
                <th className="text-right px-4 py-2">{labels.updated}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((r, idx) => (
                <tr key={`${r.model}/${r.harness}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                  <td className="px-4 py-2 text-slate-500 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{r.model}</td>
                  <td className="px-3 py-2">
                    <span
                      className="badge bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      title={
                        harnessVersion(r.harness, harnessesMeta)
                          ? `${harnessLabel(r.harness, harnessesMeta)} v${harnessVersion(r.harness, harnessesMeta)}`
                          : harnessLabel(r.harness, harnessesMeta)
                      }
                    >
                      {harnessLabel(r.harness, harnessesMeta)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-brand-700 dark:text-brand-300">
                    {(r.overall * 100).toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{(r.automated * 100).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{(r.judge * 100).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{r.tasks}</td>
                  <td className="px-4 py-2 text-right text-xs text-slate-500">{r.updated}</td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500 text-sm" colSpan={8}>
                    No rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  k, active, onClick, children,
}: { k: SortKey; active: SortKey; onClick: (k: SortKey) => void; children: React.ReactNode }) {
  const isActive = active === k;
  return (
    <th
      className={cn(
        'text-right px-3 py-2 cursor-pointer select-none',
        isActive ? 'text-brand-700 dark:text-brand-300' : 'hover:text-slate-700 dark:hover:text-slate-200'
      )}
      onClick={() => onClick(k)}
    >
      {children}{isActive ? ' ↓' : ''}
    </th>
  );
}
