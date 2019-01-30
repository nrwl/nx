#!/usr/bin/env bash

echo "Checking prettier"
prettier "**/*.{ts,js,json,css,scss,md}" "!**/{__name__,__directory__}/**" --list-different
PRETTIER_STATUS=$?

echo "Checking CRLF"
find scripts -type f -exec file "{}" ";" | grep CRLF
SCRIPTS_STATUS=$?

find packages -type f -exec file "{}" ";" | grep CRLF
PACKAGES_STATUS=$?

if [[ $PRETTIER_STATUS -eq 1 || $SCRIPTS_STATUS -eq 0 || $PACKAGES_STATUS -eq 0 ]]; then
  echo "Please run yarn format";
  exit 1;
fi
