#!/usr/bin/env bash
# Type-checks the native crate for wasm. `cargo check` never links, so it needs none
# of the wasi-sdk / cmake / sqlite machinery a full `pnpm build:wasm` does.
set -euo pipefail

# Keep in sync with the `build:wasm` script in package.json. `packages/nx/src/lib.rs`
# puts `wasi_ext` behind `#![feature]`, which stable rejects with E0554 before it
# typechecks anything, so a stable toolchain reports the wrong error here.
TOOLCHAIN=nightly-2026-03-01
TARGET=wasm32-wasip1-threads

if ! command -v rustup >/dev/null 2>&1; then
  echo "check-native-wasm needs rustup to provide $TOOLCHAIN. See https://rustup.rs." >&2
  exit 1
fi

if ! rustup toolchain list | grep -q "^$TOOLCHAIN"; then
  echo "Installing the $TOOLCHAIN toolchain (a few hundred MB under ~/.rustup, once)."
  rustup toolchain install "$TOOLCHAIN" --profile minimal --target "$TARGET"
elif ! rustup target list --toolchain "$TOOLCHAIN" --installed | grep -qx "$TARGET"; then
  rustup target add --toolchain "$TOOLCHAIN" "$TARGET"
fi

# napi-build reads this; nothing is linked, but the build script still resolves it.
export EMNAPI_LINK_DIR="$PWD/node_modules/emnapi/lib/wasm32-wasi-threads"

# `rustup run` rather than RUSTUP_TOOLCHAIN: mise puts its own non-shim `cargo` on
# PATH (the `rust` pin in mise.toml), and that one ignores RUSTUP_TOOLCHAIN.
exec rustup run "$TOOLCHAIN" cargo check -p nx --target "$TARGET"
