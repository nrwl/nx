#!/usr/bin/env bash

prettier --single-quote --print-width 120 --list-different '{packages,e2e}/**/*.ts'
