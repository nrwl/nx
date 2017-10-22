#!/usr/bin/env bash

# This script will:
# - Run the package script
# - copy built packages into new directory, so as to not mutate in place
# - NOT change the version of the root package.json
# - set all built package versions to value provided in the command line OR the version in the root package.json
# - validate that the supplied version is a valid npm version according to the semver spec
# - check that npm does not already have this version published for ANY package
# - publish all packages in the build/packages directory to npm
# - publish to the provided tag OR `latest` by default

# i.e. ./scripts/publish.sh 1.0.0-beta.1 beta
VERSION=$1
TAG=$2
PACKAGE_SOURCE=build/packages
NPM_DEST=build/npm
ORIG_DIRECTORY=`pwd`

# Grab version from package.json if not provided as 1st arg
if [ -z "$VERSION" ]; then
  VERSION=`node -e "console.log(require('./package.json').version)"`
fi

# Validate that the version is valid according to semver
VERSION=`node -e "console.log(require('semver').valid('${VERSION}'))"`

if [ "$VERSION" = "null" ]; then
  echo "Version $VERSION is not valid semver"
  exit 1
fi

if [ -z "$TAG" ]; then
  TAG="latest"
fi

./scripts/package.sh $VERSION $VERSION

# Create working directory and copy over built packages
rm -rf $NPM_DEST
mkdir -p $NPM_DEST
cp -R $PACKAGE_SOURCE/* $NPM_DEST/

# Get rid of tarballs at top of copied directory (made with npm pack)
find $NPM_DEST -name *.tgz -maxdepth 1 -delete

for package in $NPM_DEST/*/
do

  PACKAGE_DIR="$(basename ${package})"
  cd $NPM_DEST/$PACKAGE_DIR
  # Check that the new version for the package is not taken
  PACKAGE_NAME=`node -e "console.log(require('./package.json').name)"`
  echo "Preparing to publish ${PACKAGE_NAME}"
  # Package might not exist yet, so suppress errors if so
  PACKAGE_INFO=`npm view ${PACKAGE_NAME}@${VERSION} 2> /dev/null`
  if [ -z "$PACKAGE_INFO"]; then
    echo "Package ${PACKAGE_NAME} not yet published. Okay to proceed."
  elif [ "$PACKAGE_INFO" = "undefined" ]; then
    echo "Package ${PACKAGE_NAME} not yet published at ${VERSION}. Okay to proceed."
  else
    echo "package ${PACKAGE_NAME} has already been published at ${VERSION}"
    exit 1
  fi

  # Set the package.json version for the package
  npm version $VERSION

  echo "Publishing ${PACKAGE_NAME}@${VERSION} --tag ${TAG}"
  npm publish --tag $TAG

  cd $ORIG_DIRECTORY
done

echo "Publishing complete"
