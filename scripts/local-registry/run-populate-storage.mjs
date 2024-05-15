// @ts-check

import { populateLocalRegistryStorage } from './populate-storage.js';

/**
 * This script is primarily intended to run as part of e2e-ci,
 * so we want to capture the full logs of the local release.
 */
process.env.NX_VERBOSE_LOGGING = 'true';

await populateLocalRegistryStorage();
