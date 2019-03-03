#!/usr/bin/env bash
##################################################
# This shell script is executed by nx-release.js #
##################################################

VERSION=$1
TAG=$2
PACKAGE_SOURCE=build/packages
NPM_DEST=build/npm
ORIG_DIRECTORY=`pwd`

# We are running inside of a child_process, so we need to reauth
npm adduser

for package in $NPM_DEST/*/
do

  PACKAGE_DIR="$(basename ${package})"
  cd $NPM_DEST/$PACKAGE_DIR

  PACKAGE_NAME=`node -e "console.log(require('./package.json').name)"`

  echo "Publishing ${PACKAGE_NAME}@${VERSION} --tag ${TAG}"
  npm publish --tag $TAG --access public

  cd $ORIG_DIRECTORY
done

echo "Publishing complete"
