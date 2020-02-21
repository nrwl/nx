#!/usr/bin/env bash

ENABLE=$1

if [[ $ENABLE == "enable" ]]; then
	echo "Setting registry to local registry"
	echo "To Disable: yarn local-registry disable"
	npm config set registry http://localhost:4873/
	yarn config set registry http://localhost:4873/
fi

if [[ $ENABLE == "disable" ]]; then
	npm config delete registry
	yarn config delete registry
	CURRENT_NPM_REGISTRY=`npm config get registry`
	CURRENT_YARN_REGISTRY=`yarn config get registry`

	echo "Reverting registries"
	echo "  > NPM:  $CURRENT_NPM_REGISTRY"
	echo "  > YARN: $CURRENT_YARN_REIGSTRY"
fi

if [[ $ENABLE == "start" ]]; then
  echo "Starting Local Registry"
  npx verdaccio
fi
