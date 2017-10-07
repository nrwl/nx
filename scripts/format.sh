#!/usr/bin/env bash

prettier --single-quote --print-width 120 --write '{packages,e2e}/**/*.ts'
