#!/usr/bin/env bash

if [ -n "$1" ]; then
  jest --maxWorkers=1 ./build/packages/$1.spec.js
else
  jest --maxWorkers=1 ./build/packages/{schematics,bazel,builders,react,jest,web,node,express,nest,cypress,storybook,angular,workspace,tao,eslint-plugin-nx,next} --passWithNoTests
fi
