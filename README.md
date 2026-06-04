# 🐾 PawBench

> Languages: **English** · [简体中文](README.zh-CN.md)

**PawBench is a production-grade AI Agent benchmark focused on evaluating the joint performance of (Foundation Model × Harness) combinations.**

As AI moves toward production deployment, the role of the Harness has become increasingly critical, and overall Agent performance is truly a product of both the foundation model and the Harness working in synergy. PawBench breaks away from traditional single-dimension model evaluations by allowing both dimensions to be observed independently. This not only precisely diagnoses whether system bottlenecks are 'model-limited' or 'harness-limited' (such as optimizing retries, context management, tool routing, or error recovery), but also comprehensively evaluates the collaborative synergy of different technical combinations—providing scientific, quantitative guidance for architectural design, component selection, and system optimization, thereby accelerating the full lifecycle iteration of AI Agents.

$$\text{Agent Performance} = f(\text{Foundation Model}, \text{Harness})$$

PawBench v1.0 curates 150 production-grade representative tasks from the community, deeply annotated based on a five-dimensional orthogonal taxonomy (Scenario, Capability, Complexity, Modality, Environment). Together with a secure, container-isolated Docker sandbox, it provides developers with a multi-dimensional, scientifically reproducible Agent comprehensive evaluation capability and leaderboard.

## Quick Start

### Requirements

- Python >= 3.10
- Docker (some harnesses run tasks in isolated containers)

**Install dependencies and configure credentials:**
```bash
pip install -r requirements-dev.txt
cp .env.example .env   # fill in OPENAI_API_KEY / OPENAI_BASE_URL / JUDGE_API_KEY ...
```

### Run Evaluation

```bash
# Default: run all tasks with the `qwenpaw` harness
python run_bench.py --model openai/gpt-4o

# Pick a different harness
python run_bench.py --agents openclaw --model dashscope/qwen3.6-plus
python run_bench.py --agents hermes   --model dashscope/qwen3.6-plus

# Compare harnesses on a task subset
python run_bench.py --agents qwenpaw openclaw hermes \
                    --model dashscope/qwen3.6-plus \
                    --tasks T002_email_triage T006_email_reply_draft

# Sequentially evaluate multiple models
python run_bench.py --model openai/gpt-4o --model anthropic/claude-sonnet-4-6
```

Results are written under `./results/<YYYYMMDD_HHMMSS>/pawbench/<model>/<agent>/`. See `python run_bench.py --help` for all flags (`--no-results-version-path`, `--save-workspace`, `--save-docker-image`, ...).

### View the Leaderboard

```bash
cd site
npm install
npm run build:data    # aggregate raw run logs into submissions/ and JSON for the UI
npm run dev           # http://localhost:4321
```

## Harnesses

| Harness | Description |
| :--- | :--- |
| **OpenClaw** | Container-isolated, tool-rich agent runtime — the lingua franca of recent agent evaluations. |
| **QwenPaw** | Alibaba's internal harness, optimized for DashScope and Qwen-series tool calling. |
| **Hermes** | A minimal scaffolding harness used as the weak-baseline floor. |

More harnesses (e.g. **CoPaw**, **Cursor Agent**, and other community scaffolds) will be onboarded over time. PRs to integrate a new harness are very welcome.

## Tasks

PawBench follows a **Reuse & Tag** methodology — we build on top of established community benchmarks rather than authoring tasks from scratch:

1. Pull tasks from high-quality upstream suites (`claw-eval`, `qwenclawbench`, `qwenpawbench`, `pinchbench`, `skillsbench`, `wildclawbench`, ...).
2. Tag every task across a five-dimensional, orthogonal taxonomy.
3. Apply multi-stage filtering (complexity ratios, safety quotas, tool variety, reproducibility) to freeze a curated suite (**150 tasks in v1.0**).

### Five-Dimensional Tag System

| Dimension | Field | Values |
| :--- | :--- | :--- |
| **Scenario** | `scenario` | 13 L1 categories × N L2 sub-scenarios (e.g. `Office_Productivity`, `Software_Engineering`, `Safety_Alignment`) |
| **Capability** | `capabilities` | 7 atomic skills: `Logic_Reasoning`, `Math_Computation`, `Code_Manipulation`, `Tool_Use`, `Skill_Use`, `Planning`, `Self_Verification` |
| **Complexity** | `complexity` | `L1` (1–2 steps) / `L2` (3–5 steps) / `L3` (>5 steps with branches/backtracking) |
| **Modality** | `modality` | `text` or `multimodal` (`image`, `audio`, `video`) |
| **Environment** | `environment` | `closed` (fully offline, reproducible) / `open` (live internet / SaaS APIs) |

> **Design principle:** scenario is orthogonal to capability. "Financial reasoning" splits into `scenario: Finance_Investment` + `capabilities: [Logic_Reasoning]`, keeping each slice dimension single-variable.

### v1.0 Distribution (150 tasks)

**Scenario (L1):**

| Scenario | # | Scenario | # |
| :--- | ---: | :--- | ---: |
| Office_Productivity | 30 | Content_Creation | 15 |
| Software_Engineering | 25 | Information_Retrieval | 10 |
| Safety_Alignment | 19 | Knowledge | 5 |
| Automation_Platform | 19 | Manufacturing_Engineering | 5 |
| Data_Analytics | 18 | Finance_Investment / Legal | 3 / 1 |

**Upstream source breakdown:**

| Source | # | L1 / L2 / L3 | closed / open | text / multimodal | Notable focus (top L1 scenarios) |
| :--- | ---: | :---: | :---: | :---: | :--- |
| [`claweval`](https://github.com/claw-eval/claw-eval)             | 52 | 2 / 7 / 43 | 48 / 4 | 37 / 15 | Office_Productivity, Data_Analytics, Content_Creation |
| [`qwenclawbench`](https://github.com/SKYLENAGE-AI/QwenClawBench) | 29 | 0 / 0 / 29 | 28 / 1 | 27 / 2 | Automation_Platform, Software_Engineering, Safety_Alignment |
| `pinchbench`                                                     | 23 | 3 / 5 / 15 | 15 / 8 | 22 / 1 | Office_Productivity, Software_Engineering, Information_Retrieval |
| `qwenpawbench`                                                   | 21 | 5 / 14 / 2 | 13 / 8 | 16 / 5 | Automation_Platform, Information_Retrieval, Safety_Alignment |
| `skillsbench`                                                    | 15 | 0 / 0 / 15 | 15 / 0 | 14 / 1 | Software_Engineering, Manufacturing_Engineering |
| [`wildclawbench`](https://github.com/InternLM/WildClawBench)     | 10 | 2 / 3 / 5  | 10 / 0 | 8 / 2  | Office_Productivity, Safety_Alignment |
| **Total**                                                        | **150** | **12 / 29 / 109** | **129 / 21** | **124 / 26** | |

## Project Structure

```text
pawbench/
├── data/pawbench-v1.0/    # Curated evaluation task suite (v1.0)
│   ├── tasks/             # Task Markdown specs (YAML frontmatter + sections)
│   └── assets/            # Mock workspace files mounted into agent containers
├── pawbench/              # Core Python package
│   ├── agents/            # Harness adapters
│   │   └── impl/          # openclaw / qwenpaw / hermes implementations
│   ├── envs/              # Execution environments (Docker, ...)
│   ├── llm/               # Model & judge LLM configuration
│   ├── utils/             # Anomaly detection, model-ID helpers, ...
│   ├── runner.py          # Per-task execution loop
│   ├── grader.py          # Automated + LLM-judge + hybrid grading
│   ├── backend.py         # Submission aggregation
│   └── task_loader.py     # Task Markdown parser
├── run_bench.py           # Unified Model × Harness CLI runner
├── result/                # Raw run metrics and traces (gitignored)
├── submissions/           # Rolled-up Model × Harness results (.json)
├── site/                  # Astro + React leaderboard
├── scripts/               # Repo utilities (e.g. pre-commit setup)
├── .githooks/             # Versioned git hooks
├── pawbench-snapshot.html # Self-contained offline leaderboard snapshot
├── pyproject.toml
└── requirements-dev.txt
```

## Acknowledgments

PawBench is built on top of the work of the open-source agent evaluation community, including [Claw-Eval](https://github.com/claw-eval/claw-eval), [QwenClawBench](https://github.com/SKYLENAGE-AI/QwenClawBench), [WildClawBench](https://github.com/InternLM/WildClawBench), [PinchBench](https://github.com/pinchbench/skill), and others.

Contributions welcome — open an issue or PR to add tasks, integrate a new harness, or improve the leaderboard.
