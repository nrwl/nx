#!/usr/bin/env bash
##################################################
# This shell script is executed by nx-release.js #
##################################################

SCHEMATICS_VERSION=$1
NX_VERSION=$2

./scripts/build.sh

cd build/packages
sed -i "" "s|exports.nxVersion = '\*';|exports.nxVersion = '$NX_VERSION';|g" schematics/src/lib-versions.js
sed -i "" "s|exports.schematicsVersion = '\*';|exports.schematicsVersion = '$SCHEMATICS_VERSION';|g" schematics/src/lib-versions.js


tar -czf nx.tgz nx
tar -czf schematics.tgz schematics
