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
├── site/                            GitHub Pages site (Astro + React + Tailwind)
│   └── README.md                    site dev/deploy guide
├── submissions/                     (optional) per-(model, harness) result JSONs
└── .github/workflows/
    └── deploy-site.yml              auto-deploy site on push to main
```

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
