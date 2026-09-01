#!/usr/bin/env bash
#
# Emit one line per triage record status change, for the Monitor tool.
#
# Arm it after staging, then keep working — each approval, rejection or
# changes-requested note arrives as a notification instead of you polling
# `triage list`. Exits once every record has settled, which ends the watch.
#
#   Monitor(command: ".claude/skills/triage-issues/scripts/watch-triage.sh",
#           description: "triage review decisions", timeout_ms: 3600000)
#
# Env:
#   TRIAGE_DIR       record directory (default <repo>/.nx-issue-triage)
#   TRIAGE_POLL_SEC  poll interval, default 2
#
# Every terminal state emits, not just approvals — a watch that only reported
# approvals would be silent through a queue the user rejected outright, and
# silence is indistinguishable from "not started yet".
#
# State is kept in temp files rather than an associative array: macOS ships
# bash 3.2, where `declare -A` does not exist and numeric issue numbers would
# silently degrade into *indexed* array offsets instead of failing.

set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
DIR="${TRIAGE_DIR:-$ROOT/.nx-issue-triage}"
POLL="${TRIAGE_POLL_SEC:-2}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

field() { sed -n "s/^$2: *'\{0,1\}\(.*[^']\)'\{0,1\} *$/\1/p" "$1" 2>/dev/null | head -1; }

# First line of the reviewer's note, which is the part worth reading inline.
note_of() {
  awk '/^## Feedback/{f=1;next} f&&NF{print;exit}' "$1" 2>/dev/null | cut -c1-160
}

# "<issue><TAB><status>" per record, sorted so comm can diff two snapshots.
snapshot() {
  local f n st
  for f in "$DIR"/*.md; do
    [ -e "$f" ] || continue
    n="$(basename "$f" .md)"
    st="$(field "$f" status)"
    printf '%s\t%s\n' "$n" "${st:-unknown}"
  done | sort
}

count_pending() { grep -c "$(printf '\tpending$')" "$1" 2>/dev/null || true; }

if [ ! -d "$DIR" ]; then
  echo "triage watch: no records directory at $DIR — nothing staged yet"
  exit 0
fi

snapshot > "$TMP/prev"
total="$(wc -l < "$TMP/prev" | tr -d ' ')"
if [ "$total" -eq 0 ]; then
  echo "triage watch: 0 records staged in $DIR — nothing to watch"
  exit 0
fi

echo "triage watch armed: $total records, $(count_pending "$TMP/prev") pending — run 'pnpm triage-tui' to review"

while true; do
  sleep "$POLL"

  # The directory is gitignored and several agents share this checkout, so it
  # can be cleaned out from under a live review. That must be an event: going
  # quiet here would read as "the user hasn't started yet".
  if [ ! -d "$DIR" ]; then
    echo "triage watch STOPPED: $DIR disappeared — staged records were deleted, restage before applying"
    exit 1
  fi

  snapshot > "$TMP/cur"

  # Lines present in cur but not prev: a new record, or a changed status.
  comm -13 "$TMP/prev" "$TMP/cur" | while IFS="$(printf '\t')" read -r n st; do
    [ -n "$n" ] || continue
    title="$(field "$DIR/$n.md" title | cut -c1-70)"
    if ! cut -f1 "$TMP/prev" | grep -qx "$n"; then
      echo "#$n staged ($st) — ${title}"
      continue
    fi
    case "$st" in
      changes-requested)
        echo "#$n CHANGES REQUESTED — ${title}"
        note="$(note_of "$DIR/$n.md")"
        [ -n "$note" ] && echo "    note: $note"
        ;;
      rejected)  echo "#$n REJECTED — ${title}" ;;
      approved)  echo "#$n approved — ${title}" ;;
      applied)   echo "#$n applied to GitHub — ${title}" ;;
      failed)    echo "#$n APPLY FAILED — ${title}" ;;
      *)         echo "#$n -> $st — ${title}" ;;
    esac
  done

  mv "$TMP/cur" "$TMP/prev"

  if [ "$(count_pending "$TMP/prev")" -eq 0 ]; then
    a="$(grep -c "$(printf '\tapproved$')" "$TMP/prev" || true)"
    c="$(grep -c "$(printf '\tchanges-requested$')" "$TMP/prev" || true)"
    r="$(grep -c "$(printf '\trejected$')" "$TMP/prev" || true)"
    ap="$(grep -c "$(printf '\tapplied$')" "$TMP/prev" || true)"
    fa="$(grep -c "$(printf '\tfailed$')" "$TMP/prev" || true)"
    echo "triage queue settled: ${a} approved, ${c} changes-requested, ${r} rejected, ${ap} applied, ${fa} failed"
    [ "$c" -gt 0 ] && echo "    next: .claude/tools/triage feedback"
    [ "$a" -gt 0 ] && echo "    next: .claude/tools/triage apply"
    exit 0
  fi
done
