import { join } from 'path';
export const nxVersion = require(
  join('@nx/conformance', 'package.json')
).version;
