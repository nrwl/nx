import { join } from 'path';

// Dynamic join() form bypasses the eslint self-circular-import check while
// still resolving to the package's own package.json in both source and built
// (local-dist) contexts.
export const nxVersion = require(join('@nx/workspace', 'package.json')).version;

export const typescriptVersion = '~5.9.2';

// TODO: remove when preset generation is reworked and
// deps are not installed from workspace
export const angularCliVersion = '~21.2.0';
