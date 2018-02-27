#!/usr/bin/env node
import { affected } from './affected';
import { format } from './format';
import { update } from './update';
import { patchNg } from './patch-ng';

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'affected':
    affected(args);
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
  case 'postinstall':
    patchNg();
    update(['check']);
    break;
  default:
    throw new Error(`Unrecognized command '${command}'`);
}
