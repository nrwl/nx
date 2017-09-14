#!/bin/bash

rm -rf build
ngc
rsync -a --exclude=*.ts packages/ build/packages
