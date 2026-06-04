# 🐾 PawBench

> Languages: [English](README.md) · **简体中文**

**PawBench 是一个专注于评估“基座模型 × Harness”联合效果的生产级 AI Agent 评测基准。**

随着 AI 走向落地，在生产环境中 Harness 的作用越来越重要，整个 Agent 的表现实际上是大模型与 Harness 共同作用的乘积效应。PawBench 打破了传统的单一维度大模型评测，让双轴能力能够被独立观察；这不仅能精准诊断系统瓶颈究竟是“模型受限”还是“Harness 受限”（如优化重试、上下文管理、工具路由或错误恢复），更能全面评估不同技术组合的协同效应，为架构设计、组件选型与系统优化提供科学的量化指导，加速 Agent 的全生命周期迭代。

$$\text{Agent 表现} = f(\text{基座模型}, \text{Harness})$$

PawBench v1.0 从社区精选了 150 个生产级代表性任务，并基于一套包含领域场景、原子能力、复杂度、交互模态、运行环境的五维正交标签体系进行深度打标，配合安全的 Docker 隔离沙箱，为开发者提供多维度、科学可复现的 Agent 全景实力评测能力与可视化排行榜。

## 快速开始

### 环境要求

- Python >= 3.10
- Docker（部分 Harness 在隔离容器中执行任务）

**安装依赖、配置凭证：**
```bash
pip install -r requirements-dev.txt
cp .env.example .env   # 填入 OPENAI_API_KEY / OPENAI_BASE_URL / JUDGE_API_KEY ...
```

### 运行评测

```bash
# 默认：用 `qwenpaw` 脚手架跑全部任务
python run_bench.py --model openai/gpt-4o

# 切换 Harness
python run_bench.py --agents openclaw --model dashscope/qwen3.6-plus
python run_bench.py --agents hermes   --model dashscope/qwen3.6-plus

# 在指定任务集上横向对比多个 Harness
python run_bench.py --agents qwenpaw openclaw hermes \
                    --model dashscope/qwen3.6-plus \
                    --tasks T002_email_triage T006_email_reply_draft

# 顺序评测多个模型
python run_bench.py --model openai/gpt-4o --model anthropic/claude-sonnet-4-6
```

评测结果默认写入 `./results/<年月日_时分秒>/pawbench/<model>/<agent>/`。其他参数（`--no-results-version-path`、`--save-workspace`、`--save-docker-image` 等）见 `python run_bench.py --help`。

### 查看排行榜

```bash
cd site
npm install
npm run build:data    # 汇总原始日志到 submissions/ 并生成前端 JSON
npm run dev           # http://localhost:4321
```

## Harness

| Harness | 说明 |
| :--- | :--- |
| **OpenClaw** | 容器隔离、工具丰富的 Agent 运行时，近期 Agent 评测的事实标准。 |
| **QwenPaw** | 阿里内部用于评测 Qwen 系列的 Harness，针对 DashScope 与 Qwen 工具调用做了深度优化。 |
| **Hermes** | 极简脚手架，作为评测的弱基线地板。 |

后续我们会持续接入更多 Harness（如 **CoPaw**、**Cursor Agent** 等业界优秀脚手架），也非常欢迎社区通过 PR 接入新的 Harness。

## 任务集

PawBench 采用 **抽取与打标（Reuse & Tag）** 方法，站在社区已有评测集的基础上构建，而不是从零手写任务：

1. 从社区高质量上游评测集中抽取任务（`claw-eval`, `qwenclawbench`, `qwenpawbench`, `pinchbench`, `skillsbench`, `wildclawbench` 等）。
2. 对每条任务按五维正交标签体系打标。
3. 通过包含复杂度比例、安全配额、工具多样性、复现性等约束的多阶段筛选管线，固化一套代表性子集（**v1.0 共 150 条任务**）。

### 五维标签体系

| 维度 | 字段 | 标签值 |
| :--- | :--- | :--- |
| **领域场景** | `scenario` | 13 个 L1 分类 × N 个 L2 子场景（如 `Office_Productivity`, `Software_Engineering`, `Safety_Alignment`） |
| **原子能力** | `capabilities` | 7 项原子能力：`Logic_Reasoning`, `Math_Computation`, `Code_Manipulation`, `Tool_Use`, `Skill_Use`, `Planning`, `Self_Verification` |
| **复杂度** | `complexity` | `L1`（1–2 步）/ `L2`（3–5 步）/ `L3`（>5 步，含分支与回溯） |
| **交互模态** | `modality` | `text` 或 `multimodal`（含 `image`, `audio`, `video` 等子通道） |
| **运行环境** | `environment` | `closed`（纯本地 mock，100% 可复现）/ `open`（需联网或真实 SaaS API） |

> **设计原则：场景与能力正交。** 「金融推理」拆为 `scenario: Finance_Investment` + `capabilities: [Logic_Reasoning]`，保证每个切片维度都是单一变量。

### v1.0 任务分布（150 条）

**领域场景（L1）：**

| 场景 | 数量 | 场景 | 数量 |
| :--- | ---: | :--- | ---: |
| Office_Productivity | 30 | Content_Creation | 15 |
| Software_Engineering | 25 | Information_Retrieval | 10 |
| Safety_Alignment | 19 | Knowledge | 5 |
| Automation_Platform | 19 | Manufacturing_Engineering | 5 |
| Data_Analytics | 18 | Finance_Investment / Legal | 3 / 1 |

**上游来源细分：**

| 来源 | 数量 | L1 / L2 / L3 | closed / open | text / multimodal | 主要覆盖（Top L1 场景） |
| :--- | ---: | :---: | :---: | :---: | :--- |
| [`claweval`](https://github.com/claw-eval/claw-eval)             | 52 | 2 / 7 / 43 | 48 / 4 | 37 / 15 | Office_Productivity、Data_Analytics、Content_Creation |
| [`qwenclawbench`](https://github.com/SKYLENAGE-AI/QwenClawBench) | 29 | 0 / 0 / 29 | 28 / 1 | 27 / 2 | Automation_Platform、Software_Engineering、Safety_Alignment |
| `pinchbench`                                                     | 23 | 3 / 5 / 15 | 15 / 8 | 22 / 1 | Office_Productivity、Software_Engineering、Information_Retrieval |
| `qwenpawbench`                                                   | 21 | 5 / 14 / 2 | 13 / 8 | 16 / 5 | Automation_Platform、Information_Retrieval、Safety_Alignment |
| `skillsbench`                                                    | 15 | 0 / 0 / 15 | 15 / 0 | 14 / 1 | Software_Engineering、Manufacturing_Engineering |
| [`wildclawbench`](https://github.com/InternLM/WildClawBench)     | 10 | 2 / 3 / 5  | 10 / 0 | 8 / 2  | Office_Productivity、Safety_Alignment |
| **合计**                                                          | **150** | **12 / 29 / 109** | **129 / 21** | **124 / 26** | |

## 项目结构

```text
pawbench/
├── data/pawbench-v1.0/    # 精选评测任务集（v1.0）
│   ├── tasks/             # 任务 Markdown 定义（YAML frontmatter + 段落）
│   └── assets/            # 挂载进 Agent 容器的 mock 工作空间
├── pawbench/              # 核心 Python 包
│   ├── agents/            # Harness 适配层
│   │   └── impl/          # openclaw / qwenpaw / hermes 等实现
│   ├── envs/              # 执行环境（Docker 等）
│   ├── llm/               # 模型与 Judge LLM 配置
│   ├── utils/             # 异常检测、模型 ID 解析等工具
│   ├── runner.py          # 单任务执行循环
│   ├── grader.py          # 自动化 + LLM Judge + 混合打分引擎
│   ├── backend.py         # 评测结果汇总
│   └── task_loader.py     # 任务 Markdown 解析
├── run_bench.py           # 统一的 Model × Harness 评测脚本
├── result/                # 原始运行指标与 Trace（被 git 忽略）
├── submissions/           # 汇总后的 Model × Harness 结果（.json）
├── site/                  # 基于 Astro + React 的排行榜站点
├── scripts/               # 仓库级脚本（如 pre-commit 安装）
├── .githooks/             # 版本化的 git hooks
├── pawbench-snapshot.html # 单文件离线排行榜快照
├── pyproject.toml
└── requirements-dev.txt
```

## 致谢

PawBench 站在开源 Agent 评测社区的肩膀上，包括 [Claw-Eval](https://github.com/claw-eval/claw-eval)、[QwenClawBench](https://github.com/SKYLENAGE-AI/QwenClawBench)、[WildClawBench](https://github.com/InternLM/WildClawBench)、[PinchBench](https://github.com/pinchbench/skill) 等。

欢迎社区贡献——无论是提交新任务、接入新 Harness 还是改进可视化站点，都欢迎开 Issue 或 PR。
