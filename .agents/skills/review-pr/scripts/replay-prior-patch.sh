set -euo pipefail

OLD_MB=$1
PRIOR_SHA=$2
NEW_MB=$3
PATCH_TMP=$(mktemp -d)

# A separate index leaves the sandbox checkout and its real index unchanged.
export GIT_INDEX_FILE="$PATCH_TMP/index"
git read-tree "$NEW_MB"

set +e
git diff --binary --no-renames "$OLD_MB" "$PRIOR_SHA" \
  | git apply --cached --binary --3way --allow-empty \
    >"$PATCH_TMP/apply.out" 2>"$PATCH_TMP/apply.err"
PIPE_STATUSES=("${PIPESTATUS[@]}")
set -e
if [ "${PIPE_STATUSES[0]}" -ne 0 ]; then
  exit 20
fi
if [ "${PIPE_STATUSES[1]}" -ne 0 ]; then
  if [ "${PIPE_STATUSES[1]}" -eq 1 ]; then
    exit 10
  fi
  exit 20
fi

REPLAY_TREE=$(git write-tree)
if git diff --quiet "$REPLAY_TREE" HEAD; then
  exit 0
else
  DIFF_STATUS=$?
  if [ "$DIFF_STATUS" -ne 1 ]; then
    exit 20
  fi
fi

git diff --binary --no-renames "$REPLAY_TREE" HEAD
