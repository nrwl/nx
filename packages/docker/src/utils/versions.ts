import { join } from 'path';
export const nxVersion = require(join('@nx/docker', 'package.json')).version;
