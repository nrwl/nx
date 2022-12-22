#!/usr/bin/env bash

COMMAND=$1

if [[ $COMMAND == "enable" ]]; then
	echo "Setting registry to local registry"
	echo "To Disable: yarn local-registry disable"
	npm config set registry http://localhost:4873/ --location user
	yarn config set registry http://localhost:4873/
fi

if [[ $COMMAND == "disable" ]]; then
	npm config delete registry --location user
	yarn config delete registry
	CURRENT_NPM_REGISTRY=$(npm config get registry --location user)
	CURRENT_YARN_REGISTRY=$(yarn config get registry)

	echo "Reverting registries"
	echo "  > NPM:  $CURRENT_NPM_REGISTRY"
	echo "  > YARN: $CURRENT_YARN_REIGSTRY"
fi

if [[ $COMMAND == "clear" ]]; then
	echo "Clearing Local Registry"
	rm -rf ./build/local-registry/storage
fi

if [[ $COMMAND == "start" ]]; then
	echo "Starting Local Registry"
	VERDACCIO_HANDLE_KILL_SIGNALS=true
	yarn verdaccio --config ./.verdaccio/config.yml
fi
