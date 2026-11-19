import { join } from 'path';
import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';

export const nxVersion = require(join('@nx/rolldown', 'package.json')).version;
// `rolldown/config`'s `loadConfig`, which inference relies on, is stable from 1.0.
export const minSupportedRolldownVersion = '1.0.0';
export const rolldownVersion = '^1.2.0';

export function assertSupportedRolldownVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'rolldown', minSupportedRolldownVersion);
}
