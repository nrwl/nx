#!/usr/bin/env bash

find packages/ -iname "*.ts" | xargs clang-format -i
find e2e/ -iname "*.ts" | xargs clang-format -i
