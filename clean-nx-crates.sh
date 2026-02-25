#!/bin/bash
# Clean only nx workspace crates, not dependencies
for pkg in nx nx-types nx-utils-core nx-git nx-utils nx-glob nx-workspace nx-tasks nx-cache nx-watch nx-terminal nx-integrations nx-metrics nx-pty; do
  cargo clean -p $pkg 2>/dev/null || true
done
echo "Cleaned nx crates only"
