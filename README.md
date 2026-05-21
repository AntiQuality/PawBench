# pawbench

An open benchmark for evaluating AI agents on real-world tasks across **150
tasks**, **6 source datasets**, and **3 agent harnesses**.

- 🌐 Website / leaderboard: <https://agentscope-ai.github.io/pawbench/>
- 📂 Tasks: [`data/pawbench-v1.0/tasks/`](data/pawbench-v1.0/tasks/)
- 🛠️ Runner & agents: separate repository

## Repository layout

```
pawbench/
├── data/
│   ├── mapping.csv                  T-id ↔ source dataset mapping
│   └── pawbench-v1.0/
│       ├── tasks/                   150 task markdown files
│       └── assets/                  workspace files mounted into agent containers
├── result/                          raw evaluation runs (gitignored, large)
│   └── <run-name>/<model>/<harness>/T*/output/metrics.json
├── submissions/                     rolled-up scores (one JSON per run × model × harness)
├── site/                            GitHub Pages site (Astro + React + Tailwind)
│   └── README.md                    site dev/deploy guide
└── .github/workflows/
    └── deploy-site.yml              auto-deploy site on push to main
```

## Updating the leaderboard with new evaluation results

Drop a new run under `result/<run-name>/<model>/<harness>/<task-id>/output/metrics.json`
(typical file produced by the harness runners) and rebuild:

```bash
cd site
npm run build:data
```

That runs three steps in order:

1. `build_tasks.py` — `data/pawbench-v1.0/tasks/*.md` → `src/data/{tasks,stats}.json`
2. `aggregate_results.py` — `result/<run>/...` → `submissions/<run>__<model>__<harness>.json`
3. `build_leaderboard.py` — `submissions/*.json` → `src/data/leaderboard.json`
   (dedupes by `(model, harness)`, keeping the freshest `updated` date)

Display names for vendor-prefixed model directories live in
`MODEL_ALIAS` near the top of `site/scripts/aggregate_results.py`; edit there
when a new run uses a name like `openai.gpt-6` and you want it shown as `gpt-6`.

See [`site/README.md`](site/README.md) for site development and deployment, and
[`data/pawbench-v1.0/tasks/`](data/pawbench-v1.0/tasks/) for the task format.

## Pre-commit

Git hooks lint Python build scripts and run basic repo hygiene checks before each
commit. This repo chains them **after** the org AK-leak scanner (global
`core.hooksPath` is overridden locally via `.githooks/`).

```bash
pip install -r requirements-dev.txt   # or: pip install pre-commit ruff pyyaml
./scripts/setup-pre-commit.sh         # one-time: .githooks/ + pre-commit install
pre-commit run --all-files            # optional: check the whole tree now
```

Hooks cover:

- trailing whitespace / EOF (excluding curated task files under `data/`)
- YAML & JSON validity
- private-key detection & large-file guard
- **ruff** format + lint on `site/scripts/*.py`
