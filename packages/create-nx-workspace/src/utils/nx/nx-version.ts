import { join } from 'path';

export const nxVersion = require(
  join('create-nx-workspace', 'package.json')
).version;
