#!/usr/bin/env bash

echo "Prettier"
prettier "**/*.{ts,js,json,css,scss,md}" "!**/{__name__,__directory__}/**" --write
