#!/usr/bin/env bash
##################################################
# This shell script is executed by nx-release.js #
##################################################

VERSION=$1
TAG=$2
LOCALBUILD=$3
PACKAGE_SOURCE=build/packages
NPM_DEST=build/npm
ORIG_DIRECTORY=`pwd`
NPM_REGISTRY=`npm config get registry` # for local releases

if [ "$LOCALBUILD" = "--local" ]; then
  echo
  echo "Publishing to npm registry $NPM_REGISTRY"

  if [[ ! $NPM_REGISTRY == http://localhost* ]]; then
    echo "------------------"
    echo "💣 WARNING 💣 => $NPM_REGISTRY does not look like a local registry!"
    echo "You may want to set registry with 'npm config set registry ...'"
    echo "------------------"
  fi
  
  read -p "Continue? (y/n)" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    [[ "$0" = "$BASH_SOURCE" ]] && exit 1 || return 1 # handle exits from shell or function but don't exit interactive shell
  fi
else
  echo "Publishing to public npm"

  # We are running inside of a child_process, so we need to reauth
  npm adduser
fi

for package in $NPM_DEST/*/
do

  PACKAGE_DIR="$(basename ${package})"
  cd $NPM_DEST/$PACKAGE_DIR

  PACKAGE_NAME=`node -e "console.log(require('./package.json').name)"`

  echo "Publishing ${PACKAGE_NAME}@${VERSION} --tag ${TAG}"

  if [ "$LOCALBUILD" = "--local" ]; then
    npm publish --tag $TAG --access public --registry=$NPM_REGISTRY
  else
    npm publish --tag $TAG --access public
  fi

  cd $ORIG_DIRECTORY
done

echo "Publishing complete"
