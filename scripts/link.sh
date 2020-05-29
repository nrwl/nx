#!/usr/bin/env bash

if [ "$1" = "fast" ]; then
  ./scripts/build-for-test.sh
fi

if [ "$1" != "fast" ]; then
  ./scripts/package.sh $1
fi

rm -rf node_modules/@nrwl

cp -r build/packages node_modules/@nrwl
