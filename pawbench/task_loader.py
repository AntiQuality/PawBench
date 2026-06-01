# -*- coding: utf-8 -*-
"""Task loading and parsing for the pawbench benchmark.

Tasks are stored as Markdown files with YAML front-matter:

    benchmarks/pawbench/data/<dataset>/tasks/task_*.md

Each file follows the QwenClawBench task format so the same runner
infrastructure can be reused without depending on an external repository.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


logger = logging.getLogger(__name__)


class Task:
    """A single benchmark task loaded from a Markdown file."""

    def __init__(
        self,
        task_id: str,
        name: str,
        category: str,
        grading_type: str,
        timeout_seconds: int,
        workspace_files: List[Dict[str, str]],
        prompt: str,
        expected_behavior: str,
        grading_criteria: List[str],
        automated_checks: Optional[str] = None,
        llm_judge_rubric: Optional[str] = None,
        grading_weights: Optional[Dict[str, float]] = None,
        file_path: Optional[Path] = None,
        frontmatter: Optional[Dict[str, Any]] = None,
    ):
        self.task_id = task_id
        self.name = name
        self.category = category
        self.grading_type = grading_type
        self.timeout_seconds = timeout_seconds
        self.workspace_files = workspace_files
        self.prompt = prompt
        self.expected_behavior = expected_behavior
        self.grading_criteria = grading_criteria
        self.automated_checks = automated_checks
        self.llm_judge_rubric = llm_judge_rubric
        self.grading_weights = grading_weights
        self.file_path = file_path
        self.frontmatter = frontmatter or {}

    def __repr__(self) -> str:
        return f"Task(id={self.task_id!r}, name={self.name!r}, category={self.category!r})"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "name": self.name,
            "category": self.category,
            "grading_type": self.grading_type,
            "timeout_seconds": self.timeout_seconds,
            "workspace_files": self.workspace_files,
            "prompt": self.prompt,
            "expected_behavior": self.expected_behavior,
            "grading_criteria": self.grading_criteria,
            "has_automated_checks": self.automated_checks is not None,
            "has_llm_judge_rubric": self.llm_judge_rubric is not None,
            "grading_weights": self.grading_weights,
            "frontmatter": self.frontmatter,
        }


class TaskLoader:
    """Load and parse task files from a tasks directory."""

    def __init__(self, tasks_dir: Path) -> None:
        self.tasks_dir = tasks_dir
        logger.info("TaskLoader initialised: %s", tasks_dir)

    def load_all_tasks(self) -> List[Task]:
        """Load task Markdown files from *tasks_dir*.

        Supports both legacy ``task_*.md`` naming (claw-eval-converted) and the
        ``T<N>_*.md`` naming used by pawbench-v1.0 and migrated datasets.  All
        ``*.md`` files in the directory are loaded; non-task files (e.g. README)
        are silently skipped if they lack valid YAML front-matter.
        """
        tasks: List[Task] = []
        task_files = sorted(self.tasks_dir.glob("*.md"))
        logger.info("Found %d task file(s)", len(task_files))
        for task_file in task_files:
            try:
                task = self.load_task(task_file)
                tasks.append(task)
                logger.debug("Loaded task: %s", task.task_id)
            except ValueError:
                # Skip files that lack valid YAML front-matter (e.g. README.md).
                logger.debug("Skipping non-task file: %s", task_file)
            except Exception:
                logger.exception("Failed to load task from %s", task_file)
        logger.info("Loaded %d task(s) successfully", len(tasks))
        return tasks

    def load_task(self, task_file: Path) -> Task:
        """Parse a single task Markdown file."""
        content = task_file.read_text(encoding="utf-8")

        fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)", content, re.DOTALL)
        if not fm_match:
            raise ValueError(f"No YAML front-matter found in {task_file}")

        fm_text = fm_match.group(1)
        body_text = fm_match.group(2)

        # Strip internal-only tracing fields that may contain problematic YAML.
        fm_text = re.sub(
            r"^source_query:\s*.*?(?=\n\w+:\s|\n---|\Z)",
            "",
            fm_text,
            flags=re.MULTILINE | re.DOTALL,
        )
        fm_text = re.sub(r"^source_line_number:.*$", "", fm_text, flags=re.MULTILINE)

        try:
            metadata: Dict[str, Any] = yaml.safe_load(fm_text) or {}
        except yaml.YAMLError as exc:
            raise ValueError(f"Invalid YAML front-matter in {task_file}: {exc}") from exc

        sections = self._parse_sections(body_text)
        grading_criteria = self._extract_grading_criteria(sections.get("Grading Criteria", ""))

        return Task(
            task_id=metadata.get("id", ""),
            name=metadata.get("name", ""),
            category=metadata.get("category", ""),
            grading_type=metadata.get("grading_type", "automated"),
            timeout_seconds=metadata.get("timeout_seconds", 120),
            workspace_files=metadata.get("workspace_files", []),
            prompt=sections.get("Prompt", "").strip(),
            expected_behavior=sections.get("Expected Behavior", "").strip(),
            grading_criteria=grading_criteria,
            automated_checks=sections.get("Automated Checks"),
            llm_judge_rubric=sections.get("LLM Judge Rubric"),
            grading_weights=metadata.get("grading_weights"),
            file_path=task_file,
            frontmatter=metadata,
        )

    # ── internal helpers ──────────────────────────────────────────────────────

    def _parse_sections(self, body: str) -> Dict[str, str]:
        sections: Dict[str, str] = {}
        current: Optional[str] = None
        lines: List[str] = []

        for line in body.split("\n"):
            header = re.match(r"^##\s+(.+)$", line)
            if header:
                if current is not None:
                    sections[current] = "\n".join(lines).strip()
                current = header.group(1)
                lines = []
            elif current is not None:
                lines.append(line)

        if current is not None:
            sections[current] = "\n".join(lines).strip()

        return sections

    def _extract_grading_criteria(self, criteria_text: str) -> List[str]:
        criteria: List[str] = []
        for line in criteria_text.split("\n"):
            m = re.match(r"^-\s+\[[ x]\]\s+(.+)$", line.strip())
            if m:
                criteria.append(m.group(1))
        return criteria
