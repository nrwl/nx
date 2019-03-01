#!/usr/bin/env bash
##################################################
# This shell script is executed by nx-release.js #
##################################################

NX_VERSION=$1
ANGULAR_CLI_VERSION=$2

./scripts/build.sh

cd build/packages

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i "" "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" schematics/src/lib-versions.js
    sed -i "" "s|exports.schematicsVersion = '\*';|exports.schematicsVersion = '$NX_VERSION';|g" schematics/src/lib-versions.js
    sed -i "" "s|\*|$NX_VERSION|g" create-nx-workspace/package.json
    sed -i "" "s|NX_VERSION|$NX_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "" "s|NX_VERSION|$NX_VERSION|g" schematics/bin/create-nx-workspace.js
    sed -i "" "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" schematics/bin/create-nx-workspace.js
else
    sed -i "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" schematics/src/lib-versions.js
    sed -i "s|exports.schematicsVersion = '\*';|exports.schematicsVersion = '$NX_VERSION';|g" schematics/src/lib-versions.js
    sed -i "s|\*|$NX_VERSION|g" create-nx-workspace/package.json
    sed -i "s|NX_VERSION|$NX_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" create-nx-workspace/bin/create-nx-workspace.js
    sed -i "s|NX_VERSION|$NX_VERSION|g" schematics/bin/create-nx-workspace.js
    sed -i "s|ANGULAR_CLI_VERSION|$ANGULAR_CLI_VERSION|g" schematics/bin/create-nx-workspace.js
fi


tar -czf nx.tgz nx
tar -czf schematics.tgz schematics
tar -czf create-nx-workspace.tgz create-nx-workspace
