#!/usr/bin/env bash

./scripts/build.sh

cd build/packages

tar -czf bazel.tgz bazel
tar -czf nx.tgz nx
tar -czf schematics.tgz schematics
