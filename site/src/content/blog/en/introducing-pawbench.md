---
title: "Introducing pawbench: A transparent benchmark for real-world agents"
description: Why we built pawbench, and how it differs from existing agent benchmarks.
locale: en
pubDate: 2026-05-19
author: pawbench team
tags: [release, design]
---

> **TL;DR** — pawbench consolidates 6 public/internal agent evaluations into 150 transparent,
> reproducible tasks with automated, LLM-judge, and hybrid grading. Every task's prompt, grading
> code and rubric are visible on the [Tasks](../tasks) page — please scrutinize them.

## Why another benchmark

Running agent evaluations over the past year, we kept hitting the same friction:

1. **Fragmented task sources.** Each of claweval, wildclawbench, pinchbench, … maintains its own
   schema and scoring code. Comparing a model across them means standing up several harnesses.
2. **Opaque grading.** Many benchmarks publish only final scores, not the grading functions.
   For a benchmark that claims to measure "real capability", we believe **grading code must be public**.
3. **Harness dimension is ignored.** A single model's score under OpenClaw vs. QwenPaw vs. Hermes can
   vary more than the difference between two competing models — yet leaderboards rarely surface this.

pawbench answers all three with a unified task format, transparent grading, and an explicit
Model × Harness leaderboard.

## What you get

- **Task library** — full metadata, prompt, grading code and rubric for all 150 tasks.
- **Model × Harness matrix** — the home page foregrounds harness sensitivity per model.
- **Slice analysis** — compare models along complexity / capability / scenario / modality.

## What's next

In flight:
- Real leaderboard data (replacing the current mock rows)
- Public submission protocol so the community can contribute runs
- A companion paper / methodology write-up

If you take issue with a particular grader, or want to add a task or harness, open an issue on
[GitHub](https://github.com/agentscope-ai/pawbench).
