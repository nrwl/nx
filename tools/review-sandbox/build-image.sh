#!/usr/bin/env bash
# Build the review sandbox image, bringing it up to date if anything it depends on moved.
#
# Called unconditionally by review-pr's pre-flight and by setup-review-sandbox, because
# "does the image exist?" is the wrong question: an image built from any older revision
# answers yes, so a missing capability is invisible until a review is mysteriously slow.
# Docker's layer cache makes the unconditional build ~0.6 s when nothing changed, and
# BuildKit deduplicates identical concurrent builds, so the five parallel review-prs panes
# need no lock of their own.
set -euo pipefail

IMAGE="${SANDBOX_IMAGE:-nx-review-sandbox:latest}"
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ctx="$repo_root/tmp/review-sandbox-ctx"

# Minimal context — never the repo root, which would ship node_modules/.git/dist (many GB)
# to the daemon. All five entries are load-bearing; the Dockerfile says what each omission
# breaks. Rebuilt from scratch so a stale copy of a since-changed lockfile cannot linger.
rm -rf "$ctx"
mkdir -p "$ctx"
cp "$repo_root"/{mise.toml,package.json,pnpm-lock.yaml,pnpm-workspace.yaml} "$ctx/"
cp -r "$repo_root/patches" "$ctx/"

# Image ID before/after is exact, where grepping the log for "CACHED" is a guess.
before=$(docker images -q "$IMAGE" 2>/dev/null || true)

if docker build -t "$IMAGE" -f "$repo_root/tools/review-sandbox/Dockerfile" "$ctx" \
     >"$ctx/build.log" 2>&1; then
  after=$(docker images -q "$IMAGE" 2>/dev/null || true)
  # Say something either way: a review that pauses here should be self-explanatory.
  if [ -n "$before" ] && [ "$before" = "$after" ]; then
    echo "sandbox image up to date"
  else
    echo "sandbox image rebuilt (${before:-none} -> $after)"
  fi
  exit 0
fi

echo "sandbox image build FAILED — last 20 lines:"
tail -20 "$ctx/build.log"
exit 1
