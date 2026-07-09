import asyncio
from pathlib import Path
from types import SimpleNamespace

from pawbench.backend import WORKSPACE_ROOT, _stage_workspace_files


class FakeEnv:
    def __init__(self) -> None:
        self.writes: list[tuple[str, str]] = []
        self.commands: list[str] = []
        self.copies: list[tuple[Path, str]] = []

    async def write_file(self, path: str, content: str) -> bool:
        self.writes.append((path, content))
        return True

    async def execute_command(self, command: str) -> dict[str, object]:
        self.commands.append(command)
        return {"success": True}

    async def copy_to(self, source: Path, destination: str) -> bool:
        self.copies.append((source, destination))
        return True


def test_stage_workspace_files_rejects_destination_escape(tmp_path: Path) -> None:
    env = FakeEnv()
    task = SimpleNamespace(
        task_id="T001",
        file_path=tmp_path / "tasks" / "T001_escape.md",
        workspace_files=[
            {"path": "../outside.txt", "content": "escape"},
            {"source": "fixtures/input.txt", "dest": "/tmp/outside.txt"},
        ],
    )
    assets_dir = tmp_path / "assets"
    (assets_dir / "T001" / "fixtures").mkdir(parents=True)
    (assets_dir / "T001" / "fixtures" / "input.txt").write_text("data", encoding="utf-8")

    asyncio.run(
        _stage_workspace_files(
            env=env,
            task=task,
            assets_dir=assets_dir,
            agent_name="test-agent",
            verbose=False,
        )
    )

    assert env.writes == []
    assert env.copies == []


def test_stage_workspace_files_rejects_source_escape(tmp_path: Path) -> None:
    env = FakeEnv()
    dataset_dir = tmp_path / "data" / "pawbench-v1.0"
    assets_dir = dataset_dir / "assets"
    outside = dataset_dir / "outside.txt"
    outside.parent.mkdir(parents=True)
    outside.write_text("secret", encoding="utf-8")
    task = SimpleNamespace(
        task_id="T002",
        file_path=tmp_path / "tasks" / "T002_escape.md",
        workspace_files=[
            {"source": "assets/T002/../../outside.txt", "dest": "inside.txt"},
        ],
    )

    asyncio.run(
        _stage_workspace_files(
            env=env,
            task=task,
            assets_dir=assets_dir,
            agent_name="test-agent",
            verbose=False,
        )
    )

    assert env.copies == []


def test_stage_workspace_files_rejects_symlink_source(tmp_path: Path) -> None:
    env = FakeEnv()
    assets_dir = tmp_path / "assets"
    source_dir = assets_dir / "T003" / "fixtures"
    source_dir.mkdir(parents=True)
    outside = tmp_path / "outside-secret.txt"
    outside.write_text("secret", encoding="utf-8")
    (source_dir / "safe.txt").write_text("safe", encoding="utf-8")
    (source_dir / "leak.txt").symlink_to(outside)
    task = SimpleNamespace(
        task_id="T003",
        file_path=tmp_path / "tasks" / "T003_symlink.md",
        workspace_files=[
            {"source": "fixtures", "dest": "fixtures"},
        ],
    )

    asyncio.run(
        _stage_workspace_files(
            env=env,
            task=task,
            assets_dir=assets_dir,
            agent_name="test-agent",
            verbose=False,
        )
    )

    assert env.copies == []


def test_stage_workspace_files_copies_valid_content_and_assets(tmp_path: Path) -> None:
    env = FakeEnv()
    assets_dir = tmp_path / "assets"
    asset = assets_dir / "T004" / "fixtures" / "input.txt"
    asset.parent.mkdir(parents=True)
    asset.write_text("data", encoding="utf-8")
    task = SimpleNamespace(
        task_id="T004",
        file_path=tmp_path / "tasks" / "T004_valid.md",
        workspace_files=[
            {"path": "notes//readme.txt", "content": "hello"},
            {"source": "fixtures/input.txt", "dest": "fixtures/input.txt"},
        ],
    )

    asyncio.run(
        _stage_workspace_files(
            env=env,
            task=task,
            assets_dir=assets_dir,
            agent_name="test-agent",
            verbose=False,
        )
    )

    assert env.writes == [(f"{WORKSPACE_ROOT}/notes/readme.txt", "hello")]
    assert env.commands == [f"mkdir -p {WORKSPACE_ROOT}/fixtures"]
    assert env.copies == [(asset.resolve(), f"{WORKSPACE_ROOT}/fixtures/input.txt")]
