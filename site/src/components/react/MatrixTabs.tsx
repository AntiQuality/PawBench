import { useMemo, useState } from 'react';
import HarnessMatrix, { type MatrixScope } from './HarnessMatrix';
import type { LeaderboardData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TabLabel {
  key: MatrixScope;
  label: string;
  hint: string;
  count?: number;
}

interface Props {
  data: LeaderboardData;
  tabs: TabLabel[];
  matrixLabels: {
    title: string;
    empty: string;
    delta: string;
    avg: string;
    none: string;
    textOnlyBadge: string;
    textOnlyNote: string;
  };
  notes?: Partial<Record<MatrixScope, string>>;
}

export default function MatrixTabs({ data, tabs, matrixLabels, notes }: Props) {
  const [scope, setScope] = useState<MatrixScope>(tabs[0]?.key ?? 'overall');

  const activeTab = useMemo(
    () => tabs.find((t) => t.key === scope) ?? tabs[0],
    [scope, tabs],
  );

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Matrix scope"
        className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-1"
      >
        {tabs.map((t) => {
          const active = t.key === scope;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setScope(t.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition inline-flex items-baseline gap-1.5',
                active
                  ? 'bg-white dark:bg-slate-950 text-brand-700 dark:text-brand-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              )}
              title={t.hint}
            >
              <span>{t.label}</span>
              {typeof t.count === 'number' && (
                <span
                  className={cn(
                    'text-[10px] tabular-nums font-mono',
                    active ? 'text-brand-500 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab?.hint && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{activeTab.hint}</p>
      )}

      {notes?.[scope] && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <span className="font-semibold shrink-0">⚠</span>
          <span>{notes[scope]}</span>
        </div>
      )}

      <HarnessMatrix data={data} scope={scope} labels={matrixLabels} />
    </div>
  );
}
