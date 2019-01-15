#!/usr/bin/env bash
##################################################
# This shell script is executed by nx-release.js #
##################################################

SCHEMATICS_VERSION=$1
NX_VERSION=$2

./scripts/build.sh

cd build/packages

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i "" "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" schematics/src/lib-versions.js
    sed -i "" "s|exports.schematicsVersion = '\*';|exports.schematicsVersion = '$SCHEMATICS_VERSION';|g" schematics/src/lib-versions.js
else
    sed -i "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" schematics/src/lib-versions.js
    sed -i "s|exports.schematicsVersion = '\*';|exports.schematicsVersion = '$SCHEMATICS_VERSION';|g" schematics/src/lib-versions.js
fi


tar -czf nx.tgz nx
tar -czf schematics.tgz schematics
