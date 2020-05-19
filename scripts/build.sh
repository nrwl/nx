#!/usr/bin/env bash
rm -rf build
nx run-many --target=build --all --parallel

echo "Compiling e2e tests"
rm -rf build/e2e
./node_modules/.bin/tsc -p e2e/tsconfig.e2e.json
cp -rf build/e2e-out/e2e build/e2e
cp e2e/local-registry/config.yml build/e2e/local-registry/config.yaml
cp e2e/local-registry/htpasswd build/e2e/local-registry/htpasswd
