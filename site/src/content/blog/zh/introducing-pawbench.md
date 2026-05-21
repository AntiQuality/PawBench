---
title: 介绍 pawbench：面向真实场景的 Agent 评测基准
description: 为什么我们做 pawbench，以及它与现有 agent benchmark 有什么不同。
locale: zh
pubDate: 2026-05-19
author: pawbench team
tags: [release, design]
---

> **TL;DR** —— pawbench 把 6 个公开/内部的 agent 评测合并整理成 150 个透明、可复跑的任务，
> 并在评分上同时支持自动化检查、LLM judge 和混合模式。所有任务的 prompt、grading 代码、
> rubric 都直接展示在 [/tasks](../tasks) 页面，欢迎检视和批评。

## 为什么再做一个 benchmark

过去一年，我们在跑 agent 评测时遇到了几个反复出现的痛点：

1. **任务来源分散** —— claweval、wildclawbench、pinchbench 等都各自维护自己的 schema 和评分逻辑，
   想横向比较一个模型必须把每个 harness 都跑一遍。
2. **评分不透明** —— 不少 benchmark 只暴露最终分数，而不暴露 grading 函数。
   我们认为对一个声称要"评估真实能力"的 benchmark 来说，**grading code 必须公开**。
3. **Harness 维度被忽视** —— 同一个模型在 OpenClaw / QwenPaw / Hermes 等不同 harness 下的差异
   往往超过模型本身的差异，但很少有 leaderboard 显式暴露这一点。

pawbench 的目标是用一个统一的任务格式 + 透明的评分 + Model × Harness 双维度榜单回应这三点。

## 你能从这里得到什么

- **任务库**：[/tasks](../tasks) 提供 150 个任务的完整 metadata、prompt、grading 代码与 rubric。
- **Model × Harness 矩阵**：[/](/) 首页突出展示同一模型在不同 harness 下的表现差。
- **Slice 分析**：[/slice](../slice) 按复杂度、能力、场景、模态等维度切片对比模型。

## 接下来

我们在做的几件事：
- 接入正式的 leaderboard 数据（替换当前的 mock）
- 公开提交流程，让社区也能贡献跑分
- 发布配套论文与方法论

如果你对某个任务的 grading 有意见，或希望加入新的任务/harness，欢迎在
[GitHub](https://github.com/agentscope-ai/pawbench) 提 issue。
