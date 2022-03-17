#!/usr/bin/env bash
echo "Publishing make-angular-cli-faster@$1"

nx build make-angular-cli-faster
cd dist/projects/make-angular-cli-faster

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i "" "s|REPLACE|$1|g" package.json
else
    sed -i "s|REPLACE|$1|g" package.json
fi

npm adduser
npm publish --access public --tag latest

