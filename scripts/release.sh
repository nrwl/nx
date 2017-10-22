#!/usr/bin/env bash

./scripts/package.sh "nrwl/schematics-build" "nrwl/nx-build"

function restore() {
  echo "FINISHED"
  cd $STARTING_DIRECTORY
}

function getPackageVersion() {
  echo `node -e "console.log(require('./package.json').version)"`
}

#Rewrite the version in the package.json to be root package version+short sha (0.0.1+abcdef0)
function updatePackageVersion() {
  PACKAGE_NAME=$1
  VERSION=$2
  node -e "const pkgPath='./${PACKAGE_NAME}/package.json';const pkg=require(pkgPath);pkg.version='${VERSION}'; fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2)+'\n')"
}

STARTING_DIRECTORY=${PWD}
SHORT_SHA=`git rev-parse --short HEAD`
BRANCH_NAME=pub-${SHORT_SHA}
PACKAGE_VERSION=`getPackageVersion`
BUILT=../packages
BUILD_VER="${PACKAGE_VERSION}+${SHORT_SHA}"
trap restore SIGINT SIGTERM EXIT

mkdir -p build/git-clones
cd build/git-clones

for dir in $BUILT/*/
do
  PACKAGE_DIR="$(basename ${dir})"
  BUILD_ARTIFACTS="${dir}"
  REPO_DIR="${PACKAGE_DIR}-build"

  rm -rf $REPO_DIR
  mkdir -p $REPO_DIR
  # Create directory and populate with shallow git content from origin
  (cd $REPO_DIR &&
    git init && \
    git remote add origin git@github.com:nrwl/$REPO_DIR.git && \
    git fetch origin master --depth=1 && \
    git checkout origin/master && \
    git checkout -b $BRANCH_NAME
  )

  # Clean up the contents of the git directory so creating the commit will
  # be simpler (not having to selectively delete files)
  rm -rf $REPO_DIR/*
  cp -R ${BUILD_ARTIFACTS}/* $REPO_DIR/
  updatePackageVersion $REPO_DIR $BUILD_VER

  (
    cd $REPO_DIR && \
    git add --all && \
    git commit -m "publishing ${BUILD_VER}" --quiet && \
    git tag "${BUILD_VER}" && \
    git push origin $BRANCH_NAME:master --tags --force
  )
done
