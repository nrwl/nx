#!/usr/bin/env bash

echo "Prettier"
prettier "**/*.{ts,js,json,css,scss,md}" "!**/{__name__,__directory__}/**" --write

echo "Line endings"
find packages -type f -print0 | xargs -0 dos2unix
find scripts -type f -print0 | xargs -0 dos2unix
