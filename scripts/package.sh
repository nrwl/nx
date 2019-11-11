#!/usr/bin/env bash
##################################################
# This shell script is executed by nx-release.js #
##################################################

NX_VERSION=$1
ANGULAR_CLI_VERSION=$2
TYPESCRIPT_VERSION=$3

if [[ $NX_VERSION == "--local" ]]; then
    NX_VERSION="*"
fi

./scripts/build.sh

cd build/packages

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i "" "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" {react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace}/src/utils/versions.js
    sed -i "" "s|\*|$NX_VERSION|g" {schematics,react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace,cli,linter,tao,eslint-plugin-nx,create-nx-workspace}/package.json
    sed -i "" "s|NX_VERSION|$NX_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|TYPESCRIPT_VERSION|$TYPESCRIPT_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
else
    sed -i "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" {react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace}/src/utils/versions.js
    sed -i "s|\*|$NX_VERSION|g" {schematics,react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace,cli,linter,tao,eslint-plugin-nx,create-nx-workspace}/package.json
    sed -i "s|NX_VERSION|$NX_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|TYPESCRIPT_VERSION|$TYPESCRIPT_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
fi

if [[ $NX_VERSION == "*" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -E -i "" "s|\"@nrwl\/([^\"]+)\": \"\\*\"|\"@nrwl\/\1\": \"file:$PWD\/\1\"|" {schematics,jest,web,react,next,node,express,nest,cypress,storybook,angular,workspace,linter,cli,tao,eslint-plugin-nx,create-nx-workspace}/package.json
    else
    echo $PWD
        sed -E -i "s|\"@nrwl\/([^\"]+)\": \"\\*\"|\"@nrwl\/\1\": \"file:$PWD\/\1\"|" {schematics,jest,web,react,next,node,express,nest,cypress,storybook,angular,workspace,linter,cli,tao,eslint-plugin-nx,create-nx-workspace}/package.json
    fi
fi
