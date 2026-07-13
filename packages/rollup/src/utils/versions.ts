import { join } from 'path';
import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';

export const nxVersion = require(join('@nx/rollup', 'package.json')).version;
export const coreJsVersion = '^3.36.1';
// Floor for the generator-level support check. The plugin's runtime code only
// uses Rollup APIs available since v3, so v3 and v4 are both supported.
export const minSupportedRollupVersion = '3.0.0';
// Fresh-install version written when Rollup is not already present.
export const rollupVersion = '^4.59.0';
export const swcLoaderVersion = '0.1.15';
export const tsLibVersion = '^2.3.0';

export function assertSupportedRollupVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'rollup', minSupportedRollupVersion);
}
