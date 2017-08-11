#!/bin/bash

rm -rf build
tsc
rsync -a --exclude=*.ts src/ build/src
