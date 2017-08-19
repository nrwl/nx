#!/usr/bin/env bash

./scripts/build.sh
cp package.json build/src/package.json
cp README.md build/src/README.md
cp LICENSE build/src/LICENSE
