#!/usr/bin/env bash

find src/ -iname *.ts| xargs clang-format -i
find e2e/ -iname *.ts| xargs clang-format -i
