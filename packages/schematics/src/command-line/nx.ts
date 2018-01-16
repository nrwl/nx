#!/usr/bin/env node
import { affected } from './affected';
import { format } from './format';
import { migrate } from './migrate';

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'affected':
    affected(args);
    break;
  case 'format':
    format(args);
    break;
  case 'migrate':
    migrate();
    break;
  default:
    throw new Error(`Unrecognized command '${command}'`);
}
