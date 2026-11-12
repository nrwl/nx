#!/bin/sh
# Builds the Linux shim, the spike addon and the test fixtures.
set -e
cd "$(dirname "$0")"
# The repo's .cargo/config.toml redirects target-dir; keep this spike self-contained.
node ../../scripts/build-fstrace-shim.mjs
cargo build --release --target-dir target
cp target/release/libfstrace_addon.so fstrace.node
mkdir -p bin
gcc -O2 fixtures/openloop.c -o bin/openloop
gcc -O2 -static fixtures/openloop.c -o bin/openloop-static
(cd fixtures && CGO_ENABLED=0 go build -o ../bin/readfile-go readfile.go)
