#!/usr/bin/env node
import * as yargsParser from 'yargs-parser';

import { affected } from './affected';
import { format } from './format';
import { update } from './update';
import { patchNg } from './patch-ng';
import { lint } from './lint';
import { workspaceSchematic } from './workspace-schematic';
import { generateGraph } from './dep-graph';
import { parseArgs } from '../utils/cli-config-utils';
import { setAppRootPath } from '../utils/app-root-path';

const { command, appRoot } = parseArgs();
const args = process.argv.slice(3);

if (appRoot) {
  setAppRootPath(appRoot);
}

switch (command) {
  case 'affected':
    affected(args);
    break;
  case 'dep-graph':
    generateGraph(yargsParser(args));
    break;
  case 'format':
    format(args);
    break;
  case 'migrate': // TODO: delete this after 1.0
    update(args);
    break;
  case 'update':
    update(args);
    break;
  case 'lint':
    lint();
    break;
  case 'postinstall':
    patchNg();
    update(['check']);
    break;
  case 'workspace-schematic':
    workspaceSchematic(args);
    break;
  default:
    throw new Error(`Unrecognized command '${command}'`);
}
