#!/usr/bin/env bash

if [ -z "$(git status --porcelain ./docs)" ]; then
  echo "📄 Documentation not modified";
  exit 0;
else
  echo "📄 Documentation has been modified, you need to commit the changes.";
  git status --porcelain ./docs
  exit 1;
fi