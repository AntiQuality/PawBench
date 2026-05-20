#!/usr/bin/env bash
# Wire pre-commit into this repo, chaining with the global AK scanner hooks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOOKS_DIR="$ROOT/.githooks"
AK_HOOKS="${AK_HOOKS:-$HOME/.aliyunAKScanHook/hooks}"

if ! command -v pre-commit >/dev/null 2>&1; then
  echo "pre-commit not found. Install with:" >&2
  echo "  pip install pre-commit ruff pyyaml   # or: pip install -r requirements-dev.txt" >&2
  exit 1
fi

mkdir -p "$HOOKS_DIR"
chmod +x "$HOOKS_DIR/pre-commit"

# Mirror other org hooks (commit-msg, pre-push, …) so local hooksPath does not drop them.
if [[ -d "$AK_HOOKS" ]]; then
  for hook in "$AK_HOOKS"/*; do
    name="$(basename "$hook")"
    [[ "$name" == "pre-commit" ]] && continue
    ln -sf "$hook" "$HOOKS_DIR/$name"
  done
  echo "[setup-pre-commit] chained AK scanner hooks from $AK_HOOKS"
else
  echo "[setup-pre-commit] AK hooks dir not found ($AK_HOOKS); only pre-commit hook installed" >&2
fi

git config --local core.hooksPath .githooks

# We cannot use `pre-commit install` when core.hooksPath is set (org policy).
# `.githooks/pre-commit` already calls `pre-commit run`; only fetch hook envs:
pre-commit install-hooks

echo "[setup-pre-commit] done — hooksPath=$(git config --local core.hooksPath)"
echo "Run: pre-commit run --all-files"
