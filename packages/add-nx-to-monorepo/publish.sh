#!/usr/bin/env bash
echo "Publishing add-nx-to-monorepo@$1"

nx build add-nx-to-monorepo
cd dist/projects/add-nx-to-monorepo

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i "" "s|REPLACE|$1|g" package.json
else
    sed -i "s|REPLACE|$1|g" package.json
fi

npm adduser
npm publish --access public --tag latest

