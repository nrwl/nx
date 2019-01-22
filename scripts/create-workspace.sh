#!/usr/bin/env bash

./scripts/link.sh

cd tmp

../node_modules/.bin/ng new $1 --collection=@nrwl/schematics --no-interactive
rm -rf $1/node_modules/@nrwl
cp -a ../node_modules/@nrwl $1/node_modules/@nrwl
