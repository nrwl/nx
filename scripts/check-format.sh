#!/usr/bin/env bash

find packages/ -iname "*.ts" | xargs -n1 clang-format -output-replacements-xml | grep -c "<replacement " >/dev/null
if [ $? -ne 1 ]
then
    echo "Please run `yarn format`"
    exit 1;
fi

find e2e/ -iname "*.ts" | xargs -n1 clang-format -output-replacements-xml | grep -c "<replacement " >/dev/null
if [ $? -ne 1 ]
then
    echo "Please run `yarn format`"
    exit 1;
fi
