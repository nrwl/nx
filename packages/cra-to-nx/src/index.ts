#!/usr/bin/env node

import { createNxWorkspaceForReact } from './lib/cra-to-nx';
import * as yargsParser from 'yargs-parser';

export * from './lib/cra-to-nx';

const args = yargsParser(process.argv);

createNxWorkspaceForReact(args).catch((e) => {
  console.log(e);
  process.exit(1);
});
