#!/usr/bin/env bash
set -euo pipefail

cache_root="$HOME/.cache/nx-nightly-maven"
wrapper_dists="$cache_root/wrapper/dists"
repository="$cache_root/repository"
zip_url='https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/4.0.0-rc-5/apache-maven-4.0.0-rc-5-bin.zip'
zip_sha256='966874253b2491c49240eafca01a04dd0d72c96de96e7bdc726248be4e9c33a7'

keys() {
  test -n "$WRAPPER_HASH"
  test -n "$REPOSITORY_HASH"
  test ! -e "$cache_root"
  test ! -L "$cache_root"
  printf 'wrapper=maven-wrapper-v2-%s-%s-%s-%s\n' "$RUNNER_OS" "$RUNNER_ARCH" "$WRAPPER_HASH" "$zip_sha256"
  printf 'repository=maven-repository-v1-%s-%s-%s\n' "$RUNNER_OS" "$RUNNER_ARCH" "$REPOSITORY_HASH"
}

install_cache() {
  local staging="$1" destination="$2"
  test -d "$staging" && test ! -L "$staging" || return 1
  if [[ -L "$destination" ]]; then
    return 1
  fi
  if [[ -e "$destination" ]]; then
    rmdir "$destination" || return 1
  fi
  mkdir -p "$(dirname "$destination")"
  mv "$staging" "$destination"
}

prepare_repository() {
  if [[ "$MODE" != prepare-writer ]]; then
    if [[ "$REPOSITORY_HIT" == true ]] && install_cache "$repository" "$HOME/.m2/repository"; then
      printf '%s\n' 'Installed Maven repository cache.'
    else
      printf '%s\n' 'Maven repository cache unavailable. Maven will use normal resolution.'
    fi
    return
  fi

  test ! -e target
  test -z "$(find packages/maven -type d -name target -print -quit)"
  if [[ "$REPOSITORY_HIT" != true || ! -d "$repository" || -L "$repository" ]]; then
    rm -rf "$repository"
    if [[ "$REPOSITORY_HIT" != true ]]; then
      printf 'seed-key=%s\n' "$REPOSITORY_KEY" >> "$GITHUB_OUTPUT"
    fi
  fi
  # The bootstrap probes MAVEN_REPO_LOCAL, while the Maven launcher reads MAVEN_ARGS.
  printf 'MAVEN_REPO_LOCAL=%s\nMAVEN_ARGS=%s -Dmaven.repo.local=%s\n' \
    "$repository" "${MAVEN_ARGS:-}" "$repository" >> "$GITHUB_ENV"
}

seed_wrapper() (
  local properties=.mvn/wrapper/maven-wrapper.properties stage
  test "$(sed -n 's/^distributionUrl=//p' "$properties")" = "$zip_url" || return 1
  command -v unzip >/dev/null || return 1

  stage="$(mktemp -d "${RUNNER_TEMP:?}/nx-maven-wrapper.XXXXXX")"
  trap 'rm -rf "$stage"' EXIT
  rm -rf "$wrapper_dists"
  mkdir -p "$stage/.mvn/wrapper"
  cp mvnw "$stage/mvnw"
  sed '/^distributionSha256Sum=/d' "$properties" > "$stage/$properties"
  printf '\ndistributionSha256Sum=%s\n' "$zip_sha256" >> "$stage/$properties"
  unset MVNW_REPOURL
  MAVEN_USER_HOME="$cache_root" "$stage/mvnw" --version
)

install_wrapper() {
  if install_cache "$wrapper_dists" "$HOME/.m2/wrapper/dists"; then
    printf '%s\n' 'Installed Maven wrapper distribution cache.'
  else
    printf '%s\n' 'Maven wrapper cache was not installed. The wrapper will use its normal setup.'
  fi
}

plugin_version() {
  python3 - <<'READ_POM'
from xml.etree import ElementTree

pom = ElementTree.parse('pom.xml')
version = pom.findtext(
    "./build/pluginManagement/plugins/plugin[groupId='dev.nx.maven'][artifactId='nx-maven-plugin']/version",
    namespaces={'': 'http://maven.apache.org/POM/4.0.0'},
)
print((version or '').strip())
READ_POM
}

seed_repository() {
  local version group artifact target report origin=central
  test "${MAVEN_REPO_LOCAL:-}" = "$repository"
  version="$(plugin_version)"
  [[ "$version" =~ ^[[:alnum:]][[:alnum:]._-]*$ ]]
  group="$repository/dev/nx/maven"
  artifact="$group/nx-maven-plugin/$version/nx-maven-plugin-$version.jar"
  target="packages/maven/maven-plugin/target"

  if [[ "$version" == *-SNAPSHOT || -e "$group" || -e "$target" ]]; then
    origin=source
    test -s "$artifact"
    grep -Fx "${artifact##*/}>=" "${artifact%/*}/_remote.repositories"
    cmp "$artifact" "$target/${artifact##*/}"
  fi

  # Maven 4 can resolve reactor artifacts from target/project-local-repo.
  find packages/maven -type d -name target -prune -exec rm -rf {} +
  rm -rf target
  report="$(mktemp "${RUNNER_TEMP:?}/nx-maven-analysis.XXXXXX")"
  ./mvnw dev.nx.maven:nx-maven-plugin:analyze -am --batch-mode --no-transfer-progress \
    "-DoutputFile=$report" "-DworkspaceRoot=$PWD" -DtargetNamePrefix=mvn:
  jq -e '
    any(.createNodesResults[]; .[1].projects | has("packages/maven/maven-plugin"))
    and any(.createDependenciesResults[]; .target | startswith("maven:"))
  ' "$report"

  if [[ "$origin" == source ]]; then
    rm -rf "$group"
  else
    test -s "$artifact"
    grep -Fx "${artifact##*/}>central=" "${artifact%/*}/_remote.repositories"
  fi
  if grep -rl --include='_remote.repositories' '>=$' "$repository"; then
    return 1
  else
    test "$?" = 1
  fi
  find "$repository" -type f \( -name '*.lastUpdated' -o -name resolver-status.properties \) -delete
  printf 'Verified Maven repository cache (%s).\n' "$origin"
}

case "$1" in
  keys) keys >> "$GITHUB_OUTPUT" ;;
  prepare-repository) prepare_repository ;;
  seed-wrapper) seed_wrapper ;;
  install-wrapper) install_wrapper ;;
  seed-repository) seed_repository ;;
  *) exit 2 ;;
esac
