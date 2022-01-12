#!/bin/bash

# This script is used in Vercel to determine whether to continue the build or not for nx-dev.
# Exits with 0 if the build should be skipped, and exits with 1 to continue.

APP=$1
NX_VERSION=$(node -e "console.log(require('./package.json').devDependencies['@nrwl/workspace'])")

# Need the workspace in order to run affected
yarn add -D @nrwl/workspace@$NX_VERSION --prefer-offline

# We don't have a good way to check from base due to Vercel's shallow clone
# TODO: Fix this once we figure out a better solution
npx nx affected:apps --plain --base HEAD~1 --head HEAD | grep $APP -q

STATUS=$?

#if [ $STATUS -eq 1 ]; then
#  echo "🛑 - Build cancelled"
#  exit 0
#elif [ $STATUS -eq 0 ]; then
  echo "✅ - Build can proceed"
  exit 1
#fi
