#!/usr/bin/env bash
#
# Run create-nx-workspace against every CNW template, non-interactively.
#
# Each template clones into its own subdirectory under an output base dir, so
# no two runs collide ("The directory '<name>' already exists" -> CnwError
# DIRECTORY_EXISTS). Existing per-template dirs are removed before each run so
# the script is idempotent.
#
# Usage:
#   ./run-all-templates.sh [OUTPUT_DIR]
#
# Env:
#   CNW_VERSION   create-nx-workspace version/tag (default: latest)
#   ONLY          space-separated subset of template repos to run
#
# Examples:
#   ./run-all-templates.sh
#   CNW_VERSION=22.7.0 ./run-all-templates.sh /tmp/cnw-out
#   ONLY="nextjs-template react-template" ./run-all-templates.sh

set -uo pipefail

CNW_VERSION="${CNW_VERSION:-latest}"
OUTPUT_DIR="${1:-$PWD/cnw-runs-$(date +%Y%m%d-%H%M%S)}"

# Template GitHub repos under the nrwl org. --template requires the full
# nrwl/<repo> form except for the 4 shorthands (empty/react/angular/typescript).
# Listing the full repo name for all keeps it uniform.
TEMPLATES=(
  empty-template
  typescript-template
  react-template
  angular-template
  react-mfe-template
  nextjs-template
  nestjs-template
  express-api-template
  astro-starlight-template
  remotion-template
  tanstack-start-template
  tanstack-ai-template
)

if [ -n "${ONLY:-}" ]; then
  # shellcheck disable=SC2206
  TEMPLATES=($ONLY)
fi

mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR" || exit 1

echo "CNW version : $CNW_VERSION"
echo "Output dir  : $OUTPUT_DIR"
echo "Templates   : ${#TEMPLATES[@]}"
echo

declare -a PASS=()
declare -a FAIL=()

for repo in "${TEMPLATES[@]}"; do
  # workspace name = repo without the -template suffix (valid npm pkg name)
  name="${repo%-template}"
  target="$OUTPUT_DIR/$name"

  echo "=================================================================="
  echo ">> $repo  ->  $name"
  echo "=================================================================="

  # avoid DIRECTORY_EXISTS: clear any prior run for this template
  rm -rf "$target"

  CI=true npx --yes "create-nx-workspace@${CNW_VERSION}" "$name" \
    --template "nrwl/$repo" \
    --nxCloud=skip \
    --no-interactive

  if [ $? -eq 0 ] && [ -d "$target" ]; then
    PASS+=("$repo")
    echo "OK: $repo"
  else
    FAIL+=("$repo")
    echo "FAILED: $repo"
  fi
  echo
done

echo "=================================================================="
echo "SUMMARY"
echo "=================================================================="
echo "Passed (${#PASS[@]}): ${PASS[*]:-none}"
echo "Failed (${#FAIL[@]}): ${FAIL[*]:-none}"
echo "Output: $OUTPUT_DIR"

[ ${#FAIL[@]} -eq 0 ]
