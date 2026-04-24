#!/usr/bin/env bash
# sandkasten — autonomous engineering bot launcher
#
# Usage: bash engineer_command.sh [budget_minutes]
#
# Invoked by GeneralStaff's dispatcher. Creates a git worktree at
# .bot-worktree on branch bot/work, installs npm deps, runs claude -p
# inside it, exits. Cleanup + verification handled by dispatcher.

set -euo pipefail

BUDGET_MINUTES="${1:-30}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
WORKTREE_DIR="$PROJECT_ROOT/.bot-worktree"
BRANCH="${GENERALSTAFF_BOT_BRANCH:-bot/work}"

echo "=== sandkasten Bot Launcher ==="
echo "Budget: ${BUDGET_MINUTES} min"
echo "Project root: $PROJECT_ROOT"
echo "Worktree: $WORKTREE_DIR"
echo "Branch: $BRANCH"
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "================================="

if ! git -C "$PROJECT_ROOT" rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "Creating branch $BRANCH from main..."
  git -C "$PROJECT_ROOT" branch "$BRANCH" main
fi

git -C "$PROJECT_ROOT" worktree prune 2>/dev/null || true

if [ -d "$WORKTREE_DIR" ]; then
  echo "Stale worktree found — removing..."
  git -C "$PROJECT_ROOT" worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  rm -rf "$WORKTREE_DIR" 2>/dev/null || true
fi

echo "Creating worktree at $WORKTREE_DIR on $BRANCH..."
git -C "$PROJECT_ROOT" worktree add "$WORKTREE_DIR" "$BRANCH"

echo "Installing npm deps in worktree..."
cd "$WORKTREE_DIR"
npm install --silent 2>&1 | tail -5 || {
  echo "npm install failed — bot cycle will likely fail verification"
}

echo ""
echo "Launching autonomous claude -p in worktree..."
echo ""

claude -p "You are an autonomous engineering bot working on Sandkasten — an open-source WeGo naval/air/ground wargame simulation (Next.js 16, TypeScript, MapLibre GL JS, milsymbol, Playwright). Single-player end-to-end playable today: scenario editor, play mode, radar/ESM detection, fog of war, OPFOR AI, TCA scripting, combat resolution. Your job is Playwright-driven playtest hardening — does the core functionality actually work when clicked, do state transitions fire, do interactions render correctly.

## Your environment
Git worktree on $BRANCH. npm deps are installed. Do NOT touch the main working tree.

## Your task
Read \$GENERALSTAFF_ROOT/state/sandkasten/tasks.json. Pick highest-priority pending task that is NOT interactive_only. Skip any task flagged interactive_only: true. Work on exactly that task.

## What you can do
- Add or modify files under tests/ (Playwright E2E tests, *.spec.ts).
- Narrow bug fixes in src/ when a test discovers a real regression — document the fix in the commit body.
- Extend playwright.config.ts ONLY for test-infrastructure needs; port 3001 is hardcoded for a reason (Auftragstaktik collision), do not change it.
- Commit with a message starting with the task id.
- Mark task done via GS CLI:

    bun \"\$GENERALSTAFF_ROOT/src/cli.ts\" task done --project=sandkasten --task=<task-id>

## What you must NOT do
- Modify any file listed in GeneralStaff's projects.yaml hands_off for sandkasten: CLAUDE.md, GDD.md, SESSION_NOTES.md, TASKS.md, UX_ACCESSIBILITY_FIXES.md, INFOWAR_TESTING.md, DB_EXTRACTION_SPEC.md, playwright.config.ts (port 3001 is load-bearing), next.config.ts, data/ (scenario definitions — Ray's taste), package.json version bumps, .env*, Dockerfile.
- Invent new gameplay features. If a task requires new game mechanics, abandon with a note — that's interactive_only work.
- Change the simulation engine timing (20fps tick loop) without a clear task directive.
- Break any existing test — run npm test before commit, all 29 existing tests must still pass.

## Verification gate
npm test (Playwright, ~27s, headless Chromium). Dev server on port 3001 auto-starts. If any test fails after your changes, don't commit.

## Style
TypeScript strict. Match existing test style in tests/*.spec.ts. Assertions should be specific (not just 'element exists' — 'element has text X' or 'state transitions from A to B'). Commit messages: imperative, lowercase task-id prefix.

## Budget
${BUDGET_MINUTES} min total. Stop before expiring. One task per invocation — dispatcher starts a fresh cycle for the next.
" \
  --allowedTools "Read,Write,Edit,Bash,Grep,Glob" \
  --dangerously-skip-permissions \
  --mcp-config '{"mcpServers":{}}' \
  --strict-mcp-config \
  --output-format text

echo ""
echo "Bot finished. Exit code: $?"
echo "Ended: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
