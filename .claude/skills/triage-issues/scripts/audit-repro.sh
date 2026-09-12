#!/usr/bin/env bash
# Flag staged records that skipped a reproduction without one of the two reasons
# that permit it: an open linked PR, or `blocked: repro needed`.
#
#   scripts/audit-repro.sh                 # audit the live queue
#   TRIAGE_DIR=/tmp/q scripts/audit-repro.sh
#
# Exits non-zero when any record needs a run, so a sweep can gate on it.
set -uo pipefail

DIR="${TRIAGE_DIR:-.nx-issue-triage}"
[ -d "$DIR" ] || { echo "no records at $DIR"; exit 0; }

gaps=0
for f in "$DIR"/*.md; do
  [ -e "$f" ] || break
  n=$(basename "$f" .md)

  # An enhancement, feature or question has no defect to reproduce. Only bugs
  # are held to the run-it rule.
  if grep -qE "^  - 'type: (enhancement|feature|question)" "$f"; then
    printf "n/a   #%s  not a bug report\n" "$n"
    continue
  fi

  repro=$(sed -n 's/^repro: .//p' "$f")
  case "$repro" in
    [Nn]ot\ run*|[Nn]ot\ attempted*|"") skipped=yes ;;
    *) skipped=no ;;
  esac
  [ "$skipped" = no ] && continue

  pr=$(sed -n "s/^linked_pr: '\(.*\)'/\1/p" "$f")
  blocked=$(grep -c "^  - 'blocked: repro needed'" "$f")

  if [ -n "$pr" ]; then
    printf "ok    #%s  not run, PR #%s open\n" "$n" "$pr"
  elif [ "$blocked" -gt 0 ]; then
    printf "ok    #%s  not run, blocked: repro needed\n" "$n"
  else
    printf "GAP   #%s  not run, but no linked PR and no blocker -- run it\n" "$n"
    printf "        reason given: %.140s\n" "$repro"
    gaps=$((gaps + 1))
  fi
done

echo
if [ "$gaps" -gt 0 ]; then
  echo "$gaps record(s) skipped a reproduction without a reason that permits it."
  echo "See 'The excuses that have actually been used' in SKILL.md before accepting any of them."
  exit 1
fi
echo "no gaps: every skipped reproduction has a linked PR or a blocker."
