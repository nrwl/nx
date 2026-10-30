import { join } from 'path';
export const nxVersion = require(join('@nx/owners', 'package.json')).version;
