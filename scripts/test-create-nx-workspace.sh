#!/usr/bin/env bash

./scripts/link.sh
PUBLISHED_VERSION=$1 jest --maxWorkers=1 ./build/e2e/commands/create-nx-workspace.test.js
