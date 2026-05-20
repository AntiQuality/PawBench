#!/usr/bin/env python3
"""Compile pawbench task markdown files into a single tasks.json for the website.

Reads:
    data/pawbench-v1.0/tasks/*.md           (relative to repo root)

Writes:
    site/src/data/tasks.json                (all task metadata + body sections)
    site/src/data/stats.json                (aggregated counters used by /index Hero)
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

try:
    import yaml  # type: ignore
except ImportError:
    print("[build_tasks] PyYAML missing — run: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_ROOT = Path(__file__).resolve().parents[1]
TASKS_DIR = REPO_ROOT / "data" / "pawbench-v1.0" / "tasks"
OUT_DIR = SITE_ROOT / "src" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?(.*)$", re.DOTALL)
SECTION_RE = re.compile(r"^##\s+(?P<title>[^\n]+)\n", re.MULTILINE)

CANONICAL_SECTIONS = {
    "Prompt": "prompt",
    "Expected Behavior": "expected",
    "Automated Checks": "automated_checks",
    "Grading Criteria": "grading_criteria",
    "LLM Judge Rubric": "rubric",
    "Workspace": "workspace",
}


def parse_task(path: Path) -> dict[str, Any] | None:
    text = path.read_text(encoding="utf-8", errors="ignore")
    m = FRONTMATTER_RE.match(text)
    if not m:
        print(f"[build_tasks] skip (no frontmatter): {path.name}", file=sys.stderr)
        return None
    front, body = m.group(1), m.group(2)
    try:
        meta = yaml.safe_load(front) or {}
    except yaml.YAMLError as exc:
        print(f"[build_tasks] yaml error in {path.name}: {exc}", file=sys.stderr)
        return None

    sections = split_sections(body)

    t_id, source, core_id = parse_filename(path.stem)

    labels = meta.get("labels") or {}
    modality = labels.get("modality") or {}
    if isinstance(modality, str):
        modality = {"type": modality, "channels": []}

    workspace_files = meta.get("workspace_files") or []

    return {
        "t_id": t_id,
        "filename": path.name,
        "source_dataset": source,
        "core_id": core_id,
        "task_id": meta.get("id", core_id),
        "name": meta.get("name", core_id),
        "category": meta.get("category"),
        "subcategory": meta.get("subcategory"),
        "grading_type": meta.get("grading_type"),
        "grading_weights": meta.get("grading_weights") or {},
        "timeout_seconds": meta.get("timeout_seconds"),
        "input_modality": meta.get("input_modality"),
        "external_dependency": meta.get("external_dependency"),
        "labels": {
            "complexity": labels.get("complexity") or meta.get("complexity"),
            "environment": labels.get("environment") or meta.get("environment"),
            "modality": {
                "type": (modality or {}).get("type", "text"),
                "channels": (modality or {}).get("channels") or [],
            },
            "capabilities": labels.get("capabilities") or meta.get("capabilities") or [],
            "scenario": labels.get("scenario"),
        },
        "workspace_files": workspace_files,
        "sections": sections,
        "source_path": f"data/pawbench-v1.0/tasks/{path.name}",
    }


def split_sections(body: str) -> dict[str, str]:
    """Split markdown body by ## headings into a dict {key: content}."""
    out: dict[str, str] = {}
    matches = list(SECTION_RE.finditer(body))
    for i, m in enumerate(matches):
        title = m.group("title").strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        content = body[start:end].strip("\n")
        key = CANONICAL_SECTIONS.get(title, slugify(title))
        out[key] = content
    return out


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def parse_filename(stem: str) -> tuple[str, str | None, str | None]:
    m = re.match(r"^(T\d+)_([a-z0-9]+)_(.+)$", stem)
    if not m:
        return stem, None, None
    return m.group(1), m.group(2), m.group(3)


def aggregate_stats(tasks: list[dict[str, Any]]) -> dict[str, Any]:
    cats: Counter[str] = Counter()
    subcats: Counter[str] = Counter()
    sources: Counter[str] = Counter()
    complexity: Counter[str] = Counter()
    capabilities: Counter[str] = Counter()
    scenarios: Counter[str] = Counter()
    scenario_top: Counter[str] = Counter()  # before the slash
    modalities: Counter[str] = Counter()
    channels: Counter[str] = Counter()
    grading: Counter[str] = Counter()
    environments: Counter[str] = Counter()

    for t in tasks:
        if t.get("category"):
            cats[t["category"]] += 1
        if t.get("subcategory"):
            subcats[t["subcategory"]] += 1
        if t.get("source_dataset"):
            sources[t["source_dataset"]] += 1
        labels = t.get("labels", {}) or {}
        if labels.get("complexity"):
            complexity[labels["complexity"]] += 1
        for cap in labels.get("capabilities", []) or []:
            capabilities[cap] += 1
        scenario = labels.get("scenario")
        if scenario:
            scenarios[scenario] += 1
            scenario_top[scenario.split("/", 1)[0]] += 1
        modality = labels.get("modality") or {}
        mtype = modality.get("type")
        if mtype:
            modalities[mtype] += 1
        for ch in modality.get("channels") or []:
            channels[ch] += 1
        if t.get("grading_type"):
            grading[t["grading_type"]] += 1
        env = labels.get("environment")
        if env:
            environments[env] += 1

    return {
        "total": len(tasks),
        "sources": dict(sources.most_common()),
        "complexity": dict(complexity.most_common()),
        "capabilities": dict(capabilities.most_common()),
        "scenarios": dict(scenarios.most_common()),
        "scenario_top": dict(scenario_top.most_common()),
        "modality": dict(modalities.most_common()),
        "channels": dict(channels.most_common()),
        "grading_type": dict(grading.most_common()),
        "environment": dict(environments.most_common()),
        "category": dict(cats.most_common()),
        "subcategory": dict(subcats.most_common()),
    }


def main() -> int:
    if not TASKS_DIR.is_dir():
        print(f"[build_tasks] tasks dir not found: {TASKS_DIR}", file=sys.stderr)
        return 1

    files = sorted(p for p in TASKS_DIR.iterdir() if p.suffix == ".md")
    tasks: list[dict[str, Any]] = []
    for f in files:
        rec = parse_task(f)
        if rec:
            tasks.append(rec)

    tasks.sort(key=lambda x: x.get("t_id") or "")

    out_tasks = OUT_DIR / "tasks.json"
    out_tasks.write_text(json.dumps(tasks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[build_tasks] wrote {len(tasks)} tasks → {out_tasks.relative_to(SITE_ROOT)}")

    stats = aggregate_stats(tasks)
    out_stats = OUT_DIR / "stats.json"
    out_stats.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[build_tasks] wrote stats → {out_stats.relative_to(SITE_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
