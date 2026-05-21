# pawbench site

The marketing + leaderboard site for **pawbench**, deployed to
<https://agentscope-ai.github.io/pawbench/>.

Built with [Astro](https://astro.build) + React islands + Tailwind, statically
generated, no backend.

## Layout

```
site/
├── astro.config.mjs           # base path = /pawbench/  (env-overridable)
├── tailwind.config.mjs
├── src/
│   ├── pages/
│   │   ├── index.astro              /                Hero + Leaderboard
│   │   ├── slice.astro              /slice           Slice analysis
│   │   ├── tasks/index.astro        /tasks           Task explorer
│   │   ├── tasks/[id].astro         /tasks/T001 ...  Task detail (×150)
│   │   ├── blog/index.astro         /blog            Reserved
│   │   └── en/                      mirror under /en/* (English locale)
│   ├── components/
│   │   ├── astro/                   static Astro components (Nav, Hero, …)
│   │   └── react/                   interactive islands (matrix, table, …)
│   ├── layouts/Base.astro
│   ├── i18n/                        zh.json / en.json + helpers
│   ├── lib/                         types & utils
│   ├── data/                        ⬅ generated at build time, gitignored
│   └── styles/global.css
├── scripts/
│   ├── build_tasks.py               data/pawbench-v1.0/tasks/*.md → tasks.json + stats.json
│   ├── aggregate_results.py         result/<run>/.../metrics.json → submissions/*.json
│   └── build_leaderboard.py         submissions/*.json → leaderboard.json (mock if empty)
└── public/                          static assets copied as-is
```

## Pages

| Path | Purpose |
|------|---------|
| `/` | Hero banner + **Model × Harness** matrix + sortable leaderboard table |
| `/slice` | Per-label slice analysis (complexity / capability / scenario / modality / source / grading) |
| `/tasks` | Task library with full filters |
| `/tasks/[id]` | Per-task page: metadata, prompt, automated checks (Python), LLM judge rubric, workspace files |
| `/blog` | Reserved for future posts |
| `/en/...` | English mirror of all of the above |

## Local development

Prereqs: Node 20+, Python 3.11+, `pip install pyyaml`.

```bash
cd site
npm install

# 1. Compile task .md files → JSON the site consumes
npm run build:data

# 2. Dev server (hot reload). The base path is /pawbench/ so visit
#    http://localhost:4321/pawbench/
npm run dev

# 3. Production build (output in dist/)
npm run build
npm run preview
```

## Submissions / leaderboard data

Two paths to land scores on the leaderboard:

### 1. Auto-aggregate from raw runs (`result/`)

Place harness output under `result/<run>/<model>/<harness>/<task-id>/output/metrics.json`
(repo root, gitignored) and run `npm run build:data`. The aggregator
(`scripts/aggregate_results.py`) joins each metrics file with the task
metadata in `tasks.json` and emits one rolled-up JSON per
`(run, model, harness)` into `submissions/`. `build_leaderboard.py` then
dedupes by `(model, harness)` keeping the freshest `updated`.

Re-running the same run is idempotent. To deprecate an old run, just delete
its `submissions/<run>__*.json` files.

### 2. Hand-write a submission JSON

Drop a JSON under `submissions/*.json` matching this shape:

```json
{
  "run": "pawbench-rerun-20260519",
  "model": "gpt-5.4",
  "harness": "openclaw",
  "overall":   0.612,
  "automated": 0.71,
  "judge":     0.55,
  "tasks":     150,
  "tasks_errored": 0,
  "by_source":     { "claweval": 0.65, "wildclawbench": 0.58 },
  "by_capability": { "Tool_Use": 0.72, "Planning": 0.61 },
  "by_complexity": { "L1": 0.81, "L2": 0.66, "L3": 0.58 },
  "updated":   "2026-05-18"
}
```

While `submissions/` is empty, `build_leaderboard.py` falls back to inline
mock rows so the UI still renders.

## Deployment

Automated via `.github/workflows/deploy-site.yml`:

1. `push` to `main` touching `site/**`, `data/**`, `submissions/**`, or the workflow itself
2. CI runs `build_tasks.py` → `aggregate_results.py` → `build_leaderboard.py` → `npm run build`
3. The `dist/` folder is uploaded as a Pages artifact and deployed

**One-time GitHub setup**:

- `Settings → Pages → Source = GitHub Actions`
- `Settings → Actions → General → Workflow permissions = Read and write`

After that, every push to `main` updates <https://agentscope-ai.github.io/pawbench/>.

## Customizing the URL

The Astro `site` and `base` are env-overridable, so you can point this elsewhere
without code changes:

```bash
PAWBENCH_SITE=https://pawbench.org PAWBENCH_BASE=/ npm run build
```

For a custom domain, add `site/public/CNAME` containing the domain.
