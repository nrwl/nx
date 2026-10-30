import { join } from 'path';
export const nxVersion = require(
  join('@nx/conformance', 'package.json')
).version;

export const esbuildVersion = '^0.25.0';
