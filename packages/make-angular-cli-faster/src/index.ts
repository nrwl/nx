#!/usr/bin/env node

import * as yargsParser from 'yargs-parser';
import {
  Args,
  makeAngularCliFaster,
} from './utilities/make-angular-cli-faster';

const args = yargsParser(process.argv, {
  string: ['version'],
  boolean: ['verbose', 'useNxCloud'],
});

makeAngularCliFaster(args as Args).catch((e) => {
  console.log(e);
  process.exit(1);
});
