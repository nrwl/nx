#!/bin/bash

rm -rf build
rm -rf tmp
tsc
rsync -a --exclude=*.ts src/ build/src
