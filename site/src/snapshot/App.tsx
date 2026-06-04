import { useEffect, useMemo, useState } from 'react';
import HarnessMatrix from '@/components/react/HarnessMatrix';
import LeaderboardTable from '@/components/react/LeaderboardTable';
import SliceAnalyzer from '@/components/react/SliceAnalyzer';
import TaskExplorer from '@/components/react/TaskExplorer';
import { renderMarkdownLite } from '@/lib/markdown-lite';
import type { LeaderboardData, StatsData, TaskRecord } from '@/lib/types';

type Locale = 'zh' | 'en';
type TabId = 'leaderboard' | 'slice' | 'tasks' | 'blog';

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  author: string;
  tags: string[];
  body: string;
}

interface SnapshotData {
  generatedAt: string;
  stats: StatsData;
  leaderboard: LeaderboardData;
  tasks: TaskRecord[];
  blog: Record<Locale, BlogPost[]>;
  labels: Record<Locale, Record<string, unknown>>;
}

declare global {
  interface Window {
    __PAWBENCH__: SnapshotData;
  }
}

const TABS: Array<{ id: TabId; key: string }> = [
  { id: 'leaderboard', key: 'tab.leaderboard' },
  { id: 'slice',       key: 'tab.slice' },
  { id: 'tasks',       key: 'tab.tasks' },
  { id: 'blog',        key: 'tab.blog' },
];

function getLabel(L: Record<string, unknown>, key: string, fallback = ''): string {
  const v = L[key];
  return typeof v === 'string' ? v : fallback;
}

export default function App() {
  const D = window.__PAWBENCH__;
  const [locale, setLocale] = useState<Locale>('zh');
  const [tab, setTab] = useState<TabId>('leaderboard');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Sync tab + locale to URL hash so links can be shared.
  useEffect(() => {
    const m = /^#\/(zh|en)\/(leaderboard|slice|tasks|blog)/.exec(window.location.hash);
    if (m) {
      setLocale(m[1] as Locale);
      setTab(m[2] as TabId);
    }
  }, []);
  useEffect(() => {
    const next = `#/${locale}/${tab}`;
    if (window.location.hash !== next) {
      window.history.replaceState({}, '', next);
    }
  }, [locale, tab]);

  const L = D.labels[locale] as Record<string, unknown>;
  const t = (k: string, fb = '') => getLabel(L, k, fb);

  const matrixLabels = {
    title: t('leaderboard.matrix.title'),
    empty: t('leaderboard.matrix.empty'),
    avg:   t('leaderboard.matrix.avg', 'Avg'),
    delta: 'Δ',
    none:  '—',
    textOnlyBadge: t('leaderboard.matrix.textOnlyBadge', 'text-only'),
    textOnlyNote:  t('leaderboard.matrix.note', ''),
  };

  const tableLabels = {
    rank:      t('leaderboard.col.rank', '#'),
    model:     t('leaderboard.col.model', 'Model'),
    harness:   t('leaderboard.col.harness', 'Harness'),
    overall:   t('leaderboard.col.overall', 'Overall'),
    automated: t('leaderboard.col.automated', 'Automated'),
    judge:     t('leaderboard.col.judge', 'Judge'),
    tasks:     t('leaderboard.col.tasks', 'Tasks'),
    updated:   t('leaderboard.col.updated', 'Updated'),
  };

  const sliceLabels = {
    dim: t('slice.dim'),
    dims: {
      complexity:    t('slice.dim.complexity'),
      modality:      t('slice.dim.modality'),
      environment:   t('slice.dim.environment'),
      capability:    t('slice.dim.capability'),
      scenario_top:  t('slice.dim.scenario_top'),
      source:        t('slice.dim.source'),
      'bucket.title':     t('slice.bucket.title'),
      'bucket.help':      t('slice.bucket.help'),
      'pivot.summary':    t('slice.pivot.summary'),
      'pivot.taskCount':  t('slice.pivot.taskCount'),
      'pivot.avgCol':     t('slice.pivot.avgCol'),
      'pivot.rowAvg':     t('leaderboard.matrix.avg'),
      noModelData:        t('slice.noModelData'),
    },
  };

  const tasksLabels = {
    search:     t('tasks.filter.search'),
    source:     t('tasks.filter.source'),
    complexity: t('tasks.filter.complexity'),
    capability: t('tasks.filter.capability'),
    modality:   t('tasks.filter.modality'),
    grading:    t('tasks.filter.grading'),
    reset:      t('tasks.filter.reset'),
    empty:      t('tasks.empty'),
    count:      t('tasks.count'),
    modal: {
      prompt:       t('tasks.modal.prompt'),
      expected:     t('tasks.modal.expected'),
      grading:      t('tasks.modal.grading'),
      viewOnGitHub: t('tasks.modal.viewOnGitHub'),
      close:        t('tasks.modal.close'),
    },
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Topbar
        locale={locale}
        onLocale={setLocale}
        dark={dark}
        onDark={setDark}
        title={t('site.title', 'PawBench')}
        snapshotLabel={t('snapshot.badge', 'Snapshot')}
        generatedAt={D.generatedAt}
        tab={tab}
        onTab={setTab}
        tabLabels={TABS.map((tb) => ({ id: tb.id, label: t(tb.key, tb.id) }))}
      />

      {tab === 'leaderboard' && (
        <Hero
          totalTasks={D.stats.total}
          tagline={t('site.tagline')}
          formula={t('hero.formula', 'Agent Performance = f(Model, Harness)')}
          description={t('site.description')}
          stats={[
            { value: D.stats.total, label: t('hero.stats.tasks', 'Tasks') },
            { value: Object.keys(D.stats.sources || {}).length, label: t('hero.stats.sources', 'Sources') },
            { value: (D.leaderboard.matrix?.harnesses?.length ?? 0), label: t('hero.stats.harnesses', 'Harnesses') },
            { value: Object.keys(D.stats.capabilities || {}).length, label: t('hero.stats.capabilities', 'Capabilities') },
          ]}
        />
      )}

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-10 space-y-10">
        {tab === 'leaderboard' && (
          <>
            <Section title={t('leaderboard.matrix.title')}>
              <HarnessMatrix data={D.leaderboard} labels={matrixLabels} />
            </Section>
            <Section title={t('leaderboard.title')}>
              <LeaderboardTable data={D.leaderboard} labels={tableLabels} />
            </Section>
          </>
        )}

        {tab === 'slice' && (
          <Section title={t('slice.title')} subtitle={t('slice.subtitle')}>
            <SliceAnalyzer data={D.leaderboard} stats={D.stats} labels={sliceLabels} />
          </Section>
        )}

        {tab === 'tasks' && (
          <Section title={t('tasks.title')} subtitle={t('tasks.subtitle')}>
            <TaskExplorer tasks={D.tasks} baseUrl="" labels={tasksLabels} />
          </Section>
        )}

        {tab === 'blog' && (
          <Section title={t('blog.title', 'Blog')} subtitle={t('blog.subtitle')}>
            <BlogList posts={D.blog[locale] ?? []} emptyText={t('blog.empty', 'No posts yet.')} />
          </Section>
        )}
      </main>

      <Footer
        builtBy={t('footer.builtBy', 'Maintained by AgentScope')}
        license={t('footer.license', 'MIT License')}
      />
    </div>
  );
}

function Topbar({
  locale, onLocale, dark, onDark, title, snapshotLabel, generatedAt,
  tab, onTab, tabLabels,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
  dark: boolean;
  onDark: (d: boolean) => void;
  title: string;
  snapshotLabel: string;
  generatedAt: string;
  tab: TabId;
  onTab: (t: TabId) => void;
  tabLabels: Array<{ id: TabId; label: string }>;
}) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/80 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl" aria-hidden="true">🐾</span>
          <span className="font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</span>
          <span
            className="hidden sm:inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
            title={`Generated ${generatedAt}`}
          >
            {snapshotLabel}
          </span>
        </div>

        {/* Tabs (center, hidden on mobile, mobile gets a row below) */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {tabLabels.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                className={
                  'px-3 py-1.5 rounded-md transition ' +
                  (active
                    ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800')
                }
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onLocale(locale === 'zh' ? 'en' : 'zh')}
            className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle language"
          >
            {locale === 'zh' ? 'EN' : '中文'}
          </button>
          <a
            href="https://github.com/agentscope-ai/pawbench"
            target="_blank"
            rel="noopener"
            className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            GitHub
          </a>
          <button
            type="button"
            onClick={() => onDark(!dark)}
            aria-label="Toggle theme"
            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {dark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile tab row */}
      <nav className="md:hidden border-t border-slate-200 dark:border-slate-800 px-2 flex gap-1 overflow-x-auto">
        {tabLabels.map(({ id, label }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              className={
                'px-3 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ' +
                (active
                  ? 'border-brand-700 text-brand-800 dark:text-brand-200'
                  : 'border-transparent text-slate-500')
              }
            >
              {label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function Hero({
  totalTasks, tagline, formula, description, stats,
}: {
  totalTasks: number;
  tagline: string;
  formula: string;
  description: string;
  stats: Array<{ value: string | number; label: string }>;
}) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-brand-50 via-white to-white dark:from-brand-950/40 dark:via-slate-950 dark:to-slate-950">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-8 pb-6 text-center">
        <div className="flex justify-center text-xs text-brand-700 dark:text-brand-300 font-medium mb-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-900">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            v1.0 · {totalTasks} tasks
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
          <span className="text-brand-700 dark:text-brand-400">paw</span><span>bench</span>
        </h1>

        <p className="mt-2 text-base sm:text-lg text-slate-700 dark:text-slate-200 font-medium">
          {tagline}
        </p>

        <div className="mt-4 flex justify-center">
          <code className="inline-block text-xs sm:text-sm font-mono px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900 text-brand-800 dark:text-brand-200 whitespace-nowrap">
            {formula}
          </code>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>

        <div className="mt-5 flex flex-wrap justify-center items-baseline gap-x-3 gap-y-1 text-xs text-slate-500">
          {stats.map((s, i) => (
            <span key={s.label} className="inline-flex items-baseline gap-1">
              {i > 0 && <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>}
              <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300 text-sm">{s.value}</span>
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BlogList({ posts, emptyText }: { posts: BlogPost[]; emptyText: string }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const open = useMemo(() => posts.find((p) => p.slug === openSlug) ?? null, [posts, openSlug]);

  if (!posts.length) {
    return <div className="text-sm text-slate-500 py-8 text-center">{emptyText}</div>;
  }

  if (open) {
    return (
      <article className="prose prose-slate dark:prose-invert max-w-none">
        <button
          type="button"
          onClick={() => setOpenSlug(null)}
          className="not-prose mb-4 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline-offset-2 hover:underline"
        >
          ← Back
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white !mb-2">{open.title}</h1>
        <div className="not-prose flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-6">
          {open.pubDate && <time>{open.pubDate}</time>}
          {open.author && <><span>·</span><span>{open.author}</span></>}
          {open.tags.length > 0 && (
            <>
              <span>·</span>
              {open.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {tag}
                </span>
              ))}
            </>
          )}
        </div>
        <div
          className="md-body text-slate-700 dark:text-slate-200 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdownLite(open.body) }}
        />
      </article>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {posts.map((p) => (
        <li key={p.slug}>
          <button
            type="button"
            onClick={() => setOpenSlug(p.slug)}
            className="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition flex flex-col gap-1"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-slate-900 dark:text-white">{p.title}</div>
              {p.pubDate && <time className="text-xs text-slate-500 shrink-0">{p.pubDate}</time>}
            </div>
            {p.description && (
              <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{p.description}</div>
            )}
            {p.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {p.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Footer({ builtBy, license }: { builtBy: string; license: string }) {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div>{builtBy} · {license}</div>
        <div className="text-slate-400">
          Generated as a self-contained HTML snapshot · open by double-click
        </div>
      </div>
    </footer>
  );
}
