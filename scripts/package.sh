#!/usr/bin/env bash
##################################################
# This shell script is executed by nx-release.js #
##################################################

NX_VERSION=$1
ANGULAR_CLI_VERSION=$2
TYPESCRIPT_VERSION=$3
PRETTIER_VERSION=$4

if [[ $NX_VERSION == "--local" ]]; then
    NX_VERSION="*"
fi

nx run-many --target=build --all --parallel

cd build/packages

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i "" "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" {react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace}/src/utils/versions.js
    sed -i "" "s|\*|$NX_VERSION|g" {react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace,cli,linter,bazel,tao,eslint-plugin-nx,create-nx-workspace,create-nx-plugin,nx-plugin}/package.json
    sed -i "" "s|NX_VERSION|$NX_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|TYPESCRIPT_VERSION|$TYPESCRIPT_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|PRETTIER_VERSION|$PRETTIER_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|NX_VERSION|$NX_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
    sed -i "" "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
    sed -i "" "s|TYPESCRIPT_VERSION|$TYPESCRIPT_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
    sed -i "" "s|PRETTIER_VERSION|$PRETTIER_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
else
    sed -i "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" {react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace}/src/utils/versions.js
    sed -i "s|\*|$NX_VERSION|g" {react,next,web,jest,node,express,nest,cypress,storybook,angular,workspace,cli,linter,bazel,tao,eslint-plugin-nx,create-nx-workspace,create-nx-plugin,nx-plugin}/package.json
    sed -i "s|NX_VERSION|$NX_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|TYPESCRIPT_VERSION|$TYPESCRIPT_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|PRETTIER_VERSION|$PRETTIER_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|NX_VERSION|$NX_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
    sed -i "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
    sed -i "s|TYPESCRIPT_VERSION|$TYPESCRIPT_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
    sed -i "s|PRETTIER_VERSION|$PRETTIER_VERSION|g" create-nx-plugin/bin/create-nx-plugin.js
fi

if [[ $NX_VERSION == "*" ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -E -i "" "s|\"@nrwl\/([^\"]+)\": \"\\*\"|\"@nrwl\/\1\": \"file:$PWD\/\1\"|" {jest,web,react,next,node,express,nest,cypress,storybook,angular,workspace,linter,bazel,cli,tao,eslint-plugin-nx,create-nx-workspace,create-nx-plugin,nx-plugin}/package.json
    else
    echo $PWD
        sed -E -i "s|\"@nrwl\/([^\"]+)\": \"\\*\"|\"@nrwl\/\1\": \"file:$PWD\/\1\"|" {jest,web,react,next,node,express,nest,cypress,storybook,angular,workspace,linter,bazel,cli,tao,eslint-plugin-nx,create-nx-workspace,create-nx-plugin,nx-plugin}/package.json
    fi
fi
