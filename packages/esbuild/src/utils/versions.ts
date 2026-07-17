import { join } from 'path';

export const nxVersion = require(join('@nx/esbuild', 'package.json')).version;

export const tsLibVersion = '^2.3.0';

export const minSupportedEsbuildVersion = '0.19.2';
