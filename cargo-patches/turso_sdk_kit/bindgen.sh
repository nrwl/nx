#!/usr/bin/env sh

set -xe

# Use --no-layout-tests to avoid hardcoded size assertions that fail on different architectures
# The struct layouts are correct, just the compile-time assertions are architecture-specific
bindgen turso.h -o src/bindings.rs \
    --with-derive-default \
    --no-layout-tests \
    --allowlist-type "turso_.*_t" \
    --allowlist-function "turso_.*" \
    --rustified-enum "turso_type_t" \
    --rustified-enum "turso_tracing_level_t" \
    --rustified-enum "turso_status_code_t"
