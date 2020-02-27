#!/usr/bin/env bash

if [ -n "$1" ]; then
  jest --maxWorkers=1 ./build/packages/$1.spec.js
else
  jest --maxWorkers=1 ./build/packages/{bazel,react,jest,web,node,express,nest,cypress,storybook,angular,workspace,tao,eslint-plugin-nx,linter,next,nx-plugin} --passWithNoTests
fi
