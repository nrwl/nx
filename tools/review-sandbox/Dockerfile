# Review sandbox base image.
#
# Builds nx (JS + its napi-rs Rust native module) and runs reproductions inside a
# gVisor/VM sandbox, so PR-authored code never builds or runs on the host during
# a code review. Used by the reproduce-verifier agent + the reproduce-issue skill.
#
# The toolchain is driven by the repo's own mise.toml — the single source of truth —
# so node / java / dotnet / maven / rust / bun / pnpm(corepack) stay in lockstep with
# what the repo actually uses. java + dotnet are required because nx dogfoods the
# @nx/dotnet and @nx/gradle plugins in its own project graph.
#
# Build from a MINIMAL context (only mise.toml) — not the repo root, which would ship the
# whole monorepo (node_modules/.git/dist) to the daemon:
#   mkdir -p tmp/review-sandbox-ctx && cp mise.toml tmp/review-sandbox-ctx/
#   docker build -t nx-review-sandbox:latest -f tools/review-sandbox/Dockerfile tmp/review-sandbox-ctx
FROM debian:bookworm-slim

# System libraries mise-managed tools do NOT provide:
#  - the nx napi-rs Rust native build needs a C/C++ toolchain (build-essential, clang,
#    libclang, pkg-config, libssl, python3);
#  - .NET needs libicu / krb5 / zlib at runtime;
#  - mise needs curl/git/unzip/xz/ca-certificates to fetch + extract toolchains.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential clang libclang-dev pkg-config libssl-dev python3 \
      git curl ca-certificates unzip xz-utils \
      libicu72 libgssapi-krb5-2 zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Install mise — the version manager the nx repo uses.
RUN curl -fsSL https://mise.run | sh
ENV PATH="/root/.local/bin:/root/.local/share/mise/shims:${PATH}" \
    MISE_YES=1

WORKDIR /work

# Bake the repo's pinned toolchain into the image (fast common case). At run time,
# `mise install` inside the PR checkout picks up any tool-version bumps the PR made.
COPY mise.toml /work/mise.toml
RUN mise trust /work/mise.toml \
    && mise install \
    && mise reshim \
    && mise ls

# Warm the pnpm content-addressable store from master's lockfile, so a review's
# `pnpm install` links out of the store instead of downloading ~4200 packages.
#
# The store is a CACHE, not a build output: the PR checkout still installs against its
# OWN lockfile, so entries it doesn't need are merely unused and new deps are fetched
# normally. node_modules is deliberately NOT baked — it must match the PR's lockfile
# exactly, master's changes most days, and a stale one fails in the worst direction
# (tests green against versions the PR never specified).
#
# All four files are needed; each omission fails differently:
#   package.json         corepack reads `packageManager` to activate the pinned pnpm.
#                        Without it corepack silently activates the LATEST pnpm.
#   pnpm-lock.yaml       what `pnpm fetch` resolves.
#   pnpm-workspace.yaml  declares patchedDependencies (and the catalog).
#   patches/             the directory must exist for the COPY below. Its contents matter
#                        only while pnpm-workspace declares patchedDependencies; without
#                        them the fetch aborts with ERR_PNPM_PATCH_FILE_PATH_MISSING.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /work/
COPY patches /work/patches
# Drop the release-age gate from this copy. It re-checks ~4850 lockfile entries against the
# registry on every build and starves the tarball fetches below until they abort. The gate
# governs policy, not resolution, so what gets fetched is unchanged.
RUN awk '/^minimumReleaseAge/ { skip=1; next } skip && /^[[:space:]]/ { next } { skip=0; print }' \
      /work/pnpm-workspace.yaml > /work/pnpm-workspace.next \
    && mv /work/pnpm-workspace.next /work/pnpm-workspace.yaml

# Large metadata documents (playwright-core and friends) take ~18 s alone and stretch
# well past pnpm's 60 s default under parallel load, which aborts the whole fetch.
# A longer ceiling with less concurrency completes where the default times out.
# Set as env rather than --config.*, which passes values as strings and trips pnpm's
# own numeric validation ("Expected `concurrency` to be a number ... got `8` (string)").
RUN corepack prepare --activate \
    && NPM_CONFIG_FETCH_TIMEOUT=600000 NPM_CONFIG_NETWORK_CONCURRENCY=8 \
       pnpm fetch --lockfile-dir /work \
    && rm -rf /work/node_modules \
    && pnpm store path
