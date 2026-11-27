#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

stage="$HOME/.cache/nx-nightly-gradle"

cache_has_shape() {
  local bins=("$stage"/wrapper/dists/*/*/gradle-*/bin/gradle)
  local marks=("$stage"/wrapper/dists/*/*/*.zip.ok)
  local metadata=("$stage"/caches/modules-2/metadata-*/module-artifact.bin)
  [[ -x "${bins[0]:-}" && -f "${marks[0]:-}" && -s "${metadata[0]:-}" &&
    -d "$stage/caches/modules-2/files-2.1" ]]
}

if [[ "$1" == install ]]; then
  if [[ "$CACHE_HIT" != true ]]; then
    echo "Root Gradle cache skipped because there was no exact hit"
  elif ! cache_has_shape; then
    echo "Root Gradle cache skipped because the archive layout is incomplete"
  else
    if ! python3 - "$stage" "${GRADLE_USER_HOME:-$HOME/.gradle}" <<'PYTHON'
import os
import sys
from pathlib import Path

source, home = map(Path, sys.argv[1:])
paths = ("wrapper/dists", "caches/modules-2")
for path in paths:
    destination = home / path
    if os.path.lexists(destination):
        print(f"Root Gradle cache skipped because {destination} already exists")
        sys.exit(0)
for path in paths:
    destination = home / path
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        (source / path).rename(destination)
    except OSError as error:
        print(f"Root Gradle cache installation stopped at {path}: {error}")
        break
    print(f"Installed Gradle cache path {path}")
PYTHON
    then
      echo "Root Gradle cache promotion failed"
    fi
  fi
  rm -rf -- "$stage"
  exit
fi
[[ "$1" == seed ]] || exit 2

seed=$(mktemp -d "$RUNNER_TEMP/nx-gradle-seed.XXXXXX")
trap 'rm -rf -- "$seed"' EXIT
# Gradle does not cache artifacts resolved through the runner's Maven-local repository.
export GRADLE_USER_HOME="$stage" GRADLE_OPTS="-Dmaven.repo.local=$seed/maven-local"
export NX_WORKSPACE_DATA_DIRECTORY="$seed/nx" NX_DAEMON=false NX_CACHE_PROJECT_GRAPH=false NX_NO_CLOUD=true

NX_MAVEN_DISABLE=true NX_GRADLE_PROJECT_GRAPH_TIMEOUT=240 node --input-type=module <<'CHECK_GRAPH'
import assert from 'node:assert/strict';
import { createProjectGraphAsync } from '@nx/devkit';

const { nodes, externalNodes } = await createProjectGraphAsync({ exitOnError: false });
for (const project of ['batch-runner', 'project-graph']) {
  const root = `packages/gradle/${project}`;
  const targets = Object.values(nodes).find(({ data }) => data.root === root)?.data.targets ?? {};
  assert(
    Object.hasOwn(targets, 'gradle:test-ci') &&
      Object.keys(targets).some((target) => target.startsWith('gradle:test-ci--')),
    `Gradle inference did not return split test targets for ${root}`
  );
}
const packages = new Set(
  Object.values(externalNodes ?? {})
    .filter(({ type }) => type === 'gradle')
    .map(({ data }) => data.packageName)
);
for (const artifact of [
  'org.junit.jupiter.junit-jupiter-api',
  'org.junit.jupiter.junit-jupiter-engine',
  'org.jetbrains.kotlin.kotlin-test',
]) {
  assert(packages.has(artifact), `Gradle inference did not resolve ${artifact}`);
}
CHECK_GRAPH

./gradlew --stop
# The stop command can return before the daemon finishes cache cleanup.
deadline=$((SECONDS + 15))
for log in "$GRADLE_USER_HOME"/daemon/*/daemon-*.out.log; do
  pid=${log##*/daemon-}
  pid=${pid%.out.log}
  while state=$(ps -o stat= -p "$pid") && [[ "$state" != Z* ]]; do
    if ((SECONDS >= deadline)); then
      echo "Gradle daemon $pid did not exit before cache staging" >&2
      exit 1
    fi
    sleep 0.2
  done
done

cache_has_shape
find "$stage/wrapper/dists" "$stage/caches/modules-2" -type f \
  \( -name '*.lock' -o -name '*.lck' -o -name gc.properties \) -delete
