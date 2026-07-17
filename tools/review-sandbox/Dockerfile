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
# Build from the repo root so mise.toml is in the build context:
#   docker build -t nx-review-sandbox:latest -f tools/review-sandbox/Dockerfile .
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
