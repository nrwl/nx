#!/usr/bin/env bash

if [ $# -eq 0 ]
then
    echo "Please provide project name"
    exit 1;
fi

CWD=$PWD
WORK_DIR=`mktemp -d`

echo 'Creating a sandbox with the CLI and Nx Schematics...'
touch $WORK_DIR/package.json
echo '{"dependencies": {"@angular/cli": "1.5.0-rc.0", "@nrwl/schematics": "^0.0.7"}}' > $WORK_DIR/package.json

cd $WORK_DIR
npm install --silent

echo 'Creating a new project...'
cd $CWD
$WORK_DIR/node_modules/.bin/ng new $1 --collection=@nrwl/schematics

rm -rf $WORK_DIR
